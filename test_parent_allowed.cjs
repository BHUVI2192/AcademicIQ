const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query(`
      SELECT * FROM public.check_parent_login_allowed('+919559554945')
    `);
    
    console.log('--- check_parent_login_allowed returns ---');
    console.log(res.rows);

  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await client.end();
  }
}

main();
