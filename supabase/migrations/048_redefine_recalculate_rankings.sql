-- ============================================================================
-- Migration: Redefine recalculate_rankings (048)
-- ============================================================================
-- Redefines public.recalculate_rankings to compute both overall class rankings
-- and subject-wise rankings for a test, and logging it to the audit log.

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
        (SELECT COUNT(*) FROM public.students WHERE batch_id = v_test_record.batch_id AND is_active = true)::INT,
        now()
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
