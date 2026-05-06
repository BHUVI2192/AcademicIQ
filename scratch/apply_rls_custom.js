
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function run() {
  const fileName = process.argv[2];
  if (!fileName) {
    console.error('Please specify a filename');
    process.exit(1);
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const sql = fs.readFileSync(path.join(__dirname, fileName), 'utf8');
    await client.query(sql);
    console.log(`${fileName} applied successfully.`);
  } catch (err) {
    console.error(`Error applying ${fileName}:`, err.message);
  } finally {
    await client.end();
  }
}

run();
