import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import nodemailer from 'npm:nodemailer';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// SMTP Config (from Gmail/Google App Password)
const SMTP_HOST = Deno.env.get('SMTP_HOST') ?? 'smtp.gmail.com';
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') ?? '465');
const SMTP_USER = Deno.env.get('SMTP_USER');
const SMTP_PASS = Deno.env.get('SMTP_PASS');
const FROM_NAME = Deno.env.get('FROM_NAME') ?? 'AcademeIQ';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateTempPassword(length = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function sendViaSMTP(to: string, subject: string, html: string): Promise<boolean> {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('SMTP credentials not configured');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"${FROM_NAME}" <${SMTP_USER}>`,
      to,
      subject,
      html,
    });

    return true;
  } catch (err) {
    console.error('SMTP Error:', err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    const { phone } = await req.json();

    if (!phone) {
      return json({ success: false, error: 'Phone number is required' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Find profile by phone
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('phone', phone)
      .eq('role', 'parent')
      .single();

    if (profileErr || !profile) {
      return json({ success: false, error: 'No parent account found for this phone number' }, 404);
    }

    if (!profile.email) {
      return json({ success: false, error: 'No recovery email linked to this account. Please contact admin.' }, 400);
    }

    // 2. Generate temporary password
    const tempPassword = generateTempPassword();

    // 3. Update Auth User (Ensure email is correct and update password)
    const internalEmail = `parent.${phone.replace(/\D/g, '')}@academeiq.net`;
    const { error: authErr } = await supabase.auth.admin.updateUserById(profile.id, {
      email: internalEmail,
      password: tempPassword,
      email_confirm: true
    });

    if (authErr) throw authErr;

    // 4. Send Email via SMTP
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
        <h2 style="color: #111;">Password Recovery</h2>
        <p>Hello ${profile.full_name || 'Parent'},</p>
        <p>As per your request, we have generated a temporary password for your AcademeIQ account.</p>
        <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0; border-radius: 4px;">
          ${tempPassword}
        </div>
        <p>Please use this password to log in. <strong>For security reasons, we strongly recommend changing this password immediately after logging in.</strong></p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          If you did not request this, please contact your institution immediately.
        </p>
      </div>
    `;

    const emailSent = await sendViaSMTP(
      profile.email,
      'Your Temporary Password - AcademeIQ',
      emailHtml
    );

    if (!emailSent) {
      return json({ 
        success: false, 
        error: 'Account updated, but failed to send recovery email. Please check SMTP settings.' 
      }, 500);
    }

    return json({ success: true, message: 'Temporary password sent to your linked email' });

  } catch (err: any) {
    console.error('Recovery error:', err);
    return json({ success: false, error: err.message || 'Internal server error' }, 500);
  }
});
