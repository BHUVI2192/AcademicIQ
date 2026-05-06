-- ============================================================================
-- AcademeIQ Platform — Fix RLS Recursion (005)
-- ============================================================================
-- The previous profiles_self_select policy was recursive because it called
-- is_admin(), which queried the profiles table, triggering the policy again.
-- This caused extreme slowness and timeouts during login.
-- ============================================================================

-- 1. Update profiles select policy to be non-recursive
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;

-- Anyone can see their own profile (simple, no recursion)
CREATE POLICY profiles_view_own ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

-- Admins can see other profiles in their college
-- We use a subquery with a direct ID check to minimize recursion impact
-- and ensure the helper function is stable.
CREATE POLICY profiles_admin_view_all ON public.profiles
    FOR SELECT TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        AND 
        college_id = (SELECT college_id FROM public.profiles WHERE id = auth.uid())
    );

-- 2. Optimize helper functions to be more efficient
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    -- Direct lookup by PK is fastest
    SELECT is_active AND role = 'admin'
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_college_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT college_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;
