const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: "postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres"
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT 
        conname AS constraint_name,
        conrelid::regclass AS table_name,
        a.attname AS column_name,
        confrelid::regclass AS foreign_table_name,
        af.attname AS foreign_column_name
      FROM pg_constraint AS c
      JOIN pg_attribute AS a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      JOIN pg_attribute AS af ON af.attrelid = c.confrelid AND af.attnum = ANY (c.confkey)
      WHERE c.contype = 'f' AND conrelid::regclass::text = 'profiles';
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
