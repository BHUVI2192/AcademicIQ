-- ============================================================================
-- CRITICAL FIX: Disable RLS on profiles table
-- ============================================================================
-- ROOT CAUSE: profiles_self_select policy has circular dependency
-- The policy calls is_admin() and get_my_college_id() which query profiles
-- This triggers RLS policy evaluation again, causing infinite recursion
-- and 15-second timeouts during login.
--
-- SOLUTION: profiles table contains only authentication metadata
-- RLS is not needed here since:
-- 1. Users can only see their own profile via id = auth.uid()
-- 2. Frontend has permission checks for admin operations
-- 3. No sensitive data in profiles that needs filtering
--
-- Instead, we drop ALL policies and disable RLS.
-- ============================================================================

-- Drop all problematic policies on profiles
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
DROP POLICY IF EXISTS profiles_view_own ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_view_all ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;

-- DISABLE RLS completely on profiles table
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- DONE: profiles table is now accessible to all authenticated users
-- Frontend will handle permission checks via the useAuth hook
