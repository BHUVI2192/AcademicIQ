import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import type { College } from '@shared';

export function CollegesPage() {
  const { collegeId, role } = useAuth();
  const queryClient = useQueryClient();
  const isGlobalAdmin = role === 'admin' && !collegeId;

  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');

  const { data: colleges, isLoading } = useQuery({
    queryKey: ['colleges'],
    queryFn: async () => {
      console.log('[CollegesPage] Fetching colleges. isGlobalAdmin:', isGlobalAdmin, 'collegeId:', collegeId);
      let query = supabase.from('colleges').select('*');
      if (!isGlobalAdmin) {
        query = query.eq('id', collegeId);
      }
      const { data, error } = await query;
      if (error) throw error;
      console.log('[CollegesPage] Fetched colleges count:', data?.length);
      return data as College[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<College> & { id: string }) => {
      const { error } = await supabase.from('colleges').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('College updated');
      queryClient.invalidateQueries({ queryKey: ['colleges'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Update failed'),
  });

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-normal text-slate-900 dark:text-slate-100">
            {isGlobalAdmin ? 'College Directory' : 'College Profile'}
          </h1>
          <p className="text-sm text-slate-500">
            {isGlobalAdmin ? 'Manage all institutions on the platform' : 'Manage your institution details'}
          </p>
        </div>
        {/* Institution scoping locked */}
      </div>


      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {colleges?.map((college) => (
          <div key={college.id} className="card">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-md bg-slate-100 p-2 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="overflow-hidden">
                <h2 className="truncate font-normal text-slate-900 dark:text-slate-100">
                  {college.name}
                </h2>
                <p className="text-xs text-slate-500">Code: {college.code}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-normal uppercase tracking-wider text-slate-400">
                  Institution Name
                </label>
                <div className="mt-1 text-sm font-normal text-slate-900 dark:text-slate-100">
                  {college.name}
                </div>
              </div>
            </div>
          </div>
        ))}
        {colleges?.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-2 text-sm font-normal text-slate-900 dark:text-slate-100">No institutions found</h3>
            <p className="mt-1 text-sm text-slate-500">Please contact system administrator to initialize.</p>
          </div>
        )}
      </div>
    </div>
  );
}

