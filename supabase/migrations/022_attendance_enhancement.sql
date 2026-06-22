-- ============================================================================
-- AcademeIQ Platform — Attendance Enhancement (022)
-- ============================================================================
-- Fixes attendance student visibility by fetching all students with status
-- ============================================================================

-- Create improved RPC function to get all students with attendance status
CREATE OR REPLACE FUNCTION public.get_batch_attendance_with_students(
  p_batch_id UUID,
  p_date DATE,
  p_session TEXT
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  roll_number TEXT,
  attendance_id UUID,
  status TEXT,
  is_published BOOLEAN,
  parent_notified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.full_name,
    s.roll_number,
    COALESCE(a.id, NULL::UUID),
    COALESCE(a.status, NULL::TEXT),
    COALESCE(a.is_published, false),
    COALESCE(a.parent_notified, false)
  FROM public.students s
  LEFT JOIN public.attendance a ON a.student_id = s.id
    AND a.attendance_date = p_date
    AND a.session = p_session
  WHERE s.batch_id = p_batch_id
    AND s.is_active = true
  ORDER BY s.roll_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update useBatchAttendanceRpc to use improved function
-- Note: The useAttendance.ts hook will need to be updated to call this new function
-- Old function name: get_batch_attendance
-- New function name: get_batch_attendance_with_students
