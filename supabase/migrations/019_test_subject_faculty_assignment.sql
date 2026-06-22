-- ============================================================================
-- AcademeIQ Platform — Test Subject Faculty Assignment (019)
-- ============================================================================
-- Enables per-subject faculty assignment for Board Exams
-- Purpose: Different faculty can be assigned for different subjects (Physics, Chemistry, etc.)
-- ============================================================================

-- Add faculty assignment to test_subjects for subject-specific marking
ALTER TABLE public.test_subjects
  ADD COLUMN IF NOT EXISTS assigned_faculty_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_code TEXT;

-- Create index for efficient faculty subject queries
CREATE INDEX IF NOT EXISTS idx_test_subjects_faculty
  ON public.test_subjects (assigned_faculty_id, test_id);

-- Create index for subject lookup
CREATE INDEX IF NOT EXISTS idx_test_subjects_code
  ON public.test_subjects (subject_code);

-- Helper function to get assigned faculty for test subject
CREATE OR REPLACE FUNCTION public.get_subject_faculty(p_test_id UUID, p_subject_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT assigned_faculty_id
    FROM public.test_subjects
    WHERE id = p_subject_id AND test_id = p_test_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to get all subjects for a test with faculty
CREATE OR REPLACE FUNCTION public.get_test_subjects_with_faculty(p_test_id UUID)
RETURNS TABLE(
  id UUID,
  subject_name TEXT,
  subject_code TEXT,
  max_marks INT,
  assigned_faculty_id UUID,
  faculty_name TEXT,
  faculty_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ts.id,
    ts.subject_name,
    ts.subject_code,
    ts.max_marks,
    ts.assigned_faculty_id,
    p.full_name,
    p.email
  FROM public.test_subjects ts
  LEFT JOIN public.profiles p ON ts.assigned_faculty_id = p.id
  WHERE ts.test_id = p_test_id
  ORDER BY ts.display_order;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update marks table RLS to consider subject-level faculty assignment
-- Faculty can enter marks for a subject they're assigned to
DROP POLICY IF EXISTS "Faculty can insert marks for assigned subjects" ON public.marks;

CREATE POLICY "Faculty can insert marks for assigned subjects"
  ON public.marks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'faculty'
    ) AND
    (
      -- Faculty is assigned to this subject for this test
      EXISTS (
        SELECT 1 FROM public.test_subjects ts
        WHERE ts.id = NEW.subject_id
        AND ts.test_id = NEW.test_id
        AND ts.assigned_faculty_id = auth.uid()
      )
      OR
      -- OR test-level assignment (backward compatibility)
      EXISTS (
        SELECT 1 FROM public.tests t
        WHERE t.id = NEW.test_id
        AND t.assigned_faculty_id = auth.uid()
      )
    )
  );

-- Function to validate Board Exam has all subjects assigned faculty
CREATE OR REPLACE FUNCTION public.validate_board_exam_faculty_assignments(p_test_id UUID)
RETURNS TABLE(
  is_complete BOOLEAN,
  missing_count INT,
  missing_subjects TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(CASE WHEN assigned_faculty_id IS NULL THEN 1 END) = 0 AS is_complete,
    COUNT(CASE WHEN assigned_faculty_id IS NULL THEN 1 END)::INT AS missing_count,
    ARRAY_AGG(subject_name) FILTER (WHERE assigned_faculty_id IS NULL) AS missing_subjects
  FROM public.test_subjects
  WHERE test_id = p_test_id;
END;
$$ LANGUAGE plpgsql STABLE;
