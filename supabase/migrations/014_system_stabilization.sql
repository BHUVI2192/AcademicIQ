-- ============================================================================
-- AcademeIQ Platform — System Stabilization (014)
-- ============================================================================

-- 1. Standardize Exam Categories in TESTS table
DO $$ 
BEGIN
    -- Drop old constraint to allow migration of values
    ALTER TABLE public.tests DROP CONSTRAINT IF EXISTS tests_exam_category_check;
    
    -- Normalize values
    UPDATE public.tests SET exam_category = 'Board Exam' WHERE exam_category IN ('Board', 'Board Exam', 'BOARD');
    UPDATE public.tests SET exam_category = 'JEE' WHERE exam_category IN ('JEE_Mains', 'JEE_Advanced', 'JEE', 'Mains');
    UPDATE public.tests SET exam_category = 'Daily Test' WHERE exam_category IN ('Practice', 'Daily Test', 'DAILY');
    UPDATE public.tests SET exam_category = 'NEET' WHERE exam_category IN ('NEET', 'Medical');
    UPDATE public.tests SET exam_category = 'KCET' WHERE exam_category IN ('KCET', 'CET');
    
    -- Final fallback
    UPDATE public.tests SET exam_category = 'Daily Test' 
    WHERE exam_category NOT IN ('KCET', 'JEE', 'NEET', 'Board Exam', 'Daily Test') OR exam_category IS NULL;
    
    -- Re-apply standardized constraint
    ALTER TABLE public.tests ADD CONSTRAINT tests_exam_category_check 
      CHECK (exam_category IN ('KCET', 'JEE', 'NEET', 'Board Exam', 'Daily Test'));
END $$;

-- 2. Standardize Student Wings
DO $$
BEGIN
    ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_exam_wing_check;
    
    UPDATE public.students SET exam_wing = 'NONE' WHERE exam_wing IS NULL OR exam_wing = '';
    
    ALTER TABLE public.students ADD CONSTRAINT students_exam_wing_check 
      CHECK (exam_wing IN ('NEET', 'KCET', 'NONE'));
END $$;

-- 3. Robust Policy Management
-- Drop and recreate policies to avoid "already exists" errors

-- FEES
DROP POLICY IF EXISTS "Admins can do everything on fees" ON public.fees;
CREATE POLICY "Admins can do everything on fees" ON public.fees
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ATTENDANCE
DROP POLICY IF EXISTS "Admins can do everything on attendance" ON public.attendance;
CREATE POLICY "Admins can do everything on attendance" ON public.attendance
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Assigned faculty can update attendance" ON public.attendance;
CREATE POLICY "Assigned faculty can update attendance" ON public.attendance
    FOR ALL TO authenticated USING (
        assigned_faculty_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- TESTS (Allow Admins to delete)
DROP POLICY IF EXISTS tests_admin_delete ON public.tests;
CREATE POLICY tests_admin_delete ON public.tests
    FOR DELETE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 4. Faculty Deletion Support (Cascade marks)
-- Ensure deletion of faculty doesn't break tests, just unassigns them
-- This is already handled by ON DELETE SET NULL in migration 013, 
-- but let's ensure marks can be deleted if a test is deleted.
ALTER TABLE public.marks DROP CONSTRAINT IF EXISTS marks_test_id_fkey;
ALTER TABLE public.marks ADD CONSTRAINT marks_test_id_fkey 
    FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;

-- 5. Final Audit
INSERT INTO public.audit_log (college_id, actor_id, action, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  '00000000-0000-0000-0000-000000000000', 
  'migration.014_applied', 
  '{"description": "Standardized all constraints and fixed policy collision errors."}'::jsonb
);
