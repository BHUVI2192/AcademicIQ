import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, ClipboardList, ArrowRight, Plus, GraduationCap, BookOpen } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useStudents } from '@/hooks/useStudents';
import { useTests } from '@/hooks/useTests';
import { useFacultyAssignedBatches } from '@/hooks/useBatches';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { formatDate } from '@/lib/utils';

export function FacultyDashboardPage() {
  const { user, profile } = useAuth();

  const { data: assignedBatches, isLoading: lsBatches } = useFacultyAssignedBatches(user?.id);
  const batchIds = useMemo(
    () => (assignedBatches ?? []).map((b) => b.id),
    [assignedBatches]
  );

  const batchId = batchIds.length === 1 ? batchIds[0] : undefined;
  const { data: students, isLoading: lsStudents } = useStudents({ batchId });
  const { data: tests, isLoading: lsTests } = useTests(undefined, batchIds.length > 0 ? batchIds : undefined);

  const studentCount = useMemo(() => {
    if (batchIds.length <= 1) return students?.length ?? 0;
    return (students ?? []).filter((s) => batchIds.includes(s.batch_id)).length;
  }, [students, batchIds]);

  const recent = (tests ?? []).slice(0, 5);

  return (
    <div className="space-y-10 py-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Faculty Portal
        </div>
        <h1 className="text-3xl font-medium tracking-tight text-slate-900 dark:text-white">
          Welcome, {profile?.full_name?.split(' ')[0] ?? 'Faculty'}
        </h1>
        <p className="text-sm text-slate-500 font-normal">
          Manage your assigned batches and track student performance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {lsBatches ? (
          <CardSkeleton />
        ) : (
          <StatCard label="Assigned Batches" value={batchIds.length} icon={GraduationCap} />
        )}
        {lsStudents ? (
          <CardSkeleton />
        ) : (
          <StatCard label="Total Students" value={studentCount} icon={Users} />
        )}
        {lsTests ? (
          <CardSkeleton />
        ) : (
          <StatCard label="Assessments" value={tests?.length ?? 0} icon={ClipboardList} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Batches Overview */}
        <div className="card flex flex-col">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-slate-900 dark:text-white">Active Batches</h2>
            </div>
            <Link to="/faculty/students" className="text-xs font-medium uppercase tracking-wider text-slate-400 hover:text-slate-900 transition-colors flex items-center gap-1">
              Directory <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {lsBatches ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-12 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />)}
            </div>
          ) : batchIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-md">
              <BookOpen className="h-6 w-6 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No batches assigned</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignedBatches?.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-md border border-slate-100 bg-white p-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-600">
                    <span className="text-xs font-medium">{b.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{b.name}</div>
                    <div className="text-xs text-slate-500 truncate">{b.department?.name || 'General Dept'}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card flex flex-col">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-slate-900 dark:text-white">Recent Tests</h2>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/faculty/tests" className="text-xs font-medium uppercase tracking-wider text-slate-400 hover:text-slate-900">
                View All
              </Link>
              <Link to="/faculty/tests" className="flex h-8 w-8 items-center justify-center rounded bg-slate-900 text-white hover:bg-slate-800 transition-colors">
                <Plus className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {lsTests ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />)}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-md">
              <ClipboardList className="h-6 w-6 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No tests found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recent.map((t) => (
                <Link
                  key={t.id}
                  to={`/faculty/tests/${t.id}/marks`}
                  className="flex items-center justify-between rounded-md p-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{t.title}</div>
                    <div className="text-xs text-slate-500">{formatDate(t.test_date)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {t.is_locked ? (
                      <span className="text-[10px] font-medium uppercase text-slate-400">Locked</span>
                    ) : t.is_published ? (
                      <span className="text-[10px] font-medium uppercase text-emerald-600">Live</span>
                    ) : (
                      <span className="text-[10px] font-medium uppercase text-amber-600">Draft</span>
                    )}
                    <ArrowRight className="h-3 w-3 text-slate-300" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
