-- ============================================================================
-- Migration: Recalculate all rankings & update RLS for parent view (043)
-- ============================================================================

-- 1. Redefine publish_test_marks to use recalculate_rankings (which populates overall AND subject rankings)
-- and updates is_published = true.
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

  -- Recalculate both overall rankings and subject-wise rankings using the unified function
  SELECT public.recalculate_rankings(p_test_id) INTO v_rankings_inserted;

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

-- 2. Update rankings RLS policy so parents can see all rankings for a published test if their child is in that batch.
DROP POLICY IF EXISTS rankings_select ON public.rankings;
CREATE POLICY rankings_select ON public.rankings
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = rankings.test_id
              AND (t.college_id = get_my_college_id() OR is_global_admin())
              AND (
                  is_admin()
                  OR (is_faculty() AND faculty_has_batch(t.batch_id))
                  OR (
                      is_parent()
                      AND t.is_published = true
                      AND EXISTS (
                          SELECT 1 FROM public.students s
                          WHERE s.batch_id = t.batch_id
                            AND parent_has_verified_student(s.id)
                      )
                  )
              )
        )
    );
