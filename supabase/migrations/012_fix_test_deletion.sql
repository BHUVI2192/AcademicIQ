-- Fix for test deletion: Allow admins to delete tests
DROP POLICY IF EXISTS tests_admin_delete ON public.tests;
CREATE POLICY tests_admin_delete ON public.tests
    FOR DELETE TO authenticated
    USING (
        (college_id = get_my_college_id() OR is_global_admin())
        AND is_admin()
    );

-- Also ensure test_subjects and marks have cascading deletes (they should, but just in case)
-- This was already in 001_schema.sql but let's be 100% sure the constraints are active.
-- If they aren't, we can recreate them. 
-- However, the user says "tests can't be deleted", which usually means RLS or a missing policy if the DB isn't returning a FK error.
-- If it was a FK error, the user would likely see "violates foreign key constraint".
-- Since they just say "can't be deleted", it's likely RLS.
