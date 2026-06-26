import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { Profile, ParentStudentMap } from '@shared';
import { normalizePhone } from '@/lib/validators';

export function useParentsList(collegeId?: string | null) {
  return useQuery({
    queryKey: ['parents-list', collegeId],
    queryFn: async () => {
      let q = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'parent');
      
      if (collegeId) {
        q = q.eq('college_id', collegeId);
      }

      const { data, error } = await q.order('full_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

export interface ParentStudentMapRow extends ParentStudentMap {
  student?: { id: string; full_name: string; roll_number: string };
  parent?: { id: string; full_name: string; phone: string | null };
}

export function useParentStudentMappings(parentId?: string, collegeId?: string | null) {
  return useQuery({
    queryKey: ['parent-mappings', parentId ?? 'all', collegeId],
    queryFn: async () => {
      let q = supabase
        .from('parent_student_map')
        .select(
          '*, student:students!inner(id, full_name, roll_number, college_id), parent:profiles!parent_student_map_parent_id_fkey(id, full_name, phone)'
        );
      if (parentId) q = q.eq('parent_id', parentId);
      if (collegeId) {
        q = q.eq('student.college_id', collegeId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ParentStudentMapRow[];
    },
  });
}



export function useToggleMappingVerified() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_verified }: { id: string; is_verified: boolean }) => {
      const { data, error } = await supabase
        .from('parent_student_map')
        .update({ is_verified })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useUnlinkParentStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('parent_student_map').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

// Phone is now REQUIRED for parent accounts
export interface CreateParentVars {
  phone: string; // Required — used as primary login credential
  email?: string; // Optional — for forgot-password flow
  full_name: string;
  college_id: string;
  student_id?: string;
  relationship?: string;
}

const TEMP_PARENT_PASSWORD = 'Parent@123';

export function useCreateParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: CreateParentVars) => {
      const { phone, email, full_name, college_id, student_id, relationship } = vars;
      
      console.log('[CreateParent] Invoking manage-parent edge function for:', phone);

      const { data, error: functionError } = await supabase.functions.invoke('manage-parent', {
        body: {
          phone,
          full_name,
          college_id,
          email, // Optional recovery email
          student_id,
          relationship
        }
      });

      if (functionError) {
        console.error('[CreateParent] Edge Function Error:', functionError);
        throw functionError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: async (_data, variables) => {
      console.log('[CreateParent] Success, invalidating queries...');
      // Invalidate ALL relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['parents-list'] }),
        queryClient.invalidateQueries({ queryKey: ['parent-mappings'] }),
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['parents'] }),
      ]);
      // Force a refetch of the specific mappings to be extra sure
      queryClient.refetchQueries({ queryKey: ['parent-mappings'] });
      queryClient.refetchQueries({ queryKey: ['students'] });
    },
  });
}

export interface UpdateParentVars {
  parentId: string;
  full_name: string;
  email?: string;
  phone?: string;            // if provided, updates auth login phone too
  mappingId?: string;        // if updating relationship on a specific mapping
  relationship?: string;
}

export function useUpdateParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: UpdateParentVars) => {
      const { parentId, full_name, email, phone, mappingId, relationship } = vars;

      // Use the edge function which has service-role key to update auth.users
      const { data, error: fnError } = await supabase.functions.invoke('update-parent', {
        body: {
          parent_id: parentId,
          full_name: full_name.trim(),
          email: email ?? undefined,
          phone: phone?.trim() || undefined,
          mapping_id: mappingId,
          relationship,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents-list'] });
      queryClient.invalidateQueries({ queryKey: ['parent-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}


export function useLinkParentStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      parent_id: string;
      student_id: string;
      relationship?: string;
    }) => {
      const { data, error } = await supabase
        .from('parent_student_map')
        .upsert({
          parent_id: input.parent_id,
          student_id: input.student_id,
          relationship: input.relationship || 'guardian',
          is_verified: true,
          verified_at: new Date().toISOString(),
        }, { onConflict: 'parent_id,student_id' })
        .select();

      if (error) {
        console.error('[LinkParent] Error:', error);
        throw error;
      }
      if (!data || data.length === 0) throw new Error('Failed to link parent to student');
      return data[0];
    },
    onSuccess: async () => {
      console.log('[LinkParent] Success, invalidating queries...');
      // Immediately invalidate students + parent-mappings to fix the UI not updating bug
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['parent-mappings'] }),
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['parents'] }),
        queryClient.invalidateQueries({ queryKey: ['parents-list'] }),
      ]);
      // Force refetch
      queryClient.refetchQueries({ queryKey: ['parent-mappings'] });
      queryClient.refetchQueries({ queryKey: ['students'] });
    },
  });
}
