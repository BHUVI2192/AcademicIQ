-- ============================================================================
-- AcademeIQ Platform — Parent Auth RPC (010)
-- ============================================================================
-- Adds a secure function to verify parent login status before authentication.
-- This allows anonymous users to check if a phone number corresponds to a 
-- valid parent account with at least one linked student, without exposing
-- the entire profiles or parent_student_map tables via RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_parent_login_allowed(p_phone TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    has_linked_student BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.full_name,
        EXISTS (
            SELECT 1 FROM public.parent_student_map psm
            WHERE psm.parent_id = p.id
        ) as has_linked_student
    FROM public.profiles p
    WHERE p.phone = p_phone
      AND p.role = 'parent'
      AND p.is_active = true
    LIMIT 1;
END;
$$;

-- Grant access to both anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.check_parent_login_allowed(TEXT) TO anon, authenticated;

-- ============================================================================
-- DONE
-- ============================================================================
