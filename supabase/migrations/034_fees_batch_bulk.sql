-- ============================================================================
-- AcademeIQ Platform — Batch-level Bulk Fees Operations & Bug Fixes (034)
-- ============================================================================

-- 1. Fix publish_all_fees_to_parents SQL ambiguity by using a query alias
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
        -- Call existing single publish_fees_to_parents for each approved draft, qualifying fields with alias r
        SELECT r.success, r.notifications_created INTO v_success, v_notif_count
        FROM public.publish_fees_to_parents(v_draft.id, p_admin_id, p_due_date) r;
        
        IF v_success THEN
            v_pub_count := v_pub_count + 1;
            v_notif_total := v_notif_total + COALESCE(v_notif_count, 0);
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT TRUE, 'All approved fees published successfully'::TEXT, v_pub_count, v_notif_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 2. Create approve_batch_fees_drafts to bulk-approve all submitted drafts in a single batch
CREATE OR REPLACE FUNCTION public.approve_batch_fees_drafts(
    p_batch_id UUID,
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
    WHERE batch_id = p_batch_id 
      AND submission_status = 'submitted';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT TRUE, 'Batch fees approved successfully'::TEXT, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. Create publish_batch_fees_to_parents to publish all approved drafts in a single batch
CREATE OR REPLACE FUNCTION public.publish_batch_fees_to_parents(
    p_batch_id UUID,
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
    
    -- Loop through approved drafts in the batch
    FOR v_draft IN 
        SELECT id FROM public.fees_draft 
        WHERE batch_id = p_batch_id 
          AND submission_status = 'approved'
    LOOP
        -- Call existing single publish_fees_to_parents for each approved draft, qualifying fields with alias r
        SELECT r.success, r.notifications_created INTO v_success, v_notif_count
        FROM public.publish_fees_to_parents(v_draft.id, p_admin_id, p_due_date) r;
        
        IF v_success THEN
            v_pub_count := v_pub_count + 1;
            v_notif_total := v_notif_total + COALESCE(v_notif_count, 0);
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT TRUE, 'Batch approved fees published successfully'::TEXT, v_pub_count, v_notif_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
