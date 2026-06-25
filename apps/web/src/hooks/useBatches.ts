import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { Batch, Stream, ClassLevel } from '@shared';

export interface BatchWithRelations extends Batch {
  academic_year?: { id: string; label: string };
  // department kept for backward compat queries but unused in PUC context
  department?: { id: string; name: string; code: string } | null;
}

export function useBatch(id: string | undefined) {
  return useQuery({
    queryKey: ['batch', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('batches')
        .select('*, academic_year:academic_years(id, label)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as BatchWithRelations | null;
    },
    enabled: !!id,
  });
}

export function useBatches(collegeId?: string | null, academicYearId?: string | null) {
  return useQuery({
    queryKey: ['batches', collegeId, academicYearId],
    queryFn: async () => {
      let query = supabase
        .from('batches')
        .select('*, academic_year:academic_years(id, label)');

      if (collegeId) {
        query = query.eq('college_id', collegeId);
      }
      if (academicYearId) {
        query = query.eq('academic_year_id', academicYearId);
      }

      const { data, error } = await query.order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BatchWithRelations[];
    },
  });
}

export function useFacultyAssignedBatches(facultyId: string | undefined) {
  return useQuery({
    queryKey: ['faculty-batches', facultyId],
    queryFn: async () => {
      if (!facultyId) return [];
      const { data, error } = await supabase
        .from('faculty_batch_assignments')
        .select('batch:batches(*, academic_year:academic_years(id, label))')
        .eq('faculty_id', facultyId);
      if (error) throw error;
      return ((data ?? []) as any[])
        .map((r) => r.batch)
        .filter(Boolean) as BatchWithRelations[];
    },
    enabled: !!facultyId,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      college_id: string;
      academic_year_id: string;
      name: string;
      code: string;
      class_level: ClassLevel;
      stream: Stream;
    }) => {
      const { data, error } = await supabase
        .from('batches')
        .insert({ ...input, is_active: true, department_id: null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['batches', variables.college_id] });
      queryClient.invalidateQueries({ queryKey: ['batches', null] });
    },
  });
}

export function useUpdateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Batch> }) => {
      const { data, error } = await supabase
        .from('batches')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['batches', data.college_id] });
      queryClient.invalidateQueries({ queryKey: ['batches', null] });
    },
  });
}

export function useDeleteBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('batches')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });
}
