
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    // 1. Update profiles table
    const res1 = await client.query(`
      UPDATE public.profiles 
      SET email = REPLACE(email, '@parent.academeiq.internal', '@parent.academeiq.com')
      WHERE email LIKE '%@parent.academeiq.internal'
    `);
    console.log(`Updated ${res1.rowCount} profiles`);

    // 2. Update auth.users table
    const res2 = await client.query(`
      UPDATE auth.users 
      SET email = REPLACE(email, '@parent.academeiq.internal', '@parent.academeiq.com')
      WHERE email LIKE '%@parent.academeiq.internal'
    `);
    console.log(`Updated ${res2.rowCount} auth users`);

    // 3. Update identities table (important for Supabase Auth)
    const res3 = await client.query(`
      UPDATE auth.identities 
      SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb(REPLACE(identity_data->>'email', '@parent.academeiq.internal', '@parent.academeiq.com')))
      WHERE identity_data->>'email' LIKE '%@parent.academeiq.internal'
    `);
    console.log(`Updated ${res3.rowCount} identities`);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
