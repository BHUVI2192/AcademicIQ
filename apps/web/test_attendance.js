import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tevtluhuznkovezjgohh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldnRsdWh1em5rb3Zlempnb2hoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM3NTA3NCwiZXhwIjoyMDg5OTUxMDc0fQ.OuPJ3aZWln82AP2QlShUsNPmwzm9h7o2ji6B3iEFgXk'
);

async function run() {
  const collegeId = '550e8400-e29b-41d4-a716-446655440000';
  
  console.log('Inserting default college...');
  const { data: college, error: colErr } = await supabase.from('colleges').upsert({
    id: collegeId,
    name: 'Saint Joseph PU College',
    code: 'SJPC',
    is_active: true
  }, { onConflict: 'id' }).select();
  console.log('College:', college, 'error:', colErr);

  console.log('Inserting active academic year...');
  const { data: year, error: yrErr } = await supabase.from('academic_years').upsert({
    college_id: collegeId,
    label: '2024-2025',
    is_current: true,
    starts_at: '2024-06-01',
    ends_at: '2025-05-31'
  }, { onConflict: 'college_id, label' }).select();
  console.log('Academic Year:', year, 'error:', yrErr);

  console.log('Inserting default department...');
  const { data: dept, error: deptErr } = await supabase.from('departments').upsert({
    college_id: collegeId,
    name: 'Pre-University',
    code: 'PUC',
    is_active: true
  }, { onConflict: 'college_id, code' }).select();
  console.log('Department:', dept, 'error:', deptErr);

  // Insert a test batch
  console.log('Inserting test batch...');
  const { data: batch, error: batchErr } = await supabase.from('batches').upsert({
    id: 'b5555555-5555-5555-5555-555555555555',
    college_id: collegeId,
    department_id: dept?.[0]?.id || '82c0f209-77f6-4074-a021-9be9bc714f31', // Fallback if not returned
    academic_year_id: year?.[0]?.id || '44444444-4444-4444-4444-444444444444',
    name: 'PUC-II Science',
    code: 'PUC-II-SCI',
    semester: 2,
    is_active: true
  }, { onConflict: 'id' }).select();
  console.log('Batch:', batch, 'error:', batchErr);

  // Insert a test student
  console.log('Inserting test student...');
  const { data: student, error: studErr } = await supabase.from('students').upsert({
    id: 's1111111-1111-1111-1111-111111111111',
    college_id: collegeId,
    batch_id: 'b5555555-5555-5555-5555-555555555555',
    usn: 'SJPC001',
    full_name: 'Test Student',
    date_of_birth: '2007-05-15',
    is_active: true
  }, { onConflict: 'id' }).select();
  console.log('Student:', student, 'error:', studErr);

  // Map student to parent
  // We saw parent profiles in the previous query:
  // e2dfce53-af32-43a0-a340-ace5a4f7a505 (Test Parent, parent.test@example.com)
  console.log('Mapping student to Test Parent...');
  const { data: map, error: mapErr } = await supabase.from('parent_student_map').upsert({
    parent_id: 'e2dfce53-af32-43a0-a340-ace5a4f7a505',
    student_id: 's1111111-1111-1111-1111-111111111111',
    is_verified: true
  }, { onConflict: 'parent_id, student_id' }).select();
  console.log('Parent Student Map:', map, 'error:', mapErr);

  // Insert a mock attendance record that is published
  console.log('Inserting mock attendance record...');
  const studentsAttendance = {
    's1111111-1111-1111-1111-111111111111': 'present'
  };
  const { data: att, error: attErr } = await supabase.from('attendance').upsert({
    id: 'a9999999-9999-9999-9999-999999999999',
    batch_id: 'b5555555-5555-5555-5555-555555555555',
    attendance_date: '2026-05-17',
    session: 'morning',
    marked_by: '32562185-f677-4b3a-b0a0-dc27b581a61d', // Bhuvan N
    approval_status: 'published',
    students_attendance: studentsAttendance
  }, { onConflict: 'id' }).select();
  console.log('Attendance:', att, 'error:', attErr);
}

run();
