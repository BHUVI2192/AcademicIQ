
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkAdmins() {
    console.log('--- Checking Auth Users ---');
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error('Auth Error:', authError);
    } else {
        console.log(`Found ${users.length} users in Auth.`);
        users.forEach(u => console.log(`- ${u.email} (${u.id})`));
    }

    console.log('\n--- Checking Profiles ---');
    const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, email, role, college_id')
        .eq('role', 'admin');
    
    if (profError) {
        console.error('Profile Error:', profError);
    } else {
        console.log(`Found ${profiles.length} Admin profiles.`);
        profiles.forEach(p => console.log(`- ${p.email} (ID: ${p.id}, Role: ${p.role}, College: ${p.college_id})`));
    }
}

checkAdmins();
