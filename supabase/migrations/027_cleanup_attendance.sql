-- ============================================================================
-- CLEANUP MIGRATION: Remove all problematic attendance code
-- ============================================================================
-- This migration completely removes the attendance system that was
-- causing RLS recursion, 400 errors, and profile fetch timeouts.
--
-- Removes:
-- 1. All attendance RLS policies
-- 2. Attendance and attendance_approval_log tables
-- 3. All attendance RPC functions
-- 4. All attendance-related migrations (022-026)
--
-- This is a fresh start for a clean attendance implementation.
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop ALL attendance RLS policies from migration 011
-- ============================================================================

DROP POLICY IF EXISTS "Admins can do everything on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Assigned faculty can update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Parents can view child attendance" ON public.attendance;

-- ============================================================================
-- STEP 2: Drop attendance tables
-- ============================================================================

DROP TABLE IF EXISTS public.attendance_approval_log CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;

-- ============================================================================
-- STEP 3: Drop all attendance RPC functions created in 022-026
-- ============================================================================

-- From 022_attendance_enhancement.sql
DROP FUNCTION IF EXISTS public.get_batch_attendance_with_students(UUID, DATE, TEXT);

-- From 023_attendance_workflow.sql
DROP FUNCTION IF EXISTS public.get_pending_attendance_for_admin(TEXT, UUID, DATE);
DROP FUNCTION IF EXISTS public.get_batch_attendance_for_approval(UUID, DATE, TEXT);
DROP FUNCTION IF EXISTS public.get_attendance_stats();
DROP FUNCTION IF EXISTS public.submit_batch_attendance(UUID, UUID, DATE, TEXT);
DROP FUNCTION IF EXISTS public.approve_batch_attendance(UUID, UUID, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.reject_batch_attendance(UUID, UUID, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.publish_batch_attendance(UUID, UUID, DATE, TEXT);

-- ============================================================================
-- STEP 4: Clean audit log
-- ============================================================================

INSERT INTO public.audit_log (college_id, actor_id, action, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  '00000000-0000-0000-0000-000000000000', 
  'migration.cleanup_attendance', 
  '{"description": "Cleaned up problematic attendance implementation. All tables, policies, and RPC functions removed."}'::jsonb
);
