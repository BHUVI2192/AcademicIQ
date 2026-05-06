
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function applySpecificMigration() {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '010_parent_auth_rpc.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration: 010_parent_auth_rpc.sql');
    await client.query(sql);
    console.log('Successfully applied 010_parent_auth_rpc.sql');

  } catch (err) {
    console.error('Error applying migration:', err);
  } finally {
    await client.end();
  }
}

applySpecificMigration();
