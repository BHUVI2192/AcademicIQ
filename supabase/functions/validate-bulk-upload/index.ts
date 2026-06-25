// ============================================================================
// Edge Function: validate-bulk-upload
// ============================================================================
// POST {
//   college_id: string,
//   batch_id: string,
//   rows: Array<{ usn: string, full_name: string, date_of_birth?: string }>
// }
// Validates the rows, detects duplicates, then inserts valid students.
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
const USN_RE = /^[A-Z0-9\-_./]{2,30}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface Row {
  usn?: string;
  roll_number?: string;
  full_name: string;
  date_of_birth?: string;
  exam_wing?: string | null;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  parent_relationship?: string;
}

interface Body {
  college_id?: string;
  batch_id?: string;
  rows?: Row[];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function upsertParentAndLink(
  admin: any,
  vars: {
    phone: string;
    full_name: string;
    email?: string;
    college_id: string;
    student_id: string;
    relationship?: string;
  }
) {
  const { phone, full_name, college_id, email, student_id, relationship } = vars;
  
  const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/[^0-9]/g, '')}`;
  const internalEmail = `parent.${normalizedPhone.replace(/[^0-9]/g, '')}@academeiq.net`;
  const tempPassword = 'Parent@123';

  // 1. Check if profile exists by phone
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, role, email')
    .eq('phone', normalizedPhone)
    .maybeSingle();

  let userId = existingProfile?.id;
  let existingRole = existingProfile?.role;

  // 2. Ensure Auth User exists
  if (userId) {
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { 
        role: existingRole || 'parent', 
        college_id, 
        full_name, 
        phone: normalizedPhone 
      }
    });
  } else {
    // Check if auth user exists by internal email
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const foundByEmail = users.find((u: any) => u.email === internalEmail);
    
    if (foundByEmail) {
      userId = foundByEmail.id;
    } else {
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: internalEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { role: 'parent', college_id, full_name, phone: normalizedPhone }
      });

      if (createErr) {
        if (createErr.message.includes('already registered')) {
          const found = users.find((u: any) => u.email === internalEmail);
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

  if (!userId) throw new Error('Failed to acquire parent user ID');

  // 3. Upsert Profile
  const updateData: any = {
    id: userId,
    college_id,
    full_name: full_name.trim(),
    phone: normalizedPhone,
    temp_password_set: true,
    is_active: true
  };

  if (!existingRole) {
    updateData.role = 'parent';
  }

  if (email && !existingProfile?.email) {
    updateData.email = email;
  }

  const { error: profileErr } = await admin.from('profiles').upsert(updateData);

  if (profileErr) {
    if (profileErr.code === '23505' && profileErr.message.includes('email')) {
      delete updateData.email;
      const { error: retryErr } = await admin.from('profiles').upsert(updateData);
      if (retryErr) throw retryErr;
    } else {
      throw profileErr;
    }
  }

  // 4. Link Student (auto-verified!)
  const { error: mapErr } = await admin.from('parent_student_map').upsert({
    parent_id: userId,
    student_id,
    relationship: relationship || 'Parent',
    is_verified: true,
    verified_at: new Date().toISOString()
  }, { onConflict: 'parent_id,student_id' });

  if (mapErr) throw mapErr;
  return userId;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  try {
    const body = (await req.json()) as Body;
    const { college_id, batch_id, rows } = body;

    console.log(`--- Starting Bulk Upload Processing (Total Rows: ${rows?.length ?? 0}) ---`);
    console.log('Target College:', college_id);
    console.log('Target Batch:', batch_id);

    if (!college_id || !UUID_RE.test(college_id)) {
      return json({ success: false, error: 'Invalid college_id' }, 400);
    }
    if (!batch_id || !UUID_RE.test(batch_id)) {
      return json({ success: false, error: 'Invalid batch_id' }, 400);
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ success: false, error: 'Rows must be a non-empty array' }, 400);
    }
    if (rows.length > 1000) {
      return json({ success: false, error: 'Maximum 1000 rows per upload' }, 400);
    }

    // Identify the calling user
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

    // Verify caller has rights: admin in college OR faculty assigned to this batch
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, role, college_id, is_active, can_add_students')
      .eq('id', actorId)
      .single();

    console.log('Caller Profile Context:', { 
      actorId, 
      role: profile?.role, 
      college_id: profile?.college_id, 
      is_active: profile?.is_active 
    });

    if (profileErr || !profile) {
      console.error('Profile fetch error or not found:', profileErr);
      return json({ success: false, error: 'User profile not found' }, 403);
    }

    if (!profile.is_active) {
      return json({ success: false, error: 'User account is inactive' }, 403);
    }

    // Permission check
    const isGlobalAdmin = profile.role === 'admin' && !profile.college_id;
    const isCollegeAdmin = profile.role === 'admin' && profile.college_id === college_id;
    const isCollegeFaculty = profile.role === 'faculty' && profile.college_id === college_id;

    if (!isGlobalAdmin && !isCollegeAdmin && !isCollegeFaculty) {
      console.warn('Forbidden access attempt:', { actorId, role: profile.role, callerCollege: profile.college_id, targetCollege: college_id });
      return json({ success: false, error: `Forbidden: You do not have permission to upload to college ${college_id}` }, 403);
    }

    if (isCollegeFaculty && !profile.can_add_students) {
      console.warn(`Faculty ${actorId} does not have can_add_students permission`);
      return json({ success: false, error: 'Forbidden: Faculty does not have permission to register students' }, 403);
    }

    // Faculty specific check: must be assigned to the batch
    if (isCollegeFaculty) {
      const { data: assignment } = await admin
        .from('faculty_batch_assignments')
        .select('id')
        .eq('faculty_id', actorId)
        .eq('batch_id', batch_id)
        .maybeSingle();

      if (!assignment) {
        console.warn(`Faculty ${actorId} not assigned to batch ${batch_id}`);
        return json({ success: false, error: 'Forbidden: Faculty not assigned to this batch' }, 403);
      }
    }

    // Verify batch exists and belongs to the college
    const { data: batch } = await admin
      .from('batches')
      .select('id, college_id')
      .eq('id', batch_id)
      .single();

    if (!batch) {
      return json({ success: false, error: 'Batch not found' }, 400);
    }
    if (batch.college_id !== college_id) {
      return json({ success: false, error: 'Batch does not belong to this college' }, 400);
    }

    // ====== Per-row validation ======
    console.log('[Phase 1] Starting validation loop...');
    const errors: { row: number; usn?: string; reason: string }[] = [];
    const valid: { 
      usn: string; 
      full_name: string; 
      date_of_birth: string | null;
      exam_wing: string | null;
      parent_name: string | null;
      parent_phone: string | null;
      parent_email: string | null;
      parent_relationship: string | null;
    }[] = [];
    const seenUsns = new Set<string>();

    rows.forEach((r, idx) => {
      const rowNumber = idx + 1;
      const usn = (r.usn || r.roll_number || '').trim().toUpperCase();
      const fullName = (r.full_name || '').trim();
      const dob = (r.date_of_birth || '').trim();
      const examWing = (r.exam_wing || '').trim().toUpperCase();
      
      const parentName = (r.parent_name || '').trim();
      const parentPhone = (r.parent_phone || '').trim();
      const parentEmail = (r.parent_email || '').trim();
      const parentRelationship = (r.parent_relationship || 'Parent').trim();

      if (!usn) {
        errors.push({ row: rowNumber, reason: 'USN/Roll Number is required' });
        return;
      }
      if (!USN_RE.test(usn)) {
        errors.push({ row: rowNumber, usn, reason: 'USN format invalid (alphanumeric or -_./, 2–30 chars)' });
        return;
      }
      if (!fullName) {
        errors.push({ row: rowNumber, usn, reason: 'Full name is required' });
        return;
      }
      if (fullName.length > 200) {
        errors.push({ row: rowNumber, usn, reason: 'Full name too long (max 200 chars)' });
        return;
      }

      let dobValue: string | null = null;
      if (dob) {
        if (!DATE_RE.test(dob)) {
          errors.push({ row: rowNumber, usn, reason: 'Date format must be YYYY-MM-DD' });
          return;
        }
        const parsed = Date.parse(dob);
        if (Number.isNaN(parsed)) {
          errors.push({ row: rowNumber, usn, reason: 'Date is not parseable' });
          return;
        }
        dobValue = dob;
      }

      let examWingValue: string | null = null;
      if (examWing) {
        if (examWing !== 'NEET' && examWing !== 'KCET') {
          errors.push({ row: rowNumber, usn, reason: 'Exam wing must be NEET or KCET' });
          return;
        }
        examWingValue = examWing;
      }

      if (!parentName) {
        errors.push({ row: rowNumber, usn, reason: 'Parent name is required' });
        return;
      }
      if (!parentPhone) {
        errors.push({ row: rowNumber, usn, reason: 'Parent phone is required' });
        return;
      }
      const digits = parentPhone.replace(/[^0-9]/g, '');
      if (digits.length < 10) {
        errors.push({ row: rowNumber, usn, reason: 'Parent phone number must be at least 10 digits' });
        return;
      }

      if (seenUsns.has(usn)) {
        errors.push({ row: rowNumber, usn, reason: 'Duplicate USN within upload' });
        return;
      }
      seenUsns.add(usn);
      valid.push({ 
        usn, 
        full_name: fullName, 
        date_of_birth: dobValue,
        exam_wing: examWingValue,
        parent_name: parentName || null,
        parent_phone: parentPhone || null,
        parent_email: parentEmail || null,
        parent_relationship: parentRelationship || null
      });
    });

    console.log(`[Phase 1 Result] Valid rows: ${valid.length}, Errors: ${errors.length}`);

    // ====== Detect existing Roll Numbers in DB ======
    if (valid.length > 0) {
      console.log('[Phase 2] Checking for existing roll_numbers in database...');
      const { data: existing, error: checkErr } = await admin
        .from('students')
        .select('roll_number')
        .eq('college_id', college_id)
        .in('roll_number', valid.map((v) => v.usn));

      if (checkErr) {
        console.error('[Phase 2 Error] Failed to check existing students:', checkErr);
        return json({ success: false, error: `Database check failed: ${checkErr.message}` }, 500);
      }

      if (existing && existing.length > 0) {
        const existingSet = new Set(existing.map((x) => x.roll_number));
        const filtered = valid.filter((v) => {
          if (existingSet.has(v.usn)) {
            errors.push({ row: -1, usn: v.usn, reason: 'Roll Number already exists in database' });
            return false;
          }
          return true;
        });
        valid.length = 0;
        valid.push(...filtered);
        console.log(`[Phase 2 Result] Filtered out ${existing.length} existing records. Remaining to insert: ${valid.length}`);
      }
    }

    // ====== Insert valid rows ======
    let inserted = 0;
    if (valid.length > 0) {
      console.log(`[Phase 3] Inserting ${valid.length} students into database...`);
      const payload = valid.map((v) => ({
        college_id,
        batch_id,
        roll_number: v.usn, // Internal 'usn' variable maps to DB 'roll_number'
        full_name: v.full_name,
        date_of_birth: v.date_of_birth,
        exam_wing: v.exam_wing,
        created_by: actorId,
        is_active: true,
      }));

      const { data: insertResult, error: insertErr } = await admin
        .from('students')
        .insert(payload)
        .select('id, roll_number');

      if (insertErr) {
        console.error('[Phase 3 Error] Bulk insert failed:', insertErr);
        return json({ success: false, error: `Bulk insert failed: ${insertErr.message}` }, 500);
      }

      inserted = insertResult?.length ?? 0;
      console.log(`[Phase 3 Result] Successfully inserted ${inserted} students.`);

      // ====== Map inserted students and create parent accounts ======
      const rollToIdMap = new Map<string, string>();
      insertResult?.forEach((s: any) => {
        rollToIdMap.set(s.roll_number.toUpperCase(), s.id);
      });

      console.log('[Phase 4] Creating and linking parent accounts...');
      let parentSuccessCount = 0;
      let parentErrorCount = 0;
      for (const v of valid) {
        const studentId = rollToIdMap.get(v.usn);
        if (studentId && v.parent_phone && v.parent_name) {
          try {
            await upsertParentAndLink(admin, {
              phone: v.parent_phone,
              full_name: v.parent_name,
              email: v.parent_email || undefined,
              college_id,
              student_id: studentId,
              relationship: v.parent_relationship || undefined,
            });
            parentSuccessCount++;
          } catch (err: any) {
            console.error(`Failed to link parent for student USN ${v.usn}:`, err);
            parentErrorCount++;
            errors.push({ 
              row: -1, 
              usn: v.usn, 
              reason: `Linked parent account creation failed: ${err.message || err}` 
            });
          }
        }
      }
      console.log(`[Phase 4 Result] Parent accounts created/linked: ${parentSuccessCount}, failed: ${parentErrorCount}`);

      try {
        await admin.from('audit_log').insert({
          college_id,
          actor_id: actorId,
          action: 'students.bulk_upload',
          entity_type: 'students',
          new_value: { batch_id, inserted, error_count: errors.length, parents_linked: parentSuccessCount },
        });
      } catch (logErr) {
        console.warn('Failed to write audit log (non-critical):', logErr);
      }
    }

    return json({
      success: true,
      inserted,
      total_submitted: rows.length,
      valid: valid.map((v) => v.usn),
      errors,
    });
  } catch (err) {
    console.error('--- ULTRA CRITICAL FAILURE ---');
    console.error(err);
    return json(
      { 
        success: false, 
        error: err instanceof Error ? err.message : 'Internal server error',
        stack: err instanceof Error ? err.stack : undefined 
      },
      500
    );
  }
});
