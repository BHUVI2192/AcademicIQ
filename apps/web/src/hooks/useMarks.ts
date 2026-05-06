import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Mark } from '@shared';

export interface MarkUpsert {
  test_id: string;
  student_id: string;
  subject_id: string;
  marks_obtained: number | null;
  num_attempted?: number | null;
  num_unanswered?: number | null;
  num_incorrect?: number | null;
  is_absent: boolean;
  entered_by: string;
}

export function useMarks(testId: string | undefined) {
  return useQuery({
    queryKey: ['marks', testId],
    queryFn: async () => {
      if (!testId) return [];
      const { data, error } = await supabase
        .from('marks')
        .select('*')
        .eq('test_id', testId);
      if (error) throw error;
      return (data ?? []) as Mark[];
    },
    enabled: !!testId,
  });
}

export function useUpsertMark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mark: MarkUpsert) => {
      const { data, error } = await supabase
        .from('marks')
        .upsert(
          {
            test_id: mark.test_id,
            student_id: mark.student_id,
            subject_id: mark.subject_id,
            marks_obtained: mark.is_absent ? 0 : mark.marks_obtained ?? 0,
            num_attempted: mark.num_attempted,
            num_unanswered: mark.num_unanswered,
            num_incorrect: mark.num_incorrect,
            is_absent: mark.is_absent,
            entered_by: mark.entered_by,
            entered_at: new Date().toISOString(),
          },
          { onConflict: 'test_id,student_id,subject_id' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['marks', variables.test_id] });
    },
  });
}

export function useBulkMarksUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { test_id: string; marks: MarkUpsert[] }) => {
      const rows = payload.marks.map((m) => ({
        test_id: m.test_id,
        student_id: m.student_id,
        subject_id: m.subject_id,
        marks_obtained: m.is_absent ? 0 : m.marks_obtained ?? 0,
        num_attempted: m.num_attempted,
        num_unanswered: m.num_unanswered,
        num_incorrect: m.num_incorrect,
        is_absent: m.is_absent,
        entered_by: m.entered_by,
        entered_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from('marks')
        .upsert(rows, { onConflict: 'test_id,student_id,subject_id' });
      if (error) throw error;
      return { count: rows.length };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['marks', variables.test_id] });
    },
  });
}

export function useDebouncedMarkSave(delayMs = 500) {
  const upsert = useUpsertMark();
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const save = useCallback(
    (mark: MarkUpsert) => {
      const key = `${mark.test_id}:${mark.student_id}:${mark.subject_id}`;
      const existing = timersRef.current.get(key);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        upsert.mutate(mark);
        timersRef.current.delete(key);
      }, delayMs);
      timersRef.current.set(key, timer);
    },
    [upsert, delayMs]
  );

  return { save, status: upsert.status, error: upsert.error };
}
