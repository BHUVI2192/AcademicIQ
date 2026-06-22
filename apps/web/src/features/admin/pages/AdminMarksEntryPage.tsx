import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ClipboardList, Search, Plus, AlertCircle, CheckCircle2, 
  Eye, Edit2, Save, X, Users, BookOpen, Clock, Target
} from 'lucide-react';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Modal } from '@/components/Modal';
import { formatDate } from '@/lib/utils';
import { EXAM_CATEGORY_LABELS } from '@shared';
import type { ExamCategory } from '@shared';
import { useDirectory } from '@/context/DirectoryContext';

interface PendingTest {
  id: string;
  title: string;
  test_date: string;
  exam_category: ExamCategory;
  batch_id: string;
  batch: { name: string };
  subjects_count: number;
}

function usePendingMarksTests(collegeId?: string | null) {
  return useQuery({
    queryKey: ['pending-marks-tests', collegeId],
    queryFn: async () => {
      let q = supabase
        .from('tests')
        .select(`
          id, title, test_date, exam_category, batch_id,
          batch:batches(id, name)
        `)
        .not('is_published', 'eq', true)
        .order('test_date', { ascending: false });

      if (collegeId) {
        q = q.eq('college_id', collegeId);
      }

      const { data, error } = await q;
      if (error) throw error;
      
      return (data ?? []).map((t: any) => ({
        ...t,
        subjects_count: 0, // Will be populated separately if needed
      })) as PendingTest[];
    },
  });
}

export function AdminMarksEntryPage() {
  const { user } = useAuth();
  const { selectedCollegeId } = useDirectory();
  const { data: tests, isLoading } = usePendingMarksTests(selectedCollegeId);
  const [search, setSearch] = useState('');
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [editingMarks, setEditingMarks] = useState<Record<string, number>>({});

  const filtered = (tests ?? []).filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.batch.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 animate-fade-in">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            to="/admin/dashboard"
            className="group inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
          >
            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 group-hover:scale-110 transition-transform">
              <ArrowLeft className="h-3 w-3" />
            </div>
            Admin Dashboard
          </Link>
        </div>

        <div className="space-y-1">
          <h1 className="text-4xl font-light tracking-tight text-slate-900 dark:text-white">
            Marks Entry & Review
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enter, review, and manage marks for all tests
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex-1 min-w-[300px] relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by test title or batch name…"
          className="input-premium w-full pl-14 pr-6 py-4"
        />
      </div>

      {/* Tests Table */}
      <Card className="overflow-hidden border-none shadow-sm">
        {isLoading ? (
          <div className="p-12">
            <TableSkeleton rows={8} cols={5} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-20">
            <EmptyState
              icon={ClipboardList}
              title="No pending tests"
              description="All tests have been marked and submitted. Create a new test to begin marks entry."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky top-0 bg-white dark:bg-slate-950/80 px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-left">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Test Name</span>
                  </th>
                  <th className="sticky top-0 bg-white dark:bg-slate-950/80 px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-left">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Exam Type</span>
                  </th>
                  <th className="sticky top-0 bg-white dark:bg-slate-950/80 px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-left">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Batch</span>
                  </th>
                  <th className="sticky top-0 bg-white dark:bg-slate-950/80 px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Test Date</span>
                  </th>
                  <th className="sticky top-0 bg-white dark:bg-slate-950/80 px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-right">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-900/50">
                {filtered.map((test) => (
                  <tr key={test.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{test.title}</span>
                        <span className="text-[9px] font-normal text-slate-400 uppercase tracking-widest mt-0.5">
                          ID: {test.id.split('-')[0]}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none">
                        {EXAM_CATEGORY_LABELS[test.exam_category] || test.exam_category}
                      </Badge>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {test.batch?.name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        {formatDate(test.test_date)}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <Link
                          to={`/admin/tests/${test.id}/marks`}
                          className="px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-all"
                        >
                          <Eye className="h-4 w-4 inline mr-2" />
                          Enter Marks
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Info Card */}
      <Card className="p-6 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800">
        <div className="flex gap-4">
          <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Marks Entry Workflow</h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              1) Select a test to enter marks • 2) Faculty or Admin enters marks per subject •
              3) Marks automatically move to "submitted" status • 4) Admin reviews and approves •
              5) Once approved, publish to parents
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
