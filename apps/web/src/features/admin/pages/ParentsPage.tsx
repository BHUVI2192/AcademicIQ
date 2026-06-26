import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { Plus, Users, ShieldCheck, ShieldOff, Trash2, Folder, ChevronLeft, GraduationCap, Phone, RefreshCcw, Edit2 } from 'lucide-react';
import {
  useParentsList,
  useParentStudentMappings,
  useLinkParentStudent,
  useToggleMappingVerified,
  useUnlinkParentStudent,
  useCreateParent,
  useUpdateParent,
} from '@/hooks/useParents';
import { useColleges } from '@/hooks/useColleges';
import { useStudents } from '@/hooks/useStudents';
import { useBatches } from '@/hooks/useBatches';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { isPhone, normalizePhone } from '@/lib/validators';
import type { Profile } from '@shared';

import { useDirectory } from '@/context/DirectoryContext';

export function ParentsPage() {
  const { selectedCollegeId, isGlobalMode } = useDirectory();
  const location = useLocation();
  const effectiveCollegeId = selectedCollegeId;

  // Create Parent Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [targetCollegeId, setTargetCollegeId] = useState<string>('');
  const [initialBatchId, setInitialBatchId] = useState('');
  const [initialRollNumber, setInitialRollNumber] = useState('');
  const [initialRelationship, setInitialRelationship] = useState('guardian');
  const [creating, setCreating] = useState(false);
  const [batchFilter, setBatchFilter] = useState('');

  // Edit parent state
  const [editOpen, setEditOpen] = useState(false);
  const [editParentId, setEditParentId] = useState('');
  const [editMappingId, setEditMappingId] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRelationship, setEditRelationship] = useState('guardian');
  const [editSaving, setEditSaving] = useState(false);

  const queryClient = useQueryClient();
  const { data: colleges } = useColleges();
  const lookupCollegeId = targetCollegeId || effectiveCollegeId || undefined;
  
  const { data: parents, isLoading, refetch: refetchParents } = useParentsList(lookupCollegeId);
  const { data: mappings, refetch: refetchMappings } = useParentStudentMappings(undefined, lookupCollegeId);
  const { data: students, refetch: refetchStudents } = useStudents({ collegeId: lookupCollegeId });
  const { data: batches } = useBatches(lookupCollegeId);
  const link = useLinkParentStudent();
  const updateParent = useUpdateParent();
  const create = useCreateParent();
  const toggle = useToggleMappingVerified();
  const unlink = useUnlinkParentStudent();

  useEffect(() => {
    if (createOpen && selectedCollegeId) {
      setTargetCollegeId(selectedCollegeId);
    }
  }, [createOpen, selectedCollegeId]);

  useEffect(() => {
    if (location.state?.rollNumber) {
      setInitialRollNumber(location.state.rollNumber);
      if (location.state.batchId) {
        setInitialBatchId(location.state.batchId);
        setBatchFilter(location.state.batchId);
      }
      setCreateOpen(true);
      // Clear state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleRefresh = () => {
    refetchParents();
    refetchMappings();
    refetchStudents();
    toast.success('Data refreshed');
  };

  const resetForm = () => {
    setPhone('');
    setEmail('');
    setFullName('');
    setInitialRollNumber('');
    setInitialBatchId('');
    setInitialRelationship('guardian');
    setCreateOpen(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCollegeId) { toast.error('Please select a college'); return; }
    if (!phone) { toast.error('Phone number is required for parent accounts'); return; }
    if (!isPhone(phone)) { toast.error('Enter a valid phone number (e.g. +919876543210)'); return; }
    if (!fullName.trim()) { toast.error('Enter the parent\'s full name'); return; }

    let targetStudentId: string | undefined;
    if (initialRollNumber.trim()) {
      const student = students?.find(s =>
        s.roll_number.toUpperCase() === initialRollNumber.trim().toUpperCase() &&
        (initialBatchId ? s.batch_id === initialBatchId : true)
      );
      if (!student) {
        toast.error(`Student with Roll No. "${initialRollNumber}" not found${initialBatchId ? ' in selected batch' : ''}.`);
        return;
      }
      targetStudentId = student.id;
    }

    setCreating(true);
    try {
      await create.mutateAsync({
        college_id: targetCollegeId,
        full_name: fullName.trim(),
        phone: normalizePhone(phone),
        email: email.trim() || undefined,
        student_id: targetStudentId,
        relationship: initialRelationship,
      });

      toast.success(
        targetStudentId
          ? '✅ Parent account created & linked to student!'
          : '✅ Parent account created successfully.'
      );
      resetForm();
      // Force immediate refetch of mappings to update UI
      refetchMappings();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create parent');
    } finally {
      setCreating(false);
    }
  };

  const openEditParent = (m: any) => {
    setEditParentId(m.parent?.id ?? m.parent_id);
    setEditMappingId(m.id);
    setEditName(m.parent?.full_name ?? '');
    setEditEmail(m.parent?.email ?? '');
    setEditPhone(m.parent?.phone ?? '');
    setEditRelationship(m.relationship ?? 'guardian');
    setEditOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) { toast.error('Name is required'); return; }
    setEditSaving(true);
    try {
      await updateParent.mutateAsync({
        parentId: editParentId,
        full_name: editName,
        email: editEmail || undefined,
        phone: editPhone || undefined,
        mappingId: editMappingId,
        relationship: editRelationship,
      });
      toast.success('Parent details updated successfully');
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update parent');
    } finally {
      setEditSaving(false);
    }
  };

  const filteredStudents = (students ?? []).filter(s => batchFilter ? s.batch_id === batchFilter : false);

  const openCreateForStudent = (student: any) => {
    setTargetCollegeId(effectiveCollegeId || '');
    setInitialBatchId(student.batch_id);
    setInitialRollNumber(student.roll_number);
    setCreateOpen(true);
  };

  const selectedStudent = students?.find(s =>
    s.roll_number.toUpperCase() === initialRollNumber.trim().toUpperCase() &&
    (initialBatchId ? s.batch_id === initialBatchId : true)
  );

  // Build parent-student mapping lookup for the table
  const studentMappingMap = new Map<string, any[]>();
  (mappings ?? []).forEach((m) => {
    const sid = m.student_id;
    if (!studentMappingMap.has(sid)) studentMappingMap.set(sid, []);
    studentMappingMap.get(sid)!.push(m);
  });

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-academic-yellow/10 border border-academic-yellow/20">
            <Users className="h-3.5 w-3.5 text-academic-yellow" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-academic-yellow">
              Family Relations
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-5xl font-bold tracking-tight text-academic-navy leading-tight">Parent Registry</h1>
            <p className="max-w-xl text-lg text-muted-foreground font-medium leading-relaxed">
              Manage parent accounts and their academic relationships with students across institutional batches.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh} 
            className="p-3 text-academic-navy/40 hover:text-academic-navy hover:bg-academic-navy/5 rounded-xl transition-all border border-academic-navy/5 shadow-sm" 
            title="Refresh Registry"
          >
            <RefreshCcw className="h-5 w-5" />
          </button>
          {batchFilter && (
            <button 
              onClick={() => setBatchFilter('')} 
              className="px-6 py-3 text-sm font-bold text-academic-navy/60 hover:text-academic-navy transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" /> All Batches
            </button>
          )}
          <button
            onClick={() => {
              setInitialBatchId('');
              setInitialRollNumber('');
              setCreateOpen(true);
            }}
            className="btn-premium btn-primary px-8 shadow-xl shadow-academic-blue/20"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Parent
          </button>
        </div>
      </div>

      {/* Batch Folder Grid */}
      {!batchFilter ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {(batches ?? []).map((b) => {
            const studentCount = (students ?? []).filter(s => s.batch_id === b.id).length;
            const linkedCount = (students ?? []).filter(s =>
              s.batch_id === b.id && (studentMappingMap.get(s.id)?.length ?? 0) > 0
            ).length;
            return (
              <button
                key={b.id}
                onClick={() => setBatchFilter(b.id)}
                className="glass-card group p-8 flex flex-col items-start gap-6 border-none shadow-xl shadow-academic-navy/5 hover:translate-y-[-4px] transition-all text-left"
              >
                <div className="h-14 w-14 rounded-2xl bg-academic-yellow/10 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <Folder className="h-7 w-7 text-academic-yellow fill-academic-yellow/20" />
                </div>
                <div className="space-y-4 w-full">
                  <div>
                    <h3 className="text-xl font-bold text-academic-navy group-hover:text-academic-yellow transition-colors">{b.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-academic-navy/[0.03] text-academic-navy/40 border-none font-bold uppercase text-[9px] px-2 py-0.5">
                        Batch Folder
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-academic-navy/5">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-academic-navy/30">Total Students</p>
                      <p className="text-sm font-bold text-academic-navy/60">{studentCount}</p>
                    </div>
                    {linkedCount > 0 && (
                      <div className="text-right space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/50">Linked</p>
                        <p className="text-sm font-bold text-emerald-600">{linkedCount}</p>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {batches?.length === 0 && (
            <div className="col-span-full">
              <EmptyState 
                icon={Folder} 
                title="No active batches found" 
                description="Initialize your first academic cohort to start organizing parent-student relationships." 
              />
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card overflow-hidden border-none shadow-2xl shadow-academic-navy/5 p-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {isLoading ? (
            <div className="p-12"><TableSkeleton rows={6} cols={4} /></div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-24">
              <EmptyState icon={Users} title="Empty batch registry" description="No students have been added to this batch yet." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead className="bg-academic-navy/[0.03]">
                  <tr>
                    <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Institutional ID</span>
                    </th>
                    <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Student Name</span>
                    </th>
                    <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Associated Guardians</span>
                    </th>
                    <th className="px-8 py-6 text-right border-b border-academic-navy/5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-academic-navy/5">
                  {filteredStudents.map((s) => {
                    const studentMappings = studentMappingMap.get(s.id) ?? [];
                    return (
                      <tr key={s.id} className="group hover:bg-academic-navy/[0.01] transition-colors">
                        <td className="px-8 py-6">
                          <span className="inline-flex items-center px-2 py-1 rounded bg-academic-navy/[0.03] font-mono text-[11px] font-bold text-academic-navy/60 border border-academic-navy/5">
                            {s.roll_number}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="font-bold text-academic-navy text-lg group-hover:text-academic-yellow transition-colors">
                            {s.full_name}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          {studentMappings.length === 0 ? (
                            <span className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/20">No active links</span>
                          ) : (
                            <div className="flex flex-wrap gap-3">
                              {studentMappings.map((m: any) => (
                                <div
                                  key={m.id}
                                  className="flex items-center gap-3 rounded-xl border border-academic-navy/5 bg-white px-3 py-2 shadow-sm transition-all hover:border-academic-yellow/30"
                                >
                                  <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-academic-navy">{m.parent?.full_name}</div>
                                    <div className="text-[10px] font-bold text-academic-navy/40 font-mono">{m.parent?.phone}</div>
                                  </div>
                                  
                                  <div className="h-4 w-px bg-academic-navy/5" />
                                  
                                  <div className="flex items-center gap-1.5">
                                    {m.is_verified ? (
                                      <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold uppercase text-[8px] px-2">Verified</Badge>
                                    ) : (
                                      <Badge className="bg-amber-100 text-amber-700 border-none font-bold uppercase text-[8px] px-2">Pending</Badge>
                                    )}
                                    
                                    <button
                                      onClick={() => openEditParent(m)}
                                      className="p-1.5 text-academic-blue/40 hover:text-academic-blue hover:bg-academic-blue/10 rounded-lg transition-all"
                                      title="Edit parent details"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        toggle.mutate(
                                          { id: m.id, is_verified: !m.is_verified },
                                          { onSuccess: () => toast.success('Registry Updated') }
                                        )
                                      }
                                      className="p-1.5 text-academic-navy/20 hover:text-academic-navy hover:bg-academic-navy/5 rounded-lg transition-all"
                                    >
                                      {m.is_verified ? <ShieldOff className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                                    </button>
                                    <button
                                      onClick={() =>
                                        unlink.mutate(m.id, {
                                          onSuccess: () => toast.success('Association Terminated'),
                                        })
                                      }
                                      className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button
                            onClick={() => openCreateForStudent(s)}
                            className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-academic-blue hover:bg-academic-blue/5 rounded-lg transition-colors border border-academic-blue/10"
                          >
                            <Plus className="h-3.5 w-3.5 inline mr-1.5" /> Link Parent
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create/Add Parent Modal */}
      <Modal
        open={createOpen}
        onClose={resetForm}
        title="Family Account Registration"
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-6 py-4">
          {/* Selected student preview */}
          {selectedStudent && (
            <div className="bg-academic-navy/[0.02] border border-academic-navy/5 p-5 rounded-2xl flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-academic-blue/10 flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 text-academic-blue" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-academic-navy/30">Linking Account To</p>
                <p className="text-base font-bold text-academic-navy">
                  {selectedStudent.full_name} <span className="text-academic-navy/40 font-mono text-sm ml-2">[{selectedStudent.roll_number}]</span>
                </p>
              </div>
            </div>
          )}

          {/* Temp password info */}
          <div className="rounded-xl bg-academic-yellow/10 border border-academic-yellow/20 p-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-academic-yellow/20 flex items-center justify-center shrink-0">
              <RefreshCcw className="h-4 w-4 text-academic-yellow" />
            </div>
            <p className="text-xs font-bold text-academic-yellow-dark">
              Initial platform access key: <code className="font-mono bg-white/50 px-2 py-0.5 rounded ml-1">Parent@123</code>
            </p>
          </div>

          {isGlobalMode && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Academic Institution</label>
              <select
                value={targetCollegeId}
                onChange={(e) => setTargetCollegeId(e.target.value)}
                className="input-premium w-full"
                required
              >
                <option value="">Select Institution...</option>
                {colleges?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Legal Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-premium w-full"
              placeholder="e.g. Robert Smith"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-academic-navy/30" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-premium w-full pl-11"
                  placeholder="+91 00000 00000"
                  required
                />
              </div>
              <p className="text-[10px] font-bold text-academic-navy/30 uppercase tracking-tight ml-1">Includes primary login access</p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Recovery Email <span className="opacity-40 font-normal ml-1">(Optional)</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-premium w-full"
                placeholder="parent@domain.com"
              />
            </div>
          </div>

          {/* Student Linking Section */}
          <div className="pt-6 border-t border-academic-navy/5">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-academic-blue" />
              <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-academic-navy">Relationship Mapping</h4>
            </div>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-academic-navy/40 ml-1">Class / Section</label>
                <select
                  value={initialBatchId}
                  onChange={(e) => {
                    setInitialBatchId(e.target.value);
                    setInitialRollNumber('');
                  }}
                  className="input-premium w-full text-xs"
                >
                  <option value="">Global Search...</option>
                  {batches?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-academic-navy/40 ml-1">Student Roll No.</label>
                <input
                  list="students-list-modal"
                  value={initialRollNumber}
                  onChange={(e) => setInitialRollNumber(e.target.value.toUpperCase())}
                  className="input-premium w-full font-mono font-bold text-xs"
                  placeholder="ID Lookup..."
                />
                <datalist id="students-list-modal">
                  {students
                    ?.filter(s => initialBatchId ? s.batch_id === initialBatchId : true)
                    .map(s => (
                      <option key={s.id} value={s.roll_number}>{s.full_name}</option>
                    ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-academic-navy/40 ml-1">Relationship</label>
                <select
                  value={initialRelationship}
                  onChange={(e) => setInitialRelationship(e.target.value)}
                  className="input-premium w-full text-xs font-bold"
                >
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="guardian">Guardian</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <button type="button" onClick={resetForm} className="px-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-academic-navy transition-colors">Discard</button>
            <button type="submit" disabled={creating} className="btn-premium btn-primary px-10">
              {creating ? 'Processing...' : 'Confirm Registration'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Parent Modal ── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Parent Details" size="sm">
        <form onSubmit={handleEditSave} className="space-y-5 py-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Full Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
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
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="input-premium w-full"
              placeholder="parent@domain.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Relationship</label>
            <select
              value={editRelationship}
              onChange={(e) => setEditRelationship(e.target.value)}
              className="input-premium w-full font-bold"
            >
              <option value="father">Father</option>
              <option value="mother">Mother</option>
              <option value="guardian">Guardian</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">
              Mobile Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-academic-navy/30" />
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="input-premium w-full pl-11"
                placeholder="+91 00000 00000"
              />
            </div>
            <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-tight ml-1">⚠ Changing phone updates the login credential</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="px-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-academic-navy transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSaving}
              className="btn-premium btn-primary px-10"
            >
              {editSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
