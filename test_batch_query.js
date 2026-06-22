require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const facultyId = '5f1a3159-678c-47fd-b994-919c67067ddf';

async function testBatchQuery() {
  console.log('\n=== Testing Batch Query ===\n');
  
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
     console.error('Missing environment variables. Make sure .env is loaded');
     return;
  }

  console.log('Step 1: Raw faculty_batch_assignments query...');
  const { data: assignments, error: e1 } = await supabase
    .from('faculty_batch_assignments')
    .select('*')
    .eq('faculty_id', facultyId);
  
  if (e1) console.error('Error:', e1);
  else console.log(`Found ${assignments ? assignments.length : 0} assignments:\n`, JSON.stringify(assignments, null, 2));
  
  console.log('\n\nStep 2: Query WITH batch join (like the hook does)...');
  const { data: withJoin, error: e2 } = await supabase
    .from('faculty_batch_assignments')
    .select('batch:batches(*)')
    .eq('faculty_id', facultyId);
  
  if (e2) console.error('Error:', e2);
  else {
    console.log(`Found ${withJoin ? withJoin.length : 0} assignments:\n`);
    if (withJoin) withJoin.forEach((a, i) => {
      console.log(`Assignment ${i+1}:`, JSON.stringify(a, null, 2));
    });
  }
  
  console.log('\n\nStep 3: Test with academic_year join...');
  const { data: withAY, error: e3 } = await supabase
    .from('faculty_batch_assignments')
    .select('batch:batches(*, academic_year:academic_years(id, label))')
    .eq('faculty_id', facultyId);
  
  if (e3) console.error('Error:', e3);
  else {
    console.log(`Found ${withAY ? withAY.length : 0} assignments:\n`);
    if (withAY) withAY.forEach((a, i) => {
      console.log(`Assignment ${i+1} with AY:`, JSON.stringify(a, null, 2));
    });
  }
}

testBatchQuery().catch(console.error);
