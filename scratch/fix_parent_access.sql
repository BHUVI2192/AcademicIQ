
BEGIN;

-- 1. Update all existing mappings to be verified
UPDATE public.parent_student_map SET is_verified = true, verified_at = now() WHERE is_verified = false;

-- 2. Update marks_select policy to include parents
DROP POLICY IF EXISTS marks_select ON public.marks;
CREATE POLICY marks_select ON public.marks
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = marks.test_id
            AND (t.college_id = get_my_college_id() OR is_global_admin())
            AND (
                is_admin() 
                OR (is_faculty() AND faculty_has_batch(t.batch_id))
                OR (is_parent() AND t.is_published = true AND parent_has_verified_student(marks.student_id))
            )
        )
    );

-- 3. Double check tests_select policy (it already has parent check, but let's ensure it's optimal)
DROP POLICY IF EXISTS tests_select ON public.tests;
CREATE POLICY tests_select ON public.tests
    FOR SELECT
    TO authenticated
    USING (
        (college_id = get_my_college_id() OR is_global_admin())
        AND (
            is_admin()
            OR (is_faculty() AND faculty_has_batch(batch_id))
            OR (is_parent() AND is_published = true AND EXISTS (
                SELECT 1 FROM public.students s
                WHERE s.batch_id = tests.batch_id
                AND parent_has_verified_student(s.id)
            ))
        )
    );

COMMIT;
