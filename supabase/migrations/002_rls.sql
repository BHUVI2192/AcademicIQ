-- ============================================================================
-- AcademeIQ Platform — Row Level Security Migration (002)
-- ============================================================================
-- Enables RLS on every table and creates strict policies.
-- KEY RULES:
--   - Parents NEVER access marks table
--   - Faculty access only their assigned batches
--   - Parents access only their verified children
--   - audit_log is never updatable or deletable
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_college_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT college_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
$$;

CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND college_id IS NULL AND is_active = true
    )
$$;

CREATE OR REPLACE FUNCTION public.is_faculty()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'faculty' AND is_active = true
    )
$$;

CREATE OR REPLACE FUNCTION public.is_parent()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'parent' AND is_active = true
    )
$$;

CREATE OR REPLACE FUNCTION public.faculty_has_batch(p_batch_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.faculty_batch_assignments
        WHERE faculty_id = auth.uid() AND batch_id = p_batch_id
    )
$$;

CREATE OR REPLACE FUNCTION public.parent_has_verified_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.parent_student_map
        WHERE parent_id = auth.uid()
          AND student_id = p_student_id
          AND is_verified = true
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_my_college_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_faculty() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent() TO authenticated;
GRANT EXECUTE ON FUNCTION public.faculty_has_batch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parent_has_verified_student(UUID) TO authenticated;

-- ============================================================================
-- ENABLE RLS ON EVERY TABLE
-- ============================================================================
ALTER TABLE public.colleges                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_batch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_map        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_subjects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rankings                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log                 ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COLLEGES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS colleges_select ON public.colleges;
CREATE POLICY colleges_select ON public.colleges
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS colleges_admin_update ON public.colleges;
CREATE POLICY colleges_admin_update ON public.colleges
    FOR UPDATE TO authenticated
    USING (is_admin() AND (id = get_my_college_id() OR is_global_admin()))
    WITH CHECK (is_admin() AND (id = get_my_college_id() OR is_global_admin()));

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() OR (is_admin() AND (college_id = get_my_college_id() OR is_global_admin())));

DROP POLICY IF EXISTS profiles_admin_insert ON public.profiles;
CREATE POLICY profiles_admin_insert ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() AND (college_id = get_my_college_id() OR is_global_admin()));

DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
    FOR UPDATE TO authenticated
    USING (is_admin() AND (college_id = get_my_college_id() OR is_global_admin()))
    WITH CHECK (is_admin() AND (college_id = get_my_college_id() OR is_global_admin()));

-- Self-update only allows changing name/phone/email (not role / college_id / is_active)
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
        AND college_id IS NOT DISTINCT FROM (SELECT college_id FROM public.profiles WHERE id = auth.uid())
        AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
    );

-- ============================================================================
-- ACADEMIC YEARS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS academic_years_select ON public.academic_years;
CREATE POLICY academic_years_select ON public.academic_years
    FOR SELECT TO authenticated
    USING (college_id = get_my_college_id() OR is_global_admin());

DROP POLICY IF EXISTS academic_years_admin_insert ON public.academic_years;
CREATE POLICY academic_years_admin_insert ON public.academic_years
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() AND (college_id = get_my_college_id() OR is_global_admin()));

DROP POLICY IF EXISTS academic_years_admin_update ON public.academic_years;
CREATE POLICY academic_years_admin_update ON public.academic_years
    FOR UPDATE TO authenticated
    USING (is_admin() AND (college_id = get_my_college_id() OR is_global_admin()))
    WITH CHECK (is_admin() AND (college_id = get_my_college_id() OR is_global_admin()));

-- ============================================================================
-- DEPARTMENTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS departments_select ON public.departments;
CREATE POLICY departments_select ON public.departments
    FOR SELECT TO authenticated
    USING (college_id = get_my_college_id() OR is_global_admin());

DROP POLICY IF EXISTS departments_admin_insert ON public.departments;
CREATE POLICY departments_admin_insert ON public.departments
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() AND (college_id = get_my_college_id() OR is_global_admin()));

DROP POLICY IF EXISTS departments_admin_update ON public.departments;
CREATE POLICY departments_admin_update ON public.departments
    FOR UPDATE TO authenticated
    USING (is_admin() AND (college_id = get_my_college_id() OR is_global_admin()))
    WITH CHECK (is_admin() AND (college_id = get_my_college_id() OR is_global_admin()));

-- ============================================================================
-- BATCHES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS batches_select ON public.batches;
CREATE POLICY batches_select ON public.batches
    FOR SELECT TO authenticated
    USING (
        (college_id = get_my_college_id() OR is_global_admin())
        AND (
            is_admin()
            OR (is_faculty() AND faculty_has_batch(id))
            OR is_parent()  -- parents need to see batch info via student
        )
    );

DROP POLICY IF EXISTS batches_admin_insert ON public.batches;
CREATE POLICY batches_admin_insert ON public.batches
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() AND (college_id = get_my_college_id() OR is_global_admin()));

DROP POLICY IF EXISTS batches_admin_update ON public.batches;
CREATE POLICY batches_admin_update ON public.batches
    FOR UPDATE TO authenticated
    USING (is_admin() AND (college_id = get_my_college_id() OR is_global_admin()))
    WITH CHECK (is_admin() AND (college_id = get_my_college_id() OR is_global_admin()));

-- ============================================================================
-- FACULTY BATCH ASSIGNMENTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS fba_select ON public.faculty_batch_assignments;
CREATE POLICY fba_select ON public.faculty_batch_assignments
    FOR SELECT TO authenticated
    USING (
        faculty_id = auth.uid()
        OR (is_admin() AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = faculty_batch_assignments.faculty_id
              AND (p.college_id = get_my_college_id() OR is_global_admin())
        ))
    );

DROP POLICY IF EXISTS fba_admin_insert ON public.faculty_batch_assignments;
CREATE POLICY fba_admin_insert ON public.faculty_batch_assignments
    FOR INSERT TO authenticated
    WITH CHECK (
        is_admin()
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = faculty_id AND (p.college_id = get_my_college_id() OR is_global_admin())
        )
    );

DROP POLICY IF EXISTS fba_admin_delete ON public.faculty_batch_assignments;
CREATE POLICY fba_admin_delete ON public.faculty_batch_assignments
    FOR DELETE TO authenticated
    USING (
        is_admin()
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = faculty_id AND (p.college_id = get_my_college_id() OR is_global_admin())
        )
    );

-- ============================================================================
-- STUDENTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS students_select ON public.students;
CREATE POLICY students_select ON public.students
    FOR SELECT TO authenticated
    USING (
        (college_id = get_my_college_id() OR is_global_admin())
        AND (
            is_admin()
            OR (is_faculty() AND faculty_has_batch(batch_id))
            OR (is_parent() AND parent_has_verified_student(id))
        )
    );

DROP POLICY IF EXISTS students_faculty_insert ON public.students;
CREATE POLICY students_faculty_insert ON public.students
    FOR INSERT TO authenticated
    WITH CHECK (
        (college_id = get_my_college_id() OR is_global_admin())
        AND (
            is_admin()
            OR (is_faculty() AND faculty_has_batch(batch_id))
        )
    );

DROP POLICY IF EXISTS students_faculty_update ON public.students;
CREATE POLICY students_faculty_update ON public.students
    FOR UPDATE TO authenticated
    USING (
        (college_id = get_my_college_id() OR is_global_admin())
        AND (
            is_admin()
            OR (is_faculty() AND faculty_has_batch(batch_id))
        )
    )
    WITH CHECK (
        (college_id = get_my_college_id() OR is_global_admin())
        AND (
            is_admin()
            OR (is_faculty() AND faculty_has_batch(batch_id))
        )
    );

-- ============================================================================
-- PARENT STUDENT MAP POLICIES
-- ============================================================================
DROP POLICY IF EXISTS psm_select ON public.parent_student_map;
CREATE POLICY psm_select ON public.parent_student_map
    FOR SELECT TO authenticated
    USING (
        parent_id = auth.uid()
        OR (is_admin() AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = parent_student_map.student_id
              AND (s.college_id = get_my_college_id() OR is_global_admin())
        ))
    );

DROP POLICY IF EXISTS psm_admin_insert ON public.parent_student_map;
CREATE POLICY psm_admin_insert ON public.parent_student_map
    FOR INSERT TO authenticated
    WITH CHECK (
        is_admin()
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_id AND (s.college_id = get_my_college_id() OR is_global_admin())
        )
    );

DROP POLICY IF EXISTS psm_admin_update ON public.parent_student_map;
CREATE POLICY psm_admin_update ON public.parent_student_map
    FOR UPDATE TO authenticated
    USING (
        is_admin()
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_id AND (s.college_id = get_my_college_id() OR is_global_admin())
        )
    )
    WITH CHECK (
        is_admin()
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_id AND (s.college_id = get_my_college_id() OR is_global_admin())
        )
    );

DROP POLICY IF EXISTS psm_admin_delete ON public.parent_student_map;
CREATE POLICY psm_admin_delete ON public.parent_student_map
    FOR DELETE TO authenticated
    USING (
        is_admin()
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_id AND (s.college_id = get_my_college_id() OR is_global_admin())
        )
    );

-- ============================================================================
-- TESTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS tests_select ON public.tests;
CREATE POLICY tests_select ON public.tests
    FOR SELECT TO authenticated
    USING (
        (college_id = get_my_college_id() OR is_global_admin())
        AND (
            is_admin()
            OR (is_faculty() AND faculty_has_batch(batch_id))
            OR (
                is_parent()
                AND is_published = true
                AND EXISTS (
                    SELECT 1 FROM public.students s
                    WHERE s.batch_id = tests.batch_id
                      AND parent_has_verified_student(s.id)
                )
            )
        )
    );

DROP POLICY IF EXISTS tests_faculty_insert ON public.tests;
CREATE POLICY tests_faculty_insert ON public.tests
    FOR INSERT TO authenticated
    WITH CHECK (
        (college_id = get_my_college_id() OR is_global_admin())
        AND created_by = auth.uid()
        AND (is_admin() OR (is_faculty() AND faculty_has_batch(batch_id)))
    );

DROP POLICY IF EXISTS tests_faculty_update ON public.tests;
CREATE POLICY tests_faculty_update ON public.tests
    FOR UPDATE TO authenticated
    USING (
        (college_id = get_my_college_id() OR is_global_admin())
        AND (
            is_admin()
            OR (is_faculty() AND created_by = auth.uid() AND is_locked = false)
        )
    )
    WITH CHECK (
        (college_id = get_my_college_id() OR is_global_admin())
        AND (
            is_admin()
            OR (is_faculty() AND created_by = auth.uid())
        )
    );

-- ============================================================================
-- TEST SUBJECTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS test_subjects_select ON public.test_subjects;
CREATE POLICY test_subjects_select ON public.test_subjects
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = test_subjects.test_id
              AND (t.college_id = get_my_college_id() OR is_global_admin())
              AND (
                  is_admin()
                  OR (is_faculty() AND faculty_has_batch(t.batch_id))
                  OR (
                      is_parent()
                      AND t.is_published = true
                      AND EXISTS (
                          SELECT 1 FROM public.students s
                          WHERE s.batch_id = t.batch_id
                            AND parent_has_verified_student(s.id)
                      )
                  )
              )
        )
    );

DROP POLICY IF EXISTS test_subjects_faculty_modify ON public.test_subjects;
CREATE POLICY test_subjects_faculty_modify ON public.test_subjects
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = test_subjects.test_id
              AND (t.college_id = get_my_college_id() OR is_global_admin())
              AND t.is_locked = false
              AND (is_admin() OR (is_faculty() AND t.created_by = auth.uid()))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = test_subjects.test_id
              AND (t.college_id = get_my_college_id() OR is_global_admin())
              AND t.is_locked = false
              AND (is_admin() OR (is_faculty() AND t.created_by = auth.uid()))
        )
    );

-- ============================================================================
-- MARKS POLICIES — PARENTS HAVE ZERO ACCESS
-- ============================================================================
-- No policy granting parents any access. RLS is enabled, so parents are blocked.

DROP POLICY IF EXISTS marks_select ON public.marks;
CREATE POLICY marks_select ON public.marks
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = marks.test_id
              AND (t.college_id = get_my_college_id() OR is_global_admin())
              AND (
                  is_admin()
                  OR (is_faculty() AND faculty_has_batch(t.batch_id))
              )
        )
    );

DROP POLICY IF EXISTS marks_faculty_insert ON public.marks;
CREATE POLICY marks_faculty_insert ON public.marks
    FOR INSERT TO authenticated
    WITH CHECK (
        entered_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = test_id
              AND (t.college_id = get_my_college_id() OR is_global_admin())
              AND t.is_locked = false
              AND (is_admin() OR (is_faculty() AND faculty_has_batch(t.batch_id)))
        )
    );

DROP POLICY IF EXISTS marks_faculty_update ON public.marks;
CREATE POLICY marks_faculty_update ON public.marks
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = marks.test_id
              AND (t.college_id = get_my_college_id() OR is_global_admin())
              AND t.is_locked = false
              AND (is_admin() OR (is_faculty() AND faculty_has_batch(t.batch_id)))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = marks.test_id
              AND (t.college_id = get_my_college_id() OR is_global_admin())
              AND t.is_locked = false
              AND (is_admin() OR (is_faculty() AND faculty_has_batch(t.batch_id)))
        )
    );

-- ============================================================================
-- RANKINGS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS rankings_select ON public.rankings;
CREATE POLICY rankings_select ON public.rankings
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = rankings.test_id
              AND (t.college_id = get_my_college_id() OR is_global_admin())
              AND (
                  is_admin()
                  OR (is_faculty() AND faculty_has_batch(t.batch_id))
                  OR (
                      is_parent()
                      AND t.is_published = true
                      AND parent_has_verified_student(rankings.student_id)
                  )
              )
        )
    );

-- No INSERT/UPDATE/DELETE policies for rankings — only service_role can modify.

-- ============================================================================
-- AUDIT LOG POLICIES
-- ============================================================================
DROP POLICY IF EXISTS audit_log_admin_select ON public.audit_log;
CREATE POLICY audit_log_admin_select ON public.audit_log
    FOR SELECT TO authenticated
    USING (is_admin() AND (college_id = get_my_college_id() OR is_global_admin()));

DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
CREATE POLICY audit_log_insert ON public.audit_log
    FOR INSERT TO authenticated
    WITH CHECK (
        (college_id = get_my_college_id() OR is_global_admin())
        AND actor_id = auth.uid()
    );

-- RESTRICTIVE policies: nobody can update or delete audit logs
DROP POLICY IF EXISTS audit_log_no_update ON public.audit_log;
CREATE POLICY audit_log_no_update ON public.audit_log
    AS RESTRICTIVE
    FOR UPDATE TO authenticated, anon
    USING (false)
    WITH CHECK (false);

DROP POLICY IF EXISTS audit_log_no_delete ON public.audit_log;
CREATE POLICY audit_log_no_delete ON public.audit_log
    AS RESTRICTIVE
    FOR DELETE TO authenticated, anon
    USING (false);

-- ============================================================================
-- DONE — All RLS policies in place
-- ============================================================================
