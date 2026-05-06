const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function check() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query('SELECT id, email, encrypted_password, email_confirmed_at, banned_until, raw_app_meta_data, raw_user_meta_data FROM auth.users WHERE email = $1', ['admin@academeiq.com']);
    
    if (res.rows.length > 0) {
      console.log('User Status:', res.rows[0]);
    } else {
      console.log('User not found.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

check();
