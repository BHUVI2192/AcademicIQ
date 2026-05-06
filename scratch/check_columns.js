const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function checkColumns() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'students'
    `);
    console.log('Students table columns:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
checkColumns();
