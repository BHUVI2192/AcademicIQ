const { Client } = require('pg');

async function fix() {
  const client = new Client({
    connectionString: process.env.SUPABASE_CONNECTION_STRING
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const emails = ['admin@academeiq.com', 'faculty@academeiq.com'];
    const roles = {
      'admin@academeiq.com': 'admin',
      'faculty@academeiq.com': 'faculty'
    };

    for (const email of emails) {
      const res = await client.query('SELECT id FROM auth.users WHERE email = $1', [email]);
      
      if (res.rows.length === 0) {
        console.log(`User ${email} not found.`);
        continue;
      }

      const uid = res.rows[0].id;
      const role = roles[email];
      
      await client.query(
        `INSERT INTO public.profiles (id, role, full_name, is_active) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (id) DO UPDATE SET role = $2, is_active = $4`,
        [uid, role, email.split('@')[0], true]
      );
      console.log(`✅ Profile fixed for ${email} (Role: ${role})`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

fix();
