
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
      RETURNS trigger 
      LANGUAGE plpgsql 
      SECURITY DEFINER
      AS $$
      BEGIN
          -- Only create a profile if metadata indicates a role
          IF NEW.raw_user_meta_data ? 'role' AND NEW.raw_user_meta_data ? 'college_id' THEN
              INSERT INTO public.profiles (id, college_id, role, full_name, email, phone)
              VALUES (
                  NEW.id,
                  (NEW.raw_user_meta_data ->> 'college_id')::UUID,
                  NEW.raw_user_meta_data ->> 'role',
                  COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email, NEW.phone, 'New User'),
                  NEW.email,
                  COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone')
              )
              ON CONFLICT (id) DO NOTHING;
          END IF;
          RETURN NEW;
      END;
      $$;
    `);
    console.log('Function updated successfully');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
