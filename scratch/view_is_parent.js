
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query("SELECT prosrc FROM pg_proc WHERE proname = 'is_parent'");
    console.log(res.rows[0].prosrc);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
