// ============================================================================
// Edge Function: recalculate-rankings
// ============================================================================
// POST { test_id: string }
// Authorizes the caller (must be the test creator or service_role),
// then calls the recalculate_rankings(p_test_id) stored procedure.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Body {
  test_id?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  try {
    const { test_id } = (await req.json()) as Body;
    if (!test_id || !UUID_RE.test(test_id)) {
      return json({ success: false, error: 'Invalid test_id' }, 400);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    // Service role client for actually executing the RPC
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Identify caller
    let actorId: string | null = null;
    let isServiceRole = false;

    if (token === SERVICE_ROLE_KEY) {
      isServiceRole = true;
    } else if (token) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) {
        return json({ success: false, error: 'Unauthorized' }, 401);
      }
      actorId = userData.user.id;
    } else {
      return json({ success: false, error: 'Missing authorization' }, 401);
    }

    // Verify caller is allowed: service_role OR admin OR test creator
    if (!isServiceRole) {
      const { data: test, error: testErr } = await admin
        .from('tests')
        .select('id, created_by, college_id')
        .eq('id', test_id)
        .single();

      if (testErr || !test) {
        return json({ success: false, error: 'Test not found' }, 404);
      }

      const { data: profile } = await admin
        .from('profiles')
        .select('role, college_id')
        .eq('id', actorId!)
        .single();

      if (!profile) {
        return json({ success: false, error: 'Profile not found' }, 403);
      }

      const isAdminInCollege =
        profile.role === 'admin' && profile.college_id === test.college_id;
      const isTestCreator = test.created_by === actorId;

      if (!isAdminInCollege && !isTestCreator) {
        return json({ success: false, error: 'Forbidden' }, 403);
      }
    }

    // Execute the ranking recompute
    const { data, error } = await admin.rpc('recalculate_rankings', {
      p_test_id: test_id,
    });

    if (error) {
      console.error('RPC error:', error);
      return json({ success: false, error: error.message }, 500);
    }

    return json({ success: true, students_ranked: data ?? 0 });
  } catch (err) {
    console.error('Unhandled error:', err);
    return json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      500
    );
  }
});
