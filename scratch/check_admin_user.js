
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function checkUser() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to DB');
    const res = await client.query("SELECT id, email, created_at, last_sign_in_at FROM auth.users WHERE email = 'admin@academeiq.com'");
    if (res.rows.length > 0) {
      console.log('User found:', res.rows[0]);
    } else {
      console.log('User admin@academeiq.com NOT found');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkUser();
