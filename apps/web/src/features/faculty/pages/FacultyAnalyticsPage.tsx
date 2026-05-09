import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  BookOpen, 
  Trophy, 
  Target, 
  ArrowUpRight
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFacultyAnalytics } from '@/hooks/useFacultyAnalytics';

export function FacultyAnalyticsPage() {
  const { user } = useAuth();
  const { data: analytics, isLoading } = useFacultyAnalytics(user?.id);

  if (isLoading) {
    return (
      <div className="p-12 space-y-8 animate-pulse">
        <div className="h-12 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-900 rounded-2xl" />)}
        </div>
        <div className="h-96 bg-slate-50 dark:bg-slate-900/50 rounded-2xl" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-20 text-center text-slate-500 font-light">
        No analytics data available for your current assignments.
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-fade-in pb-12">
      {/* Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10">
          <BarChart3 className="h-3 w-3 text-slate-900 dark:text-white" />
          <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-900 dark:text-white">
            Performance Intelligence
          </span>
        </div>
        <h1 className="text-5xl font-light tracking-tight text-slate-900 dark:text-white leading-tight">
          Faculty Analytics
        </h1>
        <p className="max-w-xl text-lg text-slate-500 font-light leading-relaxed">
          Aggregated performance indices and cohort progression metrics across all assigned batches.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="card p-8 group hover:border-slate-900 dark:hover:border-white transition-all duration-500">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Avg. Institutional Score</span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-light text-slate-900 dark:text-white">
                  {analytics.batches.length > 0 
                    ? (analytics.batches.reduce((s, b) => s + b.averageScore, 0) / analytics.batches.length).toFixed(1) 
                    : '0'}%
                </h3>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/5 dark:bg-white/5">
              <Target className="h-5 w-5 text-slate-900 dark:text-white" />
            </div>
          </div>
        </div>

        <div className="card p-8 group hover:border-slate-900 dark:hover:border-white transition-all duration-500">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Active Cohorts</span>
              <h3 className="text-4xl font-light text-slate-900 dark:text-white">{analytics.batches.length}</h3>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/5 dark:bg-white/5">
              <Users className="h-5 w-5 text-slate-900 dark:text-white" />
            </div>
          </div>
        </div>

        <div className="card p-8 group hover:border-slate-900 dark:hover:border-white transition-all duration-500">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">Assessments Evaluated</span>
              <h3 className="text-4xl font-light text-slate-900 dark:text-white">
                {analytics.batches.reduce((s, b) => s + b.testCount, 0)}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/5 dark:bg-white/5">
              <BookOpen className="h-5 w-5 text-slate-900 dark:text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Batch Performance Bar Chart */}
        <div className="card p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-normal uppercase tracking-widest text-slate-900 dark:text-white">Cohort Performance</h4>
              <p className="text-xs text-slate-500 font-light">Average percentage across all assessments per batch.</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.batches}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="batchName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="averageScore" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Students */}
        <div className="card p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-normal uppercase tracking-widest text-slate-900 dark:text-white">Elite Performers</h4>
              <p className="text-xs text-slate-500 font-light">Top students based on cumulative institutional average.</p>
            </div>
            <Trophy className="h-5 w-5 text-amber-500" />
          </div>
          <div className="space-y-4">
            {analytics.topStudents.map((s, idx) => (
              <div key={s.studentId} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 group hover:border-slate-900 dark:hover:border-white transition-colors">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-normal text-slate-300">#{idx + 1}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-normal text-slate-900 dark:text-white">{s.studentName}</span>
                    <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">{s.rollNumber}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                   <div className="text-right">
                     <div className="text-sm font-normal text-slate-900 dark:text-white">{s.averageScore.toFixed(1)}%</div>
                     <div className="text-[10px] text-slate-400 font-light">{s.testsTaken} tests</div>
                   </div>
                   <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                </div>
              </div>
            ))}
            {analytics.topStudents.length === 0 && (
              <div className="text-center py-12 text-slate-400 font-light italic">No performance data available.</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Trends */}
      {analytics.batches.map(batch => batch.recentTrends.length > 0 && (
        <div key={batch.batchId} className="card p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-normal uppercase tracking-widest text-slate-900 dark:text-white">{batch.batchName} Progression</h4>
              <p className="text-xs text-slate-500 font-light">Performance trend over the last 5 assessments.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-slate-900 dark:text-white" />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={batch.recentTrends}>
                <defs>
                  <linearGradient id={`colorAvg-${batch.batchId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="testTitle" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="averageScore" stroke="#0f172a" strokeWidth={3} fillOpacity={1} fill={`url(#colorAvg-${batch.batchId})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
