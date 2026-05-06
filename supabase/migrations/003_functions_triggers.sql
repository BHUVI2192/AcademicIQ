-- ============================================================================
-- AcademeIQ Platform — Functions & Triggers Migration (003)
-- ============================================================================

-- ============================================================================
-- TRIGGER 1: validate_marks
-- Ensures marks_obtained does not exceed test_subjects.max_marks
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_validate_marks()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_marks NUMERIC;
BEGIN
    IF NEW.is_absent = true THEN
        NEW.marks_obtained := NULL;
        RETURN NEW;
    END IF;

    SELECT max_marks INTO v_max_marks
    FROM public.test_subjects
    WHERE id = NEW.subject_id;

    IF v_max_marks IS NULL THEN
        RAISE EXCEPTION 'Subject % does not exist', NEW.subject_id;
    END IF;

    IF NEW.marks_obtained IS NOT NULL AND NEW.marks_obtained > v_max_marks THEN
        RAISE EXCEPTION 'Marks % exceeds maximum % for subject', NEW.marks_obtained, v_max_marks;
    END IF;

    IF NEW.marks_obtained IS NOT NULL AND NEW.marks_obtained < 0 THEN
        RAISE EXCEPTION 'Marks cannot be negative';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_marks ON public.marks;
CREATE TRIGGER trg_validate_marks
    BEFORE INSERT OR UPDATE ON public.marks
    FOR EACH ROW EXECUTE FUNCTION public.fn_validate_marks();

-- ============================================================================
-- TRIGGER 2: prevent_locked_test_edit
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_prevent_locked_test_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_locked BOOLEAN;
BEGIN
    SELECT is_locked INTO v_is_locked
    FROM public.tests
    WHERE id = COALESCE(NEW.test_id, OLD.test_id);

    IF v_is_locked = true THEN
        RAISE EXCEPTION 'Cannot modify marks: test is locked';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_test_edit ON public.marks;
CREATE TRIGGER trg_prevent_locked_test_edit
    BEFORE INSERT OR UPDATE OR DELETE ON public.marks
    FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_locked_test_edit();

-- ============================================================================
-- TRIGGER 3: prevent_incomplete_publish
-- Ensures all enrolled students have a marks row (or is_absent) for every subject
-- before allowing the test to be published.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_prevent_incomplete_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_expected_count INT;
    v_actual_count   INT;
    v_subject_count  INT;
    v_student_count  INT;
BEGIN
    -- Only validate when transitioning from unpublished → published
    IF OLD.is_published = false AND NEW.is_published = true THEN

        SELECT COUNT(*) INTO v_subject_count
        FROM public.test_subjects WHERE test_id = NEW.id;

        IF v_subject_count = 0 THEN
            RAISE EXCEPTION 'Cannot publish test with no subjects defined';
        END IF;

        SELECT COUNT(*) INTO v_student_count
        FROM public.students
        WHERE batch_id = NEW.batch_id AND is_active = true;

        IF v_student_count = 0 THEN
            RAISE EXCEPTION 'Cannot publish test for batch with no students';
        END IF;

        v_expected_count := v_subject_count * v_student_count;

        SELECT COUNT(*) INTO v_actual_count
        FROM public.marks m
        JOIN public.students s ON s.id = m.student_id
        WHERE m.test_id = NEW.id AND s.is_active = true;

        IF v_actual_count < v_expected_count THEN
            RAISE EXCEPTION 'Cannot publish: only % of % marks entered (need all marks or absent flags)',
                v_actual_count, v_expected_count;
        END IF;

        NEW.published_at := now();
    END IF;

    -- Track lock timestamp
    IF OLD.is_locked = false AND NEW.is_locked = true THEN
        NEW.locked_at := now();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_incomplete_publish ON public.tests;
CREATE TRIGGER trg_prevent_incomplete_publish
    BEFORE UPDATE ON public.tests
    FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_incomplete_publish();

-- ============================================================================
-- TRIGGER 4: log_marks_change
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_log_marks_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_college_id UUID;
BEGIN
    SELECT t.college_id INTO v_college_id
    FROM public.tests t
    WHERE t.id = COALESCE(NEW.test_id, OLD.test_id);

    INSERT INTO public.audit_log (
        college_id, actor_id, action, entity_type, entity_id, old_value, new_value
    ) VALUES (
        v_college_id,
        COALESCE(NEW.entered_by, OLD.entered_by, auth.uid()),
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

DROP TRIGGER IF EXISTS trg_log_marks_change ON public.marks;
CREATE TRIGGER trg_log_marks_change
    AFTER INSERT OR UPDATE OR DELETE ON public.marks
    FOR EACH ROW EXECUTE FUNCTION public.fn_log_marks_change();

-- ============================================================================
-- TRIGGER 5: update_profiles_updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

-- ============================================================================
-- TRIGGER 6: log_test_published / log_test_locked
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_log_test_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.is_published = false AND NEW.is_published = true THEN
        INSERT INTO public.audit_log (college_id, actor_id, action, entity_type, entity_id, new_value)
        VALUES (NEW.college_id, auth.uid(), 'test.published', 'tests', NEW.id, to_jsonb(NEW));
    END IF;

    IF OLD.is_locked = false AND NEW.is_locked = true THEN
        INSERT INTO public.audit_log (college_id, actor_id, action, entity_type, entity_id, new_value)
        VALUES (NEW.college_id, auth.uid(), 'test.locked', 'tests', NEW.id, to_jsonb(NEW));
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_test_state_change ON public.tests;
CREATE TRIGGER trg_log_test_state_change
    AFTER UPDATE ON public.tests
    FOR EACH ROW EXECUTE FUNCTION public.fn_log_test_state_change();

-- ============================================================================
-- STORED FUNCTION: recalculate_rankings(p_test_id UUID)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_rankings(p_test_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_test_record   RECORD;
    v_max_weighted  NUMERIC;
    v_inserted      INT;
BEGIN
    -- Acquire advisory lock so concurrent calls for same test are serialized
    PERFORM pg_advisory_xact_lock(hashtext(p_test_id::text));

    -- Verify test exists
    SELECT * INTO v_test_record FROM public.tests WHERE id = p_test_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Test % not found', p_test_id;
    END IF;

    -- Compute max weighted marks across all subjects in this test
    SELECT COALESCE(SUM(max_marks * weightage), 0) INTO v_max_weighted
    FROM public.test_subjects
    WHERE test_id = p_test_id;

    IF v_max_weighted = 0 THEN
        RAISE EXCEPTION 'Test has no subjects with positive max marks';
    END IF;

    -- Wipe existing rankings for this test
    DELETE FROM public.rankings WHERE test_id = p_test_id;

    -- Compute and insert rankings
    WITH student_totals AS (
        SELECT
            s.id AS student_id,
            s.batch_id,
            COALESCE(SUM(
                CASE
                    WHEN m.is_absent = true THEN 0
                    WHEN m.marks_obtained IS NULL THEN 0
                    ELSE m.marks_obtained * ts.weightage
                END
            ), 0) AS total_weighted
        FROM public.students s
        LEFT JOIN public.marks m ON m.student_id = s.id AND m.test_id = p_test_id
        LEFT JOIN public.test_subjects ts ON ts.id = m.subject_id
        WHERE s.batch_id = v_test_record.batch_id
          AND s.is_active = true
        GROUP BY s.id, s.batch_id
    ),
    ranked AS (
        SELECT
            student_id,
            batch_id,
            total_weighted,
            v_max_weighted AS max_weighted,
            ROUND((total_weighted / v_max_weighted) * 100, 2) AS percentage,
            DENSE_RANK() OVER (ORDER BY total_weighted DESC)::INT AS overall_rank,
            DENSE_RANK() OVER (PARTITION BY batch_id ORDER BY total_weighted DESC)::INT AS batch_rank,
            COUNT(*) OVER ()::INT AS total_students
        FROM student_totals
    )
    INSERT INTO public.rankings (
        test_id, student_id, total_marks, max_marks, percentage,
        rank, batch_rank, total_students, computed_at
    )
    SELECT
        p_test_id, student_id, total_weighted, max_weighted, percentage,
        overall_rank, batch_rank, total_students, now()
    FROM ranked;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    -- Audit log
    INSERT INTO public.audit_log (
        college_id, actor_id, action, entity_type, entity_id, new_value
    ) VALUES (
        v_test_record.college_id,
        COALESCE(auth.uid(), v_test_record.created_by),
        'rankings.recalculated',
        'tests',
        p_test_id,
        jsonb_build_object('students_ranked', v_inserted)
    );

    RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_rankings(UUID) TO authenticated, service_role;

-- ============================================================================
-- AUTO-CREATE PROFILE WHEN AUTH USER IS CREATED
-- A safety hook so newly-invited users always get a profile row.
-- The actual profile values (role, college_id) must be set by an admin.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only create a profile if metadata indicates a role
    IF NEW.raw_user_meta_data ? 'role' AND NEW.raw_user_meta_data ? 'college_id' THEN
        INSERT INTO public.profiles (id, college_id, role, full_name, email, phone)
        VALUES (
            NEW.id,
            (NEW.raw_user_meta_data ->> 'college_id')::UUID,
            NEW.raw_user_meta_data ->> 'role',
            COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email, NEW.phone, 'New User'),
            NEW.email,
            NEW.phone
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

-- ============================================================================
-- DONE
-- ============================================================================
