import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { AuditLogEntry } from '@shared';

export interface AuditFilters {
  action?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
  collegeId?: string | null;
}

export function useAuditLog(filters: AuditFilters = {}) {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 50;
  return useQuery({
    queryKey: ['audit-log', filters],
    queryFn: async () => {
      let q = supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });
      if (filters.action) q = q.eq('action', filters.action);
      if (filters.fromDate) q = q.gte('created_at', filters.fromDate);
      if (filters.toDate) q = q.lte('created_at', filters.toDate);
      if (filters.collegeId) q = q.eq('college_id', filters.collegeId);
      
      q = q.range(page * pageSize, page * pageSize + pageSize - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return {
        rows: (data ?? []) as AuditLogEntry[],
        total: count ?? 0,
        page,
        pageSize,
      };
    },
  });
}

