import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { College } from '@shared';

export function useColleges() {
  return useQuery({
    queryKey: ['colleges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('colleges')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as College[];
    },
  });
}

export function useCollege(id: string | null) {
  return useQuery({
    queryKey: ['colleges', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('colleges')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as College;
    },
    enabled: !!id,
  });
}
