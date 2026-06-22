-- ============================================================================
-- AcademeIQ Platform — Fees & Attendance Module Enhancements (017)
-- ============================================================================
-- Enhances fees and attendance tables with tracking, notification, and workflow fields
-- Supports: Faculty updates fees/attendance → Publish to parents → Mark complete
-- ============================================================================

-- ============================================================================
-- 1. FEES TABLE ENHANCEMENTS
-- ============================================================================

ALTER TABLE public.fees
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

ALTER TABLE public.fees
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE public.fees
  ADD COLUMN IF NOT EXISTS completion_date TIMESTAMPTZ;

ALTER TABLE public.fees
  ADD COLUMN IF NOT EXISTS remarks TEXT;

-- ============================================================================
-- 2. ATTENDANCE TABLE ENHANCEMENTS
-- ============================================================================

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS marked_by UUID 
    REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS parent_notified BOOLEAN DEFAULT false;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Fees indexes
CREATE INDEX IF NOT EXISTS idx_fees_is_published 
  ON public.fees (is_published);

CREATE INDEX IF NOT EXISTS idx_fees_assigned_faculty 
  ON public.fees (assigned_faculty_id);

CREATE INDEX IF NOT EXISTS idx_fees_status 
  ON public.fees (status);

CREATE INDEX IF NOT EXISTS idx_fees_student_published 
  ON public.fees (student_id, is_published);

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_is_published 
  ON public.attendance (is_published);

CREATE INDEX IF NOT EXISTS idx_attendance_marked_by 
  ON public.attendance (marked_by);

CREATE INDEX IF NOT EXISTS idx_attendance_parent_notified 
  ON public.attendance (parent_notified);

CREATE INDEX IF NOT EXISTS idx_attendance_student_date 
  ON public.attendance (student_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_batch_date 
  ON public.attendance (student_id, attendance_date, session);

-- ============================================================================
-- 4. HELPER FUNCTION: GET FEES FOR BATCH
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_batch_fees(p_batch_id UUID)
RETURNS TABLE (
  fee_id UUID,
  student_id UUID,
  student_name TEXT,
  roll_number TEXT,
  amount_due NUMERIC,
  due_date DATE,
  status TEXT,
  is_published BOOLEAN,
  completion_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    s.id,
    s.full_name,
    s.roll_number,
    f.amount_due,
    f.due_date::DATE,
    f.status,
    f.is_published,
    f.completion_date
  FROM public.fees f
  JOIN public.students s ON s.id = f.student_id
  WHERE s.batch_id = p_batch_id
  ORDER BY s.roll_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. HELPER FUNCTION: GET ATTENDANCE FOR BATCH & DATE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_batch_attendance(
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
  is_published BOOLEAN,
  parent_notified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    s.id,
    s.full_name,
    s.roll_number,
    a.status,
    a.is_published,
    a.parent_notified
  FROM public.attendance a
  JOIN public.students s ON s.id = a.student_id
  WHERE s.batch_id = p_batch_id
    AND a.attendance_date = p_date
    AND a.session = p_session
  ORDER BY s.roll_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. HELPER FUNCTION: GET STUDENT ATTENDANCE HISTORY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_student_attendance_history(
  p_student_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  attendance_id UUID,
  attendance_date DATE,
  session TEXT,
  status TEXT,
  is_published BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.attendance_date,
    a.session,
    a.status,
    a.is_published
  FROM public.attendance a
  WHERE a.student_id = p_student_id
    AND (p_start_date IS NULL OR a.attendance_date >= p_start_date)
    AND (p_end_date IS NULL OR a.attendance_date <= p_end_date)
  ORDER BY a.attendance_date DESC, a.session DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. HELPER FUNCTION: GET STUDENT ATTENDANCE PERCENTAGE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_student_attendance_percentage(
  p_student_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_sessions INT,
  present_sessions INT,
  absent_sessions INT,
  percentage NUMERIC
) AS $$
DECLARE
  v_total INT;
  v_present INT;
  v_absent INT;
  v_percentage NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.attendance a
  WHERE a.student_id = p_student_id
    AND (p_start_date IS NULL OR a.attendance_date >= p_start_date)
    AND (p_end_date IS NULL OR a.attendance_date <= p_end_date);

  SELECT COUNT(*) INTO v_present
  FROM public.attendance a
  WHERE a.student_id = p_student_id
    AND a.status = 'present'
    AND (p_start_date IS NULL OR a.attendance_date >= p_start_date)
    AND (p_end_date IS NULL OR a.attendance_date <= p_end_date);

  SELECT COUNT(*) INTO v_absent
  FROM public.attendance a
  WHERE a.student_id = p_student_id
    AND a.status = 'absent'
    AND (p_start_date IS NULL OR a.attendance_date >= p_start_date)
    AND (p_end_date IS NULL OR a.attendance_date <= p_end_date);

  v_percentage := CASE WHEN v_total = 0 THEN 0 ELSE ROUND((v_present::NUMERIC / v_total) * 100, 2) END;

  RETURN QUERY SELECT v_total, v_present, v_absent, v_percentage;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. NOTIFICATION TRACKING TABLE (Optional, for audit trail)
-- ============================================================================
-- Note: Email notifications are sent via Edge Functions
-- This table tracks when notifications were sent
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email TEXT NOT NULL,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL CHECK (
    notification_type IN ('fees_due', 'attendance_absent', 'marks_published', 'fees_completed')
  ),
  related_entity_type TEXT,
  related_entity_id UUID,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient 
  ON public.notification_logs (recipient_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_type 
  ON public.notification_logs (notification_type, sent_at DESC);

-- ============================================================================
-- DONE — Fees & Attendance Module Enhancements Complete
-- ============================================================================
