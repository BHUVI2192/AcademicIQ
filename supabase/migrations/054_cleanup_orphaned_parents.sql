-- Delete existing orphaned parent accounts (parents with role = 'parent' having 0 mappings)
DELETE FROM auth.users 
WHERE id IN (
  SELECT p.id 
  FROM public.profiles p
  LEFT JOIN public.parent_student_map psm ON psm.parent_id = p.id
  WHERE p.role = 'parent' AND psm.parent_id IS NULL
);

-- Create trigger function to clean up orphaned parent accounts upon map deletions
CREATE OR REPLACE FUNCTION public.fn_cleanup_orphaned_parent()
RETURNS TRIGGER AS $$
BEGIN
  -- If the parent has no more students/mappings remaining and their role is 'parent',
  -- delete them from auth.users (which cascades to public.profiles)
  IF NOT EXISTS (
    SELECT 1 FROM public.parent_student_map 
    WHERE parent_id = OLD.parent_id
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = OLD.parent_id AND role = 'parent'
    ) THEN
      DELETE FROM auth.users WHERE id = OLD.parent_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on parent_student_map
DROP TRIGGER IF EXISTS trg_cleanup_orphaned_parent ON public.parent_student_map;
CREATE TRIGGER trg_cleanup_orphaned_parent
AFTER DELETE ON public.parent_student_map
FOR EACH ROW
EXECUTE FUNCTION public.fn_cleanup_orphaned_parent();
