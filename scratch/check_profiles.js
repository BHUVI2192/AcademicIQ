const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres'
  });

  try {
    await client.connect();
    console.log('Connected to DB');
    
    const res = await client.query('SELECT * FROM public.profiles WHERE role = \'admin\'');
    console.log('Admin Profiles:', res.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

check();
