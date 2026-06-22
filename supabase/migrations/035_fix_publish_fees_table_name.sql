-- ============================================================================
-- AcademeIQ Platform — Fix publish_fees_to_parents table name bug (035)
-- The function was referencing "public.parent_student_linking" which does not
-- exist. The correct table is "public.parent_student_map".
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
    
    IF v_student_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Fees draft not found'::TEXT, 0;
        RETURN;
    END IF;
    
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
    -- FIX: Use correct table name "parent_student_map" (not "parent_student_linking")
    INSERT INTO public.parent_notifications (
        parent_id, student_id, notification_type, title, message, metadata
    )
    SELECT
        psm.parent_id,
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
    FROM public.parent_student_map psm
    WHERE psm.student_id = v_student_id;
    
    GET DIAGNOSTICS v_notification_count = ROW_COUNT;
    
    RETURN QUERY SELECT TRUE, 'Fees published to parents successfully'::TEXT, v_notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
