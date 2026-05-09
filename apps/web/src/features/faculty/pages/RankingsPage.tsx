import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Download, Send, RefreshCw, Star, Award, Target, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTest } from '@/hooks/useTests';
import { useBatch } from '@/hooks/useBatches';
import { useRankings } from '@/hooks/useRankings';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { downloadCsv } from '@/lib/csvParser';
import { supabase } from '@/lib/supabaseClient';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

export function RankingsPage() {
  const { id: testId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: test, isLoading: lsTest } = useTest(testId);
  const { data: batch } = useBatch(test?.batch_id);
  const { data: rankings, isLoading: lsRanks } = useRankings(testId);
  const [notifying, setNotifying] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const queryClient = useQueryClient();

  const handleExport = () => {
    if (!rankings || rankings.length === 0) return;
    const rows = rankings.map((r) => ({
      rank: r.rank,
      roll_number: r.student?.roll_number ?? '',
      name: r.student?.full_name ?? '',
      total_marks: r.total_marks,
      max_marks: r.max_marks,
      percentage: Number(r.percentage).toFixed(2),
    }));
    downloadCsv(`rankings-${test?.title ?? testId}.csv`, rows);
  };

  const handleNotify = async () => {
    if (!testId) return;
    setNotifying(true);
    try {
      const { error } = await supabase.functions.invoke('send-notification', {
        body: { test_id: testId },
      });
      if (error) throw error;
      toast.success('Parents notified');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send notifications');
    } finally {
      setNotifying(false);
    }
  };

  const handleRecalculate = async () => {
    if (!testId) return;
    setRecalculating(true);
    try {
      const { data, error } = await supabase.rpc('recalculate_rankings', { p_test_id: testId });
      if (error) throw error;
      toast.success(`Rankings recalculated — ${data} students ranked`);
      queryClient.invalidateQueries({ queryKey: ['rankings', testId] });
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to recalculate');
    } finally {
      setRecalculating(false);
    }
  };

  if (lsTest) return (
    <div className="p-12 space-y-8">
      <TableSkeleton rows={10} cols={5} />
    </div>
  );
  if (!test) return <div className="p-20 text-center text-slate-500 font-light">Assessment not found in institutional records.</div>;

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-fade-in pb-12">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-6">
          <Link 
            to={user?.role === 'admin' ? '/admin/tests' : '/faculty/tests'} 
            className="group inline-flex items-center gap-2 text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
            Assessments Archive
          </Link>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10">
              <Trophy className="h-3 w-3 text-slate-900 dark:text-white" />
              <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-900 dark:text-white">
                Competitive Rankings
              </span>
            </div>
            <div className="space-y-1">
              <h1 className="text-5xl font-light tracking-tight text-slate-900 dark:text-white leading-tight">
                {test.title}
              </h1>
              <p className="max-w-xl text-lg text-slate-500 font-light leading-relaxed">
                Metric distribution for cohort <span className="text-slate-900 dark:text-white font-normal">{batch?.name || "unassigned"}</span>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRecalculate}
            disabled={recalculating || !test?.is_locked}
            className="btn btn-secondary px-6 shadow-sm flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
            <span className="text-xs">Recalculate Indices</span>
          </button>
          <button
            onClick={handleExport}
            disabled={!rankings || rankings.length === 0}
            className="btn btn-secondary px-6 shadow-sm flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="text-xs">Export CSV</span>
          </button>
          {test.is_published && (
            <button
              onClick={handleNotify}
              disabled={notifying}
              className="btn btn-primary px-8 shadow-xl shadow-slate-900/10 flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              <span className="text-xs uppercase tracking-widest font-normal">Notify Guardians</span>
            </button>
          )}
        </div>
      </div>

      {/* Rankings Table */}
      <div className="card overflow-hidden">
        {lsRanks ? (
          <div className="p-12"><TableSkeleton rows={10} cols={5} /></div>
        ) : !rankings || rankings.length === 0 ? (
          <div className="p-20">
            <EmptyState
              icon={Trophy}
              title="No competitive data"
              description="Finalize and lock the assessment marks to generate performance indices."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-left">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Competitive Rank</span>
                  </th>
                  <th className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-left">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Student Identity</span>
                  </th>
                  <th className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-right">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Raw Score</span>
                  </th>
                  <th className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-right">
                    <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Performance Index</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-900/50">
                {rankings.map((r) => (
                  <tr key={r.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        {r.rank === 1 ? (
                          <div className="w-8 h-8 rounded-md bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-500 shadow-sm border border-amber-200 dark:border-amber-900/30">
                            <Star className="h-4 w-4 fill-current" />
                          </div>
                        ) : r.rank === 2 ? (
                          <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700">
                            <Award className="h-4 w-4" />
                          </div>
                        ) : r.rank === 3 ? (
                          <div className="w-8 h-8 rounded-md bg-orange-50 dark:bg-orange-900/10 flex items-center justify-center text-orange-600 dark:text-orange-500 shadow-sm border border-orange-100 dark:border-orange-900/20">
                            <Award className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 flex items-center justify-center">
                            <span className="text-xs font-normal text-slate-300">#{r.rank}</span>
                          </div>
                        )}
                        <span className={`text-sm font-normal tracking-tight ${r.rank <= 3 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                          {r.rank === 1 ? 'Elite I' : r.rank === 2 ? 'Elite II' : r.rank === 3 ? 'Elite III' : `Rank ${r.rank}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-normal text-slate-900 dark:text-white">{r.student?.full_name ?? 'Anonymous Student'}</span>
                        <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mt-0.5">Roll: {r.student?.roll_number ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="inline-flex items-center gap-2">
                         <span className="text-xs font-normal tabular-nums text-slate-900 dark:text-white">
                           {Number(r.total_marks).toFixed(2)}
                         </span>
                         <span className="text-[10px] font-normal text-slate-300 uppercase tracking-widest">/ {Number(r.max_marks).toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                        <Target className="h-3 w-3" />
                        <span className="text-xs font-normal tabular-nums">{Number(r.percentage).toFixed(2)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
