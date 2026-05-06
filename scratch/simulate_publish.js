
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://tevtluhuznkovezjgohh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // I need the service role key or a valid token

// Wait, I can use the pg client to simulate it too.
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    // Get the first unpublished test
    const testRes = await client.query("SELECT id FROM public.tests WHERE is_published = false LIMIT 1");
    if (testRes.rows.length === 0) {
      console.log('No unpublished tests found.');
      return;
    }
    const testId = testRes.rows[0].id;
    console.log('Testing publish for ID:', testId);

    // Try to update
    await client.query('BEGIN');
    try {
      const updateRes = await client.query("UPDATE public.tests SET is_published = true WHERE id = $1 RETURNING *", [testId]);
      console.log('Update result:', updateRes.rows);
    } catch (err) {
      console.error('SQL Error:', err.message);
    }
    await client.query('ROLLBACK');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
