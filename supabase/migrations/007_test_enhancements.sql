-- ============================================================================
-- AcademeIQ Platform — Test & Marks Enhancement Migration (007)
-- ============================================================================
-- Adds question counts to subjects and calculation components to marks.
-- ============================================================================

-- 1. Update TEST_SUBJECTS table
ALTER TABLE public.test_subjects
  ADD COLUMN IF NOT EXISTS num_questions INT NOT NULL DEFAULT 0;

-- 2. Update MARKS table
ALTER TABLE public.marks
  ADD COLUMN IF NOT EXISTS num_attempted INT,
  ADD COLUMN IF NOT EXISTS num_unanswered INT,
  ADD COLUMN IF NOT EXISTS num_incorrect INT;

-- 3. Update AUDIT LOG for these changes
INSERT INTO public.audit_log (college_id, actor_id, action, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  '00000000-0000-0000-0000-000000000000', 
  'migration.007_applied', 
  '{"description": "Added num_questions to subjects and calculation fields to marks"}'::jsonb
);
