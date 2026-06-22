-- Fix faculty INSERT policy to allow both 'draft' and 'submitted' status on insert
-- Previously only allowed 'draft', but faculty should be able to directly submit attendance
DROP POLICY IF EXISTS faculty_insert_own_attendance ON public.attendance;

CREATE POLICY faculty_insert_own_attendance ON public.attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    marked_by = auth.uid()
    AND approval_status IN ('draft', 'submitted')
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('faculty', 'admin')
  );

-- Also ensure faculty can SELECT all attendance for their batch (not just their own rows)
-- So they can check if a session is already marked by someone else
DROP POLICY IF EXISTS faculty_select_own_attendance ON public.attendance;

CREATE POLICY faculty_select_batch_attendance ON public.attendance
  FOR SELECT
  TO authenticated
  USING (
    -- Faculty can see all attendance records (to check locking)
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('faculty', 'admin')
    OR
    -- Parents can see published attendance
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'parent'
      AND approval_status = 'published'
    )
  );
