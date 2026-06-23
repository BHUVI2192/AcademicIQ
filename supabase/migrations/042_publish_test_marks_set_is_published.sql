-- ============================================================================
-- Migration: Update publish_test_marks to set is_published = true (042)
-- ============================================================================
-- Ensure that when marks are published, the test's is_published flag is set to true
-- so that RLS policies allow parents to view the test and its results.

DROP FUNCTION IF EXISTS public.publish_test_marks(UUID, UUID);

CREATE OR REPLACE FUNCTION public.publish_test_marks(
  p_test_id UUID,
  p_admin_id UUID
) RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  rankings_count INT
) AS $$
DECLARE
  v_admin_role TEXT;
  v_test_status TEXT;
  v_rankings_inserted INT;
BEGIN
  -- Verify admin role
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
  IF v_admin_role != 'admin' THEN
    RETURN QUERY SELECT FALSE, 'Only admins can publish marks'::TEXT, 0;
    RETURN;
  END IF;

  -- Verify test marks status is approved
  SELECT marks_status INTO v_test_status FROM public.tests WHERE id = p_test_id;
  IF v_test_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Test not found'::TEXT, 0;
    RETURN;
  END IF;
  IF v_test_status != 'approved' THEN
    RETURN QUERY SELECT FALSE, 'Test not approved yet. Cannot publish.'::TEXT, 0;
    RETURN;
  END IF;

  -- Calculate and insert rankings for each student
  INSERT INTO public.rankings (
    test_id, student_id, total_marks, max_marks, percentage, rank, batch_rank, total_students
  )
  WITH student_marks AS (
    SELECT
      m.student_id,
      SUM(COALESCE(m.marks_obtained, 0)) AS total_marks,
      SUM(ts.max_marks) AS max_marks
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
      ROUND((sm.total_marks / NULLIF(sm.max_marks, 0) * 100)::NUMERIC, 2) AS percentage,
      ROW_NUMBER() OVER (ORDER BY sm.total_marks DESC) AS rank,
      COUNT(*) OVER () AS total_students
    FROM student_marks sm
  )
  SELECT
    p_test_id,
    rm.student_id,
    rm.total_marks,
    rm.max_marks,
    rm.percentage,
    rm.rank,
    rm.rank AS batch_rank,
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

  -- Update test to published status (set marks_status to 'published' AND is_published to true)
  UPDATE public.tests
  SET marks_status = 'published', is_published = true, published_at = now()
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
