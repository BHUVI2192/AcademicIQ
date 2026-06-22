-- ============================================================================
-- FIX: Simplify RLS Policies for Attendance Workflow
-- ============================================================================
-- The original policies were too restrictive. This fix allows:
-- 1. Faculty to insert attendance with or without batch_id
-- 2. Faculty to update their own draft records
-- 3. Admin full control
-- 4. Parents to see published records

-- ============================================================================
-- STEP 1: Drop existing restrictive policies
-- ============================================================================

DROP POLICY IF EXISTS "Faculty can insert attendance for assigned batches" ON public.attendance;
DROP POLICY IF EXISTS "Faculty can update own draft attendance" ON public.attendance;
DROP POLICY IF EXISTS "Faculty can view own submitted attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can read all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can update attendance status" ON public.attendance;
DROP POLICY IF EXISTS "Admins can delete attendance" ON public.attendance;
DROP POLICY IF EXISTS "Parents can view published attendance" ON public.attendance;

-- ============================================================================
-- STEP 2: Create simplified, working policies
-- ============================================================================

-- ADMIN: Full read access
CREATE POLICY "admin_select_all" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ADMIN: Full insert access
CREATE POLICY "admin_insert_all" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ADMIN: Full update access
CREATE POLICY "admin_update_all" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ADMIN: Full delete access
CREATE POLICY "admin_delete_all" ON public.attendance
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- FACULTY: Can insert/update/view their own draft records
-- ============================================================================

-- Faculty can insert new attendance records (always as draft)
CREATE POLICY "faculty_insert_draft" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Must be faculty with permission
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
        AND p.role = 'faculty' 
        AND (p.can_manage_attendance = true OR p.can_manage_attendance IS NULL)
    )
    -- New record must start as draft
    AND approval_status = 'draft'
  );

-- Faculty can update their own records only while draft/submitted
CREATE POLICY "faculty_update_own" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    -- Must be faculty who created this record
    marked_by = auth.uid()
    -- Can only edit draft records (not submitted/approved/published)
    AND approval_status IN ('draft')
  )
  WITH CHECK (
    -- Must be faculty
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
        AND p.role = 'faculty'
    )
    -- Can only change to draft or submitted
    AND approval_status IN ('draft', 'submitted')
    -- Must stay marked_by same faculty
    AND marked_by = auth.uid()
  );

-- Faculty can view their own submitted records
CREATE POLICY "faculty_select_own" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    marked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'faculty'
    )
  );

-- ============================================================================
-- PARENT: Can view only published records for their children
-- ============================================================================

CREATE POLICY "parent_select_published" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    approval_status = 'approved'
    AND is_published = true
    AND EXISTS (
      SELECT 1 FROM public.student_parent_links spl
      WHERE spl.student_id = public.attendance.student_id
        AND spl.parent_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'parent'
    )
  );
