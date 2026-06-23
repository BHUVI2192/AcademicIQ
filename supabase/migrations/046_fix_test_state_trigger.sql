-- ============================================================================
-- Migration: Fix fn_log_test_state_change trigger actor_id (046)
-- ============================================================================
-- Updates the test state log trigger function to handle null auth.uid() by falling back
-- to the test's created_by user ID, avoiding not-null constraint errors on audit_log.actor_id.

CREATE OR REPLACE FUNCTION public.fn_log_test_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.is_published = false AND NEW.is_published = true THEN
        INSERT INTO public.audit_log (college_id, actor_id, action, entity_type, entity_id, new_value)
        VALUES (NEW.college_id, COALESCE(auth.uid(), NEW.created_by), 'test.published', 'tests', NEW.id, to_jsonb(NEW));
    END IF;

    IF OLD.is_locked = false AND NEW.is_locked = true THEN
        INSERT INTO public.audit_log (college_id, actor_id, action, entity_type, entity_id, new_value)
        VALUES (NEW.college_id, COALESCE(auth.uid(), NEW.created_by), 'test.locked', 'tests', NEW.id, to_jsonb(NEW));
    END IF;

    RETURN NEW;
END;
$$;
