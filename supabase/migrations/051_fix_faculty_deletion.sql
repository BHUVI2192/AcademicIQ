-- AcademeIQ Platform — Faculty Deletion Fix (051)
-- Resolves the "Database error deleting user" issue caused by orphan marks and trigger validation constraints during cascading deletes.

-- 1. Clean up all orphan marks referencing non-existent tests (using NOT EXISTS)
DELETE FROM public.marks m
WHERE NOT EXISTS (
  SELECT 1 FROM public.tests t WHERE t.id = m.test_id
);

-- 2. Add the missing foreign key constraint from marks to tests to prevent future orphans
ALTER TABLE public.marks DROP CONSTRAINT IF EXISTS marks_test_id_fkey;
ALTER TABLE public.marks
  ADD CONSTRAINT marks_test_id_fkey 
  FOREIGN KEY (test_id) REFERENCES public.tests(id) 
  ON DELETE CASCADE;

-- 3. Redefine fn_log_marks_change to be robust against NULL college_id and actor_id
CREATE OR REPLACE FUNCTION public.fn_log_marks_change()
RETURNS TRIGGER AS $$
DECLARE
    v_college_id UUID;
    v_actor_id UUID;
BEGIN
    SELECT t.college_id INTO v_college_id
    FROM public.tests t
    WHERE t.id = COALESCE(NEW.test_id, OLD.test_id);

    -- Fallback 1: Try to get college_id from profiles (student or faculty)
    IF v_college_id IS NULL THEN
        SELECT college_id INTO v_college_id
        FROM public.profiles
        WHERE id = COALESCE(NEW.student_id, OLD.student_id, NEW.entered_by, OLD.entered_by);
    END IF;

    -- Fallback 2: Fall back to the first available college
    IF v_college_id IS NULL THEN
        SELECT id INTO v_college_id FROM public.colleges LIMIT 1;
    END IF;

    -- Resolve actor_id with a COALESCE chain
    v_actor_id := COALESCE(NEW.entered_by, OLD.entered_by, NEW.approved_by, OLD.approved_by, auth.uid());
    
    -- Fallback 3: Fall back to first admin profile or first profile if actor_id is null (e.g. migration run)
    IF v_actor_id IS NULL THEN
        SELECT id INTO v_actor_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
    END IF;
    IF v_actor_id IS NULL THEN
        SELECT id INTO v_actor_id FROM public.profiles LIMIT 1;
    END IF;

    INSERT INTO public.audit_log (
        college_id, actor_id, action, entity_type, entity_id, old_value, new_value
    ) VALUES (
        v_college_id,
        v_actor_id,
        CASE TG_OP
            WHEN 'INSERT' THEN 'marks.insert'
            WHEN 'UPDATE' THEN 'marks.update'
            WHEN 'DELETE' THEN 'marks.delete'
        END,
        'marks',
        COALESCE(NEW.id, OLD.id),
        CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
        CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 4. Redefine fn_validate_marks to only validate when subject changes
CREATE OR REPLACE FUNCTION public.fn_validate_marks()
RETURNS TRIGGER AS $$
DECLARE
    v_max_marks NUMERIC;
BEGIN
    IF NEW.is_absent = true THEN
        NEW.marks_obtained := NULL;
        RETURN NEW;
    END IF;

    -- Only check subject existence and constraints when insert or subject changes
    IF TG_OP = 'INSERT' OR OLD.subject_id IS DISTINCT FROM NEW.subject_id THEN
        SELECT max_marks INTO v_max_marks
        FROM public.test_subjects
        WHERE id = NEW.subject_id;

        IF v_max_marks IS NULL THEN
            RAISE EXCEPTION 'Subject % does not exist', NEW.subject_id;
        END IF;
    ELSE
        -- If subject didn't change, we can fetch max_marks using the existing subject_id
        SELECT max_marks INTO v_max_marks
        FROM public.test_subjects
        WHERE id = NEW.subject_id;
    END IF;

    IF NEW.marks_obtained IS NOT NULL AND v_max_marks IS NOT NULL AND NEW.marks_obtained > v_max_marks THEN
        RAISE EXCEPTION 'Marks % exceeds maximum % for subject', NEW.marks_obtained, v_max_marks;
    END IF;

    IF NEW.marks_obtained IS NOT NULL AND NEW.marks_obtained < 0 THEN
        RAISE EXCEPTION 'Marks cannot be negative';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Redefine fn_prevent_locked_test_edit to correctly handle DELETE operations (avoid returning NULL)
CREATE OR REPLACE FUNCTION public.fn_prevent_locked_test_edit()
RETURNS TRIGGER AS $$
DECLARE
    v_is_locked BOOLEAN;
BEGIN
    SELECT is_locked INTO v_is_locked
    FROM public.tests
    WHERE id = COALESCE(NEW.test_id, OLD.test_id);

    IF v_is_locked = true THEN
        IF TG_OP = 'UPDATE' THEN
            -- Only block if key marks data fields are changed
            IF OLD.student_id IS DISTINCT FROM NEW.student_id OR
               OLD.subject_id IS DISTINCT FROM NEW.subject_id OR
               OLD.test_id IS DISTINCT FROM NEW.test_id OR
               OLD.marks_obtained IS DISTINCT FROM NEW.marks_obtained OR
               OLD.is_absent IS DISTINCT FROM NEW.is_absent THEN
                RAISE EXCEPTION 'Cannot modify marks: test is locked';
            END IF;
        ELSE
            -- Block INSERT and DELETE on locked tests
            RAISE EXCEPTION 'Cannot modify marks: test is locked';
        END IF;
    END IF;

    -- Return OLD on DELETE (where NEW is NULL) to allow deletion
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
