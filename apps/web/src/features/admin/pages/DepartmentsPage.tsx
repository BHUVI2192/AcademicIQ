import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Network } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDirectory } from '@/context/DirectoryContext';
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
} from '@/hooks/useDepartments';
import { useColleges } from '@/hooks/useColleges';
import { Modal } from '@/components/Modal';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { Department } from '@shared';

export function DepartmentsPage() {
  const { role } = useAuth();
  const { selectedCollegeId, selectedCollege, isGlobalMode } = useDirectory();
  const effectiveCollegeId = selectedCollegeId;

  const { data, isLoading } = useDepartments(effectiveCollegeId);
  const { data: colleges } = useColleges();
  const create = useCreateDepartment();
  const update = useUpdateDepartment();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [targetCollegeId, setTargetCollegeId] = useState<string>('');

  useEffect(() => {
    if (open) {
      if (editing) {
        setTargetCollegeId(editing.college_id);
      } else if (selectedCollegeId) {
        setTargetCollegeId(selectedCollegeId);
      }
    }
  }, [open, editing, selectedCollegeId]);

  const reset = () => {
    setEditing(null);
    setName('');
    setCode('');
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCollegeId) {
      toast.error('Please select a college');
      return;
    }
    if (!name.trim() || !code.trim()) {
      toast.error('Name and code are required');
      return;
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: { name: name.trim(), code: code.trim() } });
        toast.success('Department updated');
      } else {
        await create.mutateAsync({
          college_id: targetCollegeId,
          name: name.trim(),
          code: code.trim().toUpperCase(),
        });
        toast.success('Department created');
      }
      reset();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed');
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-slate-900 dark:text-slate-100">Departments</h1>
          <p className="text-sm text-slate-500">Configure academic departments</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Department
        </button>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={3} cols={3} />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Network}
            title="No departments"
            description="Add your first academic department"
            action={{ label: 'Add', onClick: () => setOpen(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.name}</td>
                    <td className="font-mono text-xs">{d.code}</td>
                    <td>
                      <button
                        onClick={() => {
                          setEditing(d);
                          setName(d.name);
                          setCode(d.code);
                          setOpen(true);
                        }}
                        className="btn btn-ghost text-xs"
                      >
                        Edit
                      </button>
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
        onClose={reset}
        title={editing ? 'Edit Department' : 'Create Department'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {isGlobalMode && (
            <div>
              <label className="label">College</label>
              <select
                value={targetCollegeId}
                onChange={(e) => setTargetCollegeId(e.target.value)}
                className="input"
                required
                disabled={!!editing}
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
            <label className="label">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Computer Science"
              required
            />
          </div>
          <div>
            <label className="label">Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="input font-mono"
              placeholder="CSE"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending || update.isPending}
              className="btn btn-primary"
            >
              {editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
