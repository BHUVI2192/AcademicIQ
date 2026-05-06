import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

const sql = `
-- ============================================================================
-- 1. CLEANUP BAD POLICIES
-- ============================================================================
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
DROP POLICY IF EXISTS profiles_view_own ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_view_all ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_view_college ON public.profiles;

-- ============================================================================
-- 2. CREATE SECURITY DEFINER HELPERS
-- ============================================================================
-- These functions bypass RLS because they are SECURITY DEFINER.
-- We use PL/pgSQL to be more explicit.

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    is_adm BOOLEAN;
BEGIN
    SELECT (role = 'admin' AND is_active = true) INTO is_adm
    FROM profiles
    WHERE id = auth.uid();
    RETURN COALESCE(is_adm, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_my_college_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    cid UUID;
BEGIN
    SELECT college_id INTO cid
    FROM profiles
    WHERE id = auth.uid();
    RETURN cid;
END;
$$;

-- ============================================================================
-- 3. APPLY NON-RECURSIVE POLICIES
-- ============================================================================

-- Policy 1: Always allow users to see their own profile
-- This is a simple PK check, very fast.
CREATE POLICY profiles_view_self ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

-- Policy 2: Allow admins to see other profiles in their college
-- This uses the SECURITY DEFINER function to check the caller's role,
-- which breaks the recursion loop.
CREATE POLICY profiles_admin_view_others ON public.profiles
    FOR SELECT TO authenticated
    USING (
        check_is_admin() 
        AND 
        college_id = check_my_college_id()
    );

-- Also fix the INSERT/UPDATE policies which might have the same issue
DROP POLICY IF EXISTS profiles_admin_insert ON public.profiles;
CREATE POLICY profiles_admin_insert ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (check_is_admin() AND college_id = check_my_college_id());

DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
    FOR UPDATE TO authenticated
    USING (check_is_admin() AND college_id = check_my_college_id())
    WITH CHECK (check_is_admin() AND college_id = check_my_college_id());
`;

async function run() {
  const client = new Client({ connectionString: decodeURIComponent(connectionString) });
  try {
    await client.connect();
    console.log('Connected to database.');
    await client.query(sql);
    console.log('RLS Recursion Fix applied successfully.');
  } catch (err) {
    console.error('Error applying RLS fix:', err);
  } finally {
    await client.end();
  }
}

run();
