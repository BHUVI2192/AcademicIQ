-- ============================================================================
-- AcademeIQ Platform — Enhanced Attendance & Fees Workflow (030)
-- ============================================================================
-- Implements:
-- 1. Enhanced attendance system with morning/evening sessions
-- 2. Draft submission workflow for faculty
-- 3. Conflict prevention (admin vs faculty locks)
-- 4. Smart session tracking (prevent duplicate marking)
-- 5. Fees update workflow (draft → submit → approve → publish)
-- 6. Notification system for parents
-- ============================================================================

-- ============================================================================
-- 1. ATTENDANCE WORKFLOW TRACKING TABLE
-- ============================================================================
-- Tracks who marked which sessions to prevent conflicts
CREATE TABLE IF NOT EXISTS public.attendance_session_tracking (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id                UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    attendance_date         DATE NOT NULL,
    session                 TEXT NOT NULL CHECK (session IN ('morning', 'evening')),
    -- Track who marked this session
    marked_by_id            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    marked_by_role          TEXT CHECK (marked_by_role IN ('admin', 'faculty')),
    -- Lock status: 'locked' means admin marked or faculty submitted
    lock_status             TEXT NOT NULL DEFAULT 'unlocked' CHECK (lock_status IN ('locked', 'unlocked')),
    -- Approval workflow for faculty submissions
    submission_status       TEXT NOT NULL DEFAULT 'draft' CHECK (submission_status IN ('draft', 'submitted', 'approved', 'rejected', 'published')),
    -- Admin approval info
    approved_by_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at             TIMESTAMPTZ,
    admin_remarks           TEXT,
    -- Publish info
    published_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Unique: One lock per batch/date/session
    UNIQUE (batch_id, attendance_date, session)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session_tracking_batch_date 
    ON public.attendance_session_tracking(batch_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_session_tracking_lock_status 
    ON public.attendance_session_tracking(lock_status, submission_status);

-- ============================================================================
-- 2. FEES DRAFT WORKFLOW TABLE
-- ============================================================================
-- Tracks faculty fee submissions before admin approval
CREATE TABLE IF NOT EXISTS public.fees_draft (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id                UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    student_id              UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    -- Fee details
    total_amount            NUMERIC(10, 2) NOT NULL,
    paid_amount             NUMERIC(10, 2) NOT NULL DEFAULT 0,
    remaining_amount        NUMERIC(10, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    -- Faculty who submitted
    submitted_by_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- Workflow status
    submission_status       TEXT NOT NULL DEFAULT 'draft' CHECK (submission_status IN ('draft', 'submitted', 'approved', 'rejected', 'published')),
    -- Admin approval
    approved_by_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at             TIMESTAMPTZ,
    admin_remarks           TEXT,
    -- Due date for payment
    due_date                DATE,
    -- Publish info
    published_at            TIMESTAMPTZ,
    published_by_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Unique: One draft per student per submission cycle
    UNIQUE (batch_id, student_id, submitted_by_id, submission_status)
);

CREATE INDEX IF NOT EXISTS idx_fees_draft_batch ON public.fees_draft(batch_id);
CREATE INDEX IF NOT EXISTS idx_fees_draft_student ON public.fees_draft(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_draft_status ON public.fees_draft(submission_status);
CREATE INDEX IF NOT EXISTS idx_fees_draft_submitted_by ON public.fees_draft(submitted_by_id);

-- ============================================================================
-- 3. PARENT NOTIFICATIONS TABLE
-- ============================================================================
-- Stores notifications to be displayed on parent dashboard
CREATE TABLE IF NOT EXISTS public.parent_notifications (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id              UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    -- Notification type
    notification_type       TEXT NOT NULL CHECK (notification_type IN (
        'attendance_morning_present',
        'attendance_morning_absent',
        'attendance_evening_present',
        'attendance_evening_absent',
        'attendance_both_sessions',
        'fees_due',
        'fees_overdue',
        'fees_paid',
        'fees_partially_paid'
    )),
    -- Message content
    title                   TEXT NOT NULL,
    message                 TEXT NOT NULL,
    -- Status
    is_read                 BOOLEAN NOT NULL DEFAULT false,
    -- Related data (JSON for flexibility)
    metadata                JSONB,
    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_notifications_parent_id ON public.parent_notifications(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_student_id ON public.parent_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_is_read ON public.parent_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_created_at ON public.parent_notifications(created_at DESC);

-- ============================================================================
-- 4. RPC FUNCTION: Check if session is locked
-- ============================================================================
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
    v_lock_status TEXT;
    v_marked_by_id UUID;
    v_marked_by_role TEXT;
    v_marked_by_name TEXT;
    v_user_role TEXT;
    v_admin_marked BOOLEAN := false;
BEGIN
    -- Get current user's role
    SELECT role INTO v_user_role FROM public.profiles WHERE id = p_user_id;
    
    -- Check if there is any attendance record already approved/published, or marked by an admin
    SELECT EXISTS (
        SELECT 1 FROM public.attendance a
        JOIN public.profiles p ON a.marked_by = p.id
        WHERE a.batch_id = p_batch_id 
          AND a.attendance_date = p_date 
          AND a.session = p_session 
          AND (p.role = 'admin' OR a.approval_status IN ('approved', 'published'))
    ) INTO v_admin_marked;
    
    IF v_admin_marked THEN
        -- Get the name and details of the admin or publisher who marked/approved it
        SELECT p.full_name, p.role INTO v_marked_by_name, v_marked_by_role
        FROM public.attendance a
        JOIN public.profiles p ON a.marked_by = p.id
        WHERE a.batch_id = p_batch_id 
          AND a.attendance_date = p_date 
          AND a.session = p_session 
          AND (p.role = 'admin' OR a.approval_status IN ('approved', 'published'))
        LIMIT 1;
        
        RETURN QUERY SELECT 
            TRUE, 
            v_marked_by_role, 
            COALESCE(v_marked_by_name, 'Administrator'),
            (v_user_role = 'admin');
        RETURN;
    END IF;
    
    -- If no admin override is found, check session tracking table (for faculty submissions)
    SELECT lock_status, marked_by_id, marked_by_role INTO v_lock_status, v_marked_by_id, v_marked_by_role
    FROM public.attendance_session_tracking
    WHERE batch_id = p_batch_id AND attendance_date = p_date AND session = p_session;
    
    -- If no record exists, session is unlocked
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, TRUE;
        RETURN;
    END IF;
    
    -- Get the name of user who locked it
    SELECT full_name INTO v_marked_by_name FROM public.profiles WHERE id = v_marked_by_id;
    
    -- Session is unlocked (can mark)
    IF v_lock_status = 'unlocked' THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, TRUE;
    ELSE
        -- Session is locked
        -- Admin can always override, but faculty cannot
        RETURN QUERY SELECT 
            TRUE, 
            v_marked_by_role, 
            COALESCE(v_marked_by_name, 'Unknown'),
            (v_user_role = 'admin');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 5. RPC FUNCTION: Lock session after marking (admin) or submission (faculty)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lock_attendance_session(
    p_batch_id UUID,
    p_date DATE,
    p_session TEXT,
    p_user_id UUID,
    p_user_role TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
) AS $$
BEGIN
    -- Insert or update the session tracking record
    INSERT INTO public.attendance_session_tracking (
        batch_id, attendance_date, session, marked_by_id, marked_by_role, lock_status
    ) VALUES (
        p_batch_id, p_date, p_session, p_user_id, p_user_role, 'locked'
    )
    ON CONFLICT (batch_id, attendance_date, session) DO UPDATE SET
        marked_by_id = p_user_id,
        marked_by_role = p_user_role,
        lock_status = 'locked',
        updated_at = now();
    
    RETURN QUERY SELECT TRUE, 'Session locked successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 6. RPC FUNCTION: Submit attendance draft (Faculty)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_attendance_draft(
    p_batch_id UUID,
    p_date DATE,
    p_session TEXT,
    p_faculty_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    submission_status TEXT
) AS $$
DECLARE
    v_faculty_role TEXT;
BEGIN
    -- Verify user is faculty
    SELECT role INTO v_faculty_role FROM public.profiles WHERE id = p_faculty_id;
    IF v_faculty_role != 'faculty' THEN
        RETURN QUERY SELECT FALSE, 'Only faculty can submit attendance'::TEXT, NULL;
        RETURN;
    END IF;
    
    -- Check if session is already locked by admin
    IF EXISTS (
        SELECT 1 FROM public.attendance_session_tracking
        WHERE batch_id = p_batch_id 
        AND attendance_date = p_date 
        AND session = p_session 
        AND marked_by_role = 'admin'
        AND lock_status = 'locked'
    ) THEN
        RETURN QUERY SELECT FALSE, 'Admin has already marked this session'::TEXT, NULL;
        RETURN;
    END IF;
    
    -- Update or insert session tracking with submitted status
    INSERT INTO public.attendance_session_tracking (
        batch_id, attendance_date, session, marked_by_id, marked_by_role, 
        lock_status, submission_status
    ) VALUES (
        p_batch_id, p_date, p_session, p_faculty_id, 'faculty', 'locked', 'submitted'
    )
    ON CONFLICT (batch_id, attendance_date, session) DO UPDATE SET
        submission_status = 'submitted',
        updated_at = now()
    WHERE attendance_session_tracking.marked_by_role = 'faculty';
    
    -- Log to audit trail
    INSERT INTO public.audit_log (
        college_id, actor_id, action, entity_type, entity_id, new_value
    ) SELECT
        b.college_id, p_faculty_id, 'attendance_submitted', 'batch', p_batch_id,
        jsonb_build_object('date', p_date, 'session', p_session)
    FROM public.batches b WHERE b.id = p_batch_id;
    
    RETURN QUERY SELECT TRUE, 'Attendance submitted for approval'::TEXT, 'submitted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 7. RPC FUNCTION: Approve attendance (Admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_attendance_submission(
    p_batch_id UUID,
    p_date DATE,
    p_session TEXT,
    p_admin_id UUID,
    p_remarks TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    submission_status TEXT
) AS $$
DECLARE
    v_admin_role TEXT;
BEGIN
    -- Verify user is admin
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RETURN QUERY SELECT FALSE, 'Only admins can approve attendance'::TEXT, NULL;
        RETURN;
    END IF;
    
    -- Update session tracking to approved
    UPDATE public.attendance_session_tracking
    SET
        submission_status = 'approved',
        approved_by_id = p_admin_id,
        approved_at = now(),
        admin_remarks = COALESCE(p_remarks, admin_remarks)
    WHERE batch_id = p_batch_id 
    AND attendance_date = p_date 
    AND session = p_session
    AND submission_status = 'submitted';
    
    -- Log to audit trail
    INSERT INTO public.audit_log (
        college_id, actor_id, action, entity_type, entity_id, new_value
    ) SELECT
        b.college_id, p_admin_id, 'attendance_approved', 'batch', p_batch_id,
        jsonb_build_object('date', p_date, 'session', p_session, 'remarks', p_remarks)
    FROM public.batches b WHERE b.id = p_batch_id;
    
    RETURN QUERY SELECT TRUE, 'Attendance approved successfully'::TEXT, 'approved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 8. RPC FUNCTION: Reject attendance (Admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_attendance_submission(
    p_batch_id UUID,
    p_date DATE,
    p_session TEXT,
    p_admin_id UUID,
    p_remarks TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    submission_status TEXT
) AS $$
DECLARE
    v_admin_role TEXT;
BEGIN
    -- Verify user is admin
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RETURN QUERY SELECT FALSE, 'Only admins can reject attendance'::TEXT, NULL;
        RETURN;
    END IF;
    
    -- Update session tracking to rejected (unlock it so faculty can resubmit)
    UPDATE public.attendance_session_tracking
    SET
        submission_status = 'rejected',
        lock_status = 'unlocked',
        approved_by_id = p_admin_id,
        approved_at = now(),
        admin_remarks = p_remarks
    WHERE batch_id = p_batch_id 
    AND attendance_date = p_date 
    AND session = p_session;
    
    -- Log to audit trail
    INSERT INTO public.audit_log (
        college_id, actor_id, action, entity_type, entity_id, new_value
    ) SELECT
        b.college_id, p_admin_id, 'attendance_rejected', 'batch', p_batch_id,
        jsonb_build_object('date', p_date, 'session', p_session, 'remarks', p_remarks)
    FROM public.batches b WHERE b.id = p_batch_id;
    
    RETURN QUERY SELECT TRUE, 'Attendance rejected with remarks'::TEXT, 'rejected';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 9. RPC FUNCTION: Publish attendance to parents with notifications
-- ============================================================================
CREATE OR REPLACE FUNCTION public.publish_attendance_to_parents(
    p_batch_id UUID,
    p_date DATE,
    p_admin_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    notifications_created INT
) AS $$
DECLARE
    v_admin_role TEXT;
    v_notification_count INT := 0;
    v_student_record RECORD;
    v_morning_status TEXT;
    v_evening_status TEXT;
    v_notification_type TEXT;
    v_notification_title TEXT;
    v_notification_message TEXT;
BEGIN
    -- Verify user is admin
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RETURN QUERY SELECT FALSE, 'Only admins can publish attendance'::TEXT, NULL;
        RETURN;
    END IF;
    
    -- Update all approved/published session trackings to published
    UPDATE public.attendance_session_tracking
    SET
        submission_status = 'published',
        published_at = now()
    WHERE batch_id = p_batch_id 
    AND attendance_date = p_date 
    AND submission_status IN ('approved', 'published');
    
    -- Get all students in batch
    FOR v_student_record IN
        SELECT s.id as student_id, s.full_name as student_name
        FROM public.students s
        WHERE s.batch_id = p_batch_id AND s.is_active = true
    LOOP
        -- Get morning and evening attendance status
        SELECT students_attendance ->> v_student_record.student_id::text INTO v_morning_status
        FROM public.attendance
        WHERE batch_id = p_batch_id 
        AND attendance_date = p_date 
        AND session = 'morning';
        
        SELECT students_attendance ->> v_student_record.student_id::text INTO v_evening_status
        FROM public.attendance
        WHERE batch_id = p_batch_id 
        AND attendance_date = p_date 
        AND session = 'evening';
        
        -- Determine notification type and message
        IF v_morning_status = 'present' AND v_evening_status = 'present' THEN
            v_notification_type := 'attendance_both_sessions';
            v_notification_title := 'Perfect Attendance ✓';
            v_notification_message := v_student_record.student_name || ' attended both morning and evening sessions on ' || TO_CHAR(p_date, 'DD MMM YYYY');
        ELSIF v_morning_status = 'absent' AND v_evening_status = 'absent' THEN
            v_notification_type := 'attendance_both_sessions';
            v_notification_title := 'Absence Alert ⚠️';
            v_notification_message := v_student_record.student_name || ' was absent in both sessions on ' || TO_CHAR(p_date, 'DD MMM YYYY');
        ELSIF v_morning_status = 'absent' THEN
            v_notification_type := 'attendance_morning_absent';
            v_notification_title := 'Morning Session Absent';
            v_notification_message := v_student_record.student_name || ' was absent in the morning session on ' || TO_CHAR(p_date, 'DD MMM YYYY');
        ELSIF v_evening_status = 'absent' THEN
            v_notification_type := 'attendance_evening_absent';
            v_notification_title := 'Evening Session Absent';
            v_notification_message := v_student_record.student_name || ' was absent in the evening session on ' || TO_CHAR(p_date, 'DD MMM YYYY');
        ELSIF v_morning_status = 'present' THEN
            v_notification_type := 'attendance_morning_present';
            v_notification_title := 'Morning Session Attended ✓';
            v_notification_message := v_student_record.student_name || ' attended the morning session on ' || TO_CHAR(p_date, 'DD MMM YYYY');
        ELSIF v_evening_status = 'present' THEN
            v_notification_type := 'attendance_evening_present';
            v_notification_title := 'Evening Session Attended ✓';
            v_notification_message := v_student_record.student_name || ' attended the evening session on ' || TO_CHAR(p_date, 'DD MMM YYYY');
        END IF;
        
        -- Only create notification if there's a status to report
        IF v_notification_type IS NOT NULL THEN
            -- Find parent linked to this student
            INSERT INTO public.parent_notifications (
                parent_id, student_id, notification_type, title, message, metadata
            )
            SELECT
                psl.parent_id,
                v_student_record.student_id,
                v_notification_type,
                v_notification_title,
                v_notification_message,
                jsonb_build_object(
                    'attendance_date', p_date,
                    'morning_status', v_morning_status,
                    'evening_status', v_evening_status,
                    'student_id', v_student_record.student_id
                )
            FROM public.parent_student_linking psl
            WHERE psl.student_id = v_student_record.student_id
            AND psl.is_verified = true;
            
            GET DIAGNOSTICS v_notification_count = ROW_COUNT;
        END IF;
    END LOOP;
    
    -- Log to audit trail
    INSERT INTO public.audit_log (
        college_id, actor_id, action, entity_type, entity_id, new_value
    ) SELECT
        b.college_id, p_admin_id, 'attendance_published', 'batch', p_batch_id,
        jsonb_build_object('date', p_date, 'notifications_created', v_notification_count)
    FROM public.batches b WHERE b.id = p_batch_id;
    
    RETURN QUERY SELECT TRUE, 'Attendance published to parents successfully'::TEXT, v_notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 10. RPC FUNCTION: Submit fees draft (Faculty)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_fees_draft(
    p_student_id UUID,
    p_batch_id UUID,
    p_total_amount NUMERIC,
    p_paid_amount NUMERIC,
    p_faculty_id UUID,
    p_due_date DATE DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    remaining_amount NUMERIC
) AS $$
DECLARE
    v_faculty_role TEXT;
    v_remaining NUMERIC;
BEGIN
    -- Verify user is faculty
    SELECT role INTO v_faculty_role FROM public.profiles WHERE id = p_faculty_id;
    IF v_faculty_role != 'faculty' THEN
        RETURN QUERY SELECT FALSE, 'Only faculty can submit fees'::TEXT, NULL;
        RETURN;
    END IF;
    
    -- Validate amounts
    IF p_paid_amount > p_total_amount THEN
        RETURN QUERY SELECT FALSE, 'Paid amount cannot exceed total amount'::TEXT, NULL;
        RETURN;
    END IF;
    
    -- Calculate remaining
    v_remaining := p_total_amount - p_paid_amount;
    
    -- Insert fees draft
    INSERT INTO public.fees_draft (
        batch_id, student_id, total_amount, paid_amount, submitted_by_id, 
        submission_status, due_date
    ) VALUES (
        p_batch_id, p_student_id, p_total_amount, p_paid_amount, p_faculty_id,
        'draft', p_due_date
    );
    
    RETURN QUERY SELECT TRUE, 'Fees draft created successfully'::TEXT, v_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 11. RPC FUNCTION: Approve fees draft (Admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_fees_draft(
    p_fees_draft_id UUID,
    p_admin_id UUID,
    p_remarks TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    submission_status TEXT
) AS $$
DECLARE
    v_admin_role TEXT;
BEGIN
    -- Verify user is admin
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RETURN QUERY SELECT FALSE, 'Only admins can approve fees'::TEXT, NULL;
        RETURN;
    END IF;
    
    -- Update fees draft to approved
    UPDATE public.fees_draft
    SET
        submission_status = 'approved',
        approved_by_id = p_admin_id,
        approved_at = now(),
        admin_remarks = COALESCE(p_remarks, admin_remarks)
    WHERE id = p_fees_draft_id
    AND submission_status = 'submitted';
    
    RETURN QUERY SELECT TRUE, 'Fees approved successfully'::TEXT, 'approved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 12. RPC FUNCTION: Publish fees with notifications to parents
-- ============================================================================
CREATE OR REPLACE FUNCTION public.publish_fees_to_parents(
    p_fees_draft_id UUID,
    p_admin_id UUID,
    p_due_date DATE DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    notifications_created INT
) AS $$
DECLARE
    v_admin_role TEXT;
    v_student_id UUID;
    v_remaining_amount NUMERIC;
    v_notification_count INT := 0;
    v_notification_type TEXT;
    v_notification_title TEXT;
    v_notification_message TEXT;
BEGIN
    -- Verify user is admin
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RETURN QUERY SELECT FALSE, 'Only admins can publish fees'::TEXT, NULL;
        RETURN;
    END IF;
    
    -- Get student and remaining amount
    SELECT student_id, remaining_amount INTO v_student_id, v_remaining_amount
    FROM public.fees_draft
    WHERE id = p_fees_draft_id;
    
    -- Update due date if provided
    IF p_due_date IS NOT NULL THEN
        UPDATE public.fees_draft
        SET due_date = p_due_date
        WHERE id = p_fees_draft_id;
    END IF;
    
    -- Update fees draft to published
    UPDATE public.fees_draft
    SET
        submission_status = 'published',
        published_at = now(),
        published_by_id = p_admin_id
    WHERE id = p_fees_draft_id;

    -- Sync to public.fees table for parent/faculty views
    IF EXISTS (SELECT 1 FROM public.fees WHERE student_id = v_student_id) THEN
        UPDATE public.fees
        SET
            amount_due = v_remaining_amount,
            due_date = COALESCE(p_due_date, (SELECT due_date FROM public.fees_draft WHERE id = p_fees_draft_id)),
            status = CASE WHEN v_remaining_amount = 0 THEN 'paid'::TEXT ELSE 'pending'::TEXT END,
            is_published = true,
            published_at = now(),
            updated_at = now()
        WHERE student_id = v_student_id;
    ELSE
        INSERT INTO public.fees (
            student_id,
            amount_due,
            due_date,
            status,
            is_published,
            published_at,
            created_at,
            updated_at
        ) VALUES (
            v_student_id,
            v_remaining_amount,
            COALESCE(p_due_date, (SELECT due_date FROM public.fees_draft WHERE id = p_fees_draft_id)),
            CASE WHEN v_remaining_amount = 0 THEN 'paid'::TEXT ELSE 'pending'::TEXT END,
            true,
            now(),
            now(),
            now()
        );
    END IF;
    
    -- Determine notification type
    IF v_remaining_amount = 0 THEN
        v_notification_type := 'fees_paid';
        v_notification_title := 'Fees Paid ✓';
        v_notification_message := 'All fees have been paid successfully for ' || 
            (SELECT full_name FROM public.students WHERE id = v_student_id);
    ELSE
        v_notification_type := 'fees_due';
        v_notification_title := 'Outstanding Fees Due';
        v_notification_message := 'Amount Due: ₹' || v_remaining_amount::TEXT || ' for ' ||
            (SELECT full_name FROM public.students WHERE id = v_student_id) || 
            '. Due Date: ' || TO_CHAR(COALESCE(p_due_date, now()::date), 'DD MMM YYYY');
    END IF;
    
    -- Create notification for parent(s)
    INSERT INTO public.parent_notifications (
        parent_id, student_id, notification_type, title, message, metadata
    )
    SELECT
        psl.parent_id,
        v_student_id,
        v_notification_type,
        v_notification_title,
        v_notification_message,
        jsonb_build_object(
            'student_id', v_student_id,
            'total_amount', (SELECT total_amount FROM public.fees_draft WHERE id = p_fees_draft_id),
            'paid_amount', (SELECT paid_amount FROM public.fees_draft WHERE id = p_fees_draft_id),
            'remaining_amount', v_remaining_amount,
            'due_date', COALESCE(p_due_date, now()::date)
        )
    FROM public.parent_student_linking psl
    WHERE psl.student_id = v_student_id
    AND psl.is_verified = true;
    
    GET DIAGNOSTICS v_notification_count = ROW_COUNT;
    
    RETURN QUERY SELECT TRUE, 'Fees published to parents successfully'::TEXT, v_notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 13. RPC FUNCTION: Get pending attendance for admin review
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_attendance_submissions(
    p_admin_id UUID
)
RETURNS TABLE (
    tracking_id UUID,
    batch_id UUID,
    batch_name TEXT,
    attendance_date DATE,
    session TEXT,
    faculty_id UUID,
    faculty_name TEXT,
    submission_status TEXT,
    submitted_at TIMESTAMPTZ,
    admin_remarks TEXT,
    student_count INT
) AS $$
DECLARE
    v_admin_role TEXT;
BEGIN
    -- Verify user is admin
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can view pending attendance';
    END IF;
    
    RETURN QUERY
    SELECT
        ast.id as tracking_id,
        ast.batch_id,
        b.name as batch_name,
        ast.attendance_date,
        ast.session,
        ast.marked_by_id as faculty_id,
        p.full_name as faculty_name,
        ast.submission_status,
        ast.created_at as submitted_at,
        ast.admin_remarks,
        COALESCE((SELECT count(*) FROM jsonb_object_keys(a.students_attendance))::int, 0) as student_count
    FROM public.attendance_session_tracking ast
    JOIN public.batches b ON ast.batch_id = b.id
    JOIN public.profiles p ON ast.marked_by_id = p.id
    LEFT JOIN public.attendance a ON a.batch_id = ast.batch_id 
                                  AND a.attendance_date = ast.attendance_date 
                                  AND a.session = ast.session
    WHERE ast.marked_by_role = 'faculty'
    AND ast.submission_status IN ('submitted', 'approved')
    ORDER BY ast.attendance_date DESC, ast.session DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 14. RPC FUNCTION: Get pending fees for admin review
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_fees_submissions(
    p_admin_id UUID
)
RETURNS TABLE (
    fees_draft_id UUID,
    batch_id UUID,
    batch_name TEXT,
    student_id UUID,
    student_name TEXT,
    total_amount NUMERIC,
    paid_amount NUMERIC,
    remaining_amount NUMERIC,
    faculty_id UUID,
    faculty_name TEXT,
    submission_status TEXT,
    submitted_at TIMESTAMPTZ,
    admin_remarks TEXT
) AS $$
DECLARE
    v_admin_role TEXT;
BEGIN
    -- Verify user is admin
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can view pending fees';
    END IF;
    
    RETURN QUERY
    SELECT
        fd.id,
        fd.batch_id,
        b.name,
        fd.student_id,
        s.full_name,
        fd.total_amount,
        fd.paid_amount,
        fd.remaining_amount,
        fd.submitted_by_id,
        p.full_name,
        fd.submission_status,
        fd.created_at,
        fd.admin_remarks
    FROM public.fees_draft fd
    JOIN public.batches b ON fd.batch_id = b.id
    JOIN public.students s ON fd.student_id = s.id
    JOIN public.profiles p ON fd.submitted_by_id = p.id
    WHERE fd.submission_status IN ('submitted', 'approved')
    ORDER BY fd.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 15. Enable RLS on new tables
-- ============================================================================
ALTER TABLE public.attendance_session_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 16. RLS POLICIES (minimal - RPC functions handle permissions)
-- ============================================================================

-- Attendance session tracking: RPC functions handle access
CREATE POLICY "attendance_tracking_bypass" ON public.attendance_session_tracking
    FOR ALL TO authenticated USING (true);

-- Fees draft: RPC functions handle access
CREATE POLICY "fees_draft_bypass" ON public.fees_draft
    FOR ALL TO authenticated USING (true);

-- Parent notifications: Parents can only see their own
CREATE POLICY "parent_notifications_own" ON public.parent_notifications
    FOR SELECT TO authenticated USING (parent_id = auth.uid());

CREATE POLICY "parent_notifications_update" ON public.parent_notifications
    FOR UPDATE TO authenticated USING (parent_id = auth.uid());

-- ============================================================================
-- 17. Audit log entry for migration
-- ============================================================================
-- Migration complete message
-- This migration adds:
-- - attendance_session_tracking: Track morning/evening session marking with locks
-- - fees_draft: Track faculty fee submissions with approval workflow
-- - parent_notifications: Store parent notifications for dashboard display
-- - 14 RPC functions for complex workflows
-- - RLS policies for data access control

-- Added in post-migration updates:
CREATE OR REPLACE FUNCTION public.reject_fees_draft(
    p_fees_draft_id UUID,
    p_admin_id UUID,
    p_remarks TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    submission_status TEXT
) AS $$
DECLARE
    v_admin_role TEXT;
BEGIN
    -- Verify user is admin
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RETURN QUERY SELECT FALSE, 'Only admins can reject fees'::TEXT, NULL;
        RETURN;
    END IF;
    
    -- Update fees draft to rejected
    UPDATE public.fees_draft
    SET
        submission_status = 'rejected',
        approved_by_id = p_admin_id,
        approved_at = now(),
        admin_remarks = p_remarks
    WHERE id = p_fees_draft_id;
    
    RETURN QUERY SELECT TRUE, 'Fees draft rejected with remarks'::TEXT, 'rejected';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
