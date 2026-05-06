
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function applySeed() {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to database for seeding');

    const seedFile = path.join(__dirname, 'supabase', 'seed.sql');
    if (fs.existsSync(seedFile)) {
      console.log('Applying seed data...');
      const sql = fs.readFileSync(seedFile, 'utf8');
      await client.query(sql);
      console.log('Seed data applied successfully');
    } else {
      console.log('Seed file not found');
    }
  } catch (err) {
    console.error('Error applying seed data:', err);
  } finally {
    await client.end();
  }
}

applySeed();
