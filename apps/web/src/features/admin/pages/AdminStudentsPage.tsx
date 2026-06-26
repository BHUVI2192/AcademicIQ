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
import { useCreateParent, useUpdateParent } from '@/hooks/useParents';
import { useBatches } from '@/hooks/useBatches';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { isRollNumber, isDateIso, isPhone, normalizePhone } from '@/lib/validators';
import { parseStudentsCsv, downloadStudentTemplate } from '@/lib/csvParser';
import { parseStudentsExcel } from '@/lib/excelParser';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { useColleges } from '@/hooks/useColleges';

interface ParsedRow {
  roll_number: string;
  full_name: string;
  date_of_birth?: string;
  exam_wing?: string | null;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  parent_relationship?: string;
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
  const updateParent = useUpdateParent();

  const [createOpen, setCreateOpen] = useState(false);
  const [rollNumber, setRollNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [examWing, setExamWing] = useState<'NEET' | 'KCET' | ''>('');
  const [targetCollegeId, setTargetCollegeId] = useState<string>('');
  const [batchId, setBatchId] = useState('');

  const [parentPhone, setParentPhone] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentRelationship, setParentRelationship] = useState('Parent');

  const createParent = useCreateParent();

  const { data: colleges } = useColleges();
  const { data: modalBatches } = useBatches(targetCollegeId || selectedCollegeId || undefined);

  const [importOpen, setImportOpen] = useState(false);
  const [importBatchId, setImportBatchId] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);

  // Edit parent state
  const [editParentOpen, setEditParentOpen] = useState(false);
  const [editParentId, setEditParentId] = useState('');
  const [editMappingId, setEditMappingId] = useState('');
  const [editParentName, setEditParentName] = useState('');
  const [editParentEmail, setEditParentEmail] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [editParentRelationship, setEditParentRelationship] = useState('guardian');
  const [editParentSaving, setEditParentSaving] = useState(false);

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

    if (!parentName.trim()) {
      toast.error('Parent name is required');
      return;
    }
    if (!parentPhone.trim()) {
      toast.error('Parent phone is required');
      return;
    }
    if (!isPhone(parentPhone)) {
      toast.error('Enter a valid phone number (e.g. +919876543210)');
      return;
    }

    try {
      const student = await create.mutateAsync({
        college_id: collegeId,
        batch_id: batchId,
        roll_number: rollNumber.toUpperCase(),
        full_name: fullName.trim(),
        date_of_birth: dob || undefined,
        exam_wing: examWing || undefined,
      });

      await createParent.mutateAsync({
        phone: normalizePhone(parentPhone),
        full_name: parentName.trim(),
        email: parentEmail.trim() || undefined,
        college_id: collegeId,
        student_id: student.id,
        relationship: parentRelationship,
      });
      toast.success('Student and Parent registered successfully (Parent auto-verified)');

      setCreateOpen(false);
      setRollNumber('');
      setFullName('');
      setDob('');
      setBatchId('');
      setExamWing('');
      setParentPhone('');
      setParentName('');
      setParentEmail('');
      setParentRelationship('Parent');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to register student');
    }
  };

  const handleFile = async (file: File) => {
    try {
      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
      const rows = isExcel ? await parseStudentsExcel(file) : await parseStudentsCsv(file);
      const seen = new Set<string>();
      const parsed: ParsedRow[] = rows.map((r) => {
        const errors: string[] = [];
        if (!r.roll_number || !isRollNumber(r.roll_number)) errors.push('Invalid Roll Number');
        if (!r.full_name?.trim()) errors.push('Name required');
        if (r.date_of_birth && !isDateIso(r.date_of_birth)) errors.push('Bad DOB');
        
        if (!r.parent_name?.trim()) errors.push('Parent name required');
        if (!r.parent_phone) {
          errors.push('Parent phone required');
        } else if (r.parent_phone.replace(/[^0-9]/g, '').length < 10) {
          errors.push('Parent phone must be >= 10 digits');
        }

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
            parent_name: r.parent_name ?? null,
            parent_phone: r.parent_phone ?? null,
            parent_email: r.parent_email ?? null,
            parent_relationship: r.parent_relationship ?? null,
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

  const openEditParent = (mapping: any) => {
    setEditParentId(mapping.parent?.id ?? mapping.parent_id ?? '');
    setEditMappingId(mapping.id);
    setEditParentName(mapping.parent?.full_name ?? '');
    setEditParentEmail(mapping.parent?.email ?? '');
    setEditParentPhone(mapping.parent?.phone ?? '');
    setEditParentRelationship(mapping.relationship ?? 'guardian');
    setEditParentOpen(true);
  };

  const handleEditParentSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editParentName.trim()) { toast.error('Name is required'); return; }
    setEditParentSaving(true);
    try {
      await updateParent.mutateAsync({
        parentId: editParentId,
        full_name: editParentName,
        email: editParentEmail || undefined,
        phone: editParentPhone || undefined,
        mappingId: editMappingId,
        relationship: editParentRelationship,
      });
      toast.success('Parent details updated');
      setEditParentOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update parent');
    } finally {
      setEditParentSaving(false);
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
                                  <button
                                    onClick={() => openEditParent(m)}
                                    className="p-0.5 rounded text-academic-blue/60 hover:text-academic-blue hover:bg-academic-blue/10 transition-all ml-1"
                                    title="Edit parent details"
                                  >
                                    <Edit2 className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              ))
                            ) : (
                              <span className="text-[10px] font-bold text-red-500 italic">No Parent Linked</span>
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
                          <div className="flex justify-end gap-2 transition-all">
                            <button onClick={() => handleDelete(s.id)} className="p-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-100" title="Delete Student">
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

          {/* Parent Details Section */}
          <div className="pt-6 border-t border-academic-navy/5 space-y-4">
            <div className="inline-flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-academic-yellow" />
              <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-academic-navy">Guardian Details</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Guardian Name</label>
                <input
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="input-premium w-full"
                  placeholder="e.g. Robert Smith"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Guardian Phone</label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  className="input-premium w-full"
                  placeholder="+91 98765 43210"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Guardian Email</label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  className="input-premium w-full"
                  placeholder="parent@domain.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Relationship</label>
                <select
                  value={parentRelationship}
                  onChange={(e) => setParentRelationship(e.target.value)}
                  className="input-premium w-full"
                >
                  <option value="Parent">Parent</option>
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="guardian">Guardian</option>
                </select>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 italic">
              * Note: Registering a student will automatically create a verified parent account with default password Parent@123.
            </p>
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
                {[
                  { label: 'roll_number', req: true },
                  { label: 'full_name', req: true },
                  { label: 'date_of_birth', req: false },
                  { label: 'exam_wing', req: false },
                  { label: 'parent_name', req: true },
                  { label: 'parent_phone', req: true },
                  { label: 'parent_email', req: false },
                  { label: 'parent_relationship', req: false }
                ].map(col => (
                  <span 
                    key={col.label} 
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                      col.req 
                        ? "bg-academic-blue/5 text-academic-blue border-academic-blue/20" 
                        : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800"
                    }`}
                  >
                    {col.label}{col.req ? '' : ' (opt)'}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={downloadStudentTemplate} className="btn-premium btn-secondary px-6">
                <Download className="h-4 w-4 mr-2" /> Template
              </button>
              <label className="btn-premium btn-primary px-8 cursor-pointer">
                <Upload className="h-4 w-4 mr-2" /> Ingest CSV/Excel
                <input type="file" accept=".csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
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
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-navy/40">Student Details</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-navy/40">Guardian Details</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-academic-navy/40 text-right">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-academic-navy/5">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className={r.__error ? 'bg-red-50/50' : 'hover:bg-academic-navy/[0.01]'}>
                        <td className="px-8 py-4 font-mono font-bold text-[11px] text-muted-foreground">{r.roll_number}</td>
                        <td className="px-8 py-4">
                          <div className="font-bold text-academic-navy text-sm">{r.full_name}</div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {r.date_of_birth && <span className="text-[10px] text-muted-foreground">DOB: {r.date_of_birth}</span>}
                            {r.exam_wing && (
                              <span className="px-1.5 py-0.5 rounded bg-academic-blue/10 text-academic-blue text-[9px] font-bold uppercase border border-academic-blue/20">
                                {r.exam_wing}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          {r.parent_phone ? (
                            <div className="space-y-0.5">
                              <div className="font-bold text-academic-navy text-xs">{r.parent_name} ({r.parent_relationship || 'Parent'})</div>
                              <div className="text-[10px] text-muted-foreground font-medium">{r.parent_phone}</div>
                              {r.parent_email && <div className="text-[10px] text-muted-foreground/60">{r.parent_email}</div>}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40 italic">None</span>
                          )}
                        </td>
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

      {/* ── Edit Parent Modal ── */}
      <Modal open={editParentOpen} onClose={() => setEditParentOpen(false)} title="Edit Parent Details" size="sm">
        <form onSubmit={handleEditParentSave} className="space-y-5 py-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Full Name</label>
            <input
              value={editParentName}
              onChange={(e) => setEditParentName(e.target.value)}
              className="input-premium w-full"
              placeholder="e.g. Robert Smith"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">
              Recovery Email <span className="opacity-40 font-normal ml-1">(Optional)</span>
            </label>
            <input
              type="email"
              value={editParentEmail}
              onChange={(e) => setEditParentEmail(e.target.value)}
              className="input-premium w-full"
              placeholder="parent@domain.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Relationship</label>
            <select
              value={editParentRelationship}
              onChange={(e) => setEditParentRelationship(e.target.value)}
              className="input-premium w-full font-bold"
            >
              <option value="father">Father</option>
              <option value="mother">Mother</option>
              <option value="guardian">Guardian</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">
              Mobile Number <span className="opacity-40 font-normal ml-1">(Login Credential)</span>
            </label>
            <input
              type="tel"
              value={editParentPhone}
              onChange={(e) => setEditParentPhone(e.target.value)}
              className="input-premium w-full"
              placeholder="+91 00000 00000"
            />
            <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-tight ml-1">⚠ Changing phone updates the login credential</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditParentOpen(false)}
              className="px-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-academic-navy transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editParentSaving}
              className="btn-premium btn-primary px-10"
            >
              {editParentSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
