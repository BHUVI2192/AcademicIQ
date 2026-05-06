
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'public.profiles'::regclass 
      AND conname = 'phone_required_for_parents'
    `);
    console.log(res.rows[0]?.pg_get_constraintdef);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
