import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Student } from '@shared';
import { supabase } from '@lib/supabaseClient';

interface CreateStudentInput {
  college_id: string;
  batch_id: string;
  roll_number: string;
  full_name: string;
  date_of_birth?: string | null;
  exam_wing?: 'NEET' | 'KCET' | null;
}

interface UpdateStudentInput {
  id: string;
  full_name?: string;
  date_of_birth?: string | null;
  is_active?: boolean;
  batch_id?: string;
  exam_wing?: 'NEET' | 'KCET' | null;
}

export function useStudents(filters?: { batchId?: string; search?: string; collegeId?: string; includeInactive?: boolean }, options?: { enabled?: boolean }) {
  return useQuery({
    enabled: options?.enabled,
    queryKey: ['students', filters?.batchId ?? 'all', filters?.search ?? '', filters?.collegeId ?? 'all', filters?.includeInactive ?? false],
    queryFn: async (): Promise<Student[]> => {
      let q = supabase
        .from('students')
        .select(`
          *, 
          batch:batches(id, name, class_level, stream),
          parent_student_map(id, is_verified, parent:profiles(id, full_name))
        `)
        .order('roll_number', { ascending: true });

      if (filters?.collegeId) q = q.eq('college_id', filters.collegeId);
      if (filters?.batchId && filters.batchId !== 'none') q = q.eq('batch_id', filters.batchId);
      if (!filters?.includeInactive) {
        q = q.eq('is_active', true);
      }
      if (filters?.search && filters.search.trim()) {
        const s = filters.search.trim();
        q = q.or(`roll_number.ilike.%${s}%,full_name.ilike.%${s}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Student[];
    },
  });
}

export function useStudent(id: string | undefined) {
  return useQuery({
    queryKey: ['student', id],
    enabled: !!id,
    queryFn: async (): Promise<Student | null> => {
      if (!id) return null;
      const { data, error } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as Student | null;
    },
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateStudentInput): Promise<Student> => {
      const { data, error } = await supabase
        .from('students')
        .insert({
          college_id: input.college_id,
          batch_id: input.batch_id,
          roll_number: input.roll_number.trim().toUpperCase(),
          full_name: input.full_name.trim(),
          date_of_birth: input.date_of_birth ?? null,
          exam_wing: input.exam_wing ?? null,
          is_active: true,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as Student;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateStudentInput): Promise<Student> => {
      const { id, ...rest } = input;
      const { data, error } = await supabase
        .from('students')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as Student;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useStudentsInBatch(batchId: string) {
  return useStudents({ batchId }, { enabled: !!batchId && batchId !== 'none' });
}

