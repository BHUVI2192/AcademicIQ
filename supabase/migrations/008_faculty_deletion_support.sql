-- ============================================================================
-- AcademeIQ Platform — Faculty Deletion Support (008)
-- ============================================================================
-- Allows deleting faculty members by making their created/entered fields nullable
-- and setting them to NULL on deletion instead of restricting.
-- ============================================================================

-- 1. Update TESTS table
ALTER TABLE public.tests
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.tests
  DROP CONSTRAINT IF EXISTS tests_created_by_fkey,
  ADD CONSTRAINT tests_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES public.profiles(id) 
    ON DELETE SET NULL;

-- 2. Update MARKS table
ALTER TABLE public.marks
  ALTER COLUMN entered_by DROP NOT NULL;

ALTER TABLE public.marks
  DROP CONSTRAINT IF EXISTS marks_entered_by_fkey,
  ADD CONSTRAINT marks_entered_by_fkey 
    FOREIGN KEY (entered_by) 
    REFERENCES public.profiles(id) 
    ON DELETE SET NULL;

-- 3. Update AUDIT_LOG (Already safe as it doesn't have a hard FK constraint in 001_schema, but let's be sure)
-- (It's a UUID column, no action needed)
