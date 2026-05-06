
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tevtluhuznkovezjgohh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldnRsdWh1em5rb3Zlempnb2hoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM3NTA3NCwiZXhwIjoyMDg5OTUxMDc0fQ.OuPJ3aZWln82AP2QlShUsNPmwzm9h7o2ji6B3iEFgXk'
);

async function fixSchema() {
  console.log('Adding temp_password_set column to profiles...');
  
  // Try to use a custom function if available, or we might need to use the SQL API if enabled
  // But usually rpc('exec_sql') is not standard. 
  // Let's try to just do a dummy update to see if the column exists first
  const { error: checkError } = await supabase.from('profiles').select('temp_password_set').limit(1);
  
  if (checkError && checkError.message.includes('column "temp_password_set" does not exist')) {
    console.log('Column is indeed missing. Attempting to add via migration sequence or manual SQL if possible.');
    console.log('Since migrations failed, please run the following SQL in your Supabase SQL Editor:');
    console.log(`
      ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS temp_password_set BOOLEAN NOT NULL DEFAULT false;

      UPDATE public.profiles
      SET temp_password_set = true
      WHERE role = 'parent';

      CREATE INDEX IF NOT EXISTS idx_profiles_parent_phone 
      ON public.profiles (phone) 
      WHERE role = 'parent' AND phone IS NOT NULL;
    `);
  } else if (checkError) {
    console.error('Check error:', checkError);
  } else {
    console.log('Column exists! Try restarting your dev server or clearing the Supabase cache.');
  }
}

fixSchema();
