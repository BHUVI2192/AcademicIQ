
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT count(*), id 
      FROM public.tests 
      GROUP BY id 
      HAVING count(*) > 1
    `);
    console.log('Duplicate IDs:', res.rows);
    
    const countRes = await client.query('SELECT count(*) FROM public.tests');
    console.log('Total tests:', countRes.rows[0].count);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
