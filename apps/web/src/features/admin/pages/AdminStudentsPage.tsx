import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Users, Search, GraduationCap, Plus, Upload, Download, 
  Edit2, Trash2, Folder, CheckCircle2, ChevronLeft, ArrowRight,
  MoreVertical, UserCheck, UserX, Calendar
} from 'lucide-react';
import { useDirectory } from '@/context/DirectoryContext';
import { useStudents, useCreateStudent } from '@/hooks/useStudents';
import { useBatches } from '@/hooks/useBatches';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { isRollNumber, isDateIso } from '@/lib/validators';
import { parseStudentsCsv, downloadStudentTemplate } from '@/lib/csvParser';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { useColleges } from '@/hooks/useColleges';

interface ParsedRow {
  roll_number: string;
  full_name: string;
  date_of_birth?: string;
  __error?: string;
}

export function AdminStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedCollegeId, isGlobalMode } = useDirectory();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');

  const { data: students, isLoading } = useStudents({
    collegeId: selectedCollegeId ?? undefined,
    search: search || undefined,
    batchId: batchFilter || undefined,
    includeInactive: true,
  });

  const { data: batches } = useBatches(selectedCollegeId ?? undefined);
  const create = useCreateStudent();

  const [createOpen, setCreateOpen] = useState(false);
  const [rollNumber, setRollNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [targetCollegeId, setTargetCollegeId] = useState<string>('');
  const [batchId, setBatchId] = useState('');

  const { data: colleges } = useColleges();
  const { data: modalBatches } = useBatches(targetCollegeId || selectedCollegeId || undefined);

  const [importOpen, setImportOpen] = useState(false);
  const [importBatchId, setImportBatchId] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);

  const filtered = useMemo(() => students ?? [], [students]);
  const validRows = useMemo(() => parsedRows.filter((r) => !r.__error), [parsedRows]);

  const activeBatch = useMemo(() => 
    batches?.find(b => b.id === batchFilter), 
    [batches, batchFilter]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const collegeId = targetCollegeId || selectedCollegeId;
    if (!collegeId) {
      toast.error('Please select a college');
      return;
    }
    if (!isRollNumber(rollNumber)) {
      toast.error('Invalid Roll Number format (e.g. PUC-24-001)');
      return;
    }
    if (!fullName.trim() || !batchId) {
      toast.error('Fill all required fields');
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
      toast.success('Student added successfully');
      setCreateOpen(false);
      setRollNumber('');
      setFullName('');
      setDob('');
      setBatchId('');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add student');
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
        if (seen.has(key)) errors.push('Duplicate in file');
        seen.add(key);
        return { ...r, __error: errors.length ? errors.join('; ') : undefined };
      });
      setParsedRows(parsed);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to parse CSV');
    }
  };

  const handleUpload = async () => {
    if (!selectedCollegeId || !importBatchId || validRows.length === 0) {
      toast.error('Select a class and upload valid rows');
      return;
    }
    setUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-bulk-upload', {
        body: {
          college_id: selectedCollegeId,
          batch_id: importBatchId,
          rows: validRows.map((r) => ({
            usn: r.roll_number.toUpperCase(),
            full_name: r.full_name,
            date_of_birth: r.date_of_birth ?? null,
          })),
        },
      });

      if (error) throw error;
      
      const result = data as { 
        inserted?: number; 
        errors?: { row: number; usn?: string; reason: string }[] 
      };

      if (result.errors && result.errors.length > 0) {
        const errorCount = result.errors.length;
        const firstError = result.errors[0];
        toast.error(
          `Imported ${result.inserted ?? 0} students. ${errorCount} rows skipped. First error: ${firstError.reason}`,
          { duration: 6000 }
        );
      } else {
        toast.success(`Successfully imported ${result.inserted ?? 0} students`);
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

  const toggleStatus = async (student: any) => {
    try {
      const { error } = await supabase
        .from('students')
        .update({ is_active: !student.is_active })
        .eq('id', student.id);
      if (error) throw error;
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this student? This action cannot be undone.')) return;
    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      toast.success('Student deleted');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete student');
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-fade-in pb-12">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10">
            <GraduationCap className="h-3 w-3 text-slate-900 dark:text-white" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">
              Student Management
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-5xl font-light tracking-tight text-slate-900 dark:text-white leading-tight">
              {batchFilter ? activeBatch?.name : 'Academic Records'}
            </h1>
            <p className="max-w-xl text-lg text-slate-500 font-light leading-relaxed">
              {batchFilter 
                ? `Managing ${filtered.length} students enrolled in the ${activeBatch?.class_level} framework.`
                : 'Central repository for student profiles, enrollments, and academic associations.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {batchFilter && (
            <button 
              onClick={() => { setBatchFilter(''); setSearch(''); }} 
              className="btn btn-secondary px-6"
            >
              <ChevronLeft className="h-4 w-4" /> Batches
            </button>
          )}
          <button onClick={() => setImportOpen(true)} className="btn btn-secondary px-6">
            <Upload className="h-4 w-4" /> Import
          </button>
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary px-8">
            <Plus className="h-4 w-4" /> Add Student
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {!batchFilter ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {(batches ?? []).map((b) => {
            const studentCount = (students ?? []).filter(s => s.batch_id === b.id).length;
            return (
              <button
                key={b.id}
                onClick={() => setBatchFilter(b.id)}
                className="card group p-8 flex flex-col items-start text-left gap-6 transition-all hover:-translate-y-2 hover:shadow-sm hover:shadow-slate-200/50 dark:hover:shadow-none border-none"
              >
                <div className="w-16 h-16 bg-slate-900/5 dark:bg-white/5 rounded-md flex items-center justify-center transition-transform group-hover:scale-110 group-hover:bg-slate-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-slate-900">
                  <Folder className="h-8 w-8" />
                </div>
                <div className="space-y-1 w-full">
                  <h3 className="text-xl font-medium text-slate-900 dark:text-white truncate">{b.name}</h3>
                  <div className="flex items-center justify-between w-full">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {studentCount} Students
                    </p>
                    <ArrowRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            );
          })}
          {batches?.length === 0 && (
            <div className="col-span-full py-20 bg-slate-50/50 dark:bg-white/5 rounded-md border-2 border-dashed border-slate-200 dark:border-slate-800">
               <EmptyState icon={Folder} title="No Cohorts Found" description="Initialize a batch to begin student onboarding." />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Internal Table Search */}
          <div className="flex items-center gap-4 bg-white dark:bg-slate-950 p-2 rounded-md border border-slate-100 dark:border-slate-800 max-w-2xl">
            <div className="flex-1 relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or unique ID…"
                className="w-full bg-transparent border-none focus:ring-0 px-14 py-4 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="card overflow-hidden border-none shadow-sm">
            {isLoading ? (
              <div className="p-12"><TableSkeleton rows={10} cols={6} /></div>
            ) : filtered.length === 0 ? (
              <div className="p-20"><EmptyState icon={Users} title="Empty Cohort" description="No student records match your current criteria." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="sticky top-0 bg-white dark:bg-slate-950/80 px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-left">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Unique ID</span>
                      </th>
                      <th className="sticky top-0 bg-white dark:bg-slate-950/80 px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-left">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Student Identity</span>
                      </th>
                      <th className="sticky top-0 bg-white dark:bg-slate-950/80 px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-left">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Associated Parents</span>
                      </th>
                      <th className="sticky top-0 bg-white dark:bg-slate-950/80 backdrop-blur-xl px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-center">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</span>
                      </th>
                      <th className="sticky top-0 bg-white dark:bg-slate-950/80 backdrop-blur-xl px-8 py-6 border-b border-slate-100 dark:border-slate-800 text-right">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-900/50">
                    {filtered.map((s: any) => (
                      <tr key={s.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="px-8 py-5 font-mono text-[11px] font-medium text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white">
                          {s.roll_number}
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{s.full_name}</span>
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">
                              {s.batch?.stream || 'Standard'}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-wrap gap-2">
                            {s.parent_student_map && s.parent_student_map.length > 0 ? (
                              s.parent_student_map.map((m: any) => (
                                <div key={m.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-default">
                                  <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{m.parent?.full_name}</span>
                                  {m.is_verified ? (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <div className="w-1 h-1 rounded-md bg-amber-500 animate-pulse" />
                                  )}
                                </div>
                              ))
                            ) : (
                              <button 
                                onClick={() => navigate('/admin/parents', { state: { rollNumber: s.roll_number, batchId: s.batch_id } })}
                                className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white underline underline-offset-4"
                              >
                                + Connect Parent
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <button onClick={() => toggleStatus(s)} className="transition-transform active:scale-95">
                            <Badge variant={s.is_active !== false ? 'success' : 'danger'} className="font-black uppercase tracking-[0.1em] text-[9px] px-3">
                              {s.is_active !== false ? 'Active' : 'Archived'}
                            </Badge>
                          </button>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <button onClick={() => handleDelete(s.id)} className="p-2 rounded-md bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm">
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
        </div>
      )}

      {/* Individual Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Student Registration" size="md">
        <form onSubmit={handleCreate} className="space-y-8 p-2">
          {isGlobalMode && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Institutional Entity</label>
              <select
                value={targetCollegeId}
                onChange={(e) => {
                  setTargetCollegeId(e.target.value);
                  setBatchId('');
                }}
                className="input-premium w-full"
                required
              >
                <option value="">Select Institution...</option>
                {colleges?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Unique Roll Number</label>
              <input
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                className="input-premium w-full font-mono font-medium"
                placeholder="PUC-24-001"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Assigned Cohort</label>
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="input-premium w-full" required>
                <option value="">Select Batch…</option>
                {modalBatches?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Legal Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-premium w-full"
              placeholder="e.g. Bhuvan N"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Date of Birth (Optional)</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="input-premium w-full pl-12" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn btn-secondary px-8">Discard</button>
            <button type="submit" disabled={create.isPending} className="btn btn-primary px-10">
              {create.isPending ? 'Processing...' : 'Register Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <Modal open={importOpen} onClose={() => { setImportOpen(false); setParsedRows([]); }} title="Collective Onboarding (CSV)" size="xl">
        <div className="space-y-8 p-2">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50 dark:bg-slate-900/50 p-8 rounded-md border border-slate-100 dark:border-slate-800">
            <div className="space-y-2 text-center md:text-left">
              <p className="text-lg font-medium text-slate-900 dark:text-white leading-tight">Collective Data Ingest</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Columns: roll_number, full_name, date_of_birth</p>
            </div>
            <div className="flex gap-3">
              <button onClick={downloadStudentTemplate} className="btn btn-secondary px-6">
                <Download className="h-4 w-4" /> Template
              </button>
              <label className="btn btn-primary px-8 cursor-pointer">
                <Upload className="h-4 w-4" /> Ingest CSV
                <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Destination Cohort</label>
            <select value={importBatchId} onChange={(e) => setImportBatchId(e.target.value)} className="input-premium w-full">
              <option value="">Select class framework…</option>
              {batches?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {parsedRows.length > 0 && (
            <div className="card overflow-hidden border-slate-100 dark:border-slate-800">
              <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payload Preview</span>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{validRows.length} Valid Rows</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">ID</th>
                      <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Identity</th>
                      <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className={r.__error ? 'bg-red-500/5' : ''}>
                        <td className="px-6 py-3 font-mono font-medium text-[10px] text-slate-500">{r.roll_number}</td>
                        <td className="px-6 py-3 text-xs font-medium text-slate-900 dark:text-white">{r.full_name}</td>
                        <td className="px-6 py-3">
                          {r.__error 
                            ? <span className="text-[9px] font-black text-red-500 uppercase tracking-wider">{r.__error}</span> 
                            : <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">Verified</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={() => { setImportOpen(false); setParsedRows([]); }} className="btn btn-secondary px-8">Discard</button>
            <button onClick={handleUpload} disabled={uploading || !importBatchId || validRows.length === 0} className="btn btn-primary px-10">
              {uploading ? 'Processing...' : `Execute Ingest (${validRows.length})`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
