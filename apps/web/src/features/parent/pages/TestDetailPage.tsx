import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, BookOpen, CheckCircle2, XCircle, Target, Award, Calendar, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVerifiedChildren, useChildTestDetail, useChildMarks } from '@/hooks/useChildResults';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { formatDate } from '@/lib/utils';

export function TestDetailPage() {
  const { testId } = useParams<{ testId: string }>();
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
  const { data, isLoading } = useChildTestDetail(testId, child?.student_id);
  const { data: marks, isLoading: lsMarks } = useChildMarks(testId, child?.student_id);

  if (lsChildren || (selectedId && isLoading)) return (
    <div className="space-y-8 p-12">
      <div className="h-6 w-32 bg-slate-100 dark:bg-white/5 animate-pulse rounded-md" />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );

  if (!child || !data) {
    return (
      <div className="py-20">
        <EmptyState
          icon={BookOpen}
          title="Assessment Unavailable"
          description="This assessment record has not yet been published or is restricted."
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="group flex items-center gap-2 text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Return to Dashboard
        </button>
        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10">
          <Calendar className="h-3 w-3 text-slate-400" />
          <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">
            Published {formatDate(data.test.test_date)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-12">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2">
                <Badge variant="default" className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-none font-normal text-[10px] uppercase tracking-widest px-3 py-1">
                  {data.test.exam_category}
                </Badge>
                {data.test.is_locked && (
                  <Badge variant="info" className="font-normal text-[10px] uppercase tracking-widest px-3 py-1">
                    Verified Result
                  </Badge>
                )}
              </div>
              <h1 className="text-5xl font-light tracking-tight text-slate-900 dark:text-white leading-tight">
                {data.test.title}
              </h1>
              {data.test.description && (
                <p className="text-lg text-slate-500 font-light leading-relaxed max-w-2xl">
                  {data.test.description}
                </p>
              )}
            </div>
          </div>

          <div className="card border-none shadow-none bg-slate-50/50 dark:bg-slate-900/20 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900/40">
               <h3 className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Subject Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                    <th className="px-8 py-4 text-left text-[10px] font-normal uppercase tracking-widest text-slate-400">Subject</th>
                    <th className="px-8 py-4 text-right text-[10px] font-normal uppercase tracking-widest text-slate-400">Marks</th>
                    <th className="px-8 py-4 text-right text-[10px] font-normal uppercase tracking-widest text-slate-400">Max</th>
                    <th className="px-8 py-4 text-right text-[10px] font-normal uppercase tracking-widest text-slate-400">Yield</th>
                    <th className="px-8 py-4 text-right text-[10px] font-normal uppercase tracking-widest text-slate-400">Subject Rank</th>
                    <th className="px-8 py-4 text-right text-[10px] font-normal uppercase tracking-widest text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {marks?.map((m) => {
                    const pct = !m.is_absent && m.marks_obtained != null && m.max_marks > 0
                      ? ((m.marks_obtained / m.max_marks) * 100).toFixed(1)
                      : null;
                    const subRankObj = data.subjectRankings?.find((sr) => sr.subject_id === m.subject_id);
                    const subRank = subRankObj ? subRankObj.rank : null;
                    const totalStudents = subRankObj ? subRankObj.total_students : null;

                    return (
                      <tr key={m.id} className="group hover:bg-white dark:hover:bg-slate-900 transition-colors">
                        <td className="px-8 py-6">
                           <span className="text-sm font-normal text-slate-900 dark:text-white">{m.subject_name}</span>
                        </td>
                        <td className="px-8 py-6 text-right tabular-nums">
                          <span className="text-sm font-light text-slate-600 dark:text-slate-400">
                             {m.is_absent ? '—' : (m.marks_obtained ?? '—')}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right tabular-nums">
                          <span className="text-sm font-light text-slate-400">/ {m.max_marks}</span>
                        </td>
                        <td className="px-8 py-6 text-right">
                           {pct != null ? (
                             <span className="text-sm font-normal text-slate-900 dark:text-white">{pct}%</span>
                           ) : (
                             <span className="text-sm text-slate-300">—</span>
                           )}
                        </td>
                        <td className="px-8 py-6 text-right">
                          {subRank != null ? (
                            <span className="text-sm font-normal text-slate-900 dark:text-white">
                              #{subRank} <span className="text-xs text-slate-400">/ {totalStudents}</span>
                            </span>
                          ) : (
                            <span className="text-sm text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-8 py-6 text-right">
                          {m.is_absent ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-normal uppercase tracking-widest border border-amber-100 dark:border-amber-900/30">
                              <XCircle className="h-3 w-3" /> Absent
                            </div>
                          ) : m.marks_obtained != null ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-normal uppercase tracking-widest border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" /> Submitted
                            </div>
                          ) : (
                            <span className="text-[10px] font-normal text-slate-300 uppercase tracking-widest">Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           {data.ranking && (
             <div className="card p-8 border-none bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl shadow-slate-900/20 dark:shadow-none">
                <div className="flex items-center justify-between mb-10">
                   <div className="text-[10px] font-normal uppercase tracking-[0.2em] opacity-60">Global Index</div>
                   <Trophy className="h-5 w-5 opacity-40" />
                </div>
                
                <div className="space-y-1">
                   <div className="text-6xl font-light tracking-tighter">#{data.ranking.rank}</div>
                   <div className="text-xs font-normal uppercase tracking-widest opacity-60">
                      Out of {data.ranking.total_students} participants
                   </div>
                </div>

                <div className="mt-12 pt-8 border-t border-white/10 dark:border-slate-900/10 space-y-8">
                   <div className="flex justify-between items-end">
                      <div>
                         <div className="text-[10px] font-normal uppercase tracking-widest opacity-60 mb-2">Yield Score</div>
                         <div className="text-3xl font-light tracking-tight">{Number(data.ranking.percentage).toFixed(2)}%</div>
                      </div>
                      <div className="text-right">
                         <div className="text-[10px] font-normal uppercase tracking-widest opacity-60 mb-2">Total Points</div>
                         <div className="text-3xl font-light tracking-tight">
                            {Number(data.ranking.total_marks).toFixed(0)}
                            <span className="text-base opacity-40 ml-1">/ {Number(data.ranking.max_marks).toFixed(0)}</span>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/10 dark:border-slate-900/10 text-center">
                   <Link 
                     to={`/parent/tests/${testId}/rankings`}
                     className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white dark:text-slate-900 hover:opacity-80 transition-opacity"
                   >
                     View Class Leaderboard <ArrowRight className="h-3 w-3 animate-pulse" />
                   </Link>
                </div>
             </div>
           )}

           <div className="card p-8 space-y-6">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-md bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                    <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                 </div>
                 <h3 className="text-sm font-normal text-slate-900 dark:text-white">Analysis Context</h3>
              </div>
              <p className="text-sm text-slate-500 font-light leading-relaxed">
                 This assessment evaluates fundamental concepts in {data.test.exam_category}. 
                 The ranking is relative to the entire cohort registered for this examination module.
              </p>
              <div className="pt-4">
                 <Link 
                   to="/parent/progress" 
                   className="group flex items-center justify-between w-full p-4 rounded-md border border-slate-200 dark:border-slate-800 hover:border-slate-900 dark:hover:border-white transition-all text-[10px] font-normal uppercase tracking-widest"
                 >
                    View Growth Trajectory
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                 </Link>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
