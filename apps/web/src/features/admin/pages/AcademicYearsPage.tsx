import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Calendar, CheckCircle2, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDirectory } from '@/context/DirectoryContext';
import {
  useAcademicYears,
  useCreateAcademicYear,
  useSetCurrentAcademicYear,
  useDeleteAcademicYear,
} from '@/hooks/useAcademicYears';
import { useColleges } from '@/hooks/useColleges';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { formatDate } from '@/lib/utils';
import { isDateIso } from '@/lib/validators';

export function AcademicYearsPage() {
  const { role } = useAuth();
  const { selectedCollegeId, selectedAcademicYearId, isGlobalMode } = useDirectory();
  const effectiveCollegeId = selectedCollegeId;

  const { data, isLoading } = useAcademicYears(effectiveCollegeId);
  const { data: colleges } = useColleges();
  const create = useCreateAcademicYear();
  const setCurrent = useSetCurrentAcademicYear();
  const deleteYear = useDeleteAcademicYear();

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Are you sure you want to delete the academic year "${label}"? This will delete all batches, students, tests, marks, and associated records for this year!`)) return;
    try {
      await deleteYear.mutateAsync(id);
      toast.success('Academic year deleted successfully');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete academic year');
    }
  };

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [targetCollegeId, setTargetCollegeId] = useState<string>('');

  // Sync targetCollegeId with selectedCollegeId when modal opens
  useEffect(() => {
    if (open && selectedCollegeId) {
      setTargetCollegeId(selectedCollegeId);
    }
  }, [open, selectedCollegeId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCollegeId) {
      toast.error('Please select a college');
      return;
    }
    if (!label.trim() || !isDateIso(startsAt) || !isDateIso(endsAt)) {
      toast.error('Fill all fields with valid dates');
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      toast.error('End date must be after start date');
      return;
    }
    try {
      await create.mutateAsync({
        college_id: targetCollegeId,
        label: label.trim(),
        starts_at: startsAt,
        ends_at: endsAt,
        is_current: isCurrent,
      });
      toast.success('Academic year created');
      setOpen(false);
      setLabel('');
      setStartsAt('');
      setEndsAt('');
      setIsCurrent(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create');
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-normal text-slate-900 dark:text-slate-100">Academic Years</h1>
          <p className="text-sm text-slate-500">Manage academic year configurations</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Year
        </button>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={4} cols={4} />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No academic years yet"
            description="Create one to start organizing batches"
            action={{ label: 'Create year', onClick: () => setOpen(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((y) => (
                  <tr key={y.id}>
                    <td className="font-normal">{y.label}</td>
                    <td>{formatDate(y.starts_at)}</td>
                    <td>{formatDate(y.ends_at)}</td>
                    <td>
                      {y.is_current ? (
                        <Badge variant="success">
                          <CheckCircle2 className="h-3 w-3" /> Current
                        </Badge>
                      ) : (
                        <Badge>Inactive</Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {!y.is_current && (
                          <button
                            onClick={() =>
                              setCurrent.mutate(
                                { id: y.id, college_id: y.college_id },
                                { onSuccess: () => toast.success('Set as current') }
                              )
                            }
                            className="btn btn-ghost text-xs font-normal"
                          >
                            Set as current
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(y.id, y.label)}
                          className="btn btn-ghost text-xs font-normal text-rose-600 hover:text-rose-700 hover:bg-rose-50 p-1"
                          title="Delete Academic Year"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal 
        open={open} 
        onClose={() => setOpen(false)} 
        title="Create Academic Year"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {isGlobalMode && (
            <div>
              <label className="label">College</label>
              <select
                value={targetCollegeId}
                onChange={(e) => setTargetCollegeId(e.target.value)}
                className="input"
                required
              >
                <option value="">Select College...</option>
                {colleges?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="input"
              placeholder="2024-25"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start date</label>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">End date</label>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="input"
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
            />
            Set as current academic year
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={create.isPending} className="btn btn-primary">
              {create.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
