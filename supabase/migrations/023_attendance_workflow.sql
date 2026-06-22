-- ============================================================================
-- AcademeIQ Platform — Attendance Workflow Enhancement (023)
-- ============================================================================
-- Implements proper approval workflow for attendance:
-- Draft → Submitted → Approved/Rejected → Published
-- ============================================================================

-- ============================================================================
-- 1. ATTENDANCE TABLE ENHANCEMENTS
-- ============================================================================

-- Add batch_id for class context
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS batch_id UUID 
    REFERENCES public.batches(id) ON DELETE CASCADE;

-- Add approval workflow columns
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS approval_status TEXT 
    DEFAULT 'draft' 
    CHECK (approval_status IN ('draft', 'submitted', 'approved', 'rejected'));

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS approved_by UUID 
    REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Update session_type to support more options
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS session_type TEXT 
    DEFAULT 'full' 
    CHECK (session_type IN ('full', 'morning', 'afternoon', 'evening'));

-- ============================================================================
-- 2. AUDIT TABLE FOR APPROVAL TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.attendance_approval_log (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attendance_id       UUID REFERENCES public.attendance(id) ON DELETE CASCADE,
  old_status          TEXT,
  new_status          TEXT,
  changed_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_reason       TEXT,
  changed_at          TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Index for approval log performance
CREATE INDEX IF NOT EXISTS idx_attendance_approval_log_attendance_id
  ON public.attendance_approval_log(attendance_id);

CREATE INDEX IF NOT EXISTS idx_attendance_approval_log_changed_by
  ON public.attendance_approval_log(changed_by);

CREATE INDEX IF NOT EXISTS idx_attendance_approval_log_changed_at
  ON public.attendance_approval_log(changed_at);

-- ============================================================================
-- 3. PERFORMANCE INDEXES
-- ============================================================================

-- Batch-based queries
CREATE INDEX IF NOT EXISTS idx_attendance_batch_date
  ON public.attendance(batch_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_batch_approval_status
  ON public.attendance(batch_id, approval_status);

-- Approval workflow queries
CREATE INDEX IF NOT EXISTS idx_attendance_approval_status
  ON public.attendance(approval_status);

CREATE INDEX IF NOT EXISTS idx_attendance_submitted_at
  ON public.attendance(submitted_at);

CREATE INDEX IF NOT EXISTS idx_attendance_approved_by
  ON public.attendance(approved_by);

CREATE INDEX IF NOT EXISTS idx_attendance_published_at
  ON public.attendance(published_at);

-- Faculty queries
CREATE INDEX IF NOT EXISTS idx_attendance_marked_by_date
  ON public.attendance(marked_by, attendance_date);

-- ============================================================================
-- 4. UPDATED RLS POLICIES
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4.1 ADMIN POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can do everything on attendance" ON public.attendance;
CREATE POLICY "Admins can read all attendance" ON public.attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update attendance status" ON public.attendance
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete attendance" ON public.attendance
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 4.2 FACULTY POLICIES
-- ============================================================================

-- Faculty can insert attendance for their assigned batches (DRAFT only)
DROP POLICY IF EXISTS "Faculty can manage attendance for assigned batches" ON public.attendance;
CREATE POLICY "Faculty can insert attendance for assigned batches" ON public.attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    approval_status = 'draft'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
        AND p.role = 'faculty' 
        AND p.can_manage_attendance = true
        AND EXISTS (
          SELECT 1 FROM public.students s
          JOIN public.batches b ON s.batch_id = b.id
          JOIN public.faculty_batch_assignments fba ON b.id = fba.batch_id
          WHERE fba.faculty_id = auth.uid() 
            AND s.id = public.attendance.student_id
        )
    )
  );

-- Faculty can update their own DRAFT attendance
CREATE POLICY "Faculty can update own draft attendance" ON public.attendance
  FOR UPDATE
  TO authenticated
  USING (
    marked_by = auth.uid()
    AND approval_status = 'draft'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
        AND p.role = 'faculty' 
        AND p.can_manage_attendance = true
    )
  )
  WITH CHECK (
    marked_by = auth.uid()
    AND approval_status IN ('draft', 'submitted')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
        AND p.role = 'faculty' 
        AND p.can_manage_attendance = true
    )
  );

-- Faculty can view their own attendance records
CREATE POLICY "Faculty can view own submitted attendance" ON public.attendance
  FOR SELECT
  TO authenticated
  USING (
    marked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'faculty'
    )
  );

-- ============================================================================
-- 4.3 PARENT POLICIES
-- ============================================================================

-- Parents can view attendance for linked students (ONLY if approved and published)
DROP POLICY IF EXISTS "Parents can view child attendance" ON public.attendance;
DROP POLICY IF EXISTS "Parents can view attendance for linked students" ON public.attendance;
CREATE POLICY "Parents can view published attendance" ON public.attendance
  FOR SELECT
  TO authenticated
  USING (
    approval_status = 'approved'
    AND is_published = true
    AND EXISTS (
      SELECT 1 FROM public.student_parent_links spl
      WHERE spl.student_id = public.attendance.student_id
        AND spl.parent_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. RPC FUNCTIONS
-- ============================================================================

-- ============================================================================
-- 5.1 GET FUNCTIONS
-- ============================================================================

-- Get pending attendance for admin review
CREATE OR REPLACE FUNCTION public.get_pending_attendance_for_admin(
  p_status TEXT DEFAULT 'submitted',
  p_batch_id UUID DEFAULT NULL,
  p_date DATE DEFAULT NULL
)
RETURNS TABLE (
  batch_id UUID,
  batch_name TEXT,
  attendance_date DATE,
  session TEXT,
  student_count INT,
  submitted_at TIMESTAMPTZ,
  marked_by UUID,
  faculty_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.batch_id,
    b.name,
    a.attendance_date,
    a.session,
    COUNT(DISTINCT a.student_id)::INT,
    MIN(a.submitted_at),
    a.marked_by,
    p.full_name
  FROM public.attendance a
  LEFT JOIN public.batches b ON a.batch_id = b.id
  LEFT JOIN public.profiles p ON a.marked_by = p.id
  WHERE a.approval_status = p_status
    AND (p_batch_id IS NULL OR a.batch_id = p_batch_id)
    AND (p_date IS NULL OR a.attendance_date = p_date)
  GROUP BY a.batch_id, b.name, a.attendance_date, a.session, a.marked_by, p.full_name
  ORDER BY MIN(a.submitted_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get detailed attendance for approval
CREATE OR REPLACE FUNCTION public.get_batch_attendance_for_approval(
  p_batch_id UUID,
  p_date DATE,
  p_session TEXT
)
RETURNS TABLE (
  attendance_id UUID,
  student_id UUID,
  student_name TEXT,
  roll_number TEXT,
  status TEXT,
  approval_status TEXT,
  submitted_at TIMESTAMPTZ,
  marked_by_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.student_id,
    s.full_name,
    s.roll_number,
    a.status,
    a.approval_status,
    a.submitted_at,
    p.full_name
  FROM public.attendance a
  JOIN public.students s ON a.student_id = s.id
  LEFT JOIN public.profiles p ON a.marked_by = p.id
  WHERE a.batch_id = p_batch_id
    AND a.attendance_date = p_date
    AND a.session = p_session
  ORDER BY s.roll_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get attendance statistics for dashboard
CREATE OR REPLACE FUNCTION public.get_attendance_stats()
RETURNS TABLE (
  status_name TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    approval_status::TEXT,
    COUNT(*)
  FROM public.attendance
  GROUP BY approval_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 5.2 ACTION FUNCTIONS
-- ============================================================================

-- Submit batch attendance for review
CREATE OR REPLACE FUNCTION public.submit_batch_attendance(
  p_batch_id UUID,
  p_date DATE,
  p_session TEXT,
  p_faculty_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_count INT;
  v_result JSON;
BEGIN
  -- Check if faculty has permission for this batch
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_faculty_id 
      AND p.role = 'faculty' 
      AND p.can_manage_attendance = true
    LIMIT 1
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Faculty does not have permission to manage attendance'
    );
  END IF;

  -- Check if faculty is assigned to this batch
  IF NOT EXISTS (
    SELECT 1 FROM public.faculty_batch_assignments
    WHERE faculty_id = p_faculty_id AND batch_id = p_batch_id
    LIMIT 1
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Faculty is not assigned to this batch'
    );
  END IF;

  -- Update attendance status
  UPDATE public.attendance
  SET 
    approval_status = 'submitted',
    submitted_at = now()
  WHERE batch_id = p_batch_id
    AND attendance_date = p_date
    AND session = p_session
    AND approval_status = 'draft'
    AND marked_by = p_faculty_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log the action
  INSERT INTO public.attendance_approval_log (
    attendance_id, old_status, new_status, changed_by, change_reason
  )
  SELECT id, 'draft', 'submitted', p_faculty_id, 'Faculty submitted for review'
  FROM public.attendance
  WHERE batch_id = p_batch_id
    AND attendance_date = p_date
    AND session = p_session
    AND approval_status = 'submitted'
    AND marked_by = p_faculty_id
    AND submitted_at > now() - interval '1 second';

  RETURN json_build_object(
    'success', true,
    'message', format('%s attendance records submitted for review', v_count),
    'count', v_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Approve batch attendance
CREATE OR REPLACE FUNCTION public.approve_batch_attendance(
  p_batch_id UUID,
  p_date DATE,
  p_session TEXT,
  p_admin_id UUID,
  p_remarks TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_count INT;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_id AND role = 'admin'
    LIMIT 1
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only admins can approve attendance'
    );
  END IF;

  -- Update attendance status
  UPDATE public.attendance
  SET 
    approval_status = 'approved',
    approved_by = p_admin_id,
    approved_at = now()
  WHERE batch_id = p_batch_id
    AND attendance_date = p_date
    AND session = p_session
    AND approval_status = 'submitted';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log the action
  INSERT INTO public.attendance_approval_log (
    attendance_id, old_status, new_status, changed_by, change_reason
  )
  SELECT id, 'submitted', 'approved', p_admin_id, 
         COALESCE('Approved' || CASE WHEN p_remarks IS NOT NULL THEN ': ' || p_remarks ELSE '' END, 'Approved')
  FROM public.attendance
  WHERE batch_id = p_batch_id
    AND attendance_date = p_date
    AND session = p_session
    AND approval_status = 'approved'
    AND approved_by = p_admin_id
    AND approved_at > now() - interval '1 second';

  RETURN json_build_object(
    'success', true,
    'message', format('%s attendance records approved', v_count),
    'count', v_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Reject batch attendance
CREATE OR REPLACE FUNCTION public.reject_batch_attendance(
  p_batch_id UUID,
  p_date DATE,
  p_session TEXT,
  p_admin_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSON AS $$
DECLARE
  v_count INT;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_id AND role = 'admin'
    LIMIT 1
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only admins can reject attendance'
    );
  END IF;

  -- Update attendance status
  UPDATE public.attendance
  SET 
    approval_status = 'rejected',
    rejection_reason = p_rejection_reason
  WHERE batch_id = p_batch_id
    AND attendance_date = p_date
    AND session = p_session
    AND approval_status = 'submitted';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log the action
  INSERT INTO public.attendance_approval_log (
    attendance_id, old_status, new_status, changed_by, change_reason
  )
  SELECT id, 'submitted', 'rejected', p_admin_id, p_rejection_reason
  FROM public.attendance
  WHERE batch_id = p_batch_id
    AND attendance_date = p_date
    AND session = p_session
    AND approval_status = 'rejected'
    AND rejection_reason = p_rejection_reason
    AND updated_at > now() - interval '1 second';

  RETURN json_build_object(
    'success', true,
    'message', format('%s attendance records rejected', v_count),
    'count', v_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Publish approved attendance to parents
CREATE OR REPLACE FUNCTION public.publish_batch_attendance(
  p_batch_id UUID,
  p_date DATE,
  p_session TEXT,
  p_admin_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_count INT;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_id AND role = 'admin'
    LIMIT 1
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only admins can publish attendance'
    );
  END IF;

  -- Update attendance status (only approved records)
  UPDATE public.attendance
  SET 
    is_published = true,
    published_at = now()
  WHERE batch_id = p_batch_id
    AND attendance_date = p_date
    AND session = p_session
    AND approval_status = 'approved';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log the action
  INSERT INTO public.attendance_approval_log (
    attendance_id, old_status, new_status, changed_by, change_reason
  )
  SELECT id, 'approved', 'approved', p_admin_id, 'Published to parents'
  FROM public.attendance
  WHERE batch_id = p_batch_id
    AND attendance_date = p_date
    AND session = p_session
    AND is_published = true
    AND published_at > now() - interval '1 second';

  RETURN json_build_object(
    'success', true,
    'message', format('%s attendance records published to parents', v_count),
    'count', v_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 6. AUDIT LOG ENTRY
-- ============================================================================

INSERT INTO public.audit_log (college_id, actor_id, action, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  '00000000-0000-0000-0000-000000000000', 
  'migration.023_applied', 
  '{"description": "Implemented attendance approval workflow: draft → submitted → approved → published"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATION 023 COMPLETE
-- ============================================================================
