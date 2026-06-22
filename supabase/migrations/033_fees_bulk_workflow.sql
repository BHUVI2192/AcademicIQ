-- ============================================================================
-- AcademeIQ Platform — Bulk Fees Workflow Enhancements (033)
-- ============================================================================

-- 1. Update submit_fees_draft to support update/upsert on draft or rejected status
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
    
    -- Check if there's an existing draft (draft or rejected)
    SELECT id INTO v_draft_id 
    FROM public.fees_draft 
    WHERE batch_id = p_batch_id 
      AND student_id = p_student_id 
      AND submitted_by_id = p_faculty_id 
      AND submission_status IN ('draft', 'rejected')
    LIMIT 1;
    
    IF v_draft_id IS NOT NULL THEN
        UPDATE public.fees_draft
        SET
            total_amount = p_total_amount,
            paid_amount = p_paid_amount,
            due_date = p_due_date,
            submission_status = 'draft', -- Reset status to draft so it can be edited/resubmitted
            admin_remarks = NULL,         -- Clear any previous rejection remarks
            approved_by_id = NULL,
            approved_at = NULL,
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


-- 2. Create set_global_fees_draft to apply a global amount to all active students in a batch
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
        -- Check if there is already a draft or rejected draft
        SELECT id INTO v_draft_id 
        FROM public.fees_draft 
        WHERE batch_id = p_batch_id 
          AND student_id = v_student.id 
          AND submitted_by_id = p_faculty_id 
          AND submission_status IN ('draft', 'rejected')
        LIMIT 1;
        
        IF v_draft_id IS NOT NULL THEN
            UPDATE public.fees_draft
            SET
                total_amount = p_total_amount,
                submission_status = 'draft', -- Reset to draft if it was rejected
                admin_remarks = NULL,         -- Clear any previous rejection remarks
                approved_by_id = NULL,
                approved_at = NULL,
                updated_at = now()
            WHERE id = v_draft_id;
            v_count := v_count + 1;
        ELSE
            -- Check if they already have a 'submitted', 'approved', or 'published' draft.
            -- If not, we insert a new 'draft' record.
            IF NOT EXISTS (
                SELECT 1 FROM public.fees_draft 
                WHERE batch_id = p_batch_id 
                  AND student_id = v_student.id 
                  AND submission_status IN ('submitted', 'approved', 'published')
            ) THEN
                INSERT INTO public.fees_draft (
                    batch_id, student_id, total_amount, paid_amount, submitted_by_id, 
                    submission_status, updated_at
                ) VALUES (
                    p_batch_id, v_student.id, p_total_amount, 0, p_faculty_id,
                    'draft', now()
                );
                v_count := v_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT TRUE, 'Global fees set successfully for all active students'::TEXT, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. Create submit_all_fees_draft_to_admin to submit all drafts/rejected drafts in a batch
CREATE OR REPLACE FUNCTION public.submit_all_fees_draft_to_admin(
    p_batch_id UUID,
    p_faculty_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    submitted_count INT
) AS $$
DECLARE
    v_faculty_role TEXT;
    v_count INT;
BEGIN
    -- Verify user is faculty
    SELECT role INTO v_faculty_role FROM public.profiles WHERE id = p_faculty_id;
    IF v_faculty_role != 'faculty' THEN
        RETURN QUERY SELECT FALSE, 'Only faculty can submit fees'::TEXT, 0;
        RETURN;
    END IF;

    UPDATE public.fees_draft
    SET 
        submission_status = 'submitted',
        updated_at = now()
    WHERE batch_id = p_batch_id
      AND submitted_by_id = p_faculty_id
      AND submission_status IN ('draft', 'rejected');
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT TRUE, 'All draft fees submitted to admin'::TEXT, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 4. Create approve_all_fees_drafts to bulk-approve all submitted drafts
CREATE OR REPLACE FUNCTION public.approve_all_fees_drafts(
    p_admin_id UUID,
    p_remarks TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    approved_count INT
) AS $$
DECLARE
    v_admin_role TEXT;
    v_count INT;
BEGIN
    -- Verify user is admin
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RETURN QUERY SELECT FALSE, 'Only admins can approve fees'::TEXT, 0;
        RETURN;
    END IF;
    
    UPDATE public.fees_draft
    SET
        submission_status = 'approved',
        approved_by_id = p_admin_id,
        approved_at = now(),
        admin_remarks = COALESCE(p_remarks, admin_remarks)
    WHERE submission_status = 'submitted';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT TRUE, 'All submitted fees approved successfully'::TEXT, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5. Create publish_all_fees_to_parents to publish all approved drafts in one command
CREATE OR REPLACE FUNCTION public.publish_all_fees_to_parents(
    p_admin_id UUID,
    p_due_date DATE DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    published_count INT,
    notifications_created INT
) AS $$
DECLARE
    v_admin_role TEXT;
    v_draft RECORD;
    v_pub_count INT := 0;
    v_notif_total INT := 0;
    v_success BOOLEAN;
    v_notif_count INT;
BEGIN
    -- Verify user is admin
    SELECT role INTO v_admin_role FROM public.profiles WHERE id = p_admin_id;
    IF v_admin_role != 'admin' THEN
        RETURN QUERY SELECT FALSE, 'Only admins can publish fees'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- Loop through all approved drafts
    FOR v_draft IN 
        SELECT id FROM public.fees_draft WHERE submission_status = 'approved'
    LOOP
        -- Call existing single publish_fees_to_parents for each approved draft
        SELECT success, notifications_created INTO v_success, v_notif_count
        FROM public.publish_fees_to_parents(v_draft.id, p_admin_id, p_due_date);
        
        IF v_success THEN
            v_pub_count := v_pub_count + 1;
            v_notif_total := v_notif_total + COALESCE(v_notif_count, 0);
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT TRUE, 'All approved fees published successfully'::TEXT, v_pub_count, v_notif_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
