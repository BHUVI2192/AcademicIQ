import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { AcademicYear } from '@shared';

export function useAcademicYears(collegeId?: string | null) {
  return useQuery({
    queryKey: ['academic-years', collegeId],
    queryFn: async () => {
      let query = supabase.from('academic_years').select('*');
      if (collegeId) {
        query = query.eq('college_id', collegeId);
      }
      const { data, error } = await query.order('starts_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AcademicYear[];
    },
  });
}

export function useCreateAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      college_id: string;
      label: string;
      starts_at: string;
      ends_at: string;
      is_current?: boolean;
    }) => {
      console.log('[useCreateAcademicYear] Starting mutation with input:', input);
      if (input.is_current) {
        console.log('[useCreateAcademicYear] Resetting other years for college:', input.college_id);
        const { error: updateError } = await supabase
          .from('academic_years')
          .update({ is_current: false })
          .eq('college_id', input.college_id);
        
        if (updateError) {
          console.error('[useCreateAcademicYear] Update error:', updateError);
          throw updateError;
        }
        console.log('[useCreateAcademicYear] Reset complete');
      }
      
      console.log('[useCreateAcademicYear] Inserting new year...');
      const { data, error } = await supabase
        .from('academic_years')
        .insert({ ...input, is_current: input.is_current ?? false })
        .select()
        .single();
        
      if (error) {
        console.error('[useCreateAcademicYear] Insert error:', error);
        throw error;
      }
      console.log('[useCreateAcademicYear] Creation successful:', data);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['academic-years', variables.college_id] });
      queryClient.invalidateQueries({ queryKey: ['academic-years', null] });
    },
  });
}

export function useSetCurrentAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, college_id }: { id: string; college_id: string }) => {
      await supabase
        .from('academic_years')
        .update({ is_current: false })
        .eq('college_id', college_id);
      const { data, error } = await supabase
        .from('academic_years')
        .update({ is_current: true })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['academic-years', variables.college_id] });
      queryClient.invalidateQueries({ queryKey: ['academic-years', null] });
    },
  });
}

