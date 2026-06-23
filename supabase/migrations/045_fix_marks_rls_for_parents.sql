-- ============================================================================
-- Migration: Fix marks RLS policy for parent select (045)
-- ============================================================================
-- The previous policy required marks.approval_status = 'published'.
-- However, the marks table check constraint restricts status to ('draft', 'submitted', 'approved', 'rejected').
-- This migration updates the policy so parents can select marks if the test is_published = true.

DROP POLICY IF EXISTS "Parents can view marks for linked students" ON public.marks;

CREATE POLICY "Parents can view marks for linked students"
    ON public.marks
    FOR SELECT
    USING (
        (
            EXISTS (
                SELECT 1 FROM public.student_parent_links spl
                WHERE spl.student_id = student_id
                AND spl.parent_id = auth.uid()
            )
            AND EXISTS (
                SELECT 1 FROM public.tests t
                WHERE t.id = test_id
                  AND t.is_published = true
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
