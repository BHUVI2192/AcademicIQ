-- ============================================================================
-- AcademeIQ Platform — Fix submit_marks_for_test for Board Exam multi-faculty (036)
-- ============================================================================
-- Problem: For Board Exams, subjects are assigned to different faculty members
-- via test_subjects.assigned_faculty_id. The original function only checked
-- tests.assigned_faculty_id or tests.created_by, so subject-level faculty
-- assignments were not authorized → "Faculty does not have permission" error.
--
-- Fix: Also allow submission if the faculty is assigned to at least one subject
-- in the test via test_subjects.assigned_faculty_id.
-- For Board Exams specifically, we only submit the marks entered by the
-- requesting faculty (their subjects only). For all other exam categories,
-- all draft marks for the test are submitted (original behavior).
-- ============================================================================

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
  v_exam_category TEXT;
  v_has_permission BOOLEAN;
BEGIN
  -- Verify faculty/admin exists and get role
  SELECT role INTO v_faculty_role FROM public.profiles WHERE id = p_faculty_id;
  
  IF v_faculty_role IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Faculty not found'::TEXT, 0;
    RETURN;
  END IF;

  -- Get exam category
  SELECT exam_category INTO v_exam_category FROM public.tests WHERE id = p_test_id;
  
  IF v_exam_category IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Test not found'::TEXT, 0;
    RETURN;
  END IF;

  -- Check permission: admin always has access
  IF v_faculty_role = 'admin' THEN
    v_has_permission := TRUE;
  ELSE
    -- Faculty has permission if:
    -- 1. They created the test, OR
    -- 2. They are assigned to the whole test (assigned_faculty_id), OR
    -- 3. They are assigned to at least one subject in this test (Board Exam multi-faculty scenario)
    SELECT EXISTS (
      SELECT 1 FROM public.tests
      WHERE id = p_test_id AND (
        created_by = p_faculty_id OR
        assigned_faculty_id = p_faculty_id
      )
      UNION ALL
      SELECT 1 FROM public.test_subjects
      WHERE test_id = p_test_id AND assigned_faculty_id = p_faculty_id
    ) INTO v_has_permission;
  END IF;

  IF NOT v_has_permission THEN
    RETURN QUERY SELECT FALSE, 'Faculty does not have permission for this test'::TEXT, 0;
    RETURN;
  END IF;

  -- For Board Exams with per-subject faculty assignments:
  -- Only submit marks entered by THIS faculty (for their own subjects)
  -- For other exam types: submit all draft marks for the test
  IF v_exam_category = 'Board Exam' AND v_faculty_role != 'admin' THEN
    -- Only submit marks this faculty entered
    UPDATE public.marks
    SET approval_status = 'submitted'
    WHERE test_id = p_test_id
      AND approval_status = 'draft'
      AND entered_by = p_faculty_id;
  ELSE
    -- Submit all draft marks for the test
    UPDATE public.marks
    SET approval_status = 'submitted'
    WHERE test_id = p_test_id AND approval_status = 'draft';
  END IF;

  GET DIAGNOSTICS v_marks_submitted = ROW_COUNT;

  -- Update test marks_status to 'submitted' only if it was 'draft'
  -- For Board Exams, only flip to submitted once ALL subjects have been submitted
  IF v_exam_category = 'Board Exam' AND v_faculty_role != 'admin' THEN
    -- Check if any marks are still in draft state for this test
    IF NOT EXISTS (
      SELECT 1 FROM public.marks
      WHERE test_id = p_test_id AND approval_status = 'draft'
    ) THEN
      UPDATE public.tests SET marks_status = 'submitted' WHERE id = p_test_id AND marks_status = 'draft';
    END IF;
  ELSE
    UPDATE public.tests SET marks_status = 'submitted' WHERE id = p_test_id AND marks_status = 'draft';
  END IF;

  -- Log to audit trail
  INSERT INTO public.audit_log (
    college_id, actor_id, action, entity_type, entity_id, new_value
  ) SELECT
    t.college_id, p_faculty_id, 'marks_submitted', 'test', p_test_id,
    jsonb_build_object('marks_count', v_marks_submitted, 'exam_category', v_exam_category)
  FROM public.tests t WHERE t.id = p_test_id;

  RETURN QUERY SELECT TRUE, 'Marks submitted for admin review'::TEXT, v_marks_submitted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
