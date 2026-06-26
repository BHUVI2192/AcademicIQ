-- Migration 052: Allow negative marks for competitive exams
-- Reason: NEET, JEE, KCET, Daily Test use negative marking.
--         Only Board Exam marks should be restricted to >= 0.

-- Drop the database CHECK constraint that enforces non-negative marks globally
ALTER TABLE public.marks DROP CONSTRAINT IF EXISTS marks_marks_obtained_check;

CREATE OR REPLACE FUNCTION public.fn_validate_marks()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_marks ON public.marks;
CREATE TRIGGER trg_validate_marks
    BEFORE INSERT OR UPDATE ON public.marks
    FOR EACH ROW EXECUTE FUNCTION public.fn_validate_marks();