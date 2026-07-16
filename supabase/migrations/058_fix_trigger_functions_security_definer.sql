-- AcademeIQ Platform — Set SECURITY DEFINER on Marks Triggers (058)
-- Resolves the "Database error deleting user" issue when deleting a faculty member
-- who has entered marks. This ensures that cascading updates to the marks table
-- (setting entered_by to NULL) run under the database owner's privileges rather
-- than the limited supabase_auth_admin user.

-- 1. fn_log_marks_change
CREATE OR REPLACE FUNCTION public.fn_log_marks_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 2. fn_validate_marks
CREATE OR REPLACE FUNCTION public.fn_validate_marks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max_marks      NUMERIC;
    v_exam_category  TEXT;
BEGIN
    IF NEW.is_absent = true THEN
        NEW.marks_obtained := NULL;
        RETURN NEW;
    END IF;

    SELECT ts.max_marks, t.exam_category
    INTO   v_max_marks, v_exam_category
    FROM   public.test_subjects ts
    JOIN   public.tests t ON t.id = ts.test_id
    WHERE  ts.id = NEW.subject_id;

    IF v_max_marks IS NULL THEN
        RAISE EXCEPTION 'Subject % does not exist', NEW.subject_id;
    END IF;

    IF NEW.marks_obtained IS NOT NULL
       AND v_max_marks IS NOT NULL
       AND NEW.marks_obtained > v_max_marks THEN
        RAISE EXCEPTION 'Marks % exceeds maximum % for subject', NEW.marks_obtained, v_max_marks;
    END IF;

    IF NEW.marks_obtained IS NOT NULL
       AND NEW.marks_obtained < 0
       AND v_exam_category = 'Board Exam' THEN
        RAISE EXCEPTION 'Marks cannot be negative for Board Exam subjects';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- 3. fn_prevent_locked_test_edit
CREATE OR REPLACE FUNCTION public.fn_prevent_locked_test_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;
