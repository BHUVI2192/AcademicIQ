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
        <h1 className="text-2xl font-light tracking-tight text-[hsl(var(--text-main))]">Audit Log</h1>
        <p className="text-sm font-light text-[hsl(var(--text-muted))]">Immutable activity history repository</p>
      </div>

      <div className="glass-card border-none">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-[hsl(var(--text-muted))] font-medium">Action Filter</label>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(0);
              }}
              className="input bg-[hsl(var(--bg-main)/0.2)] border-[hsl(var(--card-border)/0.3)] text-[hsl(var(--text-main))] font-light"
            >
              <option value="" className="bg-[hsl(var(--bg-main))]">All Activities</option>
              {COMMON_ACTIONS.map((a) => (
                <option key={a} value={a} className="bg-[hsl(var(--bg-main))]">
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-[hsl(var(--text-muted))] font-medium">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(0);
              }}
              className="input bg-[hsl(var(--bg-main)/0.2)] border-[hsl(var(--card-border)/0.3)] text-[hsl(var(--text-main))] font-light"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-[hsl(var(--text-muted))] font-medium">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(0);
              }}
              className="input bg-[hsl(var(--bg-main)/0.2)] border-[hsl(var(--card-border)/0.3)] text-[hsl(var(--text-main))] font-light"
            />
          </div>
        </div>
      </div>

      <div className="glass-card p-0 border-none">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={6} cols={4} />
          </div>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No log entries" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[hsl(var(--card-border)/0.3)]">
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--text-muted))] font-medium">When</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--text-muted))] font-medium">Action</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--text-muted))] font-medium">Entity</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--text-muted))] font-medium">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--card-border)/0.1)]">
                  {data.rows.map((r) => (
                    <tr key={r.id} className="group hover:bg-[hsl(var(--primary)/0.02)] transition-colors">
                      <td className="px-6 py-4 text-sm font-light text-[hsl(var(--text-muted))] whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[hsl(var(--primary)/0.05)] border border-[hsl(var(--primary)/0.1)] text-[10px] font-mono text-[hsl(var(--primary))] uppercase tracking-tight">
                          {r.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-light text-[hsl(var(--text-main))]">
                        {r.entity_type ?? '—'}{' '}
                        {r.entity_id && (
                          <span className="text-xs text-[hsl(var(--text-muted))]">({String(r.entity_id).slice(0, 8)}…)</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                         <code className="text-xs font-mono text-[hsl(var(--text-muted))] opacity-60 group-hover:opacity-100 transition-opacity">
                           {String(r.actor_id).slice(0, 8)}…
                         </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[hsl(var(--card-border)/0.3)] px-6 py-4 text-sm">
              <span className="text-[10px] uppercase tracking-widest text-[hsl(var(--text-muted))] font-light">
                {data.total} total activities · Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-4">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[hsl(var(--text-main))] hover:text-[hsl(var(--primary))] transition-colors disabled:opacity-20"
                >
                  <ChevronLeft className="h-3 w-3" /> Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page + 1 >= totalPages}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[hsl(var(--text-main))] hover:text-[hsl(var(--primary))] transition-colors disabled:opacity-20"
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
