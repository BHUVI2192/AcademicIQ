-- ============================================================================
-- AcademeIQ Platform — Fix marks_status check constraint (037)
-- ============================================================================
-- The tests table had: CHECK (marks_status IN ('draft', 'submitted', 'published'))
-- The approve_marks_for_test function sets marks_status = 'approved' which
-- was not in the allowed list, causing a constraint violation error.
-- Fix: Drop old constraint and add new one including 'approved'.
-- ============================================================================

-- Drop the old constraint (we need to find its exact name first)
ALTER TABLE public.tests DROP CONSTRAINT IF EXISTS tests_marks_status_check;

-- Also drop any column-level check that may have been added via ADD COLUMN
-- Re-add the column default cleanly (safe, no-op if already correct)
ALTER TABLE public.tests
  ALTER COLUMN marks_status SET DEFAULT 'draft';

-- Add the corrected constraint with all 5 valid statuses
ALTER TABLE public.tests
  ADD CONSTRAINT tests_marks_status_check
  CHECK (marks_status IN ('draft', 'submitted', 'approved', 'published', 'finalized'));
