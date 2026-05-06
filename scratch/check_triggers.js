const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: "postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres"
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT 
        trigger_name, 
        event_manipulation, 
        event_object_table, 
        action_statement 
      FROM 
        information_schema.triggers 
      WHERE 
        event_object_schema = 'auth';
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
