-- ============================================================================
-- AcademeIQ Platform — Fix "submission_status is ambiguous" in fees RPCs (050)
-- ============================================================================
-- Root cause: approve_fees_draft returned a column named "submission_status"
-- which collided with the fees_draft table column of the same name.
-- PostgreSQL could not resolve which one to use in the WHERE clause.
-- Fix: DROP and recreate with renamed return column "new_status".
-- ============================================================================

-- 1. Drop and recreate approve_fees_draft with non-ambiguous return columns
DROP FUNCTION IF EXISTS public.approve_fees_draft(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.approve_fees_draft(
    p_fees_draft_id UUID,
    p_admin_id UUID,
    p_remarks TEXT DEFAULT NULL
)
RETURNS TABLE (
    success    BOOLEAN,
    message    TEXT,
    new_status TEXT
) AS $$
DECLARE
    v_admin_role   TEXT;
    v_rows_updated INT;
BEGIN
    -- Verify user is admin
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RETURN QUERY SELECT FALSE, 'Only admins can approve fees'::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    -- Update fees draft to approved using table alias to avoid column name collision
    UPDATE public.fees_draft AS fd
    SET
        submission_status = 'approved',
        approved_by_id    = p_admin_id,
        approved_at       = now(),
        admin_remarks     = COALESCE(p_remarks, fd.admin_remarks)
    WHERE fd.id               = p_fees_draft_id
      AND fd.submission_status = 'submitted';

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
        RETURN QUERY SELECT FALSE,
            'Draft not found or not in submitted state'::TEXT,
            NULL::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, 'Fees approved successfully'::TEXT, 'approved'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 2. Drop and recreate reject_fees_draft to avoid any potential ambiguity
DROP FUNCTION IF EXISTS public.reject_fees_draft(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.reject_fees_draft(
    p_fees_draft_id UUID,
    p_admin_id      UUID,
    p_remarks       TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_admin_role   TEXT;
    v_rows_updated INT;
BEGIN
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RETURN QUERY SELECT FALSE, 'Only admins can reject fees'::TEXT;
        RETURN;
    END IF;

    IF p_remarks IS NULL OR trim(p_remarks) = '' THEN
        RETURN QUERY SELECT FALSE, 'Rejection remarks are required'::TEXT;
        RETURN;
    END IF;

    UPDATE public.fees_draft AS fd
    SET
        submission_status = 'rejected',
        admin_remarks     = p_remarks,
        approved_by_id    = NULL,
        approved_at       = NULL
    WHERE fd.id               = p_fees_draft_id
      AND fd.submission_status IN ('submitted', 'approved');

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
        RETURN QUERY SELECT FALSE, 'Draft not found or not in a rejectable state'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, 'Fees draft rejected successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. Re-fix approve_all_fees_drafts with table alias
CREATE OR REPLACE FUNCTION public.approve_all_fees_drafts(
    p_admin_id UUID,
    p_remarks  TEXT DEFAULT NULL
)
RETURNS TABLE (
    success        BOOLEAN,
    message        TEXT,
    approved_count INT
) AS $$
DECLARE
    v_admin_role TEXT;
    v_count      INT;
BEGIN
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RETURN QUERY SELECT FALSE, 'Only admins can approve fees'::TEXT, 0;
        RETURN;
    END IF;

    UPDATE public.fees_draft AS fd
    SET
        submission_status = 'approved',
        approved_by_id    = p_admin_id,
        approved_at       = now(),
        admin_remarks     = COALESCE(p_remarks, fd.admin_remarks)
    WHERE fd.submission_status = 'submitted';

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN QUERY SELECT TRUE, 'All submitted fees approved successfully'::TEXT, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 4. Re-fix approve_batch_fees_drafts with table alias
CREATE OR REPLACE FUNCTION public.approve_batch_fees_drafts(
    p_batch_id UUID,
    p_admin_id UUID,
    p_remarks  TEXT DEFAULT NULL
)
RETURNS TABLE (
    success        BOOLEAN,
    message        TEXT,
    approved_count INT
) AS $$
DECLARE
    v_admin_role TEXT;
    v_count      INT;
BEGIN
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RETURN QUERY SELECT FALSE, 'Only admins can approve fees'::TEXT, 0;
        RETURN;
    END IF;

    UPDATE public.fees_draft AS fd
    SET
        submission_status = 'approved',
        approved_by_id    = p_admin_id,
        approved_at       = now(),
        admin_remarks     = COALESCE(p_remarks, fd.admin_remarks)
    WHERE fd.batch_id          = p_batch_id
      AND fd.submission_status = 'submitted';

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN QUERY SELECT TRUE, 'Batch fees approved successfully'::TEXT, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
