const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Bhuvan%409988@db.tevtluhuznkovezjgohh.supabase.co:6543/postgres';

async function fix() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // Get all colleges
    const collegesRes = await client.query('SELECT id, name, code FROM public.colleges');
    const colleges = collegesRes.rows;

    for (const college of colleges) {
      // Check if this college has any academic year
      const yearsRes = await client.query('SELECT id FROM public.academic_years WHERE college_id = $1', [college.id]);
      
      if (yearsRes.rows.length === 0) {
        console.log(`Adding academic year for ${college.name} (${college.code})...`);
        
        await client.query(
          `INSERT INTO public.academic_years (college_id, label, is_current, starts_at, ends_at) 
           VALUES ($1, $2, $3, $4, $5)`,
          [college.id, '2025-26', true, '2025-06-01', '2026-05-31']
        );
        console.log(`✅ Added 2025-26 to ${college.code}`);
      } else {
        console.log(`College ${college.code} already has academic years.`);
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

fix();
