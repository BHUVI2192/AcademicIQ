-- ============================================================================
-- Migration 053: Fix approve/reject marks functions — add SECURITY DEFINER
-- ============================================================================
-- Problem: approve_marks_for_test and reject_marks_for_test were defined
-- WITHOUT SECURITY DEFINER. When called by an admin, the function still
-- runs under the caller's RLS context, and the UPDATE on marks table was
-- being blocked by the existing RLS policies that check entered_by / batch
-- assignments. Adding SECURITY DEFINER makes the function run as the DB
-- owner and bypass RLS, which is safe because the function itself validates
-- the admin role before performing any data changes.
--
-- Also fixes get_pending_marks_approvals so it can JOIN marks without being
-- blocked by RLS when called from admin role.
-- ============================================================================

-- ── 1. approve_marks_for_test ───────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.approve_marks_for_test(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.approve_marks_for_test(
  p_test_id   UUID,
  p_admin_id  UUID,
  p_remarks   TEXT DEFAULT NULL
)
RETURNS TABLE (
  success      BOOLEAN,
  message      TEXT,
  marks_count  INT,
  test_status  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role      TEXT;
  v_test_marks_status TEXT;
  v_marks_approved  INT;
BEGIN
  -- Verify admin role
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;

  IF v_admin_role IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Admin not found'::TEXT, 0, NULL::TEXT;
    RETURN;
  END IF;

  IF v_admin_role != 'admin' THEN
    RETURN QUERY SELECT FALSE, 'Only admins can approve marks'::TEXT, 0, NULL::TEXT;
    RETURN;
  END IF;

  -- Get current test marks status
  SELECT marks_status INTO v_test_marks_status FROM public.tests WHERE id = p_test_id;

  IF v_test_marks_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Test not found'::TEXT, 0, NULL::TEXT;
    RETURN;
  END IF;

  -- Update all submitted marks to approved
  UPDATE public.marks
  SET
    approval_status = 'approved',
    approved_by     = p_admin_id,
    approved_at     = now(),
    admin_remarks   = COALESCE(p_remarks, admin_remarks)
  WHERE test_id = p_test_id
    AND approval_status IN ('submitted', 'draft');   -- also catch drafts submitted in bulk

  GET DIAGNOSTICS v_marks_approved = ROW_COUNT;

  -- Update test marks_status to 'approved'
  UPDATE public.tests
  SET marks_status = 'approved'
  WHERE id = p_test_id;

  -- Log to audit trail
  INSERT INTO public.audit_log (
    college_id, actor_id, action, entity_type, entity_id, new_value
  )
  SELECT
    t.college_id, p_admin_id, 'marks_approved', 'test', p_test_id,
    jsonb_build_object('marks_count', v_marks_approved, 'remarks', p_remarks)
  FROM public.tests t WHERE t.id = p_test_id;

  RETURN QUERY SELECT TRUE, 'Marks approved successfully'::TEXT, v_marks_approved, 'approved'::TEXT;
END;
$$;

-- ── 2. reject_marks_for_test ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.reject_marks_for_test(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.reject_marks_for_test(
  p_test_id   UUID,
  p_admin_id  UUID,
  p_remarks   TEXT
)
RETURNS TABLE (
  success      BOOLEAN,
  message      TEXT,
  marks_count  INT,
  test_status  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role    TEXT;
  v_marks_rejected INT;
BEGIN
  -- Verify admin role
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;

  IF v_admin_role IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Admin not found'::TEXT, 0, NULL::TEXT;
    RETURN;
  END IF;

  IF v_admin_role != 'admin' THEN
    RETURN QUERY SELECT FALSE, 'Only admins can reject marks'::TEXT, 0, NULL::TEXT;
    RETURN;
  END IF;

  IF p_remarks IS NULL OR trim(p_remarks) = '' THEN
    RETURN QUERY SELECT FALSE, 'Remarks are required for rejection'::TEXT, 0, NULL::TEXT;
    RETURN;
  END IF;

  -- Update all submitted marks to rejected
  UPDATE public.marks
  SET
    approval_status = 'rejected',
    approved_by     = p_admin_id,
    approved_at     = now(),
    admin_remarks   = p_remarks
  WHERE test_id = p_test_id
    AND approval_status IN ('submitted', 'draft');

  GET DIAGNOSTICS v_marks_rejected = ROW_COUNT;

  -- Reset marks to draft so faculty can re-enter
  UPDATE public.marks
  SET approval_status = 'draft'
  WHERE test_id = p_test_id
    AND approval_status = 'rejected';

  -- Update test marks_status back to draft (faculty can re-enter)
  UPDATE public.tests
  SET marks_status = 'draft'
  WHERE id = p_test_id;

  -- Log to audit trail
  INSERT INTO public.audit_log (
    college_id, actor_id, action, entity_type, entity_id, new_value
  )
  SELECT
    t.college_id, p_admin_id, 'marks_rejected', 'test', p_test_id,
    jsonb_build_object('marks_count', v_marks_rejected, 'remarks', p_remarks)
  FROM public.tests t WHERE t.id = p_test_id;

  RETURN QUERY SELECT TRUE, 'Marks rejected and reset to draft for re-entry'::TEXT, v_marks_rejected, 'draft'::TEXT;
END;
$$;

-- ── 3. get_pending_marks_approvals ──────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_pending_marks_approvals(UUID);

CREATE OR REPLACE FUNCTION public.get_pending_marks_approvals(
  p_college_id UUID
)
RETURNS TABLE (
  test_id          UUID,
  test_title       TEXT,
  batch_name       TEXT,
  exam_category    TEXT,
  submitted_by_name  TEXT,
  submitted_by_email TEXT,
  marks_count      INT,
  submitted_at     TIMESTAMPTZ,
  marks_status     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    b.name,
    t.exam_category,
    p.full_name,
    p.email,
    COUNT(m.id)::INT,
    MAX(m.entered_at),
    t.marks_status
  FROM public.tests t
  JOIN public.batches  b ON t.batch_id  = b.id
  JOIN public.profiles p ON t.created_by = p.id
  LEFT JOIN public.marks m ON t.id = m.test_id AND m.approval_status = 'submitted'
  WHERE t.college_id   = p_college_id
    AND t.marks_status = 'submitted'
  GROUP BY t.id, t.title, b.name, t.exam_category, p.full_name, p.email, t.marks_status
  ORDER BY MAX(m.entered_at) DESC NULLS LAST;
END;
$$;
