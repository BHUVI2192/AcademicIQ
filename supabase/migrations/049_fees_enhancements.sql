-- ============================================================================
-- AcademeIQ Platform — Fees History & Faculty Edit Support (049)
-- ============================================================================

-- 1. Redefine submit_fees_draft to support updating draft in ANY status
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
    v_draft_id UUID;
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
    
    -- Check if there's any existing draft for this student in this batch
    SELECT id INTO v_draft_id 
    FROM public.fees_draft 
    WHERE batch_id = p_batch_id 
      AND student_id = p_student_id 
    LIMIT 1;
    
    IF v_draft_id IS NOT NULL THEN
        UPDATE public.fees_draft
        SET
            total_amount = p_total_amount,
            paid_amount = p_paid_amount,
            due_date = COALESCE(p_due_date, due_date),
            submission_status = 'draft', -- Revert status to draft for review
            admin_remarks = NULL,         -- Clear any previous rejection remarks
            approved_by_id = NULL,
            approved_at = NULL,
            published_at = NULL,
            published_by_id = NULL,
            submitted_by_id = p_faculty_id, -- Update editor
            updated_at = now()
        WHERE id = v_draft_id;
    ELSE
        -- Insert new fees draft
        INSERT INTO public.fees_draft (
            batch_id, student_id, total_amount, paid_amount, submitted_by_id, 
            submission_status, due_date, updated_at
        ) VALUES (
            p_batch_id, p_student_id, p_total_amount, p_paid_amount, p_faculty_id,
            'draft', p_due_date, now()
        );
    END IF;
    
    RETURN QUERY SELECT TRUE, 'Fees draft saved successfully'::TEXT, v_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 2. Redefine set_global_fees_draft to support resetting any existing draft to draft status
CREATE OR REPLACE FUNCTION public.set_global_fees_draft(
    p_batch_id UUID,
    p_total_amount NUMERIC,
    p_faculty_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    updated_count INT
) AS $$
DECLARE
    v_faculty_role TEXT;
    v_student RECORD;
    v_count INT := 0;
    v_draft_id UUID;
BEGIN
    -- Verify user is faculty
    SELECT role INTO v_faculty_role FROM public.profiles WHERE id = p_faculty_id;
    IF v_faculty_role != 'faculty' THEN
        RETURN QUERY SELECT FALSE, 'Only faculty can set fees'::TEXT, 0;
        RETURN;
    END IF;
    
    -- Loop through all active students in the batch
    FOR v_student IN 
        SELECT id FROM public.students WHERE batch_id = p_batch_id AND is_active = true
    LOOP
        -- Check if there is already a draft
        SELECT id INTO v_draft_id 
        FROM public.fees_draft 
        WHERE batch_id = p_batch_id 
          AND student_id = v_student.id 
        LIMIT 1;
        
        IF v_draft_id IS NOT NULL THEN
            UPDATE public.fees_draft
            SET
                total_amount = p_total_amount,
                submission_status = 'draft', -- Reset to draft
                admin_remarks = NULL,         -- Clear any previous rejection remarks
                approved_by_id = NULL,
                approved_at = NULL,
                published_at = NULL,
                published_by_id = NULL,
                submitted_by_id = p_faculty_id,
                updated_at = now()
            WHERE id = v_draft_id;
            v_count := v_count + 1;
        ELSE
            -- Insert a new draft record
            INSERT INTO public.fees_draft (
                batch_id, student_id, total_amount, paid_amount, submitted_by_id, 
                submission_status, updated_at
            ) VALUES (
                p_batch_id, v_student.id, p_total_amount, 0, p_faculty_id,
                'draft', now()
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT TRUE, 'Global fees set successfully for all active students'::TEXT, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. Create RPC function to retrieve published fees history
CREATE OR REPLACE FUNCTION public.get_published_fees_history(
    p_admin_id UUID
)
RETURNS TABLE (
    fees_draft_id UUID,
    batch_id UUID,
    batch_name TEXT,
    student_id UUID,
    student_name TEXT,
    student_roll_number TEXT,
    total_amount NUMERIC,
    paid_amount NUMERIC,
    remaining_amount NUMERIC,
    faculty_id UUID,
    faculty_name TEXT,
    submission_status TEXT,
    published_at TIMESTAMPTZ,
    due_date DATE,
    admin_remarks TEXT
) AS $$
DECLARE
    v_admin_role TEXT;
BEGIN
    -- Verify user is admin
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can view fees history';
    END IF;
    
    RETURN QUERY
    SELECT
        fd.id,
        fd.batch_id,
        b.name,
        fd.student_id,
        s.full_name,
        s.roll_number,
        fd.total_amount,
        fd.paid_amount,
        fd.remaining_amount,
        fd.submitted_by_id,
        p.full_name,
        fd.submission_status,
        fd.published_at,
        fd.due_date,
        fd.admin_remarks
    FROM public.fees_draft fd
    JOIN public.batches b ON fd.batch_id = b.id
    JOIN public.students s ON fd.student_id = s.id
    JOIN public.profiles p ON fd.submitted_by_id = p.id
    WHERE fd.submission_status = 'published'
    ORDER BY fd.published_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
