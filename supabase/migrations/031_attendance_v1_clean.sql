-- ============================================================================
-- Migration 031: Revert to Clean V1 Single-Table Attendance Scheme
-- ============================================================================
-- Problem: V2 used attendance_session_tracking as a secondary table which
-- got out of sync with the main attendance table causing the approval portal
-- to show nothing even when valid submissions existed.
--
-- Solution: Everything goes back to querying ONLY the public.attendance table.
-- Locking and submission status are derived from approval_status column.
-- ============================================================================

-- 1. Drop the V2-specific functions that relied on attendance_session_tracking
DROP FUNCTION IF EXISTS public.submit_attendance_draft(UUID, DATE, TEXT, UUID);
DROP FUNCTION IF EXISTS public.get_pending_attendance_submissions(UUID);
DROP FUNCTION IF EXISTS public.approve_attendance_submission(UUID, DATE, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_attendance_submission(UUID, DATE, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.publish_attendance_to_parents(UUID, DATE, UUID);
DROP FUNCTION IF EXISTS public.is_attendance_session_locked(UUID, DATE, TEXT, UUID);

-- 2. Recreate is_attendance_session_locked using ONLY the attendance table
--    Logic:
--    - If attendance exists with status submitted/approved/published by ANY user: locked for all faculty
--    - If attendance exists with status draft by THIS faculty: not locked (they can edit their own draft)
--    - Admin can always mark (can_mark = true for admins)
CREATE OR REPLACE FUNCTION public.is_attendance_session_locked(
    p_batch_id UUID,
    p_date DATE,
    p_session TEXT,
    p_user_id UUID
)
RETURNS TABLE (
    is_locked BOOLEAN,
    locked_by_role TEXT,
    locked_by_user TEXT,
    can_mark BOOLEAN
) AS $$
DECLARE
    v_user_role TEXT;
    v_record RECORD;
BEGIN
    SELECT role INTO v_user_role FROM public.profiles WHERE id = p_user_id;

    -- Check if any attendance record exists for this batch/date/session
    SELECT a.approval_status, a.marked_by, p.full_name, p.role
    INTO v_record
    FROM public.attendance a
    JOIN public.profiles p ON a.marked_by = p.id
    WHERE a.batch_id = p_batch_id
      AND a.attendance_date = p_date
      AND a.session = p_session
    LIMIT 1;

    IF NOT FOUND THEN
        -- No record exists, session is open for anyone
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, TRUE;
        RETURN;
    END IF;

    -- Record exists - check who owns it and what status it is
    IF v_record.approval_status IN ('submitted', 'approved', 'published') THEN
        -- Locked: only admin can override
        RETURN QUERY SELECT
            TRUE,
            v_record.role,
            v_record.full_name,
            (v_user_role = 'admin');
        RETURN;
    END IF;

    -- Status is 'draft'
    IF v_record.marked_by = p_user_id THEN
        -- This faculty owns the draft, they can still edit
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, TRUE;
    ELSE
        -- Someone else owns the draft
        RETURN QUERY SELECT
            TRUE,
            v_record.role,
            v_record.full_name,
            (v_user_role = 'admin');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Ensure get_pending_attendance_for_review exists and works correctly
--    This is the V1 function used by the admin approval portal.
--    It reads directly from the attendance table.
CREATE OR REPLACE FUNCTION public.get_pending_attendance_for_review(
    p_user_role TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    batch_id UUID,
    batch_name TEXT,
    attendance_date DATE,
    session TEXT,
    marked_by_id UUID,
    faculty_name TEXT,
    approval_status TEXT,
    student_count INT
) AS $$
BEGIN
    IF p_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can view pending attendance';
    END IF;

    RETURN QUERY
    SELECT
        a.id,
        a.batch_id,
        b.name as batch_name,
        a.attendance_date,
        a.session,
        a.marked_by as marked_by_id,
        p.full_name as faculty_name,
        a.approval_status,
        (SELECT count(*) FROM jsonb_object_keys(a.students_attendance))::int as student_count
    FROM public.attendance a
    JOIN public.batches b ON a.batch_id = b.id
    JOIN public.profiles p ON a.marked_by = p.id
    WHERE a.approval_status IN ('submitted', 'approved')
    ORDER BY a.attendance_date DESC, a.session DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Ensure approve_attendance, reject_attendance, publish_attendance exist (V1)
CREATE OR REPLACE FUNCTION public.approve_attendance(
    p_attendance_id UUID,
    p_user_id UUID,
    p_user_role TEXT,
    p_remarks TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can approve attendance';
    END IF;
    UPDATE public.attendance
    SET
        approval_status = 'approved',
        approved_by = p_user_id,
        approved_at = now(),
        admin_remarks = COALESCE(p_remarks, admin_remarks),
        updated_at = now()
    WHERE id = p_attendance_id;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reject_attendance(
    p_attendance_id UUID,
    p_user_id UUID,
    p_user_role TEXT,
    p_remarks TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can reject attendance';
    END IF;
    UPDATE public.attendance
    SET
        approval_status = 'draft',
        admin_remarks = COALESCE(p_remarks, admin_remarks),
        updated_at = now()
    WHERE id = p_attendance_id;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.publish_attendance(
    p_attendance_id UUID,
    p_user_id UUID,
    p_user_role TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can publish attendance';
    END IF;
    UPDATE public.attendance
    SET
        approval_status = 'published',
        published_by = p_user_id,
        published_at = now(),
        updated_at = now()
    WHERE id = p_attendance_id
      AND approval_status = 'approved';
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Grants
GRANT EXECUTE ON FUNCTION public.is_attendance_session_locked(UUID, DATE, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_attendance_for_review(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_attendance(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_attendance(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_attendance(UUID, UUID, TEXT) TO authenticated;
