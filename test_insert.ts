import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './apps/web/.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: { user }, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@academeiq.com', // Replace with an admin email if known
    password: 'password123'       // Replace if known
  });

  if (authErr) {
    console.error('Auth error:', authErr.message);
    // If auth fails, we can't test RLS easily. Let's just output this.
    return;
  }

  console.log('Logged in as', user?.email);

  const collegeId = '00000000-0000-0000-0000-000000000000'; // dummy
  
  // Try inserting a test to see the error
  const { data, error } = await supabase
    .from('tests')
    .insert({
      college_id: 'd9b9b9b9-b9b9-4b9b-8b9b-9b9b9b9b9b9b', // Random uuid
      batch_id: 'd9b9b9b9-b9b9-4b9b-8b9b-9b9b9b9b9b9b',
      created_by: user!.id,
      title: 'TEST',
      test_date: '2026-05-04',
      exam_category: 'Practice',
    })
    .select();

  console.log('Insert result:', error || 'Success');
}

run();
