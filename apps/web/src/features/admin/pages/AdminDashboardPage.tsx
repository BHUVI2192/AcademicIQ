import { useQuery } from '@tanstack/react-query';
import {
  Users,
  GraduationCap,
  ClipboardList,
  UserCog,
  TrendingUp,
  Activity,
  BookOpen,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { formatDateTime } from '@/lib/utils';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useDirectory } from '@/context/DirectoryContext';

// ─── Data Hooks ──────────────────────────────────────────────────────────────

function useAdminStats(collegeId?: string | null) {
  return useQuery({
    queryKey: ['admin-stats', collegeId],
    queryFn: async () => {
      let facultyQ = supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'faculty');
      let batchesQ = supabase.from('batches').select('id', { count: 'exact', head: true });
      let studentsQ = supabase.from('students').select('id', { count: 'exact', head: true });
      let testsQ = supabase.from('tests').select('id', { count: 'exact', head: true }).eq('is_published', true);
      let parentsQ = supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'parent');

      if (collegeId) {
        facultyQ = facultyQ.eq('college_id', collegeId);
        batchesQ = batchesQ.eq('college_id', collegeId);
        studentsQ = studentsQ.eq('college_id', collegeId);
        testsQ = testsQ.eq('college_id', collegeId);
        parentsQ = parentsQ.eq('college_id', collegeId);
      }

      const [faculty, batches, students, tests, parents] = await Promise.all([
        facultyQ, batchesQ, studentsQ, testsQ, parentsQ,
      ]);

      return {
        faculty: faculty.count ?? 0,
        batches: batches.count ?? 0,
        students: students.count ?? 0,
        publishedTests: tests.count ?? 0,
        parents: parents.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });
}

function useRecentTests(collegeId?: string | null) {
  return useQuery({
    queryKey: ['admin-recent-tests', collegeId],
    queryFn: async () => {
      let q = supabase
        .from('tests')
        .select('id, title, is_published, is_locked, test_date, exam_category, batch:batches(name)')
        .order('created_at', { ascending: false })
        .limit(6);
      if (collegeId) q = q.eq('college_id', collegeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: typeof Users;
  color: string;
  bgColor: string;
  sub?: string;
}

function DashStatCard({ label, value, icon: Icon, color, bgColor, sub }: StatCardProps) {
  return (
    <div className="card group relative overflow-hidden p-6 transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-700">
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 mb-2">{label}</p>
          <p className="text-3xl font-medium tracking-tight text-slate-900 dark:text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400 font-normal">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${bgColor} transition-transform group-hover:scale-105`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

// ─── Mini activity badge ──────────────────────────────────────────────────────

function StatusDot({ published, locked }: { published: boolean; locked: boolean }) {
  if (locked) return (
    <span className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400">
      <CheckCircle2 className="h-3 w-3" /> Locked
    </span>
  );
  if (published) return (
    <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
      <Activity className="h-3 w-3" /> Published
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
      Draft
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  const { selectedCollegeId, selectedCollege } = useDirectory();
  const { data: stats, isLoading } = useAdminStats(selectedCollegeId);
  const { data: recentTests, isLoading: lsTests } = useRecentTests(selectedCollegeId);
  const { data: audit } = useAuditLog({ pageSize: 8, collegeId: selectedCollegeId });

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  return (
    <div className="space-y-10 animate-fade-in font-normal">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 mb-3">
            <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
              {selectedCollege?.code ?? 'Global'}
            </span>
          </div>
          <h1 className="text-4xl font-medium tracking-tight text-slate-900 dark:text-white">
            Good {greeting}.
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
            {selectedCollege
              ? `Everything is running smoothly at ${selectedCollege.name}.`
              : 'Welcome to your global overview. Select a college to dive deeper.'}
          </p>
        </div>
        
        {selectedCollege && (
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-md text-xs font-medium">
            <Building2 className="h-3.5 w-3.5 opacity-70" />
            {selectedCollege.name}
          </div>
        )}
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <DashStatCard
            label="Faculty"
            value={stats?.faculty ?? 0}
            icon={UserCog}
            color="text-slate-900 dark:text-white"
            bgColor="bg-slate-100 dark:bg-white/10"
          />
          <DashStatCard
            label="Batches"
            value={stats?.batches ?? 0}
            icon={GraduationCap}
            color="text-slate-900 dark:text-white"
            bgColor="bg-slate-100 dark:bg-white/10"
          />
          <DashStatCard
            label="Students"
            value={stats?.students ?? 0}
            icon={Users}
            color="text-slate-900 dark:text-white"
            bgColor="bg-slate-100 dark:bg-white/10"
          />
          <DashStatCard
            label="Published"
            value={stats?.publishedTests ?? 0}
            icon={ClipboardList}
            color="text-slate-900 dark:text-white"
            bgColor="bg-slate-100 dark:bg-white/10"
          />
          <DashStatCard
            label="Parents"
            value={stats?.parents ?? 0}
            icon={BookOpen}
            color="text-slate-900 dark:text-white"
            bgColor="bg-slate-100 dark:bg-white/10"
          />
        </div>
      )}

      {/* Engagement summary bar */}
      {!isLoading && stats && stats.students > 0 && (
        <div className="card p-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-md bg-white/10 dark:bg-slate-900/5 flex items-center justify-center">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-medium opacity-60 uppercase tracking-widest text-[10px]">Ratio Analysis</div>
                <div className="text-lg font-medium">Platform Health</div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-12">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest opacity-40 font-medium">Students/Batch</div>
                <div className="text-xl font-medium tracking-tight">
                  {stats.batches > 0 ? (stats.students / stats.batches).toFixed(1) : '—'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest opacity-40 font-medium">Faculty/Batch</div>
                <div className="text-xl font-medium tracking-tight">
                  {stats.batches > 0 ? (stats.faculty / stats.batches).toFixed(1) : '—'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest opacity-40 font-medium">Parent Coverage</div>
                <div className="text-xl font-medium tracking-tight">
                  {stats.students > 0
                    ? `${Math.min(100, Math.round((stats.parents / stats.students) * 100))}%`
                    : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Recent Tests */}
        <div className="card p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Recent Tests
            </h2>
            <button className="text-[10px] uppercase tracking-widest font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
              View All
            </button>
          </div>
          
          {lsTests ? (
            <CardSkeleton />
          ) : !recentTests || recentTests.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 italic font-normal">No tests recorded yet</p>
          ) : (
            <div className="space-y-4">
              {recentTests.map((t: any) => (
                <div
                  key={t.id}
                  className="group flex items-center justify-between rounded-md border border-slate-100 dark:border-slate-800 p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-md bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{t.title}</div>
                      <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                        {t.exam_category ? `${t.exam_category} · ` : ''}{t.batch?.name ?? '—'}
                      </div>
                    </div>
                  </div>
                  <StatusDot published={t.is_published} locked={t.is_locked} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit log */}
        <div className="card p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Activity Feed
            </h2>
            <div className="h-1.5 w-1.5 rounded-md bg-emerald-500 animate-pulse" />
          </div>

          {audit && audit.rows.length > 0 ? (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-slate-100 dark:bg-white/5" />
              
              <div className="space-y-6">
                {audit.rows.map((r) => (
                  <div key={r.id} className="relative flex items-start gap-5 pl-8">
                    {/* Timeline dot */}
                    <div className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-md border-2 border-white bg-slate-900 dark:border-slate-900 dark:bg-white" />
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-white leading-snug">
                        {r.action}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                          {r.entity_type ?? 'System'}
                        </span>
                        <span className="text-slate-200 dark:text-slate-800">•</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {formatDateTime(r.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400 italic font-normal">No activity recorded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

