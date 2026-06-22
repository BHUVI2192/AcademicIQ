-- ============================================================================
-- AcademeIQ Platform — Data Cleanup & Single College Setup (020)
-- ============================================================================
-- Creates "Saint Joseph PU College" as the only college
-- Removes all other colleges and associated data
-- Keeps only SJPC for single-college operation
-- ============================================================================

-- Step 1: Create Saint Joseph PU College (if not exists)
INSERT INTO public.colleges (id, name, code, is_active, created_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Saint Joseph PU College',
  'SJPC',
  true,
  now()
)
ON CONFLICT (code) DO UPDATE SET is_active = true;

-- IMPORTANT: Drop the validation and audit logging triggers BEFORE deleting any marks
-- This prevents validation errors and audit log insertion errors during the cleanup process
DROP TRIGGER IF EXISTS trg_validate_marks ON public.marks;
DROP TRIGGER IF EXISTS trg_log_marks_change ON public.marks;

-- Step 2: Delete all data associated with OTHER colleges (not SJPC)
DELETE FROM public.marks
WHERE test_id IN (
  SELECT t.id FROM public.tests t
  WHERE t.college_id NOT IN (SELECT id FROM public.colleges WHERE code = 'SJPC')
);

DELETE FROM public.rankings
WHERE test_id IN (
  SELECT t.id FROM public.tests t
  WHERE t.college_id NOT IN (SELECT id FROM public.colleges WHERE code = 'SJPC')
);

DELETE FROM public.tests
WHERE college_id NOT IN (SELECT id FROM public.colleges WHERE code = 'SJPC');

DELETE FROM public.attendance
WHERE student_id IN (
  SELECT s.id FROM public.students s
  JOIN public.batches b ON s.batch_id = b.id
  WHERE b.college_id NOT IN (SELECT id FROM public.colleges WHERE code = 'SJPC')
);

DELETE FROM public.fees
WHERE student_id IN (
  SELECT s.id FROM public.students s
  JOIN public.batches b ON s.batch_id = b.id
  WHERE b.college_id NOT IN (SELECT id FROM public.colleges WHERE code = 'SJPC')
);

DELETE FROM public.students
WHERE batch_id IN (
  SELECT b.id FROM public.batches b
  WHERE b.college_id NOT IN (SELECT id FROM public.colleges WHERE code = 'SJPC')
);

DELETE FROM public.faculty_batch_assignments
WHERE batch_id IN (
  SELECT b.id FROM public.batches b
  WHERE b.college_id NOT IN (SELECT id FROM public.colleges WHERE code = 'SJPC')
);

DELETE FROM public.batches
WHERE college_id NOT IN (SELECT id FROM public.colleges WHERE code = 'SJPC');

DELETE FROM public.departments
WHERE college_id NOT IN (SELECT id FROM public.colleges WHERE code = 'SJPC');

DELETE FROM public.academic_years
WHERE college_id NOT IN (SELECT id FROM public.colleges WHERE code = 'SJPC');

-- Delete faculty from other colleges
DELETE FROM public.profiles
WHERE college_id NOT IN (SELECT id FROM public.colleges WHERE code = 'SJPC')
  AND role = 'faculty';

-- Step 3: Delete all other colleges
DELETE FROM public.colleges
WHERE code != 'SJPC';

-- Step 4: Clear all student and faculty assignment data from SJPC
-- Delete everything in correct order

DELETE FROM public.notification_logs;
DELETE FROM public.marks;
DELETE FROM public.rankings;
DELETE FROM public.attendance;
DELETE FROM public.fees;
DELETE FROM public.students;
DELETE FROM public.faculty_batch_assignments;
DELETE FROM public.profiles WHERE role = 'faculty';
DELETE FROM public.batches;

-- Step 5: Recreate the validation and audit logging triggers for future use
CREATE TRIGGER trg_validate_marks
    BEFORE INSERT OR UPDATE ON public.marks
    FOR EACH ROW EXECUTE FUNCTION public.fn_validate_marks();

CREATE TRIGGER trg_log_marks_change
    AFTER INSERT OR UPDATE OR DELETE ON public.marks
    FOR EACH ROW EXECUTE FUNCTION public.fn_log_marks_change();

-- Step 6: Ensure there's an active academic year for Saint Joseph
INSERT INTO public.academic_years (college_id, label, is_current, starts_at, ends_at)
SELECT 
  c.id,
  '2024-2025',
  true,
  '2024-06-01'::DATE,
  '2025-05-31'::DATE
FROM public.colleges c
WHERE c.code = 'SJPC'
ON CONFLICT DO NOTHING;

-- Step 7: Create default department for PUC
INSERT INTO public.departments (college_id, name, code, is_active)
SELECT 
  c.id,
  'Pre-University',
  'PUC',
  true
FROM public.colleges c
WHERE c.code = 'SJPC'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Migration Complete
-- Result: Single college "Saint Joseph PU College" (SJPC)
-- All other colleges and their data deleted
-- All students, faculty, marks, and assignments cleared
-- Ready for fresh setup with new batches and faculty
-- ============================================================================
