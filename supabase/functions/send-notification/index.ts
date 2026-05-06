// ============================================================================
// Edge Function: send-notification
// ============================================================================
// POST { type: 'test_published', test_id: string }
// Notifies all parents of students in the test's batch via Resend email.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@academeiq.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type NotificationType = 'test_published';
interface Body {
  type?: NotificationType;
  test_id?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured — skipping email send to', to);
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Resend error:', res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Email send failed:', err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  try {
    const { type, test_id } = (await req.json()) as Body;

    if (type !== 'test_published') {
      return json({ success: false, error: 'Unsupported notification type' }, 400);
    }
    if (!test_id || !UUID_RE.test(test_id)) {
      return json({ success: false, error: 'Invalid test_id' }, 400);
    }

    // Identify caller
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ success: false, error: 'Missing authorization' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }
    const actorId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Fetch test
    const { data: test, error: testErr } = await admin
      .from('tests')
      .select('id, title, test_date, batch_id, college_id, is_published, created_by')
      .eq('id', test_id)
      .single();

    if (testErr || !test) {
      return json({ success: false, error: 'Test not found' }, 404);
    }

    if (!test.is_published) {
      return json({ success: false, error: 'Test is not published' }, 400);
    }

    // Verify caller authorization
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, college_id')
      .eq('id', actorId)
      .single();

    if (!profile || profile.college_id !== test.college_id) {
      return json({ success: false, error: 'Forbidden' }, 403);
    }
    if (profile.role !== 'admin' && actorId !== test.created_by) {
      return json({ success: false, error: 'Forbidden' }, 403);
    }

    // Find all parents whose verified children are in this test's batch
    const { data: psm } = await admin
      .from('parent_student_map')
      .select(`
        parent_id,
        student_id,
        students!inner ( id, batch_id, full_name )
      `)
      .eq('is_verified', true)
      .eq('students.batch_id', test.batch_id);

    if (!psm || psm.length === 0) {
      return json({ success: true, recipients: 0, sent: 0 });
    }

    const parentIds = [...new Set(psm.map((r) => r.parent_id))];

    const { data: parents } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', parentIds);

    if (!parents || parents.length === 0) {
      return json({ success: true, recipients: 0, sent: 0 });
    }

    const subject = `New test results published: ${test.title}`;
    let sent = 0;

    for (const parent of parents) {
      if (!parent.email) continue;
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111;">New Test Results Available</h2>
          <p>Dear ${parent.full_name ?? 'Parent'},</p>
          <p>The results for <strong>${test.title}</strong> (${test.test_date}) have been published.</p>
          <p>Please log in to AcademeIQ to view your child's performance and ranking.</p>
          <p style="margin-top: 32px; color: #666; font-size: 12px;">
            This is an automated notification from AcademeIQ.
          </p>
        </div>
      `;
      const ok = await sendEmail(parent.email, subject, html);
      if (ok) sent++;
    }

    await admin.from('audit_log').insert({
      college_id: test.college_id,
      actor_id: actorId,
      action: 'notification.sent',
      entity_type: 'tests',
      entity_id: test.id,
      new_value: { type, recipients: parents.length, sent },
    });

    return json({ success: true, recipients: parents.length, sent });
  } catch (err) {
    console.error('Unhandled error:', err);
    return json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      500
    );
  }
});
