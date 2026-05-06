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

  const [isAdding, setIsAdding] = useState(false);
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

  const create = useMutation({
    mutationFn: async (payload: { name: string; code: string }) => {
      const { error } = await supabase.from('colleges').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('College created');
      setIsAdding(false);
      setNewName('');
      setNewCode('');
      queryClient.invalidateQueries({ queryKey: ['colleges'] });
    },
    onError: (e: any) => {
      if (e.message?.includes('colleges_code_key')) {
        toast.error('This College Code is already in use. Please choose a different unique code.');
      } else {
        toast.error(e.message ?? 'Creation failed');
      }
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
          <h1 className="text-2xl font-medium text-slate-900 dark:text-slate-100">
            {isGlobalAdmin ? 'College Directory' : 'College Profile'}
          </h1>
          <p className="text-sm text-slate-500">
            {isGlobalAdmin ? 'Manage all institutions on the platform' : 'Manage your institution details'}
          </p>
        </div>
        {isGlobalAdmin && (
          <button onClick={() => setIsAdding(!isAdding)} className="btn btn-primary">
            {isAdding ? 'Cancel' : 'Add College'}
          </button>
        )}
      </div>

      {isAdding && (
        <div className="card max-w-xl animate-in fade-in slide-in-from-top-4">
          <h2 className="mb-4 font-medium">Add New College</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({ name: newName, code: newCode });
            }}
            className="space-y-4"
          >
            <div>
              <label className="label">College Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input"
                placeholder="e.g. Stanford University"
                required
              />
            </div>
            <div>
              <label className="label">College Code (Unique)</label>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                className={`input ${colleges?.some(c => c.code === newCode) ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder="e.g. STANFORD"
                required
              />
              {colleges?.some(c => c.code === newCode) && (
                <p className="mt-1 text-xs text-red-500 font-medium">This code is already taken.</p>
              )}
            </div>
            <button 
              type="submit" 
              disabled={create.isPending || colleges?.some(c => c.code === newCode)} 
              className="btn btn-primary w-full"
            >
              {create.isPending ? 'Creating...' : 'Create College'}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {colleges?.map((college) => (
          <div key={college.id} className="card">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-md bg-slate-100 p-2 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="overflow-hidden">
                <h2 className="truncate font-medium text-slate-900 dark:text-slate-100">
                  {college.name}
                </h2>
                <p className="text-xs text-slate-500">Code: {college.code}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Edit Name
                </label>
                <input
                  defaultValue={college.name}
                  onBlur={(e) => {
                    if (e.target.value !== college.name) {
                      update.mutate({ id: college.id, name: e.target.value });
                    }
                  }}
                  className="input mt-1 h-8 text-sm"
                />
              </div>
            </div>
          </div>
        ))}
        {colleges?.length === 0 && !isAdding && (
          <div className="col-span-full py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">No colleges</h3>
            <p className="mt-1 text-sm text-slate-500">Get started by creating your first college.</p>
          </div>
        )}
      </div>
    </div>
  );
}

