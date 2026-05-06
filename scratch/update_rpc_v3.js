
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      CREATE OR REPLACE FUNCTION public.check_parent_login_allowed(p_phone text)
      RETURNS TABLE(id uuid, email text, has_linked_student boolean, temp_password_set boolean)
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
          RETURN QUERY
          SELECT 
              p.id,
              'parent.' || regexp_replace(p.phone, '[^0-9]', '', 'g') || '@academeiq.net' as email,
              EXISTS (SELECT 1 FROM parent_student_map m WHERE m.parent_id = p.id) as has_linked_student,
              p.temp_password_set
          FROM profiles p
          WHERE p.phone = p_phone AND p.role = 'parent';
      END;
      $$;
    `);
    console.log('RPC updated successfully with parent.prefix@academeiq.net');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
