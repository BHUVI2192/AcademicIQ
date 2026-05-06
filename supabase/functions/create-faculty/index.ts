// ============================================================================
// Edge Function: create-faculty
// ============================================================================
// POST { college_id, full_name, email, phone? }
// Creates an auth user + profile for a faculty member,
// then emails their credentials via SMTP (Gmail) or Resend.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import nodemailer from 'npm:nodemailer';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY            = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY      = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL          = Deno.env.get('FROM_EMAIL') ?? 'noreply@academeiq.app';
const FROM_NAME           = Deno.env.get('FROM_NAME') ?? 'AcademeIQ';
const APP_URL             = Deno.env.get('APP_URL') ?? 'https://academeiq.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Generate a readable random password: e.g. Violet@7342 */
function generatePassword(): string {
  const adjectives = ['Blue', 'Green', 'Swift', 'Bright', 'Gold', 'Silver', 'Coral', 'Violet', 'Amber', 'Teal'];
  const nouns      = ['Eagle', 'River', 'Stone', 'Flame', 'Cloud', 'Tiger', 'Storm', 'Maple', 'Lotus', 'Comet'];
  const adj   = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun  = nouns[Math.floor(Math.random() * nouns.length)];
  const num   = Math.floor(1000 + Math.random() * 9000);
  return `${adj}${noun}@${num}`;
}

// SMTP Config (for Gmail/Google App Password)
const SMTP_HOST     = Deno.env.get('SMTP_HOST') ?? 'smtp.gmail.com';
const SMTP_PORT     = parseInt(Deno.env.get('SMTP_PORT') ?? '465');
const SMTP_USER     = Deno.env.get('SMTP_USER');
const SMTP_PASS     = Deno.env.get('SMTP_PASS');

/** Send via SMTP (Gmail) - Using Nodemailer (npm) */
async function sendViaSMTP(to: string, subject: string, html: string): Promise<boolean> {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('SMTP credentials not configured — falling back to Resend');
    return false;
  }

  try {
    console.log('Attempting Gmail SMTP send to:', to);
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${SMTP_USER}>`,
      to,
      subject,
      html,
    });

    console.log('Email sent successfully via Gmail SMTP. Message ID:', info.messageId);
    return true;
  } catch (err) {
    console.error('SMTP Error details:', err);
    return false;
  }
}

/** Send via Resend */
async function sendViaResend(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY || RESEND_API_KEY === 're_your_resend_api_key') {
    console.warn('Resend API key not configured — skipping email');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error('Resend error:', res.status, await res.text());
      return false;
    }
    console.log('Email sent via Resend to', to);
    return true;
  } catch (err) {
    console.error('Resend send failed:', err);
    return false;
  }
}

function buildWelcomeEmail(fullName: string, email: string, password: string, collegeName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .body p { color: #374151; line-height: 1.6; }
    .credentials { background: #f1f5f9; border-radius: 12px; padding: 20px 24px; margin: 24px 0; }
    .credentials .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .credentials .row:last-child { border-bottom: none; }
    .credentials .label { color: #64748b; font-size: 13px; font-weight: 500; }
    .credentials .value { color: #1e293b; font-size: 13px; font-weight: 700; font-family: monospace; }
    .btn { display: inline-block; background: #6366f1; color: #fff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0; }
    .footer { background: #f8fafc; padding: 20px 32px; text-align: center; color: #94a3b8; font-size: 12px; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 20px 0; font-size: 13px; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Welcome to AcademeIQ</h1>
      <p>${collegeName}</p>
    </div>
    <div class="body">
      <p>Dear <strong>${fullName}</strong>,</p>
      <p>Your faculty account has been created on <strong>AcademeIQ</strong>. You can now log in and start managing your classes, entering marks, and tracking student performance.</p>
      
      <div class="credentials">
        <div class="row">
          <span class="label">Login URL</span>
          <span class="value">${APP_URL}</span>
        </div>
        <div class="row">
          <span class="label">Email</span>
          <span class="value">${email}</span>
        </div>
        <div class="row">
          <span class="label">Temporary Password</span>
          <span class="value">${password}</span>
        </div>
      </div>

      <div class="warning">
        ⚠️ Please change your password immediately after your first login. Go to your profile settings.
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${APP_URL}" class="btn">Login to AcademeIQ →</a>
      </div>

      <p style="font-size: 13px; color: #64748b;">If you did not expect this email or need help, please contact your institution administrator.</p>
    </div>
    <div class="footer">
      AcademeIQ © ${new Date().getFullYear()} — Academic ERP for PUC Schools<br/>
      This is an automated message. Please do not reply.
    </div>
  </div>
</body>
</html>
  `.trim();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  console.log(`[${new Date().toISOString()}] Incoming request: ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  // Health check / Ping
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('test-email') === 'true') {
      const testTo = url.searchParams.get('to') || SMTP_USER;
      if (!testTo) return json({ success: false, error: 'No test email address provided' });
      
      console.log('--- TEST EMAIL TRIGGERED ---');
      const sent = await sendViaSMTP(testTo, 'AcademeIQ SMTP Test', '<h1>It works!</h1><p>If you see this, your Gmail SMTP is configured correctly.</p>');
      return json({ success: sent, message: sent ? 'Test email sent' : 'Test email failed (check logs)' });
    }
    return json({ success: true, message: 'Faculty creation service is online - V3', env: { 
      has_url: !!SUPABASE_URL, 
      has_service_key: !!SERVICE_ROLE_KEY,
      has_smtp_user: !!SMTP_USER,
      has_smtp_pass: !!SMTP_PASS
    }});
  }

  try {
    console.log('--- Starting Create Faculty Process ---');
    
    // ── Auth check ─────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      console.error('Missing authorization token');
      return json({ success: false, error: 'Missing authorization' }, 401);
    }

    let callerId: string;
    let callerCollegeId: string | null = null;
    let isServiceRole = false;

    // Check if token is service role
    const isSrv = token === SERVICE_ROLE_KEY;
    console.log('Token check:', {
      tokenPrefix: token?.substring(0, 10),
      matchesServiceRole: isSrv
    });

    if (isSrv) {
      console.log('Bypassing auth check for Service Role');
      isServiceRole = true;
      callerId = 'service-role';
    } else {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      });

      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) {
        console.error('Auth verification failed:', userErr);
        return json({ success: false, error: 'Unauthorized' }, 401);
      }
      callerId = userData.user.id;
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Verify caller is admin (skip for service role)
    if (!isServiceRole) {
      const { data: callerProfile, error: profileFetchErr } = await admin
        .from('profiles')
        .select('id, role, college_id')
        .eq('id', callerId)
        .single();

      if (profileFetchErr || !callerProfile || callerProfile.role !== 'admin') {
        console.error('Caller is not an admin or profile not found:', profileFetchErr);
        return json({ 
          success: false, 
          error: 'Only admins can create faculty',
          debug: { profileFetchErr, callerId }
        }, 403);
      }
      callerCollegeId = callerProfile.college_id;
    }

    // ── Parse body ──────────────────────────────────────────────────────────────
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error('Failed to parse request JSON:', e);
      return json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const { college_id, full_name, email, phone } = body as {
      college_id: string;
      full_name: string;
      email: string;
      phone?: string;
    };

    console.log(`Creating faculty: ${email} for college: ${college_id}`);

    if (!college_id || !UUID_RE.test(college_id)) return json({ success: false, error: 'Invalid college_id' }, 400);
    if (!full_name?.trim()) return json({ success: false, error: 'full_name required' }, 400);
    if (!email?.includes('@')) return json({ success: false, error: 'Invalid email' }, 400);

    const emailClean = email.trim().toLowerCase();

    // Scope check: non-global admin can only create in their college
    if (callerCollegeId && callerCollegeId !== college_id) {
      console.error('College mismatch: caller college', callerCollegeId, 'vs target', college_id);
      return json({ success: false, error: 'Forbidden: college mismatch' }, 403);
    }

    // Fetch college name for email
    const { data: college } = await admin.from('colleges').select('name').eq('id', college_id).maybeSingle();

    // ── Generate credentials ────────────────────────────────────────────────────
    const tempPassword = generatePassword();

    console.log(`[Phase] Handling Auth User for email: ${emailClean}`);
    let targetUser: any = null;
    
    // 1. Check if user already exists in profiles (fastest lookup)
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', emailClean)
      .maybeSingle();

    if (existingProfile) {
      console.log(`User found in profiles (ID: ${existingProfile.id}). Updating Auth...`);
      const { data: updated, error: updateErr } = await admin.auth.admin.updateUserById(existingProfile.id, {
        password: tempPassword,
        user_metadata: { role: 'faculty', college_id, full_name: full_name.trim() },
        phone: phone ?? undefined,
      });

      if (updateErr) {
        console.error('Failed to update existing auth user:', updateErr);
        return json({ success: false, error: `Auth Update Error: ${updateErr.message}` }, 400);
      }
      targetUser = updated.user;
    } else {
      console.log('User not found in profiles. Attempting to create new auth user...');
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: emailClean,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { role: 'faculty', college_id, full_name: full_name.trim() },
        phone: phone ?? undefined,
      });

      if (createErr) {
        const msg = createErr.message || '';
        if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
           console.log('User exists in Auth but has no profile. Finding Auth ID...');
           const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
           if (listErr) return json({ success: false, error: 'Failed to search auth system' }, 500);
           
           const found = users.find(u => u.email?.toLowerCase() === emailClean);
           if (!found) return json({ success: false, error: 'User exists in auth but could not be located' }, 400);

           const { data: updated, error: updateErr } = await admin.auth.admin.updateUserById(found.id, {
             password: tempPassword,
             user_metadata: { role: 'faculty', college_id, full_name: full_name.trim() },
             phone: phone ?? undefined,
           });
           if (updateErr) return json({ success: false, error: 'Auth update failed for ghost user' }, 400);
           targetUser = updated.user;
        } else {
           console.error('Auth Creation Error:', createErr);
           return json({ success: false, error: `Auth Creation Error: ${msg}` }, 400);
        }
      } else {
        targetUser = created.user;
      }
    }

    if (!targetUser) {
      console.error('Critical: targetUser is still null after logic');
      return json({ success: false, error: 'Failed to acquire auth user account' }, 500);
    }

    console.log(`[Phase] Syncing Profile for ID: ${targetUser.id}`);

    console.log('[Phase] Inserting/Updating Profile...');
    const { error: profileUpsertErr } = await admin.from('profiles').upsert({
      id: targetUser.id,
      college_id,
      role: 'faculty',
      full_name: full_name.trim(),
      email: emailClean,
      phone: phone ?? null,
      is_active: true,
    }, { onConflict: 'id' });

    if (profileUpsertErr) {
      console.error('Profile upsert error (non-fatal):', profileUpsertErr);
    }

    console.log('[Phase] Writing Audit Log...');
    const { error: auditErr } = await admin.from('audit_log').insert({
      college_id,
      actor_id: callerId === 'service-role' ? null : callerId,
      action: 'faculty.created',
      entity_type: 'profiles',
      entity_id: targetUser.id,
      new_value: { email: emailClean, full_name: full_name.trim(), college_id },
    });
    if (auditErr) {
      console.error('Audit log failed (non-fatal):', auditErr);
    } else {
      console.log('Audit log written successfully');
    }

    // ── Send welcome email ─────────────────────────────────────────────────────
    console.log('Attempting to send welcome email...');
    const html = buildWelcomeEmail(
      full_name.trim(),
      emailClean,
      tempPassword,
      college?.name ?? 'Your Institution'
    );

    let emailSent = false;
    
    // Try SMTP first
    try {
      emailSent = await sendViaSMTP(
        emailClean,
        `Welcome to AcademeIQ — Your faculty account is ready`,
        html
      );
    } catch (smtpErr) {
      console.error('SMTP function threw error:', smtpErr);
    }

    // Fallback to Resend
    if (!emailSent) {
      console.log('Falling back to Resend for email...');
      try {
        emailSent = await sendViaResend(
          emailClean,
          `Welcome to AcademeIQ — Your faculty account is ready`,
          html
        );
      } catch (resendErr) {
        console.error('Resend function threw error:', resendErr);
      }
    }

    console.log('Email process finished. Sent?', emailSent);

    return json({
      success: true,
      faculty_id: targetUser.id,
      email_sent: emailSent,
      temp_password: emailSent ? undefined : tempPassword,
    });

  } catch (err) {
    console.error('ULTRA CRITICAL UNHANDLED ERROR:', err);
    let errorMessage = 'Internal server error';
    let errorDetails = null;
    
    if (err instanceof Error) {
      errorMessage = err.message;
      errorDetails = {
        name: err.name,
        stack: err.stack,
      };
    } else {
      errorDetails = err;
    }

    return json(
      { 
        success: false, 
        error: errorMessage, 
        details: errorDetails,
        phase: 'global_catch'
      },
      500
    );
  }
});
