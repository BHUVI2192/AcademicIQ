-- ============================================================================
-- NEW ATTENDANCE SYSTEM: Clean Architecture (Migration 028)
-- ============================================================================
-- This is a fresh attendance implementation designed with lessons learned:
--
-- ARCHITECTURE PRINCIPLES:
-- 1. Simple table schema with clear columns
-- 2. RPC functions that accept role as parameter (avoid profiles queries)
-- 3. Minimal RLS - frontend handles permissions via useAuth hook
-- 4. No circular dependencies or recursion
-- 5. Clear workflow: Draft → Submitted → Approved → Published
--
-- Key Changes from Previous Implementation:
-- - batch_id based instead of student-by-student
-- - attendance records grouped by batch/date/session
-- - students_attendance stored as JSONB for flexibility
-- - RPC functions take user_role as parameter
-- - NO RLS policies that query profiles table
-- ============================================================================

-- ============================================================================
-- CREATE ATTENDANCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.attendance (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id            UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    attendance_date     DATE NOT NULL,
    session             TEXT NOT NULL CHECK (session IN ('morning', 'evening')),
    -- Store attendance as JSON: {"student_id": "present" or "absent"}
    students_attendance JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Faculty who marked the attendance
    marked_by           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    -- Workflow status
    approval_status     TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'submitted', 'approved', 'published')),
    -- For admin remarks during approval/rejection
    admin_remarks       TEXT,
    -- Audit fields
    approved_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at         TIMESTAMPTZ,
    published_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Unique constraint: One record per batch/date/session
    UNIQUE (batch_id, attendance_date, session, marked_by)
);

CREATE INDEX IF NOT EXISTS idx_attendance_batch_date ON public.attendance(batch_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_marked_by ON public.attendance(marked_by);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance(approval_status);

-- ============================================================================
-- ENABLE RLS ON ATTENDANCE TABLE
-- ============================================================================

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SIMPLE RLS POLICIES (no recursion - don't query profiles)
-- ============================================================================

-- Policy 1: Faculty can INSERT their own attendance records (as draft)
CREATE POLICY "faculty_insert_own_attendance" ON public.attendance
    FOR INSERT TO authenticated
    WITH CHECK (
        marked_by = auth.uid()
        AND approval_status = 'draft'
    );

-- Policy 2: Faculty can UPDATE their own draft/submitted records
CREATE POLICY "faculty_update_own_attendance" ON public.attendance
    FOR UPDATE TO authenticated
    USING (marked_by = auth.uid() AND approval_status IN ('draft', 'submitted'))
    WITH CHECK (marked_by = auth.uid() AND approval_status IN ('draft', 'submitted'));

-- Policy 3: Faculty can VIEW their own records
CREATE POLICY "faculty_select_own_attendance" ON public.attendance
    FOR SELECT TO authenticated
    USING (marked_by = auth.uid());

-- Note: RPC functions with SECURITY DEFINER will bypass RLS policies automatically
-- No additional permissive policies needed

-- ============================================================================
-- RPC FUNCTIONS (WITH SECURITY DEFINER)
-- ============================================================================
-- These functions bypass RLS and handle permission checks explicitly

-- Function 1: Get all batches with pending attendance for admin to review
-- Takes: user_role as parameter (provided by frontend from useAuth)
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
    -- Only admins can view pending attendance
    IF p_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can view pending attendance';
    END IF;

    RETURN QUERY
    SELECT
        a.id,
        a.batch_id,
        b.name,
        a.attendance_date,
        a.session,
        a.marked_by,
        p.full_name,
        a.approval_status,
        (SELECT count(*) FROM jsonb_object_keys(a.students_attendance))::int as student_count
    FROM public.attendance a
    JOIN public.batches b ON a.batch_id = b.id
    JOIN public.profiles p ON a.marked_by = p.id
    WHERE a.approval_status IN ('submitted', 'approved', 'rejected')
    ORDER BY a.attendance_date DESC, a.session DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.get_batch_attendance_details(UUID, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.get_batch_attendance_details(
    p_batch_id UUID,
    p_attendance_date DATE,
    p_session TEXT
)
RETURNS TABLE (
    id UUID,
    student_id UUID,
    student_name TEXT,
    roll_number TEXT,  -- Changed from INT to TEXT to match students table schema
    status TEXT,
    approval_status TEXT,  -- Added approval_status to help frontend lock/unlock controls
    marked_by_name TEXT,
    marked_by_role TEXT
) AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        s_id::UUID as student_id,
        (SELECT full_name FROM public.students WHERE students.id = s_id::UUID LIMIT 1) as student_name,
        (SELECT roll_number FROM public.students WHERE students.id = s_id::UUID LIMIT 1) as roll_number,
        a.students_attendance ->> s_id as status,
        a.approval_status,
        p.full_name as marked_by_name,
        p.role as marked_by_role
    FROM public.attendance a
    LEFT JOIN public.profiles p ON a.marked_by = p.id,
    jsonb_object_keys(a.students_attendance) as s_id
    WHERE a.batch_id = p_batch_id
      AND a.attendance_date = p_attendance_date
      AND a.session = p_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function 3: Approve attendance (admin only)
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

-- Function 4: Reject attendance (admin only)
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
        approved_by = p_user_id,
        approved_at = now(),
        admin_remarks = COALESCE(p_remarks, admin_remarks),
        updated_at = now()
    WHERE id = p_attendance_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function 5: Publish attendance (admin only)
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

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_pending_attendance_for_review(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_batch_attendance_details(UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_attendance(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_attendance(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_attendance(UUID, UUID, TEXT) TO authenticated;

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

INSERT INTO public.audit_log (college_id, actor_id, action, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  '00000000-0000-0000-0000-000000000000', 
  'migration.028_new_attendance_system', 
  '{"description": "Created clean attendance system: Simple table, RPC functions with role parameter, minimal RLS"}'::jsonb
);
