-- AcademeIQ Platform — Fix Attendance marked_by delete constraint (057)
-- Resolves the "Database error deleting user" issue caused by a conflict between
-- the NOT NULL constraint on public.attendance.marked_by and its foreign key
-- delete rule of ON DELETE SET NULL.

-- 1. Drop existing foreign key constraint on marked_by
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_marked_by_fkey;

-- 2. Make the marked_by column nullable to allow setting to NULL on delete
ALTER TABLE public.attendance
  ALTER COLUMN marked_by DROP NOT NULL;

-- 3. Re-add foreign key constraint with ON DELETE SET NULL
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_marked_by_fkey
  FOREIGN KEY (marked_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;
