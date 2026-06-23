import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, ArrowRight, Trophy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTests } from '@/hooks/useTests';
import { useFacultyAssignedBatches, useBatches } from '@/hooks/useBatches';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { formatDate } from '@/lib/utils';


export function TestsPage() {
  const { user, collegeId } = useAuth();
  const { data: batches } = useFacultyAssignedBatches(user?.id);
  const { data: allBatches } = useBatches();

  const batchIds = useMemo(() => (batches ?? []).map((b) => b.id), [batches]);
  const { data: tests, isLoading } = useTests(undefined, batchIds, undefined);
  const batchNameMap = new Map((allBatches ?? []).map((b) => [b.id, b.name]));

  const reset = () => {
    // No longer needed
  };



  const getCategoryLabel = (cat: string, subType?: string) => {
    if (subType) return subType;
    if (cat === 'Board Exam') return 'Board';
    if (cat === 'Daily Test') return 'Daily';
    return cat;
  };

  const getCategoryBadge = (cat: string) => {
    const badges: Record<string, string> = {
      JEE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      JEE_Mains: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      JEE_Advanced: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      NEET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      'Board Exam': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      Board: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      'Daily Test': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
      Practice: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    };
    return badges[cat] || badges.Practice;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-slate-900 dark:text-slate-100">Tests</h1>
          <p className="text-sm text-slate-500">View examination records, enter marks, and publish results</p>
        </div>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="p-6"><TableSkeleton rows={5} cols={5} /></div>
        ) : !tests || tests.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No tests yet"
            description="Assessments will appear here once they are created by the admin."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Exam</th>
                  <th>Date</th>
                  <th>Batch</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.title}</td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${getCategoryBadge(t.exam_category)}`}
                      >
                        {getCategoryLabel(t.exam_category, t.exam_sub_type ?? undefined)}
                      </span>
                    </td>
                    <td>{formatDate(t.test_date)}</td>
                    <td>{batchNameMap.get(t.batch_id) ?? '—'}</td>
                    <td>
                      {t.is_locked ? (
                        <Badge variant="info">Locked</Badge>
                      ) : t.is_published ? (
                        <Badge variant="success">Published</Badge>
                      ) : (
                        <Badge>Draft</Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-3 items-center">
                        <Link
                          to={`/faculty/tests/${t.id}/marks`}
                          className="btn btn-ghost inline-flex items-center gap-1 text-xs"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                        {(t.is_locked || t.is_published) && (
                          <Link
                            to={`/faculty/tests/${t.id}/rankings`}
                            className="inline-flex items-center justify-center p-1.5 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all shadow-sm"
                            title="View Leaderboard"
                          >
                            <Trophy className="h-4 w-4" />
                          </Link>
                        )}
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
