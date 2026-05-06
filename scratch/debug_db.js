const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres'
  });

  try {
    await client.connect();
    console.log('Connected to DB');
    
    const res = await client.query('SELECT * FROM public.colleges');
    console.log('Colleges:', res.rows);
    
    const res2 = await client.query("SELECT conname FROM pg_constraint WHERE conrelid = 'public.colleges'::regclass");
    console.log('Constraints:', res2.rows.map(r => r.conname));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

check();
