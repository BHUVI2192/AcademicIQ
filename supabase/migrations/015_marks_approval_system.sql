-- ============================================================================
-- AcademeIQ Platform — Marks Approval Workflow (015)
-- ============================================================================
-- Implements admin approval system for marks entry before publishing to parents
-- Faculty enters marks → Status: 'submitted'
-- Admin reviews → Status: 'approved' (with remarks) or 'rejected'
-- Only approved marks can be published to parents
-- ============================================================================

-- ============================================================================
-- 1. MARKS TABLE ENHANCEMENTS
-- ============================================================================

-- Add approval workflow columns to marks table
ALTER TABLE public.marks
  ADD COLUMN IF NOT EXISTS approval_status TEXT 
    DEFAULT 'draft' 
    CHECK (approval_status IN ('draft', 'submitted', 'approved', 'rejected'));

ALTER TABLE public.marks
  ADD COLUMN IF NOT EXISTS approved_by UUID 
    REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.marks
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE public.marks
  ADD COLUMN IF NOT EXISTS admin_remarks TEXT;

-- ============================================================================
-- 2. TESTS TABLE CLARIFICATION
-- ============================================================================
-- Note: tests.marks_status already tracks: 'draft' | 'submitted' | 'published'
-- This is different from marks.approval_status (for individual marks)
-- Flow:
--   test.marks_status = 'draft' while faculty entering
--   test.marks_status = 'submitted' when all marks forwarded to admin
--   test.marks_status = 'approved' when admin reviews (marks.approval_status = 'approved')
--   test.marks_status = 'published' when published to parents

-- Add trigger to auto-update test.marks_status when marks submitted
CREATE OR REPLACE FUNCTION public.update_test_marks_status_on_marks_submitted()
RETURNS TRIGGER AS $$
BEGIN
  -- When faculty submits marks, update test.marks_status to 'submitted'
  UPDATE public.tests
  SET marks_status = 'submitted'
  WHERE id = NEW.test_id AND marks_status = 'draft';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for marks submission
DROP TRIGGER IF EXISTS tr_update_test_marks_status_on_marks_submitted ON public.marks;
CREATE TRIGGER tr_update_test_marks_status_on_marks_submitted
  AFTER UPDATE OF approval_status ON public.marks
  FOR EACH ROW
  WHEN (NEW.approval_status = 'submitted' AND OLD.approval_status = 'draft')
  EXECUTE FUNCTION public.update_test_marks_status_on_marks_submitted();

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_marks_approval_status 
  ON public.marks (approval_status);

CREATE INDEX IF NOT EXISTS idx_marks_approved_by 
  ON public.marks (approved_by);

CREATE INDEX IF NOT EXISTS idx_marks_test_approval_status 
  ON public.marks (test_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_marks_entered_by_approval 
  ON public.marks (entered_by, approval_status);

-- ============================================================================
-- 4. RLS POLICY UPDATES FOR MARKS APPROVAL
-- ============================================================================

-- Faculty can INSERT marks as 'draft'
DROP POLICY IF EXISTS "Faculty can enter marks for assigned batches" ON public.marks;
CREATE POLICY "Faculty can enter marks for assigned batches" ON public.marks
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Faculty or admin entering marks
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'faculty')
    )
    AND
    -- For Board Exams: Must be assigned faculty or admin
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.tests t 
        WHERE t.id = test_id AND t.exam_category = 'Board Exam'
      )
      THEN
        auth.uid() = (
          SELECT assigned_faculty_id FROM public.tests WHERE id = test_id
        ) OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      -- For Competitive Exams: Faculty with batch assignment
      ELSE
        EXISTS (
          SELECT 1 FROM public.faculty_batch_assignments fba
          JOIN public.tests t ON t.batch_id = fba.batch_id
          WHERE fba.faculty_id = auth.uid() AND t.id = test_id
        ) OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    END
  );

-- Faculty can UPDATE marks only if approval_status is 'draft'
DROP POLICY IF EXISTS "Faculty can update own marks" ON public.marks;
CREATE POLICY "Faculty can update own marks" ON public.marks
  FOR UPDATE TO authenticated
  USING (entered_by = auth.uid() AND approval_status = 'draft')
  WITH CHECK (entered_by = auth.uid() AND approval_status = 'draft');

-- Admin can UPDATE marks to change approval_status
DROP POLICY IF EXISTS "Admin can approve or reject marks" ON public.marks;
CREATE POLICY "Admin can approve or reject marks" ON public.marks
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admin can SELECT all marks (already exists, but reinforced)
DROP POLICY IF EXISTS "Admin can view all marks" ON public.marks;
CREATE POLICY "Admin can view all marks" ON public.marks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Faculty can SELECT marks they entered (draft/submitted states)
DROP POLICY IF EXISTS "Faculty can view own marks" ON public.marks;
CREATE POLICY "Faculty can view own marks" ON public.marks
  FOR SELECT TO authenticated
  USING (
    entered_by = auth.uid() OR
    (
      -- Faculty can view marks for their assigned batches
      EXISTS (
        SELECT 1 FROM public.faculty_batch_assignments fba
        JOIN public.tests t ON t.batch_id = fba.batch_id
        WHERE fba.faculty_id = auth.uid() AND t.id = test_id
      )
    )
  );

-- Parents CANNOT view marks (no policy = no access)
-- Rankings are published separately

-- ============================================================================
-- 5. TESTS TABLE RLS UPDATES
-- ============================================================================

-- Only admins can update test.marks_status
DROP POLICY IF EXISTS "Admin can update test status" ON public.tests;
CREATE POLICY "Admin can update test status" ON public.tests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- 6. AUDIT LOG ENTRIES FOR MARK APPROVALS
-- ============================================================================
-- This is handled by application logic calling audit_log INSERT
-- No trigger needed (explicit logging preferred)

-- ============================================================================
-- DONE — Marks Approval System Complete
-- ============================================================================
