-- ============================================================================
-- AcademeIQ Platform — Schema Migration (001)
-- ============================================================================
-- Creates all tables, foreign keys, constraints, and indexes for the platform.
-- Run order: 001_schema.sql → 002_rls.sql → 003_functions_triggers.sql
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. COLLEGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.colleges (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    code        TEXT UNIQUE NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. ACADEMIC YEARS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.academic_years (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id   UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    label        TEXT NOT NULL,
    is_current   BOOLEAN NOT NULL DEFAULT false,
    starts_at    DATE,
    ends_at      DATE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (college_id, label)
);

-- Only one current academic year per college
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_years_one_current
    ON public.academic_years (college_id)
    WHERE is_current = true;

-- ============================================================================
-- 3. DEPARTMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.departments (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id   UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    code         TEXT NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (college_id, code)
);

-- ============================================================================
-- 4. PROFILES (extends auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    college_id   UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
    role         TEXT NOT NULL CHECK (role IN ('admin', 'faculty', 'parent')),
    full_name    TEXT NOT NULL,
    email        TEXT,
    phone        TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_college_role ON public.profiles (college_id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email) WHERE email IS NOT NULL;

-- ============================================================================
-- 5. BATCHES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.batches (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id          UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    department_id       UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    academic_year_id    UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    name                TEXT NOT NULL,
    code                TEXT NOT NULL,
    semester            INT NOT NULL CHECK (semester BETWEEN 1 AND 10),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (college_id, code)
);

CREATE INDEX IF NOT EXISTS idx_batches_college ON public.batches (college_id);
CREATE INDEX IF NOT EXISTS idx_batches_department ON public.batches (department_id);

-- ============================================================================
-- 6. FACULTY BATCH ASSIGNMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.faculty_batch_assignments (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    batch_id     UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (faculty_id, batch_id)
);

CREATE INDEX IF NOT EXISTS idx_fba_faculty ON public.faculty_batch_assignments (faculty_id);
CREATE INDEX IF NOT EXISTS idx_fba_batch ON public.faculty_batch_assignments (batch_id);

-- ============================================================================
-- 7. STUDENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.students (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id      UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    batch_id        UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
    usn             TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    date_of_birth   DATE,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (college_id, usn)
);

CREATE INDEX IF NOT EXISTS idx_students_college_batch ON public.students (college_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_students_batch ON public.students (batch_id);

-- ============================================================================
-- 8. PARENT STUDENT MAP
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.parent_student_map (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    relationship    TEXT NOT NULL DEFAULT 'guardian',
    is_verified     BOOLEAN NOT NULL DEFAULT false,
    mapped_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at     TIMESTAMPTZ,
    UNIQUE (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_psm_parent ON public.parent_student_map (parent_id, student_id);
CREATE INDEX IF NOT EXISTS idx_psm_student ON public.parent_student_map (student_id);

-- ============================================================================
-- 9. TESTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id      UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    batch_id        UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
    created_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title           TEXT NOT NULL,
    description     TEXT,
    test_date       DATE NOT NULL,
    is_published    BOOLEAN NOT NULL DEFAULT false,
    is_locked       BOOLEAN NOT NULL DEFAULT false,
    published_at    TIMESTAMPTZ,
    locked_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tests_batch_published ON public.tests (batch_id, is_published);
CREATE INDEX IF NOT EXISTS idx_tests_college ON public.tests (college_id);

-- ============================================================================
-- 10. TEST SUBJECTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.test_subjects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id         UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    subject_name    TEXT NOT NULL,
    max_marks       INT NOT NULL CHECK (max_marks > 0),
    weightage       NUMERIC(5, 2) NOT NULL DEFAULT 1.0 CHECK (weightage > 0),
    display_order   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (test_id, subject_name)
);

CREATE INDEX IF NOT EXISTS idx_test_subjects_test ON public.test_subjects (test_id);

-- ============================================================================
-- 11. MARKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.marks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id             UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id          UUID NOT NULL REFERENCES public.test_subjects(id) ON DELETE CASCADE,
    marks_obtained      NUMERIC(6, 2) CHECK (marks_obtained >= 0),
    is_absent           BOOLEAN NOT NULL DEFAULT false,
    entered_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    entered_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (test_id, student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_marks_test_student ON public.marks (test_id, student_id);
CREATE INDEX IF NOT EXISTS idx_marks_test ON public.marks (test_id);

-- ============================================================================
-- 12. RANKINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rankings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id             UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    total_marks         NUMERIC(8, 2) NOT NULL,
    max_marks           NUMERIC(8, 2) NOT NULL,
    percentage          NUMERIC(5, 2) NOT NULL,
    rank                INT NOT NULL,
    batch_rank          INT NOT NULL,
    total_students      INT NOT NULL,
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (test_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_rankings_test_rank ON public.rankings (test_id, rank);
CREATE INDEX IF NOT EXISTS idx_rankings_student ON public.rankings (student_id);

-- ============================================================================
-- 13. AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id              BIGSERIAL PRIMARY KEY,
    college_id      UUID NOT NULL,
    actor_id        UUID NOT NULL,
    action          TEXT NOT NULL,
    entity_type     TEXT,
    entity_id       UUID,
    old_value       JSONB,
    new_value       JSONB,
    ip_address      INET,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor_time ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_college_time ON public.audit_log (college_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_log (action);

-- ============================================================================
-- DONE — Schema complete
-- ============================================================================
