const { createClient } = require('@supabase/supabase-js');


const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = `
-- 1. Create is_global_admin helper
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND college_id IS NULL AND is_active = true
    )
$$;

-- 2. Update Colleges Policies
DROP POLICY IF EXISTS colleges_global_admin_insert ON public.colleges;
CREATE POLICY colleges_global_admin_insert ON public.colleges
    FOR INSERT TO authenticated
    WITH CHECK (is_global_admin());

DROP POLICY IF EXISTS colleges_global_admin_update ON public.colleges;
CREATE POLICY colleges_global_admin_update ON public.colleges
    FOR UPDATE TO authenticated
    USING (is_global_admin())
    WITH CHECK (is_global_admin());

DROP POLICY IF EXISTS colleges_global_admin_delete ON public.colleges;
CREATE POLICY colleges_global_admin_delete ON public.colleges
    FOR DELETE TO authenticated
    USING (is_global_admin());

-- 3. Update Profiles Policies to allow Global Admin to see/manage all
DROP POLICY IF EXISTS profiles_global_admin_all ON public.profiles;
CREATE POLICY profiles_global_admin_all ON public.profiles
    FOR ALL TO authenticated
    USING (is_global_admin())
    WITH CHECK (is_global_admin());

-- 4. Update Academic Years Policies
DROP POLICY IF EXISTS academic_years_global_admin_all ON public.academic_years;
CREATE POLICY academic_years_global_admin_all ON public.academic_years
    FOR ALL TO authenticated
    USING (is_global_admin())
    WITH CHECK (is_global_admin());

-- 5. Update Departments Policies
DROP POLICY IF EXISTS departments_global_admin_all ON public.departments;
CREATE POLICY departments_global_admin_all ON public.departments
    FOR ALL TO authenticated
    USING (is_global_admin())
    WITH CHECK (is_global_admin());

-- 6. Update Batches Policies
DROP POLICY IF EXISTS batches_global_admin_all ON public.batches;
CREATE POLICY batches_global_admin_all ON public.batches
    FOR ALL TO authenticated
    USING (is_global_admin())
    WITH CHECK (is_global_admin());

-- 7. Update Students Policies
DROP POLICY IF EXISTS students_global_admin_all ON public.students;
CREATE POLICY students_global_admin_all ON public.students
    FOR ALL TO authenticated
    USING (is_global_admin())
    WITH CHECK (is_global_admin());

-- 8. Update Parent Student Map Policies
DROP POLICY IF EXISTS psm_global_admin_all ON public.parent_student_map;
CREATE POLICY psm_global_admin_all ON public.parent_student_map
    FOR ALL TO authenticated
    USING (is_global_admin())
    WITH CHECK (is_global_admin());

-- 9. Update Audit Log Policies
DROP POLICY IF EXISTS audit_log_global_admin_all ON public.audit_log;
CREATE POLICY audit_log_global_admin_all ON public.audit_log
    FOR SELECT TO authenticated
    USING (is_global_admin());
`;

async function repair() {
  console.log('🚀 Applying RLS repairs for Global Admin...');
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    if (error.message.includes('function "exec_sql" does not exist')) {
      console.log('⚠️ exec_sql not found. This is expected if it was not set up.');
      console.log('I will attempt to apply the policies via multiple queries if possible, or you may need to run this in the Supabase SQL Editor.');
      
      // Fallback: If exec_sql is missing, we can't easily run arbitrary SQL via the client.
      // But we can try to provide the SQL for the user to run.
      console.log('\n--- PLEASE RUN THIS SQL IN YOUR SUPABASE SQL EDITOR ---');
      console.log(sql);
      console.log('-------------------------------------------------------\n');
    } else {
      console.error('❌ Error:', error);
    }
  } else {
    console.log('✅ RLS policies updated successfully!');
  }
}

repair();
