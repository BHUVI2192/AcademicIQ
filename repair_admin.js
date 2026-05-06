const { Client } = require('pg');


async function fix() {
  const client = new Client({
    connectionString: process.env.SUPABASE_CONNECTION_STRING
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query('SELECT id FROM auth.users WHERE email = $1', ['admin@academeiq.com']);
    
    if (res.rows.length === 0) {
      console.log('User admin@academeiq.com not found in auth.users.');
      return;
    }

    const uid = res.rows[0].id;
    console.log('Found UID:', uid);

    await client.query(
      `INSERT INTO public.profiles (id, role, full_name, is_active) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (id) DO UPDATE SET role = $2, is_active = $4`,
      [uid, 'admin', 'System Administrator', true]
    );

    console.log('✅ Admin profile fixed successfully.');
  } catch (err) {
    console.error('Error during repair:', err);
  } finally {
    await client.end();
  }
}

fix();
