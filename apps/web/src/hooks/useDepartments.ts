import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { Department } from '@shared';

export function useDepartments(collegeId?: string | null) {
  return useQuery({
    queryKey: ['departments', collegeId],
    queryFn: async () => {
      let query = supabase.from('departments').select('*');
      if (collegeId) {
        query = query.eq('college_id', collegeId);
      }
      const { data, error } = await query.order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Department[];
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { college_id: string; name: string; code: string }) => {
      const { data, error } = await supabase
        .from('departments')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['departments', variables.college_id] });
      queryClient.invalidateQueries({ queryKey: ['departments', null] });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Department> }) => {
      const { data, error } = await supabase
        .from('departments')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['departments', data.college_id] });
      queryClient.invalidateQueries({ queryKey: ['departments', null] });
    },
  });
}

