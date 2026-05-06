const { Client } = require('pg');

// Connection string from .env
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function check() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    console.log('\n--- Checking auth.users ---');
    const userRes = await client.query('SELECT id, email, encrypted_password, email_confirmed_at, last_sign_in_at FROM auth.users WHERE email = $1', ['admin@academeiq.com']);
    
    if (userRes.rows.length === 0) {
      console.log('❌ User admin@academeiq.com NOT FOUND in auth.users');
      
      console.log('\n--- All users in auth.users ---');
      const allUsers = await client.query('SELECT id, email FROM auth.users LIMIT 10');
      console.table(allUsers.rows);
    } else {
      console.log('✅ User admin@academeiq.com FOUND');
      console.log('Details:', userRes.rows[0]);
    }

    console.log('\n--- Checking public.profiles ---');
    const profileRes = await client.query('SELECT * FROM public.profiles WHERE id = (SELECT id FROM auth.users WHERE email = $1)', ['admin@academeiq.com']);
    if (profileRes.rows.length === 0) {
      console.log('❌ No profile found for this user.');
    } else {
      console.log('✅ Profile found:');
      console.table(profileRes.rows);
    }

    console.log('\n--- Checking Colleges ---');
    const collegeRes = await client.query('SELECT id, name, code FROM public.colleges');
    console.table(collegeRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

check();
