
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query("SELECT batch_id FROM public.tests WHERE id = 'b464b174-8db4-42ff-a381-61495529b25d'");
    const batchId = res.rows[0].batch_id;
    console.log('Batch ID:', batchId);
    
    const assignRes = await client.query("SELECT faculty_id FROM public.faculty_batch_assignments WHERE batch_id = $1", [batchId]);
    console.log('Assigned Faculty IDs:', assignRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
