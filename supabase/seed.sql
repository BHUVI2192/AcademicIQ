-- ============================================================================
-- AcademeIQ Platform — Seed Data
-- ============================================================================
-- Inserts realistic sample data for development and demo purposes.
-- NOTE: Auth users must be created separately via Supabase Dashboard or
-- supabase.auth.admin.createUser API. This script uses placeholder UUIDs
-- for faculty/admin profile IDs — replace them with real auth.users IDs
-- after creating those users.
-- ============================================================================

-- Clean up any prior seed data (safe re-run)
DELETE FROM public.rankings WHERE test_id IN (SELECT id FROM public.tests WHERE college_id IN (SELECT id FROM public.colleges WHERE code = 'SJCE'));
DELETE FROM public.marks WHERE test_id IN (SELECT id FROM public.tests WHERE college_id IN (SELECT id FROM public.colleges WHERE code = 'SJCE'));
DELETE FROM public.test_subjects WHERE test_id IN (SELECT id FROM public.tests WHERE college_id IN (SELECT id FROM public.colleges WHERE code = 'SJCE'));
DELETE FROM public.tests WHERE college_id IN (SELECT id FROM public.colleges WHERE code = 'SJCE');
DELETE FROM public.parent_student_map WHERE student_id IN (SELECT id FROM public.students WHERE college_id IN (SELECT id FROM public.colleges WHERE code = 'SJCE'));
DELETE FROM public.students WHERE college_id IN (SELECT id FROM public.colleges WHERE code = 'SJCE');
DELETE FROM public.faculty_batch_assignments WHERE batch_id IN (SELECT id FROM public.batches WHERE college_id IN (SELECT id FROM public.colleges WHERE code = 'SJCE'));
DELETE FROM public.batches WHERE college_id IN (SELECT id FROM public.colleges WHERE code = 'SJCE');
DELETE FROM public.departments WHERE college_id IN (SELECT id FROM public.colleges WHERE code = 'SJCE');
DELETE FROM public.academic_years WHERE college_id IN (SELECT id FROM public.colleges WHERE code = 'SJCE');
DELETE FROM public.colleges WHERE code = 'SJCE';

-- ============================================================================
-- COLLEGE
-- ============================================================================
INSERT INTO public.colleges (id, name, code, is_active) VALUES
    ('11111111-1111-1111-1111-111111111111', 'St. Joseph''s College of Engineering', 'SJCE', true);

-- ============================================================================
-- ACADEMIC YEAR
-- ============================================================================
INSERT INTO public.academic_years (id, college_id, label, is_current, starts_at, ends_at) VALUES
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '2024-25', true, '2024-08-01', '2025-05-31');

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================
INSERT INTO public.departments (id, college_id, name, code, is_active) VALUES
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Computer Science & Engineering', 'CSE', true),
    ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Electronics & Communication', 'ECE', true);

-- ============================================================================
-- BATCHES
-- ============================================================================
INSERT INTO public.batches (id, college_id, department_id, academic_year_id, name, code, semester, is_active) VALUES
    ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'CSE Section A — Sem 3', 'CSE-A-S3', 3, true),
    ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'CSE Section B — Sem 3', 'CSE-B-S3', 3, true),
    ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'ECE Section A — Sem 3', 'ECE-A-S3', 3, true);

-- ============================================================================
-- STUDENTS (30 across 3 batches)
-- ============================================================================
-- CSE-A: 10 students
INSERT INTO public.students (id, college_id, batch_id, usn, full_name, date_of_birth, is_active) VALUES
    ('a1000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '1SJ23CS001', 'Aarav Sharma',     '2005-03-12', true),
    ('a1000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '1SJ23CS002', 'Bhavya Patel',     '2005-05-22', true),
    ('a1000003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '1SJ23CS003', 'Chetan Reddy',     '2005-07-09', true),
    ('a1000004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '1SJ23CS004', 'Diya Iyer',        '2005-08-15', true),
    ('a1000005-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '1SJ23CS005', 'Eshan Kumar',      '2005-09-30', true),
    ('a1000006-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '1SJ23CS006', 'Fatima Khan',      '2005-11-04', true),
    ('a1000007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '1SJ23CS007', 'Gaurav Singh',     '2005-12-19', true),
    ('a1000008-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '1SJ23CS008', 'Hanvika Rao',      '2006-01-08', true),
    ('a1000009-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '1SJ23CS009', 'Ishaan Kapoor',    '2006-02-21', true),
    ('a1000010-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '1SJ23CS010', 'Jhanvi Desai',     '2006-03-14', true);

-- CSE-B: 10 students
INSERT INTO public.students (id, college_id, batch_id, usn, full_name, date_of_birth, is_active) VALUES
    ('b1000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '1SJ23CS011', 'Karthik Bhat',     '2005-04-11', true),
    ('b1000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '1SJ23CS012', 'Lavanya Hegde',    '2005-06-23', true),
    ('b1000003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '1SJ23CS013', 'Manish Joshi',     '2005-07-29', true),
    ('b1000004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '1SJ23CS014', 'Nithya Murthy',    '2005-09-05', true),
    ('b1000005-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '1SJ23CS015', 'Omkar Pai',        '2005-10-18', true),
    ('b1000006-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '1SJ23CS016', 'Pooja Naik',       '2005-12-02', true),
    ('b1000007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '1SJ23CS017', 'Quincy Crasta',    '2006-01-25', true),
    ('b1000008-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '1SJ23CS018', 'Rohan Shetty',     '2006-02-13', true),
    ('b1000009-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '1SJ23CS019', 'Sneha Gowda',      '2006-03-22', true),
    ('b1000010-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '1SJ23CS020', 'Tarun Acharya',    '2006-04-09', true);

-- ECE-A: 10 students
INSERT INTO public.students (id, college_id, batch_id, usn, full_name, date_of_birth, is_active) VALUES
    ('c1000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '1SJ23EC001', 'Uma Bhandary',     '2005-05-17', true),
    ('c1000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '1SJ23EC002', 'Vikram Holla',     '2005-06-28', true),
    ('c1000003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '1SJ23EC003', 'Wajeed Ahmed',     '2005-08-04', true),
    ('c1000004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '1SJ23EC004', 'Xenia Pinto',      '2005-09-19', true),
    ('c1000005-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '1SJ23EC005', 'Yash Kamath',      '2005-10-30', true),
    ('c1000006-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '1SJ23EC006', 'Zara D''Souza',    '2005-12-11', true),
    ('c1000007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '1SJ23EC007', 'Aniket Pujari',    '2006-01-16', true),
    ('c1000008-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '1SJ23EC008', 'Bindu Kulkarni',   '2006-02-27', true),
    ('c1000009-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '1SJ23EC009', 'Charan Salian',    '2006-03-30', true),
    ('c1000010-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '1SJ23EC010', 'Deepika Nayak',    '2006-04-15', true);

-- ============================================================================
-- INFO MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'AcademeIQ seed data loaded successfully:';
    RAISE NOTICE '  - 1 College: St. Joseph''s College of Engineering (SJCE)';
    RAISE NOTICE '  - 1 Academic Year: 2024-25';
    RAISE NOTICE '  - 2 Departments: CSE, ECE';
    RAISE NOTICE '  - 3 Batches: CSE-A, CSE-B, ECE-A (Semester 3)';
    RAISE NOTICE '  - 30 Students';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Create admin user via Supabase Dashboard → Authentication';
    RAISE NOTICE '  2. Insert profile row linking that user to college_id:';
    RAISE NOTICE '     11111111-1111-1111-1111-111111111111 with role=admin';
    RAISE NOTICE '  3. Login at /login and start using the platform!';
    RAISE NOTICE '======================================================================';
END $$;
