import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, GraduationCap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDirectory } from '@/context/DirectoryContext';
import { useBatches, useCreateBatch } from '@/hooks/useBatches';
import { useColleges } from '@/hooks/useColleges';
import { useAcademicYears } from '@/hooks/useAcademicYears';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { STREAMS, CLASS_LEVELS, type Stream, type ClassLevel } from '@shared';

export function BatchesPage() {
  const { role } = useAuth();
  const { selectedCollegeId, selectedAcademicYearId, isGlobalMode } = useDirectory();
  const effectiveCollegeId = selectedCollegeId;

  const { data: batches, isLoading } = useBatches(effectiveCollegeId, selectedAcademicYearId);
  const { data: colleges } = useColleges();
  
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [classLevel, setClassLevel] = useState<ClassLevel>(11);
  const [stream, setStream] = useState<Stream>('PCMB');
  const [academicYearId, setAcademicYearId] = useState('');
  const [targetCollegeId, setTargetCollegeId] = useState<string>('');

  const { data: years } = useAcademicYears(targetCollegeId || effectiveCollegeId);
  const create = useCreateBatch();

  useEffect(() => {
    if (open) {
      if (selectedCollegeId) setTargetCollegeId(selectedCollegeId);
      if (selectedAcademicYearId) setAcademicYearId(selectedAcademicYearId);
    }
  }, [open, selectedCollegeId, selectedAcademicYearId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCollegeId) {
      toast.error('Please select a college');
      return;
    }
    if (!name.trim() || !code.trim() || !academicYearId) {
      toast.error('Fill all fields including batch code');
      return;
    }
    
    try {
      await create.mutateAsync({
        college_id: targetCollegeId,
        academic_year_id: academicYearId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        class_level: classLevel,
        stream,
      });
      toast.success('Batch created');
      setOpen(false);
      setName('');
      setCode('');
      setClassLevel(11);
      setStream('PCMB');
      setAcademicYearId('');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed');
    }
  };

  return (
    <div className="space-y-10 py-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Section Management</div>
          <h1 className="text-3xl font-medium tracking-tight text-slate-900 dark:text-slate-100">Classes & Batches</h1>
          <p className="text-sm text-slate-500">Manage 11th and 12th grade class sections</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Class
        </button>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={4} cols={5} />
          </div>
        ) : !batches || batches.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No classes yet"
            description="Create classes and batches to start organizing students"
            action={{ label: 'Create class', onClick: () => setOpen(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Section / Name</th>
                  <th>Class</th>
                  <th>Stream</th>
                  <th>Academic Year</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="font-medium">{b.name}</td>
                    <td>{b.class_level ? `Class ${b.class_level}` : '—'}</td>
                    <td>{b.stream ?? '—'}</td>
                    <td>{b.academic_year?.label ?? '—'}</td>
                    <td>
                      {b.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge>Inactive</Badge>
                      )}
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
        title="Create Class / Batch"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {isGlobalMode && (
            <div>
              <label className="label">College / School</label>
              <select
                value={targetCollegeId}
                onChange={(e) => {
                  setTargetCollegeId(e.target.value);
                  setAcademicYearId('');
                }}
                className="input"
                required
              >
                <option value="">Select School...</option>
                {colleges?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Section name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="e.g. 11-PCMB-A"
              required
            />
          </div>
          <div>
            <label className="label">Section code <span className="text-slate-400 font-normal">(unique per school)</span></label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="input font-mono"
              placeholder="11-PCMB-A-24"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Class Level</label>
              <select
                value={classLevel}
                onChange={(e) => setClassLevel(Number(e.target.value) as ClassLevel)}
                className="input"
                required
              >
                {CLASS_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    Class {level}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Stream</label>
              <select
                value={stream}
                onChange={(e) => setStream(e.target.value as Stream)}
                className="input"
                required
              >
                {STREAMS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Academic year</label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="input"
              required
            >
              <option value="">Select…</option>
              {years?.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label} {y.is_current ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>
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
