import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tevtluhuznkovezjgohh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldnRsdWh1em5rb3Zlempnb2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzUwNzQsImV4cCI6MjA4OTk1MTA3NH0._2_hylQjLgPDdBZie6CaOCCKwUneb9oi8HQrRkbRFZ8'
);

async function run() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@academeiq.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error('Auth error:', authErr.message);
    return;
  }
  const user = authData.user;
  
  // Get admin profile to see college_id
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  console.log('Admin profile:', profile);

  // Get a batch
  const { data: batches } = await supabase.from('batches').select('*').limit(1);
  const batch = batches[0];
  console.log('Batch:', batch);

  const { data, error } = await supabase
    .from('tests')
    .insert({
      college_id: profile.college_id || batch?.college_id,
      batch_id: batch?.id,
      created_by: user.id,
      title: 'TEST API SCRIPT',
      test_date: '2026-05-04',
      exam_category: 'Practice',
    })
    .select();

  console.log('Insert result data:', data);
  console.log('Insert result error:', error);
}

run();

run();
