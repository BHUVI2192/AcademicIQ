import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import type { Profile, FacultyBatchAssignment } from '@shared';

export function useFacultyList(collegeId?: string | null) {
  return useQuery({
    queryKey: ['faculty-list', collegeId],
    queryFn: async () => {
      let query = supabase.from('profiles').select('*').eq('role', 'faculty');
      if (collegeId) {
        query = query.eq('college_id', collegeId);
      }
      const { data, error } = await query.order('full_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

export function useFacultyAssignments(facultyId: string | undefined) {
  return useQuery({
    queryKey: ['faculty-assignments', facultyId],
    queryFn: async () => {
      if (!facultyId) return [];
      const { data, error } = await supabase
        .from('faculty_batch_assignments')
        .select('*')
        .eq('faculty_id', facultyId);
      if (error) throw error;
      return (data ?? []) as FacultyBatchAssignment[];
    },
    enabled: !!facultyId,
  });
}

export function useAssignFacultyToBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { faculty_id: string; batch_id: string }) => {
      const { data, error } = await supabase
        .from('faculty_batch_assignments')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['faculty-assignments', variables.faculty_id] });
    },
  });
}

export function useRemoveFacultyFromBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { faculty_id: string; batch_id: string }) => {
      const { error } = await supabase
        .from('faculty_batch_assignments')
        .delete()
        .eq('faculty_id', input.faculty_id)
        .eq('batch_id', input.batch_id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['faculty-assignments', variables.faculty_id] });
    },
  });
}

export function useToggleFacultyActive(collegeId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['faculty-list', data.college_id] });
      queryClient.invalidateQueries({ queryKey: ['faculty-list', null] });
    },
  });
}

export function useCreateFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { 
      email: string; 
      full_name: string; 
      college_id: string;
      phone?: string;
    }) => {
      console.log('Invoking create-faculty with payload:', input);
      const { data, error } = await supabase.functions.invoke('create-faculty', {
        body: input,
      });

      if (error) {
        // Handle Supabase Function invocation error
        // If the error has a response, try to parse it
        console.error('Edge Function Error:', error);
        if (error.context) {
          try {
            const resp = await error.context.json();
            const errorMsg = resp.error || resp.message || error.message;
            toast.error(errorMsg);
            throw new Error(errorMsg);
          } catch (e) {
            // If JSON parsing fails, or any other error, fallback to default message
            if (e instanceof Error && e.message !== error.message) {
              throw e; // Re-throw the one we just created
            }
            toast.error(error.message);
            throw error;
          }
        }
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create faculty');
      }

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['faculty-list', variables.college_id] });
      queryClient.invalidateQueries({ queryKey: ['faculty-list', null] });
    },
  });
}

export function useDeleteFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (facultyId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-faculty', {
        body: { faculty_id: facultyId },
      });

      if (error) {
        if (error.context) {
          try {
            const resp = await error.context.json();
            const errorMsg = resp.error || resp.message || error.message;
            toast.error(errorMsg);
            throw new Error(errorMsg);
          } catch (e) {
            if (e instanceof Error && e.message !== error.message) {
              throw e;
            }
            toast.error(error.message);
            throw error;
          }
        }
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to delete faculty');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-list'] });
    },
  });
}
