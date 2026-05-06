
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'update_rls.sql'), 'utf8');
    await client.query(sql);
    console.log('RLS policy updated successfully.');
  } catch (err) {
    console.error('Error updating RLS policy:', err.message);
  } finally {
    await client.end();
  }
}

run();
