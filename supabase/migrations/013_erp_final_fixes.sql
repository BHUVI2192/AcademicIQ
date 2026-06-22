-- ============================================================================
-- AcademeIQ Platform — ERP Final Fixes & Enhancements (013)
-- ============================================================================

-- 1. PROFILES Table Updates
-- Ensure faculty can have a subject
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS can_add_students BOOLEAN DEFAULT false;

-- 2. STUDENTS Table Updates
-- Add exam_wing with robust check
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS exam_wing TEXT;

-- Drop old constraint if exists to avoid conflicts during updates
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_exam_wing_check;
ALTER TABLE public.students ADD CONSTRAINT students_exam_wing_check 
  CHECK (exam_wing IN ('NEET', 'KCET', 'NONE') OR exam_wing IS NULL);

-- 3. TESTS Table Updates
-- Drop old constraint first
ALTER TABLE public.tests DROP CONSTRAINT IF EXISTS tests_exam_category_check;

-- Robustly update existing categories to match new standard
UPDATE public.tests SET exam_category = 'Board Exam' WHERE exam_category IN ('Board', 'Board Exam');
UPDATE public.tests SET exam_category = 'JEE' WHERE exam_category IN ('JEE_Mains', 'JEE_Advanced', 'JEE');
UPDATE public.tests SET exam_category = 'Daily Test' WHERE exam_category IN ('Practice', 'Daily Test');
UPDATE public.tests SET exam_category = 'NEET' WHERE exam_category = 'NEET';
UPDATE public.tests SET exam_category = 'KCET' WHERE exam_category = 'KCET';

-- Fallback for any other values to 'Daily Test' to avoid constraint violation
UPDATE public.tests SET exam_category = 'Daily Test' 
WHERE exam_category NOT IN ('KCET', 'JEE', 'NEET', 'Board Exam', 'Daily Test') OR exam_category IS NULL;

-- Finally add the new constraint
ALTER TABLE public.tests ADD CONSTRAINT tests_exam_category_check 
  CHECK (exam_category IN ('KCET', 'JEE', 'NEET', 'Board Exam', 'Daily Test'));

-- Add necessary columns if not present
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS chapter_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_faculty_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marks_status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS admin_remarks TEXT;

-- Add chapter_name to test_subjects
ALTER TABLE public.test_subjects
  ADD COLUMN IF NOT EXISTS chapter_name TEXT;

-- 4. Robust Policy Handling
-- Fees
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fees') THEN
        DROP POLICY IF EXISTS "Admins can do everything on fees" ON public.fees;
        CREATE POLICY "Admins can do everything on fees" ON public.fees
            FOR ALL TO authenticated USING (
                EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            );
    END IF;
END $$;

-- Attendance
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attendance') THEN
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
    END IF;
END $$;

-- Tests Deletion Policy (Ensure it's there)
DROP POLICY IF EXISTS tests_admin_delete ON public.tests;
CREATE POLICY tests_admin_delete ON public.tests
    FOR DELETE TO authenticated
    USING (
        (college_id = (SELECT college_id FROM public.profiles WHERE id = auth.uid()) OR 
         EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 5. Audit Log Entry
INSERT INTO public.audit_log (college_id, actor_id, action, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  '00000000-0000-0000-0000-000000000000', 
  'migration.013_applied', 
  '{"description": "Finalized ERP fixes: Robust test categories, Wing selection, and Policy stabilization"}'::jsonb
);
