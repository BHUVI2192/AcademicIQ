-- ============================================================================
-- AcademeIQ Platform — Custom ERP Enhancements (011)
-- ============================================================================

-- 1. PROFILES Table Updates
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS can_add_students BOOLEAN DEFAULT false;

-- 2. STUDENTS Table Updates
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS exam_wing TEXT CHECK (exam_wing IN ('NEET', 'KCET'));

-- 3. TESTS Table Updates
-- Drop old constraint first so we can update the values without violation
ALTER TABLE public.tests DROP CONSTRAINT IF EXISTS tests_exam_category_check;

-- Now update existing categories to match new standard
UPDATE public.tests SET exam_category = 'Board Exam' WHERE exam_category = 'Board';
UPDATE public.tests SET exam_category = 'JEE' WHERE exam_category IN ('JEE_Mains', 'JEE_Advanced');
UPDATE public.tests SET exam_category = 'Daily Test' WHERE exam_category = 'Practice';

-- Finally add the new constraint with updated values
ALTER TABLE public.tests ADD CONSTRAINT tests_exam_category_check 
  CHECK (exam_category IN ('KCET', 'JEE', 'NEET', 'Board Exam', 'Daily Test'));

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS chapter_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_faculty_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marks_status TEXT DEFAULT 'draft' CHECK (marks_status IN ('draft', 'submitted', 'published')),
  ADD COLUMN IF NOT EXISTS admin_remarks TEXT;

-- 4. TEST_SUBJECTS Table Updates
ALTER TABLE public.test_subjects
  ADD COLUMN IF NOT EXISTS chapter_name TEXT;

-- 4. FEES Table
CREATE TABLE IF NOT EXISTS public.fees (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount_due          NUMERIC(10, 2) NOT NULL DEFAULT 0,
    due_date            DATE,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    assigned_faculty_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ATTENDANCE Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    attendance_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    session             TEXT NOT NULL CHECK (session IN ('morning', 'evening')),
    status              TEXT NOT NULL CHECK (status IN ('present', 'absent')),
    assigned_faculty_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_published        BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, attendance_date, session)
);

-- 6. RLS POLICIES

-- Fees RLS
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can do everything on fees" ON public.fees;
CREATE POLICY "Admins can do everything on fees" ON public.fees
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Assigned faculty can update fees" ON public.fees;
CREATE POLICY "Assigned faculty can update fees" ON public.fees
    FOR UPDATE TO authenticated USING (
        assigned_faculty_id = auth.uid()
    );

DROP POLICY IF EXISTS "Parents can view child fees" ON public.fees;
CREATE POLICY "Parents can view child fees" ON public.fees
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.parent_student_map psm
            WHERE psm.parent_id = auth.uid() AND psm.student_id = public.fees.student_id
        )
    );

-- Attendance RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can do everything on attendance" ON public.attendance;
CREATE POLICY "Admins can do everything on attendance" ON public.attendance
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Assigned faculty can update attendance" ON public.attendance;
CREATE POLICY "Assigned faculty can update attendance" ON public.attendance
    FOR ALL TO authenticated USING (
        assigned_faculty_id = auth.uid()
    );

DROP POLICY IF EXISTS "Parents can view child attendance" ON public.attendance;
CREATE POLICY "Parents can view child attendance" ON public.attendance
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.parent_student_map psm
            WHERE psm.parent_id = auth.uid() AND psm.student_id = public.attendance.student_id
        ) AND is_published = true
    );

-- 7. AUDIT LOG for new features
INSERT INTO public.audit_log (college_id, actor_id, action, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  '00000000-0000-0000-0000-000000000000', 
  'migration.011_applied', 
  '{"description": "Implemented custom ERP changes: Fees, Attendance, Exam Wings, and Test Workflow enhancements"}'::jsonb
);
