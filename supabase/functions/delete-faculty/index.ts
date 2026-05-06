import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Unauthorized' }, 401);

    // Verify admin status
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    
    // Get caller info
    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller) return json({ error: 'Unauthorized' }, 401);

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'admin') {
      return json({ error: 'Forbidden: Admins only' }, 403);
    }

    const { faculty_id } = await req.json();
    if (!faculty_id) return json({ error: 'faculty_id required' }, 400);

    console.log(`[DeleteFaculty] Deleting user: ${faculty_id}`);

    // 1. Check if the user is actually a faculty member (safety check)
    const { data: targetProfile, error: targetErr } = await admin
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', faculty_id)
      .single();

    if (targetErr || !targetProfile) {
      console.error(`Profile not found for ID: ${faculty_id}`, targetErr);
      return json({ error: `Faculty profile not found for ID: ${faculty_id}` }, 404);
    }

    if (targetProfile.role !== 'faculty') {
      return json({ error: 'Only faculty members can be deleted via this service' }, 400);
    }

    // 2. Delete from auth.users (cascades to profiles and assignments)
    const { error: deleteErr } = await admin.auth.admin.deleteUser(faculty_id);
    if (deleteErr) {
      console.error('Delete Auth User Error:', deleteErr);
      return json({ error: deleteErr.message }, 400);
    }

    // 3. Log the action
    await admin.from('audit_log').insert({
      college_id: caller.user_metadata?.college_id || null, // Best effort
      actor_id: caller.id,
      action: 'faculty.deleted',
      entity_type: 'profiles',
      entity_id: faculty_id,
      old_value: targetProfile,
    });

    return json({ success: true, message: 'Faculty member deleted' });

  } catch (err: any) {
    console.error('Unhandled Error:', err);
    return json({ error: err.message || 'Internal server error' }, 500);
  }
});
