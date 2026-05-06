
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT routine_definition 
      FROM information_schema.routines 
      WHERE routine_name = 'check_parent_login_allowed'
    `);
    console.log(res.rows[0].routine_definition);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
