import { useState } from 'react';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { formatDateTime } from '@/lib/utils';

const COMMON_ACTIONS = [
  'marks.upsert',
  'rankings.recalculate',
  'students.bulk_create',
  'notification.sent',
  'test.published',
  'test.locked',
];

import { useDirectory } from '@/context/DirectoryContext';

export function AuditLogPage() {
  const { selectedCollegeId } = useDirectory();
  const [action, setAction] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;
  
  const { data, isLoading } = useAuditLog({
    action: action || undefined,
    fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
    toDate: toDate ? new Date(toDate).toISOString() : undefined,
    page,
    pageSize,
    collegeId: selectedCollegeId,
  });
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-slate-900 dark:text-slate-100">Audit Log</h1>
        <p className="text-sm text-slate-500">Immutable activity history</p>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Action</label>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(0);
              }}
              className="input"
            >
              <option value="">All</option>
              {COMMON_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(0);
              }}
              className="input"
            />
          </div>
          <div>
            <label className="label">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(0);
              }}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={6} cols={4} />
          </div>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No log entries" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="text-slate-500">{formatDateTime(r.created_at)}</td>
                      <td>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono dark:bg-slate-800">
                          {r.action}
                        </span>
                      </td>
                      <td className="text-slate-500">
                        {r.entity_type ?? '—'}{' '}
                        {r.entity_id && (
                          <span className="text-xs">({String(r.entity_id).slice(0, 8)}…)</span>
                        )}
                      </td>
                      <td className="font-mono text-xs text-slate-500">
                        {String(r.actor_id).slice(0, 8)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
              <span className="text-slate-500">
                {data.total} total · Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="btn btn-ghost text-xs disabled:opacity-40"
                >
                  <ChevronLeft className="h-3 w-3" /> Prev
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page + 1 >= totalPages}
                  className="btn btn-ghost text-xs disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
