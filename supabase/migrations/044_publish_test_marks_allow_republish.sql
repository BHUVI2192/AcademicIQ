-- ============================================================================
-- Migration: Allow republishing in publish_test_marks (044)
-- ============================================================================
-- Update publish_test_marks to allow execution if status is 'approved' OR 'published'.
-- This is necessary to sync test visibility (is_published = true) or recalculate
-- rankings if previous attempts failed.

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

  -- Verify test marks status is approved or already published
  SELECT marks_status INTO v_test_status FROM public.tests WHERE id = p_test_id;
  IF v_test_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Test not found'::TEXT, 0;
    RETURN;
  END IF;
  IF v_test_status NOT IN ('approved', 'published') THEN
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
