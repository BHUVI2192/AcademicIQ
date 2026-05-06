import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Plus, Users, Upload, Download, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useStudents, useCreateStudent } from '@/hooks/useStudents';
import { useFacultyAssignedBatches } from '@/hooks/useBatches';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { isRollNumber, isDateIso } from '@/lib/validators';
import { parseStudentsCsv, downloadStudentTemplate } from '@/lib/csvParser';
import { supabase } from '@/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';

interface ParsedRow {
  roll_number: string;
  full_name: string;
  date_of_birth?: string;
  batch_code?: string;
  __error?: string;
}

export function StudentsPage() {
  const { user, collegeId } = useAuth();
  const queryClient = useQueryClient();
  const { data: batches } = useFacultyAssignedBatches(user?.id);
  const [batchFilter, setBatchFilter] = useState('');
  const [search, setSearch] = useState('');
  const { data: students, isLoading } = useStudents({
    batchId: batchFilter || undefined,
    search: search || undefined,
  });
  const create = useCreateStudent();

  const [createOpen, setCreateOpen] = useState(false);
  const [rollNumber, setRollNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [batchId, setBatchId] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [importBatchId, setImportBatchId] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);

  const validRows = useMemo(() => parsedRows.filter((r) => !r.__error), [parsedRows]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeId) return;
    if (!isRollNumber(rollNumber)) {
      toast.error('Invalid Roll Number format');
      return;
    }
    if (!fullName.trim() || !batchId) {
      toast.error('Fill all required fields');
      return;
    }
    if (dob && !isDateIso(dob)) {
      toast.error('Invalid date format');
      return;
    }
    try {
      await create.mutateAsync({
        college_id: collegeId,
        batch_id: batchId,
        roll_number: rollNumber.toUpperCase(),
        full_name: fullName.trim(),
        date_of_birth: dob || undefined,
      });
      toast.success('Student added');
      setCreateOpen(false);
      setRollNumber('');
      setFullName('');
      setDob('');
      setBatchId('');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed');
    }
  };

  const handleFile = async (file: File) => {
    try {
      const rows = await parseStudentsCsv(file);
      const seen = new Set<string>();
      const parsed: ParsedRow[] = rows.map((r) => {
        const errors: string[] = [];
        if (!r.roll_number || !isRollNumber(r.roll_number)) errors.push('Invalid Roll Number');
        if (!r.full_name?.trim()) errors.push('Name required');
        if (r.date_of_birth && !isDateIso(r.date_of_birth)) errors.push('Bad DOB');
        const key = (r.roll_number ?? '').toUpperCase();
        if (seen.has(key)) errors.push('Duplicate Roll Number');
        seen.add(key);
        return { ...r, __error: errors.length ? errors.join('; ') : undefined };
      });
      setParsedRows(parsed);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to parse CSV');
    }
  };

  const handleUpload = async () => {
    if (!collegeId || !importBatchId || validRows.length === 0) {
      toast.error('Select a batch and upload valid rows');
      return;
    }
    setUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-bulk-upload', {
        body: {
          college_id: collegeId,
          batch_id: importBatchId,
          rows: validRows.map((r) => ({
            roll_number: r.roll_number.toUpperCase(),
            full_name: r.full_name,
            date_of_birth: r.date_of_birth ?? null,
          })),
        },
      });
      if (error) throw error;
      const result = data as { inserted?: number; errors?: { row: number; reason: string }[] };
      toast.success(`Imported ${result.inserted ?? 0} students`);
      if (result.errors && result.errors.length > 0) {
        toast.error(`${result.errors.length} rows failed`);
      }
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setImportOpen(false);
      setParsedRows([]);
      setImportBatchId('');
    } catch (err: any) {
      toast.error(err.message ?? 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-slate-900 dark:text-slate-100">Students</h1>
          <p className="text-sm text-slate-500">Manage students in your batches</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setImportOpen(true)} className="btn btn-secondary inline-flex items-center gap-2">
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Student
          </button>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Batch</label>
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="input"
            >
              <option value="">All my batches</option>
              {batches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · Class {(b as any).class_level}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
                placeholder="Name or Roll No. …"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={5} cols={4} />
          </div>
        ) : !students || students.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students found"
            description="Add a student or import via CSV"
            action={{ label: 'Add student', onClick: () => setCreateOpen(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Roll No.</th>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">{s.roll_number}</td>
                    <td className="font-medium">{s.full_name}</td>
                    <td>
                      {s.is_active ? (
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Student">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Roll No.</label>
            <input
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
              className="input font-mono"
              placeholder="PUC-24-001"
              required
            />
          </div>
          <div>
            <label className="label">Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date of Birth</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Batch</label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="input"
                required
              >
                <option value="">Select…</option>
                {batches?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={create.isPending} className="btn btn-primary">
              {create.isPending ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setParsedRows([]);
        }}
        title="Import Students from CSV"
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={downloadStudentTemplate} className="btn btn-ghost text-xs">
              <Download className="h-3 w-3" /> Download template
            </button>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="text-xs"
            />
          </div>
          <div>
            <label className="label">Target batch</label>
            <select
              value={importBatchId}
              onChange={(e) => setImportBatchId(e.target.value)}
              className="input"
            >
              <option value="">Select…</option>
              {batches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {parsedRows.length > 0 && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700">
                {parsedRows.length} rows · {validRows.length} valid · {parsedRows.length - validRows.length} errors
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th>Roll No.</th>
                      <th>Name</th>
                      <th>DOB</th>
                      <th>Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r, i) => (
                      <tr key={i} className={r.__error ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <td className="font-mono text-xs">{r.roll_number}</td>
                        <td>{r.full_name}</td>
                        <td className="text-xs text-slate-500">{r.date_of_birth ?? ''}</td>
                        <td className="text-xs text-red-600">{r.__error ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setImportOpen(false);
                setParsedRows([]);
              }}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !importBatchId || validRows.length === 0}
              className="btn btn-primary"
            >
              {uploading ? 'Uploading...' : `Import ${validRows.length} students`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
