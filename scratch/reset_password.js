const userId = '0d6700bb-86a9-4392-ac44-242a1ab1e87b';
const newPassword = 'admin123';
const supabaseUrl = 'https://tevtluhuznkovezjgohh.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldnRsdWh1em5rb3Zlempnb2hoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM3NTA3NCwiZXhwIjoyMDg5OTUxMDc0fQ.OuPJ3aZWln82AP2QlShUsNPmwzm9h7o2ji6B3iEFgXk';

async function resetPassword() {
  console.log(`Resetting password for user ${userId}...`);
  
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({
        password: newPassword,
        email_confirm: true // Ensure email is confirmed too
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Password reset successfully!');
      console.log('New credentials:');
      console.log('Email: admin@academeiq.com');
      console.log('Password: admin123');
    } else {
      console.error('❌ Failed to reset password:', data);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

resetPassword();
