-- ============================================================================
-- Migration: Temp Inspect Function (047)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.inspect_recalculate_rankings()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_src TEXT;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc WHERE proname = 'recalculate_rankings';
  RETURN v_src;
END;
$$;
