-- ============================================================================
-- AcademeIQ Platform — Parent Phone Auth Support (009)
-- ============================================================================
-- Ensures phone is tracked for parent accounts and adds a temp_password_set flag
-- ============================================================================

-- Add temp_password_set column to profiles (tracks if parent needs to change password)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS temp_password_set BOOLEAN NOT NULL DEFAULT false;

-- Update existing parent profiles to mark temp password as set
UPDATE public.profiles
  SET temp_password_set = true
  WHERE role = 'parent';

-- Add index for faster phone lookups on parents
CREATE INDEX IF NOT EXISTS idx_profiles_parent_phone 
  ON public.profiles (phone) 
  WHERE role = 'parent' AND phone IS NOT NULL;

-- ============================================================================
-- DONE
-- ============================================================================
