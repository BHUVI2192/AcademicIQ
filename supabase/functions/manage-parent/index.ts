import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('System configuration error: Missing environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { phone, full_name, college_id, email, student_id, relationship } = await req.json();

    if (!phone || !full_name || !college_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/[^0-9]/g, '')}`;
    const internalEmail = `parent.${normalizedPhone.replace(/[^0-9]/g, '')}@academeiq.net`;
    const tempPassword = 'Parent@123';

    console.log(`[ManageParent] Phone: ${normalizedPhone}, Internal Email: ${internalEmail}`);

    // 1. Check if profile exists by phone (REGARDLESS of role)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    let userId = existingProfile?.id;
    let existingRole = existingProfile?.role;

    // 2. Ensure Auth User exists
    if (userId) {
      console.log(`[ManageParent] Existing profile found (ID: ${userId}, Role: ${existingRole}).`);
      // If they are not a parent, we don't change their role (they might be faculty), 
      // but we ensure they have the necessary metadata.
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { 
          // Preserve existing role if it's not 'parent', otherwise set to 'parent'
          role: existingRole || 'parent', 
          college_id, 
          full_name, 
          phone: normalizedPhone 
        }
      });
    } else {
      // Check if auth user exists by internal email if profile wasn't found
      const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const foundByEmail = users.find(u => u.email === internalEmail);
      
      if (foundByEmail) {
        userId = foundByEmail.id;
        console.log(`[ManageParent] Auth user found by email (ID: ${userId}) but no profile.`);
      } else {
        console.log(`[ManageParent] Creating new auth user for ${internalEmail}`);
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email: internalEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { role: 'parent', college_id, full_name, phone: normalizedPhone }
        });

        if (createErr) {
          if (createErr.message.includes('already registered')) {
            const found = users.find(u => u.email === internalEmail);
            if (found) {
              userId = found.id;
            } else {
              throw new Error(`User already registered but could not find ID for ${internalEmail}`);
            }
          } else {
            throw createErr;
          }
        } else {
          userId = newUser.user.id;
        }
      }
    }

    if (!userId) throw new Error('Failed to acquire user ID');

    // 3. Upsert Profile
    // We use upsert but we want to PRESERVE the role if it's already something else (like faculty)
    // and we only update the email if it's currently null or if the new one is provided.
    const updateData: any = {
      id: userId,
      college_id,
      full_name: full_name.trim(),
      phone: normalizedPhone,
      temp_password_set: true,
      is_active: true
    };

    // Only set role to 'parent' if it doesn't exist yet
    if (!existingRole) {
      updateData.role = 'parent';
    }

    // Only set email if provided and not already set (to avoid clobbering teacher email if it differs)
    if (email && !existingProfile?.email) {
      updateData.email = email;
    }

    const { error: profileErr } = await supabase.from('profiles').upsert(updateData);

    if (profileErr) {
      // If it's a conflict on email, and it's because of a faculty account, we skip updating email
      if (profileErr.code === '23505' && profileErr.message.includes('email')) {
        console.warn(`[ManageParent] Email ${email} already taken. Skipping email update.`);
        delete updateData.email;
        const { error: retryErr } = await supabase.from('profiles').upsert(updateData);
        if (retryErr) throw retryErr;
      } else {
        throw profileErr;
      }
    }

    // 4. Link Student if provided
    if (student_id) {
      console.log(`[ManageParent] Linking student ${student_id} to user ${userId}`);
      const { error: mapErr } = await supabase.from('parent_student_map').upsert({
        parent_id: userId,
        student_id,
        relationship: relationship || 'Parent',
        is_verified: true,
        verified_at: new Date().toISOString()
      }, { onConflict: 'parent_id,student_id' });

      if (mapErr) throw mapErr;
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[ManageParent] Error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200, // Return 200 so frontend can read the JSON error
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
