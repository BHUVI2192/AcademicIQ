-- ============================================================================
-- AcademeIQ Platform — Optimize Helpers & Fix Grants (006)
-- ============================================================================
-- Optimizes helper functions to minimize recursion and performance overhead.
-- Fixes missing grants for is_global_admin() which was causing RLS violations.
-- ============================================================================

-- 1. Optimize is_global_admin()
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role = 'admin' AND college_id IS NULL AND is_active = true
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- 2. Optimize is_faculty()
CREATE OR REPLACE FUNCTION public.is_faculty()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role = 'faculty' AND is_active = true
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- 3. Optimize is_parent()
CREATE OR REPLACE FUNCTION public.is_parent()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role = 'parent' AND is_active = true
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- 4. Optimize get_my_role()
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- 5. Fix/Ensure all grants are present
GRANT EXECUTE ON FUNCTION public.is_global_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_faculty() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_college_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.faculty_has_batch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parent_has_verified_student(UUID) TO authenticated;
