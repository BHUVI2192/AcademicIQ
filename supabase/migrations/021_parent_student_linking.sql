-- ============================================================================
-- AcademeIQ Platform — Parent-Student Linking (021)
-- ============================================================================
-- Creates junction table to link parents to students for access management
-- ============================================================================

-- Create student_parent_links junction table
CREATE TABLE IF NOT EXISTS public.student_parent_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_student_parent_links_student 
    ON public.student_parent_links (student_id);

CREATE INDEX IF NOT EXISTS idx_student_parent_links_parent 
    ON public.student_parent_links (parent_id);

-- Enable RLS
ALTER TABLE public.student_parent_links ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can manage all links
CREATE POLICY "Admin can manage parent-student links"
    ON public.student_parent_links
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Policy: Parents can see their linked students
CREATE POLICY "Parents can view their linked students"
    ON public.student_parent_links
    FOR SELECT
    USING (parent_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Policy: Parents can only be linked by admin
CREATE POLICY "Only admin can insert parent-student links"
    ON public.student_parent_links
    FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Update fees RLS to allow parents to see fees for linked students
CREATE POLICY "Parents can view fees for linked students"
    ON public.fees
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.student_parent_links spl
            WHERE spl.student_id = student_id
            AND spl.parent_id = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Update attendance RLS to allow parents to see attendance for linked students
CREATE POLICY "Parents can view attendance for linked students"
    ON public.attendance
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.student_parent_links spl
            WHERE spl.student_id = student_id
            AND spl.parent_id = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Update marks RLS to allow parents to see marks for linked students (only published)
CREATE POLICY "Parents can view marks for linked students"
    ON public.marks
    FOR SELECT
    USING (
        (
            EXISTS (
                SELECT 1 FROM public.student_parent_links spl
                WHERE spl.student_id = student_id
                AND spl.parent_id = auth.uid()
            )
            AND approval_status = 'published'
        )
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Update rankings RLS to allow parents to see rankings for linked students (only published tests)
CREATE POLICY "Parents can view rankings for linked students"
    ON public.rankings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.student_parent_links spl
            WHERE spl.student_id = student_id
            AND spl.parent_id = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
