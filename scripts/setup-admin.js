import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const email = 'admin@academeiq.com';
  const password = 'password123'; // Default password

  console.log(`Checking if ${email} exists...`);
  
  // Create or update the user with email_confirm: true
  const { data: user, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'admin' }
  });

  if (createError) {
    if (createError.code === 'email_exists' || createError.message.includes('already been registered')) {
      console.log('User already exists. Updating password and confirming email...');
      
      // Get the user id
      const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error('Error listing users:', listError);
        return;
      }
      
      const existingUser = usersData.users.find(u => u.email === email);
      if (existingUser) {
         const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
           password: password,
           email_confirm: true,
           user_metadata: { role: 'admin' }
         });
         
         if (updateError) {
            console.error('Error updating user:', updateError);
         } else {
            console.log(`Successfully updated and confirmed ${email}. Password is: ${password}`);
         }
      }
    } else {
      console.error("Error creating user:", createError);
    }
  } else {
    console.log(`Successfully created and confirmed ${email}. Password is: ${password}`);
  }
}

main();
