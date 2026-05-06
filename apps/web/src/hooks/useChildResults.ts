import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { Ranking, Test, TestSubject, VerifiedChild } from '@shared';

export function useVerifiedChildren(parentId: string | undefined) {
  return useQuery({
    queryKey: ['verified-children', parentId],
    queryFn: async () => {
      if (!parentId) return [];
      const { data, error } = await supabase
        .from('parent_student_map')
        .select(
          'student:students(id, full_name, roll_number, batch:batches(id, name))'
        )
        .eq('parent_id', parentId)
        .eq('is_verified', true);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      return rows
        .map((r) => {
          const s = r.student;
          if (!s) return null;
          return {
            student_id: s.id,
            full_name: s.full_name,
            roll_number: s.roll_number,
            batch_id: s.batch?.id ?? '',
            batch_name: s.batch?.name ?? '',
          } as VerifiedChild;
        })
        .filter(Boolean) as VerifiedChild[];
    },
    enabled: !!parentId,
  });
}

export interface ChildRanking extends Ranking {
  test?: Test;
}

export function useChildRankings(studentId: string | undefined) {
  return useQuery({
    queryKey: ['child-rankings', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('rankings')
        .select('*, test:tests(*)')
        .eq('student_id', studentId)
        .order('computed_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as ChildRanking[];
      return rows.filter((r) => r.test?.is_published);
    },
    enabled: !!studentId,
  });
}

export interface ChildTestDetail {
  test: Test;
  subjects: TestSubject[];
  ranking: Ranking | null;
}

export function useChildTestDetail(testId: string | undefined, studentId: string | undefined) {
  return useQuery({
    queryKey: ['child-test-detail', testId, studentId],
    queryFn: async (): Promise<ChildTestDetail | null> => {
      if (!testId || !studentId) return null;
      const { data: test, error: testError } = await supabase
        .from('tests')
        .select('*')
        .eq('id', testId)
        .eq('is_published', true)
        .maybeSingle();
      if (testError) throw testError;
      if (!test) return null;
      const { data: subjects, error: subjectsError } = await supabase
        .from('test_subjects')
        .select('*')
        .eq('test_id', testId)
        .order('display_order', { ascending: true });
      if (subjectsError) throw subjectsError;
      const { data: ranking } = await supabase
        .from('rankings')
        .select('*')
        .eq('test_id', testId)
        .eq('student_id', studentId)
        .maybeSingle();
      return {
        test: test as Test,
        subjects: (subjects ?? []) as TestSubject[],
        ranking: (ranking ?? null) as Ranking | null,
      };
    },
    enabled: !!testId && !!studentId,
  });
}

export interface ChildMarkRow {
  id: string;
  subject_id: string;
  marks_obtained: number | null;
  is_absent: boolean;
  subject_name: string;
  max_marks: number;
  weightage: number;
}

/** Fetches subject-wise marks for a specific student in a specific (published) test */
export function useChildMarks(testId: string | undefined, studentId: string | undefined) {
  return useQuery({
    queryKey: ['child-marks', testId, studentId],
    queryFn: async (): Promise<ChildMarkRow[]> => {
      if (!testId || !studentId) return [];
      const { data, error } = await supabase
        .from('marks')
        .select(
          'id, subject_id, marks_obtained, is_absent, subject:test_subjects(subject_name, max_marks, weightage)'
        )
        .eq('test_id', testId)
        .eq('student_id', studentId);
      if (error) throw error;
      return ((data ?? []) as any[]).map((m) => ({
        id: m.id,
        subject_id: m.subject_id,
        marks_obtained: m.marks_obtained,
        is_absent: m.is_absent ?? false,
        subject_name: m.subject?.subject_name ?? 'Unknown',
        max_marks: m.subject?.max_marks ?? 0,
        weightage: m.subject?.weightage ?? 1,
      }));
    },
    enabled: !!testId && !!studentId,
  });
}
