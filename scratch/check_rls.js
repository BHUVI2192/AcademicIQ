const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: "postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres"
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT 
        policyname, 
        permissive, 
        roles, 
        cmd, 
        qual, 
        with_check 
      FROM 
        pg_policies 
      WHERE 
        tablename = 'profiles';
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
