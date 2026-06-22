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
  exam_wing?: string | null;
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
  const [examWing, setExamWing] = useState<'NEET' | 'KCET' | ''>('');
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
        exam_wing: examWing || undefined,
      });
      toast.success('Student added successfully');
      setCreateOpen(false);
      setRollNumber('');
      setFullName('');
      setDob('');
      setBatchId('');
      setExamWing('');
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
            exam_wing: r.exam_wing ?? null,
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-academic-blue/10 border border-academic-blue/20">
            <GraduationCap className="h-3.5 w-3.5 text-academic-blue" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-academic-blue">
              Registry Management
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-5xl font-bold tracking-tight text-academic-navy leading-tight">
              {batchFilter ? activeBatch?.name : 'Institutional Records'}
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground font-medium leading-relaxed">
              {batchFilter 
                ? `Managing ${filtered.length} students enrolled in the ${activeBatch?.class_level} academic framework.`
                : 'Central repository for student profiles, academic enrollments, and institutional registry.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {batchFilter && (
            <button 
              onClick={() => { setBatchFilter(''); setSearch(''); }} 
              className="btn-premium btn-secondary px-6"
            >
              <ChevronLeft className="h-4 w-4 mr-2" /> Back to Cohorts
            </button>
          )}
          <button onClick={() => setImportOpen(true)} className="btn-premium btn-secondary px-6">
            <Upload className="h-4 w-4 mr-2" /> Collective Import
          </button>
          <button onClick={() => setCreateOpen(true)} className="btn-premium btn-primary px-8">
            <Plus className="h-4 w-4 mr-2" /> Register Student
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
                className="glass-card group p-8 flex flex-col items-start text-left gap-6 transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-academic-blue/10 border-none"
              >
                <div className="w-16 h-16 bg-academic-blue/10 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:bg-academic-blue group-hover:text-white group-hover:rotate-3 shadow-inner">
                  <Folder className="h-8 w-8" />
                </div>
                <div className="space-y-1.5 w-full">
                  <h3 className="text-2xl font-bold text-academic-navy truncate group-hover:text-academic-blue transition-colors">{b.name}</h3>
                  <div className="flex items-center justify-between w-full">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      {studentCount} Enrolled Students
                    </p>
                    <ArrowRight className="h-5 w-5 text-academic-blue opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0" />
                  </div>
                </div>
              </button>
            );
          })}
          {batches?.length === 0 && (
            <div className="col-span-full py-24 glass-card flex flex-col items-center justify-center text-center border-2 border-dashed border-academic-navy/10 bg-academic-navy/[0.02]">
               <EmptyState icon={Folder} title="No Cohorts Found" description="Initialize an academic batch to begin student onboarding." />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Internal Table Search */}
          <div className="glass-card p-2 max-w-2xl border-none shadow-xl shadow-academic-navy/5">
            <div className="flex-1 relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search registry by name or unique ID…"
                className="w-full bg-transparent border-none focus:ring-0 px-14 py-5 text-base font-semibold text-academic-navy placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          <div className="glass-card overflow-hidden border-none shadow-2xl shadow-academic-navy/5 p-0">
            {isLoading ? (
              <div className="p-12"><TableSkeleton rows={10} cols={6} /></div>
            ) : filtered.length === 0 ? (
              <div className="p-24"><EmptyState icon={Users} title="Empty Cohort" description="No student records match your current criteria in this batch." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead className="bg-academic-navy/[0.03]">
                    <tr>
                      <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Unique ID</span>
                      </th>
                      <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Student Identity</span>
                      </th>
                      <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Guardians</span>
                      </th>
                      <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Wing</span>
                      </th>
                      <th className="px-8 py-6 text-center border-b border-academic-navy/5">
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Status</span>
                      </th>
                      <th className="px-8 py-6 text-right border-b border-academic-navy/5">
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Management</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-academic-navy/5">
                    {filtered.map((s: any) => (
                      <tr key={s.id} className="group hover:bg-academic-navy/[0.01] transition-colors">
                        <td className="px-8 py-6 font-mono text-[12px] font-bold text-muted-foreground group-hover:text-academic-blue transition-colors">
                          {s.roll_number}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-academic-blue/10 flex items-center justify-center text-academic-blue font-bold text-sm shadow-inner group-hover:scale-105 transition-transform">
                              {s.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-academic-navy">{s.full_name}</span>
                              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                {s.batch?.stream || 'GENERAL'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-wrap gap-2">
                            {s.parent_student_map && s.parent_student_map.length > 0 ? (
                              s.parent_student_map.map((m: any) => (
                                <div key={m.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-academic-yellow/10 border border-academic-yellow/20 hover:bg-academic-yellow/20 transition-all cursor-default group/parent">
                                  <span className="text-[10px] font-bold text-academic-navy/80">{m.parent?.full_name}</span>
                                  {m.is_verified ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : (
                                    <div className="w-1.5 h-1.5 rounded-full bg-academic-yellow animate-pulse" title="Verification Pending" />
                                  )}
                                </div>
                              ))
                            ) : (
                              <button 
                                onClick={() => navigate('/admin/parents', { state: { rollNumber: s.roll_number, batchId: s.batch_id } })}
                                className="text-[11px] font-bold uppercase tracking-widest text-academic-blue/60 hover:text-academic-blue transition-colors underline underline-offset-4 decoration-2"
                              >
                                + Link Guardian
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                           {s.exam_wing ? (
                             <Badge variant="outline" className="bg-academic-blue/5 text-academic-blue border-academic-blue/20 font-bold px-3 py-1 text-[10px]">
                               {s.exam_wing}
                             </Badge>
                           ) : (
                             <span className="text-[10px] font-bold text-muted-foreground/40 italic">N/A</span>
                           )}
                        </td>
                        <td className="px-8 py-6 text-center">
                          <button onClick={() => toggleStatus(s)} className="transition-transform active:scale-95">
                            <Badge variant={s.is_active !== false ? 'success' : 'danger'} className="font-bold uppercase tracking-widest text-[10px] px-4 py-1.5 rounded-full shadow-sm">
                              {s.is_active !== false ? 'Enrolled' : 'Inactive'}
                            </Badge>
                          </button>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <button onClick={() => handleDelete(s.id)} className="p-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-100">
                              <Trash2 className="h-4.5 w-4.5" />
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

      {/* Registration Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Institutional Registration" size="md">
        <form onSubmit={handleCreate} className="space-y-6 py-4">
          {isGlobalMode && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Affiliated Institution</label>
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
              <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Roll ID (Unique)</label>
              <input
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                className="input-premium w-full font-mono font-bold"
                placeholder="PUC-24-001"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Academic Cohort</label>
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="input-premium w-full" required>
                <option value="">Select Batch…</option>
                {modalBatches?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Legal Student Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-premium w-full"
              placeholder="e.g. Bhuvan N"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Date of Birth</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="input-premium w-full pl-12" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Exam Wing (Optional)</label>
            <select
              value={examWing}
              onChange={(e) => setExamWing(e.target.value as any)}
              className="input-premium w-full"
            >
              <option value="">No Special Wing</option>
              <option value="NEET">NEET Wing</option>
              <option value="KCET">KCET Wing</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-academic-navy transition-colors">Discard</button>
            <button type="submit" disabled={create.isPending} className="btn-premium btn-primary px-10">
              {create.isPending ? 'Validating...' : 'Confirm Registration'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <Modal open={importOpen} onClose={() => { setImportOpen(false); setParsedRows([]); }} title="Collective Onboarding" size="xl">
        <div className="space-y-8 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 bg-academic-blue/[0.03] p-10 rounded-2xl border border-academic-blue/10 shadow-inner">
            <div className="space-y-3 text-center md:text-left">
              <p className="text-2xl font-bold text-academic-navy leading-tight">Data Ingestion Engine</p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {['roll_number', 'full_name', 'date_of_birth'].map(col => (
                  <span key={col} className="px-2 py-0.5 rounded bg-academic-navy/5 text-[10px] font-bold uppercase tracking-wider text-academic-navy/60 border border-academic-navy/5">{col}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={downloadStudentTemplate} className="btn-premium btn-secondary px-6">
                <Download className="h-4 w-4 mr-2" /> Template
              </button>
              <label className="btn-premium btn-primary px-8 cursor-pointer">
                <Upload className="h-4 w-4 mr-2" /> Ingest CSV
                <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Target Academic Cohort</label>
            <select value={importBatchId} onChange={(e) => setImportBatchId(e.target.value)} className="input-premium w-full">
              <option value="">Select destination batch…</option>
              {batches?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {parsedRows.length > 0 && (
            <div className="glass-card overflow-hidden border-academic-navy/5 shadow-inner p-0">
              <div className="px-8 py-5 bg-academic-navy/[0.03] border-b border-academic-navy/5 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-academic-navy/60">Payload Preview</span>
                <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold uppercase text-[9px] px-3">{validRows.length} Rows Verified</Badge>
              </div>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead className="bg-academic-navy/[0.01] sticky top-0">
                    <tr>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-navy/40">Student ID</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-navy/40">Full Identity</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-navy/40 text-right">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-academic-navy/5">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className={r.__error ? 'bg-red-50/50' : 'hover:bg-academic-navy/[0.01]'}>
                        <td className="px-8 py-4 font-mono font-bold text-[11px] text-muted-foreground">{r.roll_number}</td>
                        <td className="px-8 py-4 text-sm font-bold text-academic-navy">{r.full_name}</td>
                        <td className="px-8 py-4 text-right">
                          {r.__error 
                            ? <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{r.__error}</span> 
                            : <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Verified</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-6">
            <button type="button" onClick={() => { setImportOpen(false); setParsedRows([]); }} className="px-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-academic-navy transition-colors">Discard</button>
            <button onClick={handleUpload} disabled={uploading || !importBatchId || validRows.length === 0} className="btn-premium btn-primary px-10">
              {uploading ? 'Processing Transaction...' : `Finalize Ingest (${validRows.length} Records)`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
