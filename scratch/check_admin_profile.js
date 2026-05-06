
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function checkProfile() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query("SELECT * FROM public.profiles WHERE id = '0d6700bb-86a9-4392-ac44-242a1ab1e87b'");
    console.log('Profile:', res.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkProfile();
