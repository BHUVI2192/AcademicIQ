import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { Ranking } from '@shared';

export interface RankingRow extends Ranking {
  student?: { id: string; full_name: string; roll_number: string };
}

export function useRankings(testId: string | undefined) {
  return useQuery({
    queryKey: ['rankings', testId],
    queryFn: async () => {
      if (!testId) return [];
      const { data, error } = await supabase
        .from('rankings')
        .select('*, student:students(id, full_name, roll_number)')
        .eq('test_id', testId)
        .order('rank', { ascending: true });
      if (error) throw error;
      return (data ?? []) as RankingRow[];
    },
    enabled: !!testId,
  });
}
