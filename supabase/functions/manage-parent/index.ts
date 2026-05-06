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

    // 1. Check if profile exists by phone
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', normalizedPhone)
      .eq('role', 'parent')
      .maybeSingle();

    let userId = existingProfile?.id;

    // 2. Ensure Auth User exists with internal email
    if (userId) {
      console.log(`[ManageParent] Updating auth user ${userId}`);
      await supabase.auth.admin.updateUserById(userId, {
        email: internalEmail,
        password: tempPassword,
        user_metadata: { role: 'parent', college_id, full_name, phone: normalizedPhone },
        email_confirm: true
      });
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
          console.log('[ManageParent] User exists in Auth but not in Profiles. Syncing...');
          const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
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

    if (!userId) throw new Error('Failed to acquire user ID');

    // 3. Upsert Profile
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: userId,
      college_id,
      role: 'parent',
      full_name: full_name.trim(),
      phone: normalizedPhone,
      email: email || null,
      temp_password_set: true,
      is_active: true
    });

    if (profileErr) {
      if (profileErr.code === '23505' && profileErr.message.includes('email')) {
        throw new Error(`The email "${email}" is already used by another account (likely your faculty account). Please leave it blank or use a different one.`);
      }
      throw profileErr;
    }

    // 4. Link Student if provided
    if (student_id) {
      console.log(`[ManageParent] Linking student ${student_id} to parent ${userId}`);
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
