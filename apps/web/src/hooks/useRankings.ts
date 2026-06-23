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

export interface SubjectRankingRow {
  id: string;
  test_id: string;
  subject_id: string;
  student_id: string;
  marks_obtained: number | null;
  is_absent: boolean;
  rank: number;
  total_students: number;
  student?: { id: string; full_name: string; roll_number: string };
}

export function useSubjectRankings(testId: string | undefined, subjectId: string | undefined) {
  return useQuery({
    queryKey: ['subject-rankings', testId, subjectId],
    queryFn: async () => {
      if (!testId || !subjectId) return [];
      const { data, error } = await supabase
        .from('subject_rankings')
        .select('*, student:students(id, full_name, roll_number)')
        .eq('test_id', testId)
        .eq('subject_id', subjectId)
        .order('rank', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SubjectRankingRow[];
    },
    enabled: !!testId && !!subjectId,
  });
}

