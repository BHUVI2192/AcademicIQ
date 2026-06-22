const { createClient } = require("@supabase/supabase-js");
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://tevtluhuznkovezjgohh.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== Profiles list ===\n");
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, email');
  profiles?.forEach(p => console.log(`  ${p.role} | ${p.email} | ${p.full_name} | ${p.id}`));

  console.log("\n=== Batches list ===\n");
  const { data: batches } = await supabase
    .from('batches')
    .select('id, name, faculty_id');
  batches?.forEach(b => console.log(`  ${b.name} | faculty=${b.faculty_id} | id=${b.id}`));

  console.log("\n=== Faculty assignments ===\n");
  const { data: assignments } = await supabase
    .from('batch_faculty_assignments')
    .select('batch_id, faculty_id, is_primary');
  assignments?.forEach(a => console.log(`  batch=${a.batch_id} faculty=${a.faculty_id} primary=${a.is_primary}`));
}

main().catch(console.error);
