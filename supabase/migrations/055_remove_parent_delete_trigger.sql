-- Drop the parent cleanup trigger and function to prevent direct SQL deletes on auth.users,
-- which causes GoTrue cache/state corruption.
DROP TRIGGER IF EXISTS trg_cleanup_orphaned_parent ON public.parent_student_map;
DROP FUNCTION IF EXISTS public.fn_cleanup_orphaned_parent();
