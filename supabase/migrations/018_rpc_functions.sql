-- ============================================================================
-- AcademeIQ Platform — RPC Functions for Marks Approval & Workflow (018)
-- ============================================================================
-- Implements business logic for:
-- - Approving/rejecting marks submissions
-- - Publishing marks to parents
-- - Exam wing-based test filtering
-- - Notification tracking
-- ============================================================================

-- ============================================================================
-- 1. FUNCTION: APPROVE TEST MARKS
-- ============================================================================
-- Admin approves all marks for a test (full test approval, not individual)
-- Sets all marks with approval_status = 'submitted' to 'approved'
-- Updates test.marks_status to 'approved'

CREATE OR REPLACE FUNCTION public.approve_marks_for_test(
  p_test_id UUID,
  p_admin_id UUID,
  p_remarks TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  marks_count INT,
  test_status TEXT
) AS $$
DECLARE
  v_test_marks_status TEXT;
  v_marks_approved INT;
  v_admin_role TEXT;
BEGIN
  -- Verify admin role
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
  
  IF v_admin_role IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Admin not found'::TEXT, 0, NULL;
    RETURN;
  END IF;

  IF v_admin_role != 'admin' THEN
    RETURN QUERY SELECT FALSE, 'Only admins can approve marks'::TEXT, 0, NULL;
    RETURN;
  END IF;

  -- Get current test marks status
  SELECT marks_status INTO v_test_marks_status FROM public.tests WHERE id = p_test_id;
  
  IF v_test_marks_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Test not found'::TEXT, 0, NULL;
    RETURN;
  END IF;

  -- Update all submitted marks to approved
  UPDATE public.marks
  SET
    approval_status = 'approved',
    approved_by = p_admin_id,
    approved_at = now(),
    admin_remarks = COALESCE(p_remarks, admin_remarks)
  WHERE test_id = p_test_id AND approval_status = 'submitted';

  GET DIAGNOSTICS v_marks_approved = ROW_COUNT;

  -- Update test marks status to 'approved'
  UPDATE public.tests
  SET marks_status = 'approved'
  WHERE id = p_test_id;

  -- Log to audit trail
  INSERT INTO public.audit_log (
    college_id, actor_id, action, entity_type, entity_id, new_value
  ) SELECT
    t.college_id, p_admin_id, 'marks_approved', 'test', p_test_id,
    jsonb_build_object('marks_count', v_marks_approved, 'remarks', p_remarks)
  FROM public.tests t WHERE t.id = p_test_id;

  RETURN QUERY SELECT TRUE, 'Marks approved successfully'::TEXT, v_marks_approved, 'approved';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. FUNCTION: REJECT TEST MARKS
-- ============================================================================
-- Admin rejects all submitted marks for a test
-- Sets all marks with approval_status = 'submitted' to 'rejected'
-- Faculty must re-enter after reviewing remarks

CREATE OR REPLACE FUNCTION public.reject_marks_for_test(
  p_test_id UUID,
  p_admin_id UUID,
  p_remarks TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  marks_count INT,
  test_status TEXT
) AS $$
DECLARE
  v_admin_role TEXT;
  v_marks_rejected INT;
BEGIN
  -- Verify admin role
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
  
  IF v_admin_role IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Admin not found'::TEXT, 0, NULL;
    RETURN;
  END IF;

  IF v_admin_role != 'admin' THEN
    RETURN QUERY SELECT FALSE, 'Only admins can reject marks'::TEXT, 0, NULL;
    RETURN;
  END IF;

  IF p_remarks IS NULL OR p_remarks = '' THEN
    RETURN QUERY SELECT FALSE, 'Remarks are required for rejection'::TEXT, 0, NULL;
    RETURN;
  END IF;

  -- Update all submitted marks to rejected
  UPDATE public.marks
  SET
    approval_status = 'rejected',
    approved_by = p_admin_id,
    approved_at = now(),
    admin_remarks = p_remarks
  WHERE test_id = p_test_id AND approval_status = 'submitted';

  GET DIAGNOSTICS v_marks_rejected = ROW_COUNT;

  -- Update test marks status back to 'draft' (faculty can re-enter)
  UPDATE public.tests
  SET marks_status = 'draft'
  WHERE id = p_test_id;

  -- Log to audit trail
  INSERT INTO public.audit_log (
    college_id, actor_id, action, entity_type, entity_id, new_value
  ) SELECT
    t.college_id, p_admin_id, 'marks_rejected', 'test', p_test_id,
    jsonb_build_object('marks_count', v_marks_rejected, 'remarks', p_remarks)
  FROM public.tests t WHERE t.id = p_test_id;

  RETURN QUERY SELECT TRUE, 'Marks rejected and test reset to draft'::TEXT, v_marks_rejected, 'draft';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. FUNCTION: PUBLISH APPROVED MARKS TO PARENTS
-- ============================================================================
-- Publishes approved marks for a test to parents
-- Calculates rankings
-- Sets test.marks_status = 'published'
-- Returns TRUE only if all marks are approved

CREATE OR REPLACE FUNCTION public.publish_test_marks(
  p_test_id UUID,
  p_admin_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  rankings_count INT
) AS $$
DECLARE
  v_admin_role TEXT;
  v_test_status TEXT;
  v_not_approved_count INT;
  v_total_marks NUMERIC;
  v_max_marks NUMERIC;
  v_percentage NUMERIC;
  v_batch_id UUID;
  v_rankings_inserted INT;
BEGIN
  -- Verify admin role
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
  
  IF v_admin_role != 'admin' THEN
    RETURN QUERY SELECT FALSE, 'Only admins can publish marks'::TEXT, 0;
    RETURN;
  END IF;

  -- Get test info
  SELECT marks_status, batch_id INTO v_test_status, v_batch_id
  FROM public.tests WHERE id = p_test_id;

  IF v_test_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Test not found'::TEXT, 0;
    RETURN;
  END IF;

  -- Check if all marks are approved
  SELECT COUNT(*) INTO v_not_approved_count
  FROM public.marks
  WHERE test_id = p_test_id AND approval_status != 'approved';

  IF v_not_approved_count > 0 THEN
    RETURN QUERY SELECT FALSE, 'Not all marks are approved. Cannot publish.'::TEXT, 0;
    RETURN;
  END IF;

  -- Calculate and insert rankings for each student
  INSERT INTO public.rankings (
    test_id, student_id, total_marks, max_marks, percentage, rank, batch_rank, total_students
  )
  WITH student_marks AS (
    SELECT
      m.student_id,
      SUM(COALESCE(m.marks_obtained, 0)) as total_marks,
      SUM(ts.max_marks) as max_marks
    FROM public.marks m
    JOIN public.test_subjects ts ON m.subject_id = ts.id
    WHERE m.test_id = p_test_id
    GROUP BY m.student_id
  ),
  ranked_marks AS (
    SELECT
      sm.student_id,
      sm.total_marks,
      sm.max_marks,
      ROUND((sm.total_marks / NULLIF(sm.max_marks, 0) * 100)::NUMERIC, 2) as percentage,
      ROW_NUMBER() OVER (ORDER BY sm.total_marks DESC) as rank,
      COUNT(*) OVER () as total_students
    FROM student_marks sm
  )
  SELECT
    p_test_id,
    rm.student_id,
    rm.total_marks,
    rm.max_marks,
    rm.percentage,
    rm.rank,
    rm.rank as batch_rank,
    rm.total_students
  FROM ranked_marks rm
  ON CONFLICT (test_id, student_id) DO UPDATE SET
    total_marks = EXCLUDED.total_marks,
    max_marks = EXCLUDED.max_marks,
    percentage = EXCLUDED.percentage,
    rank = EXCLUDED.rank,
    batch_rank = EXCLUDED.batch_rank,
    total_students = EXCLUDED.total_students,
    computed_at = now();

  GET DIAGNOSTICS v_rankings_inserted = ROW_COUNT;

  -- Update test to published status
  UPDATE public.tests
  SET marks_status = 'published', published_at = now()
  WHERE id = p_test_id;

  -- Log to audit trail
  INSERT INTO public.audit_log (
    college_id, actor_id, action, entity_type, entity_id, new_value
  ) SELECT
    t.college_id, p_admin_id, 'test_published', 'test', p_test_id,
    jsonb_build_object('rankings_count', v_rankings_inserted)
  FROM public.tests t WHERE t.id = p_test_id;

  RETURN QUERY SELECT TRUE, 'Marks published and rankings calculated'::TEXT, v_rankings_inserted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. FUNCTION: SUBMIT MARKS FROM FACULTY
-- ============================================================================
-- Changes all marks for a test from 'draft' to 'submitted'
-- Prevents further edits until admin reviews

CREATE OR REPLACE FUNCTION public.submit_marks_for_test(
  p_test_id UUID,
  p_faculty_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  marks_count INT
) AS $$
DECLARE
  v_faculty_role TEXT;
  v_marks_submitted INT;
  v_test_exists BOOLEAN;
BEGIN
  -- Verify faculty role
  SELECT role INTO v_faculty_role FROM public.profiles WHERE id = p_faculty_id;
  
  IF v_faculty_role IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Faculty not found'::TEXT, 0;
    RETURN;
  END IF;

  -- Check if faculty/admin has permission for this test
  SELECT EXISTS (
    SELECT 1 FROM public.tests
    WHERE id = p_test_id AND (
      created_by = p_faculty_id OR
      assigned_faculty_id = p_faculty_id OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = p_faculty_id AND role = 'admin')
    )
  ) INTO v_test_exists;

  IF NOT v_test_exists THEN
    RETURN QUERY SELECT FALSE, 'Faculty does not have permission for this test'::TEXT, 0;
    RETURN;
  END IF;

  -- Update all draft marks to submitted
  UPDATE public.marks
  SET approval_status = 'submitted'
  WHERE test_id = p_test_id AND approval_status = 'draft' AND entered_by = p_faculty_id;

  GET DIAGNOSTICS v_marks_submitted = ROW_COUNT;

  -- Update test status to submitted
  UPDATE public.tests
  SET marks_status = 'submitted'
  WHERE id = p_test_id AND marks_status = 'draft';

  -- Log to audit trail
  INSERT INTO public.audit_log (
    college_id, actor_id, action, entity_type, entity_id, new_value
  ) SELECT
    t.college_id, p_faculty_id, 'marks_submitted', 'test', p_test_id,
    jsonb_build_object('marks_count', v_marks_submitted)
  FROM public.tests t WHERE t.id = p_test_id;

  RETURN QUERY SELECT TRUE, 'Marks submitted for admin review'::TEXT, v_marks_submitted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. FUNCTION: GET TESTS VISIBLE TO STUDENT BY EXAM WING
-- ============================================================================
-- Returns tests a student can see based on their exam_wing

CREATE OR REPLACE FUNCTION public.get_student_visible_tests(
  p_student_id UUID,
  p_batch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  test_id UUID,
  title TEXT,
  exam_category TEXT,
  test_date DATE,
  is_published BOOLEAN,
  marks_status TEXT
) AS $$
DECLARE
  v_exam_wing TEXT;
  v_batch_id UUID;
BEGIN
  -- Get student's exam wing and batch
  SELECT s.exam_wing, s.batch_id INTO v_exam_wing, v_batch_id
  FROM public.students s WHERE s.id = p_student_id;

  IF v_exam_wing IS NULL THEN
    -- Student with no exam wing: return no tests
    RETURN;
  END IF;

  -- Return tests based on exam wing visibility rules
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.exam_category,
    t.test_date,
    t.is_published,
    t.marks_status
  FROM public.tests t
  WHERE t.batch_id = COALESCE(p_batch_id, v_batch_id)
    AND t.is_locked = FALSE
    AND (
      -- NEET Wing students: See NEET + JEE + KCET + Daily Test
      (v_exam_wing = 'NEET' AND t.exam_category IN ('NEET', 'JEE', 'KCET', 'Daily Test')) OR
      -- KCET Wing students: See KCET + Daily Test
      (v_exam_wing = 'KCET' AND t.exam_category IN ('KCET', 'Daily Test')) OR
      -- All students see Board Exams
      (t.exam_category = 'Board Exam')
    )
  ORDER BY t.test_date DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. FUNCTION: GET PENDING MARKS APPROVALS
-- ============================================================================
-- Returns all tests with pending marks approvals (submitted status)

CREATE OR REPLACE FUNCTION public.get_pending_marks_approvals(
  p_college_id UUID
)
RETURNS TABLE (
  test_id UUID,
  test_title TEXT,
  batch_name TEXT,
  exam_category TEXT,
  submitted_by_name TEXT,
  submitted_by_email TEXT,
  marks_count INT,
  submitted_at TIMESTAMPTZ,
  marks_status TEXT
) AS $$
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
  JOIN public.batches b ON t.batch_id = b.id
  JOIN public.profiles p ON t.created_by = p.id
  LEFT JOIN public.marks m ON t.id = m.test_id AND m.approval_status = 'submitted'
  WHERE t.college_id = p_college_id AND t.marks_status = 'submitted'
  GROUP BY t.id, t.title, b.name, t.exam_category, p.full_name, p.email, t.marks_status
  ORDER BY MAX(m.entered_at) DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. FUNCTION: LOG NOTIFICATION
-- ============================================================================
-- Records notification sent to recipient (for audit trail)

CREATE OR REPLACE FUNCTION public.log_notification(
  p_recipient_id UUID,
  p_recipient_email TEXT,
  p_notification_type TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT 'sent'
)
RETURNS TABLE (
  success BOOLEAN,
  notification_id UUID
) AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notification_logs (
    recipient_id, recipient_email, notification_type, related_entity_type, related_entity_id, status
  ) VALUES (
    p_recipient_id, p_recipient_email, p_notification_type, p_entity_type, p_entity_id, p_status
  )
  RETURNING id INTO v_notification_id;

  RETURN QUERY SELECT TRUE, v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DONE — RPC Functions Complete
-- ============================================================================
