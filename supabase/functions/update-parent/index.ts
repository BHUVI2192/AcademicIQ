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

    // Service-role client (can update auth.users)
    const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Caller-authenticated client (to verify caller is admin)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify caller role
    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can update parent details' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse request body ────────────────────────────────────────────────────
    const { parent_id, full_name, email, phone, mapping_id, relationship } = await req.json();

    if (!parent_id) {
      return new Response(JSON.stringify({ error: 'parent_id is required' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 1. Fetch existing profile ─────────────────────────────────────────────
    const { data: existingProfile, error: profileFetchErr } = await adminSupabase
      .from('profiles')
      .select('id, phone, email, role')
      .eq('id', parent_id)
      .single();

    if (profileFetchErr || !existingProfile) {
      throw new Error('Parent profile not found');
    }

    // ── 2. Handle phone change ────────────────────────────────────────────────
    const profileUpdate: any = {};
    const authUpdate: any = { user_metadata: {} };

    if (full_name?.trim()) {
      profileUpdate.full_name = full_name.trim();
      authUpdate.user_metadata.full_name = full_name.trim();
    }

    if (email !== undefined) {
      profileUpdate.email = email?.trim() || null;
    }

    if (phone) {
      const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/[^0-9]/g, '')}`;

      // Check if phone is already used by another profile
      const { data: conflict } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('phone', normalizedPhone)
        .neq('id', parent_id)
        .maybeSingle();

      if (conflict) {
        return new Response(JSON.stringify({ error: `Phone ${normalizedPhone} is already registered to another account` }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newInternalEmail = `parent.${normalizedPhone.replace(/[^0-9]/g, '')}@academeiq.net`;
      profileUpdate.phone = normalizedPhone;
      authUpdate.email = newInternalEmail;
      authUpdate.user_metadata.phone = normalizedPhone;
    }

    // ── 3. Update auth.users via admin API ────────────────────────────────────
    if (Object.keys(authUpdate).length > 1 || authUpdate.email) {
      // Only call if we have something meaningful to update
      const { error: authErr } = await adminSupabase.auth.admin.updateUserById(parent_id, authUpdate);
      if (authErr) throw new Error(`Auth update failed: ${authErr.message}`);
    }

    // ── 4. Update profiles table ──────────────────────────────────────────────
    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileErr } = await adminSupabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', parent_id);

      if (profileErr) throw new Error(`Profile update failed: ${profileErr.message}`);
    }

    // ── 5. Update relationship if mapping_id provided ─────────────────────────
    if (mapping_id && relationship) {
      const { error: mapErr } = await adminSupabase
        .from('parent_student_map')
        .update({ relationship })
        .eq('id', mapping_id);

      if (mapErr) throw new Error(`Mapping update failed: ${mapErr.message}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[UpdateParent] Error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
