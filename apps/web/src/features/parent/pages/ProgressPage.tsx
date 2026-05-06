import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp, Activity, Award, Target, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVerifiedChildren, useChildRankings } from '@/hooks/useChildResults';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { formatDate } from '@/lib/utils';

export function ProgressPage() {
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
  const { data: rankings, isLoading } = useChildRankings(child?.student_id);

  const chartData = useMemo(() => {
    if (!rankings) return [];
    return rankings
      .slice()
      .reverse()
      .map((r) => ({
        date: r.test?.test_date ? formatDate(r.test.test_date) : '',
        title: r.test?.title ?? 'Test',
        percentage: Number(r.percentage),
        rank: r.rank,
      }));
  }, [rankings]);

  if (lsChildren || (selectedId && isLoading)) return (
    <div className="space-y-12 p-8">
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );

  if (!child) return null;

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-fade-in pb-12">
      {/* Editorial Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10">
          <Activity className="h-3 w-3 text-slate-900 dark:text-white" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">
            Performance Analytics
          </span>
        </div>
        <div className="space-y-1">
          <h1 className="text-5xl font-light tracking-tight text-slate-900 dark:text-white leading-tight">
            Academic Trajectory
          </h1>
          <p className="max-w-xl text-lg text-slate-500 font-light leading-relaxed">
            A longitudinal visualization of {child?.full_name || "your child"}'s progress across the academic year.
          </p>
        </div>
      </div>

      {!rankings || rankings.length === 0 ? (
        <div className="p-20 card">
          <EmptyState
            icon={TrendingUp}
            title="Awaiting Data points"
            description="The performance trajectory will manifest as your child completes and records assessments."
          />
        </div>
      ) : (
        <div className="grid gap-10">
          {/* Main Chart Card */}
          <div className="card p-10 space-y-10">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-xl font-medium text-slate-900 dark:text-white">Percentage Trend</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Relative accuracy over time</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-md bg-indigo-600" />
                  <span className="text-[10px] font-medium uppercase tracking-widest text-slate-600 dark:text-slate-400 text-right">Score %</span>
                </div>
              </div>
            </div>

            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.1)" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                    dy={15}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: '16px',
                      border: 'none',
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                      padding: '12px 16px',
                    }}
                    itemStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    labelStyle={{ fontSize: '13px', fontWeight: 500, color: '#1e293b', marginBottom: '4px' }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Accuracy']}
                  />
                  <Area
                    type="monotone"
                    dataKey="percentage"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorPct)"
                    dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Historical Log */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 ml-1">
              <Calendar className="h-4 w-4 text-slate-400" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Assessment Archive</h2>
            </div>

            <div className="card overflow-hidden">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 text-left">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Date</span>
                    </th>
                    <th className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 text-left">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Title</span>
                    </th>
                    <th className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 text-right">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Performance</span>
                    </th>
                    <th className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 text-right">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Global Rank</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-900/50">
                  {chartData.map((d, i) => (
                    <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <span className="text-xs font-medium text-slate-400">{d.date}</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{d.title}</span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
                          <Target className="h-3 w-3 text-indigo-500" />
                          <span className="text-xs font-black tabular-nums">{d.percentage.toFixed(2)}%</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                          <Award className="h-3 w-3 text-amber-500" />
                          <span className="text-xs font-black text-amber-700 dark:text-amber-500 tabular-nums">#{d.rank}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
