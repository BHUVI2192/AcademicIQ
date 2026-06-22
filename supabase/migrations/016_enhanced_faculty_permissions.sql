-- ============================================================================
-- AcademeIQ Platform — Enhanced Faculty Permissions (016)
-- ============================================================================
-- Adds granular permission flags for faculty to manage specific modules
-- - can_manage_fees: Faculty can update fees for assigned batches
-- - can_manage_attendance: Faculty can mark attendance for assigned batches
-- ============================================================================

-- ============================================================================
-- 1. PROFILES TABLE ENHANCEMENTS
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_manage_fees BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_manage_attendance BOOLEAN DEFAULT false;

-- ============================================================================
-- 2. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_can_manage_fees 
  ON public.profiles (college_id, can_manage_fees) WHERE can_manage_fees = true;

CREATE INDEX IF NOT EXISTS idx_profiles_can_manage_attendance 
  ON public.profiles (college_id, can_manage_attendance) WHERE can_manage_attendance = true;

-- ============================================================================
-- 3. RLS POLICY UPDATES FOR FEES
-- ============================================================================

-- Admin can do everything on fees (already exists, reinforced)
DROP POLICY IF EXISTS "Admins can do everything on fees" ON public.fees;
CREATE POLICY "Admins can do everything on fees" ON public.fees
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Faculty with can_manage_fees can update fees for their assigned batches
DROP POLICY IF EXISTS "Faculty can manage fees for assigned batches" ON public.fees;
CREATE POLICY "Faculty can manage fees for assigned batches" ON public.fees
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
        AND p.role = 'faculty' 
        AND p.can_manage_fees = true
        AND EXISTS (
          SELECT 1 FROM public.students s
          JOIN public.batches b ON s.batch_id = b.id
          JOIN public.faculty_batch_assignments fba ON b.id = fba.batch_id
          WHERE fba.faculty_id = auth.uid() AND s.id = public.fees.student_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
        AND p.role = 'faculty' 
        AND p.can_manage_fees = true
        AND EXISTS (
          SELECT 1 FROM public.students s
          JOIN public.batches b ON s.batch_id = b.id
          JOIN public.faculty_batch_assignments fba ON b.id = fba.batch_id
          WHERE fba.faculty_id = auth.uid() AND s.id = public.fees.student_id
        )
    )
  );

-- Parents can view fees for their children
DROP POLICY IF EXISTS "Parents can view child fees" ON public.fees;
CREATE POLICY "Parents can view child fees" ON public.fees
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_map psm
      WHERE psm.parent_id = auth.uid() AND psm.student_id = public.fees.student_id
    )
  );

-- ============================================================================
-- 4. RLS POLICY UPDATES FOR ATTENDANCE
-- ============================================================================

-- Admin can do everything on attendance (already exists, reinforced)
DROP POLICY IF EXISTS "Admins can do everything on attendance" ON public.attendance;
CREATE POLICY "Admins can do everything on attendance" ON public.attendance
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Faculty with can_manage_attendance can mark attendance for assigned batches
DROP POLICY IF EXISTS "Faculty can manage attendance for assigned batches" ON public.attendance;
CREATE POLICY "Faculty can manage attendance for assigned batches" ON public.attendance
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
        AND p.role = 'faculty' 
        AND p.can_manage_attendance = true
        AND EXISTS (
          SELECT 1 FROM public.students s
          JOIN public.batches b ON s.batch_id = b.id
          JOIN public.faculty_batch_assignments fba ON b.id = fba.batch_id
          WHERE fba.faculty_id = auth.uid() AND s.id = public.attendance.student_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
        AND p.role = 'faculty' 
        AND p.can_manage_attendance = true
        AND EXISTS (
          SELECT 1 FROM public.students s
          JOIN public.batches b ON s.batch_id = b.id
          JOIN public.faculty_batch_assignments fba ON b.id = fba.batch_id
          WHERE fba.faculty_id = auth.uid() AND s.id = public.attendance.student_id
        )
    )
  );

-- Parents can view attendance for their children
DROP POLICY IF EXISTS "Parents can view child attendance" ON public.attendance;
CREATE POLICY "Parents can view child attendance" ON public.attendance
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_map psm
      WHERE psm.parent_id = auth.uid() AND psm.student_id = public.attendance.student_id
    )
  );

-- ============================================================================
-- 5. PERMISSIONS COMMENT FOR CLARITY
-- ============================================================================
-- Admin: Full access to all modules
-- Faculty with can_add_students: Can add students to their assigned batches
-- Faculty with can_manage_fees: Can update fees for their assigned batches
-- Faculty with can_manage_attendance: Can mark attendance for their assigned batches
-- Parents: Read-only access to their children's fees and attendance

-- ============================================================================
-- DONE — Enhanced Faculty Permissions Complete
-- ============================================================================
