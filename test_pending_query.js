const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function testQuery() {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Let's call get_pending_attendance_for_review directly to see the error
    try {
      console.log('Testing existing get_pending_attendance_for_review...');
      const res = await client.query("SELECT * FROM public.get_pending_attendance_for_review('admin');");
      console.log('Success! Res:', res.rows);
    } catch (err) {
      console.error('Error calling get_pending_attendance_for_review:', err.message);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

testQuery();
