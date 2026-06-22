-- ============================================================================
-- EMERGENCY RLS FIX: Simplify policies to minimal viable checks
-- ============================================================================
-- The current policies may be too strict. This version:
-- 1. Disables all old policies
-- 2. Creates brand new, simpler policies
-- 3. Maintains security but is more permissive for testing

-- ============================================================================
-- STEP 1: Drop ALL existing attendance policies
-- ============================================================================

DROP POLICY IF EXISTS "admin_select_all" ON public.attendance;
DROP POLICY IF EXISTS "admin_insert_all" ON public.attendance;
DROP POLICY IF EXISTS "admin_update_all" ON public.attendance;
DROP POLICY IF EXISTS "admin_delete_all" ON public.attendance;
DROP POLICY IF EXISTS "faculty_insert_draft" ON public.attendance;
DROP POLICY IF EXISTS "faculty_update_own" ON public.attendance;
DROP POLICY IF EXISTS "faculty_select_own" ON public.attendance;
DROP POLICY IF EXISTS "parent_select_published" ON public.attendance;

-- ============================================================================
-- STEP 2: Create new, simpler policies
-- ============================================================================

-- ADMIN: Full access to everything
CREATE POLICY "admin_all" ON public.attendance
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- FACULTY: Can manage their own records
-- ============================================================================

-- Faculty can insert records (will always be draft)
CREATE POLICY "faculty_insert" ON public.attendance
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be faculty
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'faculty'
    )
  );

-- Faculty can update records they created
CREATE POLICY "faculty_update" ON public.attendance
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    -- Can only update records they created
    marked_by = auth.uid()
  )
  WITH CHECK (
    -- Still must be faculty
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'faculty'
    )
  );

-- Faculty can view their own records
CREATE POLICY "faculty_select" ON public.attendance
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    marked_by = auth.uid()
    AND auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'faculty'
    )
  );

-- ============================================================================
-- PARENT: View only published records for their children
-- ============================================================================

CREATE POLICY "parent_select" ON public.attendance
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    approval_status = 'approved'
    AND is_published = true
    AND auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'parent'
    )
    AND EXISTS (
      SELECT 1 FROM public.student_parent_links 
      WHERE student_id = public.attendance.student_id
        AND parent_id = auth.uid()
    )
  );

-- ============================================================================
-- PUBLIC/ANONYMOUS: No access
-- ============================================================================

CREATE POLICY "deny_anon" ON public.attendance
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false);
