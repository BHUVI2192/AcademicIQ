-- View all attendance records for a batch (Admin)
CREATE OR REPLACE FUNCTION public.get_batch_attendance_history(
    p_batch_id UUID,
    p_user_role TEXT
)
RETURNS TABLE (
    id UUID,
    attendance_date DATE,
    session TEXT,
    approval_status TEXT,
    marked_by_id UUID,
    faculty_name TEXT,
    student_count INT
) AS $$
BEGIN
    IF p_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can view batch history';
    END IF;

    RETURN QUERY
    SELECT 
        a.id,
        a.attendance_date,
        a.session,
        a.approval_status,
        a.marked_by,
        p.full_name,
        (SELECT count(*) FROM jsonb_object_keys(a.students_attendance))::int as student_count
    FROM public.attendance a
    JOIN public.profiles p ON a.marked_by = p.id
    WHERE a.batch_id = p_batch_id
    ORDER BY a.attendance_date DESC, a.session DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get student's published attendance (Parent)
CREATE OR REPLACE FUNCTION public.get_student_attendance(
    p_student_id UUID
)
RETURNS TABLE (
    id UUID,
    attendance_date DATE,
    session TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.attendance_date,
        a.session,
        a.students_attendance ->> p_student_id::text as status
    FROM public.attendance a
    WHERE (a.students_attendance ? p_student_id::text)
      AND a.approval_status = 'published'
    ORDER BY a.attendance_date DESC, a.session DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_batch_attendance_history(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_attendance(UUID) TO authenticated;
