-- ============================================================================
-- AcademeIQ Platform — PUC School Re-Architecture Migration (004)
-- ============================================================================
-- Transforms the schema from Engineering College to 11th/12th Grade (PUC)
-- Run AFTER 001_schema.sql, 002_rls.sql, 003_functions_triggers.sql
-- ============================================================================

-- ============================================================================
-- STEP 1: Update BATCHES table
-- Remove department dependency and semester, add class_level + stream
-- ============================================================================

-- Make department_id optional (was NOT NULL)
ALTER TABLE public.batches
  ALTER COLUMN department_id DROP NOT NULL;

-- Drop old semester constraint and column
ALTER TABLE public.batches
  DROP CONSTRAINT IF EXISTS batches_semester_check,
  DROP COLUMN IF EXISTS semester;

-- Add PUC-specific columns
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS class_level SMALLINT CHECK (class_level IN (11, 12)),
  ADD COLUMN IF NOT EXISTS stream TEXT CHECK (stream IN ('PCMB', 'PCMC', 'PCME', 'Commerce', 'Arts', 'Other'));

-- Update existing batches to have defaults (for already-seeded data)
UPDATE public.batches SET class_level = 11, stream = 'PCMB' WHERE class_level IS NULL;

-- ============================================================================
-- STEP 2: Update STUDENTS table
-- Rename usn → roll_number
-- ============================================================================

-- Add new roll_number column
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS roll_number TEXT;

-- Copy existing usn data to roll_number (if usn still exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'usn'
    ) THEN
        UPDATE public.students SET roll_number = usn WHERE roll_number IS NULL;
    END IF;
END $$;

-- Drop old unique constraint on usn
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_college_id_usn_key;

-- Add unique constraint on roll_number (per college)
ALTER TABLE public.students
  ADD CONSTRAINT students_college_id_roll_number_key UNIQUE (college_id, roll_number);

-- Drop old usn column (keep roll_number as primary identifier)
ALTER TABLE public.students
  DROP COLUMN IF EXISTS usn;

-- ============================================================================
-- STEP 3: Update TESTS table
-- Add exam_category and exam_sub_type
-- ============================================================================

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS exam_category TEXT DEFAULT 'Board'
    CHECK (exam_category IN ('Board', 'KCET', 'NEET', 'JEE_Mains', 'JEE_Advanced', 'Practice')),
  ADD COLUMN IF NOT EXISTS exam_sub_type TEXT;
  -- exam_sub_type examples: Mid-term, Final, Unit-Test, CET-Mock, Full-Syllabus, Chapter-wise

-- Update existing tests to have defaults
UPDATE public.tests SET exam_category = 'Board', exam_sub_type = 'Mid-term' WHERE exam_category IS NULL;

-- ============================================================================
-- STEP 4: Create SUBJECT_RANKINGS table
-- Per-subject rank per test per student
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subject_rankings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id         UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    subject_id      UUID NOT NULL REFERENCES public.test_subjects(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    marks_obtained  NUMERIC(6, 2),
    is_absent       BOOLEAN NOT NULL DEFAULT false,
    rank            INT NOT NULL,
    total_students  INT NOT NULL,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (test_id, subject_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_rankings_test ON public.subject_rankings (test_id);
CREATE INDEX IF NOT EXISTS idx_subject_rankings_student ON public.subject_rankings (student_id);
CREATE INDEX IF NOT EXISTS idx_subject_rankings_subject ON public.subject_rankings (test_id, subject_id);

-- ============================================================================
-- STEP 5: Update recalculate_rankings to also compute subject-wise rankings
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
    PERFORM pg_advisory_xact_lock(hashtext(p_test_id::text));

    SELECT * INTO v_test_record FROM public.tests WHERE id = p_test_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Test % not found', p_test_id;
    END IF;

    SELECT COALESCE(SUM(max_marks * weightage), 0) INTO v_max_weighted
    FROM public.test_subjects
    WHERE test_id = p_test_id;

    IF v_max_weighted = 0 THEN
        RAISE EXCEPTION 'Test has no subjects with positive max marks';
    END IF;

    -- ── OVERALL RANKINGS ─────────────────────────────────────────────────────
    DELETE FROM public.rankings WHERE test_id = p_test_id;

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

    -- ── SUBJECT-WISE RANKINGS ─────────────────────────────────────────────────
    DELETE FROM public.subject_rankings WHERE test_id = p_test_id;

    INSERT INTO public.subject_rankings (
        test_id, subject_id, student_id, marks_obtained, is_absent, rank, total_students, computed_at
    )
    SELECT
        p_test_id,
        ts.id AS subject_id,
        s.id  AS student_id,
        m.marks_obtained,
        COALESCE(m.is_absent, false),
        DENSE_RANK() OVER (
            PARTITION BY ts.id
            ORDER BY CASE WHEN COALESCE(m.is_absent, false) THEN -1 ELSE COALESCE(m.marks_obtained, 0) END DESC
        )::INT AS rank,
        (SELECT COUNT(*) FROM public.students WHERE batch_id = v_test_record.batch_id AND is_active = true)::INT
    FROM public.test_subjects ts
    CROSS JOIN public.students s
    LEFT JOIN public.marks m
        ON m.test_id   = p_test_id
       AND m.subject_id = ts.id
       AND m.student_id = s.id
    WHERE ts.test_id   = p_test_id
      AND s.batch_id   = v_test_record.batch_id
      AND s.is_active  = true;

    -- ── AUDIT LOG ─────────────────────────────────────────────────────────────
    INSERT INTO public.audit_log (
        college_id, actor_id, action, entity_type, entity_id, new_value
    ) VALUES (
        v_test_record.college_id,
        COALESCE(auth.uid(), v_test_record.created_by),
        'rankings.recalculated',
        'tests',
        p_test_id,
        jsonb_build_object('students_ranked', v_inserted, 'subject_rankings', true)
    );

    RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_rankings(UUID) TO authenticated, service_role;

-- ============================================================================
-- STEP 6: RLS for subject_rankings (read for authenticated, write for service_role)
-- ============================================================================

ALTER TABLE public.subject_rankings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subject_rankings_read" ON public.subject_rankings;
CREATE POLICY "subject_rankings_read" ON public.subject_rankings
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "subject_rankings_service_write" ON public.subject_rankings;
CREATE POLICY "subject_rankings_service_write" ON public.subject_rankings
    FOR ALL TO service_role USING (true);

-- ============================================================================
-- DONE — PUC School Migration complete
-- Apply to Supabase via: supabase db push OR paste in SQL editor
-- ============================================================================
