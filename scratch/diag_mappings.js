
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT p.phone, p.full_name, p.id as profile_id, m.student_id 
      FROM public.profiles p 
      LEFT JOIN public.parent_student_map m ON p.id = m.parent_id 
      WHERE p.role = 'parent'
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
