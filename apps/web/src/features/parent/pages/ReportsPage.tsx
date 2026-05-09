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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[hsl(var(--primary)/0.05)] border border-[hsl(var(--primary)/0.1)]">
          <FileText className="h-3 w-3 text-[hsl(var(--primary))]" />
          <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-[hsl(var(--primary))]">
            Document Repository
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="text-5xl font-light tracking-tight text-slate-900 dark:text-white">Academic Reports</h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl text-lg font-light">
            Comprehensive performance analysis and term-wise progress reports for <span className="text-slate-900 dark:text-white font-normal underline decoration-slate-200 underline-offset-4">{child.full_name}</span>.
          </p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Term End Report */}
        <div className="glass-card group p-8 flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-2xl border-none">
          <div className="space-y-6">
            <div className="w-14 h-14 bg-[hsl(var(--primary)/0.05)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.1)] rounded-md flex items-center justify-center transition-transform group-hover:scale-110">
              <ClipboardList className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-normal text-[hsl(var(--text-main))]">Term Summary</h3>
              <p className="text-sm text-[hsl(var(--text-muted))] leading-relaxed font-light">Full breakdown of semester performance and aggregated results.</p>
            </div>
          </div>
          <button 
            disabled={!rankings?.length}
            className="group mt-8 flex items-center justify-between w-full p-4 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <span className="text-[10px] font-normal uppercase tracking-widest">Generate Report</span>
            <Download className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
          </button>
        </div>

        {/* Progress Analysis */}
        <div className="glass-card group p-8 flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-2xl border-none">
          <div className="space-y-6">
            <div className="w-14 h-14 bg-[hsl(var(--accent)/0.05)] text-[hsl(var(--accent))] border border-[hsl(var(--accent)/0.1)] rounded-md flex items-center justify-center transition-transform group-hover:scale-110">
              <TrendingUp className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-normal text-[hsl(var(--text-main))]">Progress Analysis</h3>
              <p className="text-sm text-[hsl(var(--text-muted))] leading-relaxed font-light">Longitudinal trend analysis of subject-wise accuracy and growth.</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/parent/progress')}
            className="group mt-8 flex items-center justify-between w-full p-4 rounded-md border border-[hsl(var(--card-border))] hover:border-[hsl(var(--primary))] transition-all active:scale-[0.98]"
          >
            <span className="text-[10px] font-normal uppercase tracking-widest text-[hsl(var(--text-muted))] group-hover:text-[hsl(var(--text-main))]">View Trajectory</span>
            <ArrowRight className="h-4 w-4 text-[hsl(var(--text-muted))] transition-transform group-hover:translate-x-1 group-hover:text-[hsl(var(--text-main))]" />
          </button>
        </div>

        {/* Weekly Summary */}
        <div className="glass-card group p-8 flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-2xl border-none">
          <div className="space-y-6">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md flex items-center justify-center transition-transform group-hover:scale-110">
              <Calendar className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-normal text-[hsl(var(--text-main))]">Weekly Performance</h3>
              <p className="text-sm text-[hsl(var(--text-muted))] leading-relaxed font-light">Snapshot of academic activity and performance in the last 7 days.</p>
            </div>
          </div>
          <div className="mt-8 p-4 rounded-md bg-[hsl(var(--bg-main)/0.3)] border border-[hsl(var(--card-border)/0.2)]">
             <div className="flex justify-between items-end">
                <div>
                   <div className="text-[10px] font-normal text-[hsl(var(--text-muted))] uppercase tracking-widest">Active Tests</div>
                   <div className="text-2xl font-light text-[hsl(var(--text-main))]">{weeklyTests.length}</div>
                </div>
                <div className="text-right">
                   <div className="text-[10px] font-normal text-[hsl(var(--text-muted))] uppercase tracking-widest">Avg. Score</div>
                   <div className="text-2xl font-light text-[hsl(var(--text-main))]">
                      {weeklyTests.length > 0 
                        ? (weeklyTests.reduce((acc, curr) => acc + Number(curr.percentage), 0) / weeklyTests.length).toFixed(1)
                        : '—'}%
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="glass-card border-none shadow-none bg-transparent p-20 text-center">
         <div className="max-w-md mx-auto space-y-6">
            <div className="w-20 h-20 bg-[hsl(var(--card-bg))] rounded-md shadow-sm border border-[hsl(var(--card-border)/0.5)] flex items-center justify-center mx-auto transition-transform hover:rotate-6">
               <FileText className="h-10 w-10 text-[hsl(var(--text-muted)/0.3)]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-light tracking-tight text-[hsl(var(--text-main))]">Analytical Archive</h2>
              <p className="text-[hsl(var(--text-muted))] font-light leading-relaxed">
                As assessments are published, detailed PDF reports and granular performance archives will manifest here for your records.
              </p>
            </div>
         </div>
      </div>
    </div>
  );
}
