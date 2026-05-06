import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, TrendingUp, Calendar, ArrowRight, Download, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVerifiedChildren, useChildRankings } from '@/hooks/useChildResults';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { formatDate } from '@/lib/utils';

export function ReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: children, isLoading: lsChildren } = useVerifiedChildren(user?.id);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => sessionStorage.getItem('aiq.selectedChildId')
  );

  useEffect(() => {
    if (lsChildren) return;
    if (!children || children.length === 0) {
      navigate('/parent/pending', { replace: true });
      return;
    }
    if (!selectedId || !children.find((c) => c.student_id === selectedId)) {
      if (children.length === 1) {
        sessionStorage.setItem('aiq.selectedChildId', children[0].student_id);
        setSelectedId(children[0].student_id);
      } else {
        navigate('/parent/select-child', { replace: true });
      }
    }
  }, [children, lsChildren, selectedId, navigate]);

  const child = children?.find((c) => c.student_id === selectedId) ?? null;
  const { data: rankings, isLoading: lsRanks } = useChildRankings(child?.student_id);

  if (lsChildren || (selectedId && lsRanks)) return (
    <div className="space-y-10 p-8">
      <CardSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );

  if (!child) return null;

  const weeklyTests = rankings?.filter(r => {
    const testDate = new Date(r.test?.test_date || '');
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return testDate >= weekAgo;
  }) || [];

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10">
          <FileText className="h-3 w-3 text-slate-900 dark:text-white" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">
            Document Repository
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="text-5xl font-light tracking-tight text-slate-900 dark:text-white">Academic Reports</h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl text-lg font-light">
            Comprehensive performance analysis and term-wise progress reports for <span className="text-slate-900 dark:text-white font-medium underline decoration-slate-200 underline-offset-4">{child.full_name}</span>.
          </p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Term End Report */}
        <div className="card group p-8 flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none border-none">
          <div className="space-y-6">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-md flex items-center justify-center transition-transform group-hover:scale-110">
              <ClipboardList className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-medium text-slate-900 dark:text-slate-100">Term Summary</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-light">Full breakdown of semester performance and aggregated results.</p>
            </div>
          </div>
          <button 
            disabled={!rankings?.length}
            className="group mt-8 flex items-center justify-between w-full p-4 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
          >
            <span className="text-[10px] font-black uppercase tracking-widest">Generate Report</span>
            <Download className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
          </button>
        </div>

        {/* Progress Analysis */}
        <div className="card group p-8 flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none border-none">
          <div className="space-y-6">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-md flex items-center justify-center transition-transform group-hover:scale-110">
              <TrendingUp className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-medium text-slate-900 dark:text-slate-100">Progress Analysis</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-light">Longitudinal trend analysis of subject-wise accuracy and growth.</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/parent/progress')}
            className="group mt-8 flex items-center justify-between w-full p-4 rounded-md border border-slate-200 dark:border-slate-800 hover:border-slate-900 dark:hover:border-white transition-all active:scale-[0.98]"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white">View Trajectory</span>
            <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-slate-900 dark:group-hover:text-white" />
          </button>
        </div>

        {/* Weekly Summary */}
        <div className="card group p-8 flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none border-none">
          <div className="space-y-6">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 rounded-md flex items-center justify-center transition-transform group-hover:scale-110">
              <Calendar className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-medium text-slate-900 dark:text-slate-100">Weekly Performance</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-light">Snapshot of academic activity and performance in the last 7 days.</p>
            </div>
          </div>
          <div className="mt-8 p-4 rounded-md bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
             <div className="flex justify-between items-end">
                <div>
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Tests</div>
                   <div className="text-2xl font-light text-slate-900 dark:text-white">{weeklyTests.length}</div>
                </div>
                <div className="text-right">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg. Score</div>
                   <div className="text-2xl font-light text-slate-900 dark:text-white">
                      {weeklyTests.length > 0 
                        ? (weeklyTests.reduce((acc, curr) => acc + Number(curr.percentage), 0) / weeklyTests.length).toFixed(1)
                        : '—'}%
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="card border-none shadow-none bg-slate-50/50 dark:bg-slate-900/20 p-20 text-center">
         <div className="max-w-md mx-auto space-y-6">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-md shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center mx-auto transition-transform hover:rotate-6">
               <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-light tracking-tight text-slate-900 dark:text-slate-100">Analytical Archive</h2>
              <p className="text-slate-500 dark:text-slate-400 font-light leading-relaxed">
                As assessments are published, detailed PDF reports and granular performance archives will manifest here for your records.
              </p>
            </div>
         </div>
      </div>
    </div>
  );
}
