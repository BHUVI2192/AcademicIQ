
-- Update the tests_faculty_update policy to allow any faculty assigned to the batch to update the test.
-- This allows faculty to publish/lock tests even if they were created by an Admin or another faculty.

BEGIN;

DROP POLICY IF EXISTS tests_faculty_update ON public.tests;

CREATE POLICY tests_faculty_update ON public.tests
    FOR UPDATE
    TO authenticated
    USING (
        (college_id = get_my_college_id() OR is_global_admin()) 
        AND (
            is_admin() 
            OR (is_faculty() AND faculty_has_batch(batch_id) AND is_locked = false)
        )
    )
    WITH CHECK (
        (college_id = get_my_college_id() OR is_global_admin()) 
        AND (
            is_admin() 
            OR (is_faculty() AND faculty_has_batch(batch_id))
        )
    );

COMMIT;
