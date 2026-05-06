
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    // 1. Update profiles table
    // Matches both .internal and the .com we briefly had
    const res1 = await client.query(`
      UPDATE public.profiles 
      SET email = 'parent.' || regexp_replace(phone, '[^0-9]', '', 'g') || '@academeiq.net'
      WHERE email LIKE '%@parent.academeiq.internal' OR email LIKE '%@parent.academeiq.com'
    `);
    console.log(`Updated ${res1.rowCount} profiles`);

    // 2. Update auth.users table
    const res2 = await client.query(`
      UPDATE auth.users 
      SET email = 'parent.' || regexp_replace(phone, '[^0-9]', '', 'g') || '@academeiq.net'
      WHERE email LIKE '%@parent.academeiq.internal' OR email LIKE '%@parent.academeiq.com'
    `);
    console.log(`Updated ${res2.rowCount} auth users`);

    // 3. Update identities table
    const res3 = await client.query(`
      UPDATE auth.identities 
      SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb('parent.' || regexp_replace(identity_data->>'email', '[^0-9]', '', 'g') || '@academeiq.net'))
      WHERE identity_data->>'email' LIKE '%@parent.academeiq.internal' OR identity_data->>'email' LIKE '%@parent.academeiq.com'
    `);
    console.log(`Updated ${res3.rowCount} identities`);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
