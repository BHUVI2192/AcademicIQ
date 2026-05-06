import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVerifiedChildren, useChildTestDetail, useChildMarks } from '@/hooks/useChildResults';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { formatDate } from '@/lib/utils';

export function TestDetailPage() {
  const { testId } = useParams<{ testId: string }>();
  const { user } = useAuth();
  const { data: children } = useVerifiedChildren(user?.id);
  const selectedId = sessionStorage.getItem('aiq.selectedChildId');
  const child = children?.find((c) => c.student_id === selectedId);
  const { data, isLoading } = useChildTestDetail(testId, child?.student_id);
  const { data: marks } = useChildMarks(testId, child?.student_id);

  if (isLoading) return <CardSkeleton />;
  if (!data) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Test not available"
        description="This test isn't published or doesn't exist."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Link
        to="/parent/dashboard"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-medium text-slate-900 dark:text-slate-100">
              {data.test.title}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <span>{formatDate(data.test.test_date)}</span>
              {data.test.is_locked && <Badge variant="info">Final</Badge>}
            </div>
            {data.test.description && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {data.test.description}
              </p>
            )}
          </div>
          {data.ranking && (
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-xs uppercase tracking-wide text-slate-500">
                <Trophy className="h-3 w-3" /> Class rank
              </div>
              <div className="text-3xl font-medium text-slate-900 dark:text-white">#{data.ranking.rank}</div>
              <div className="mt-1 text-xs text-slate-500">
                of {data.ranking.total_students} students
              </div>
            </div>
          )}
        </div>

        {data.ranking && (
          <div className="mt-6 rounded-md bg-slate-900 p-4 dark:bg-white">
            <div className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Overall Performance
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-4xl font-black text-white dark:text-slate-900">
                {Number(data.ranking.percentage).toFixed(2)}%
              </div>
              <div className="text-sm text-slate-500">
                {Number(data.ranking.total_marks).toFixed(0)} / {Number(data.ranking.max_marks).toFixed(0)} marks
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subject-wise marks breakdown */}
      <div className="card">
        <h2 className="mb-3 text-lg font-medium text-slate-900 dark:text-slate-100">
          Subject-wise Marks
        </h2>
        {marks && marks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th className="text-right">Marks</th>
                  <th className="text-right">Max</th>
                  <th className="text-right">%</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {marks.map((m) => {
                  const pct =
                    !m.is_absent && m.marks_obtained != null && m.max_marks > 0
                      ? ((m.marks_obtained / m.max_marks) * 100).toFixed(1)
                      : null;
                  return (
                    <tr key={m.id}>
                      <td className="font-medium">{m.subject_name}</td>
                      <td className="text-right tabular-nums">
                        {m.is_absent ? '—' : (m.marks_obtained ?? '—')}
                      </td>
                      <td className="text-right tabular-nums text-slate-500">{m.max_marks}</td>
                      <td className="text-right tabular-nums font-medium">
                        {pct != null ? `${pct}%` : '—'}
                      </td>
                      <td>
                        {m.is_absent ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <XCircle className="h-3.5 w-3.5" /> Absent
                          </span>
                        ) : m.marks_obtained != null ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-2">
            {data.subjects.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700"
              >
                <div>
                  <div className="font-medium">{s.subject_name}</div>
                  <div className="text-xs text-slate-500">Max: {s.max_marks}</div>
                </div>
                <div className="text-xs text-slate-400">Weight × {s.weightage}</div>
              </div>
            ))}
            <p className="mt-3 text-xs text-slate-500">
              Detailed marks will appear here once results are finalised.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
