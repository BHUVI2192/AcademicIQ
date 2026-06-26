const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function test() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    await client.query('BEGIN;');

    // Mock Supabase authenticated user session
    await client.query(`
      SELECT set_config('request.jwt.claims', '{"sub": "0d6700bb-86a9-4392-ac44-242a1ab1e87b", "role": "authenticated"}', true);
    `);
    await client.query(`SET LOCAL ROLE authenticated;`);

    console.log('Mocked auth session. Running checks...');
    
    // Check get_my_college_id()
    const myCollege = await client.query('SELECT public.get_my_college_id() as college_id;');
    console.log('get_my_college_id() returns:', myCollege.rows[0].college_id);

    // Check is_global_admin()
    const globalAdmin = await client.query('SELECT public.is_global_admin() as is_global;');
    console.log('is_global_admin() returns:', globalAdmin.rows[0].is_global);

    // Call RPC
    console.log('Calling approve_marks_for_test...');
    const rpcResult = await client.query(`
      SELECT * FROM public.approve_marks_for_test(
        'fb352ace-b825-4ff9-b463-788222eb8dcb'::uuid,
        '0d6700bb-86a9-4392-ac44-242a1ab1e87b'::uuid,
        'Approved via script'
      );
    `);
    console.log('RPC Result:', rpcResult.rows);

    await client.query('ROLLBACK;');
  } catch (err) {
    console.error('Error occurred:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    if (err.hint) console.error('Hint:', err.hint);
    console.error(err);
    try {
      await client.query('ROLLBACK;');
    } catch (e) {}
  } finally {
    await client.end();
  }
}

test();
