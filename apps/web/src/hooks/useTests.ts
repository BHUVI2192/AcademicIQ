// ============================================================================
// useTests — manage tests + subjects + publish/lock lifecycle
// ============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Test, TestSubject, ExamCategory } from '@shared';
import { supabase } from '@lib/supabaseClient';

interface SubjectInput {
  subject_name: string;
  max_marks: number;
  num_questions?: number;
  weightage: number;
  display_order: number;
  chapter_name?: string;
}

interface CreateTestInput {
  college_id: string;
  batch_id: string;
  created_by: string;
  title: string;
  description?: string;
  chapter_name?: string;
  test_date: string;
  exam_category: ExamCategory;
  exam_sub_type?: string;
  assigned_faculty_id?: string | null;
  subjects: SubjectInput[];
}

export function useTests(batchId?: string, batchIds?: string[], facultyId?: string) {
  return useQuery({
    queryKey: ['tests', batchId ?? 'all', batchIds?.join(',') ?? '', facultyId ?? ''],
    queryFn: async (): Promise<Test[]> => {
      let q = supabase.from('tests').select('*').order('test_date', { ascending: false });
      
      if (batchIds && batchIds.length > 0) {
        // Faculty tests: only show tests for their assigned batches
        q = q.in('batch_id', batchIds);
      } else if (batchId) {
        q = q.eq('batch_id', batchId);
      } else if (facultyId) {
        // If no batch IDs but faculty ID provided, still filter by batch_id
        // This handles the case where faculty has no assigned batches
        q = q.eq('batch_id', 'no-batch-found');
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data as Test[];
    },
  });
}

export function useTest(testId: string | undefined) {
  return useQuery({
    queryKey: ['test', testId],
    enabled: !!testId,
    queryFn: async (): Promise<(Test & { subjects: TestSubject[] }) | null> => {
      if (!testId) return null;
      const { data: test, error: testErr } = await supabase
        .from('tests')
        .select('*')
        .eq('id', testId)
        .maybeSingle();
      if (testErr) throw testErr;
      if (!test) return null;

      const { data: subjects, error: subjErr } = await supabase
        .from('test_subjects')
        .select('*')
        .eq('test_id', testId)
        .order('display_order', { ascending: true });
      if (subjErr) throw subjErr;

      return { ...(test as Test), subjects: (subjects ?? []) as TestSubject[] };
    },
  });
}

export function useCreateTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTestInput): Promise<Test> => {
      // Create test row
      const { data: test, error: testErr } = await supabase
        .from('tests')
        .insert({
          college_id: input.college_id,
          batch_id: input.batch_id,
          created_by: input.created_by,
          title: input.title.trim(),
          description: input.description?.trim() ?? null,
          chapter_name: input.chapter_name?.trim() ?? null,
          test_date: input.test_date,
          exam_category: input.exam_category,
          exam_sub_type: input.exam_sub_type || null,
          assigned_faculty_id: input.assigned_faculty_id || null,
          is_published: false,
          is_locked: false,
        })
        .select('*');
      if (testErr) throw testErr;
      if (!test || test.length === 0) throw new Error('Failed to create test record');
      const testData = test[0];

      // Create subjects
      if (input.subjects.length > 0) {
        const { error: subjErr } = await supabase.from('test_subjects').insert(
          input.subjects.map((s) => ({
            test_id: testData.id,
            subject_name: s.subject_name.trim(),
            max_marks: s.max_marks,
            num_questions: s.num_questions || 0,
            weightage: s.weightage,
            chapter_name: s.chapter_name?.trim() || null,
            display_order: s.display_order,
          }))
        );
        if (subjErr) throw subjErr;
      }

      return testData as Test;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tests'] });
    },
  });
}

export function usePublishTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (testId: string): Promise<Test> => {
      const { data, error } = await supabase
        .from('tests')
        .update({ is_published: true })
        .eq('id', testId)
        .select('*');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Test not found or could not be updated');
      return data[0] as Test;
    },
    onSuccess: (_, testId) => {
      qc.invalidateQueries({ queryKey: ['tests'] });
      qc.invalidateQueries({ queryKey: ['test', testId] });
    },
  });
}

export function useLockTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (testId: string): Promise<Test> => {
      // Lock the test
      const { data, error } = await supabase
        .from('tests')
        .update({ is_locked: true })
        .eq('id', testId)
        .select('*');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Test not found or could not be updated');

      // Trigger ranking computation via SQL RPC
      const { error: rpcErr } = await supabase.rpc('recalculate_rankings', {
        p_test_id: testId,
      });
      if (rpcErr) {
        console.error('Recalculate rankings failed:', rpcErr);
        // Still return the test — admin can re-trigger ranking later
      }

      return data[0] as Test;
    },
    onSuccess: (_, testId) => {
      qc.invalidateQueries({ queryKey: ['tests'] });
      qc.invalidateQueries({ queryKey: ['test', testId] });
      qc.invalidateQueries({ queryKey: ['rankings', testId] });
    },
  });
}

/**
 * Admin: Approve all submitted marks for a test
 */
export function useApproveMarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ testId, adminId, remarks }: { testId: string; adminId: string; remarks?: string }) => {
      const { data, error } = await supabase.rpc('approve_marks_for_test', {
        p_test_id: testId,
        p_admin_id: adminId,
        p_remarks: remarks ?? null,
      });
      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data as any;
      if (!res?.success) throw new Error(res?.message ?? 'Failed to approve marks');
      return res;
    },
    onSuccess: (_, { testId }) => {
      qc.invalidateQueries({ queryKey: ['test', testId] });
      qc.invalidateQueries({ queryKey: ['marks', testId] });
    },
  });
}

/**
 * Admin: Publish approved marks to parents (sets marks_status = 'published', calculates rankings)
 */
export function usePublishMarksToParents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ testId, adminId }: { testId: string; adminId: string }) => {
      const { data, error } = await supabase.rpc('publish_test_marks', {
        p_test_id: testId,
        p_admin_id: adminId,
      });
      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data as any;
      if (!res?.success) throw new Error(res?.message ?? 'Failed to publish marks');
      return res;
    },
    onSuccess: (_, { testId }) => {
      qc.invalidateQueries({ queryKey: ['test', testId] });
      qc.invalidateQueries({ queryKey: ['marks', testId] });
      qc.invalidateQueries({ queryKey: ['rankings', testId] });
    },
  });
}
