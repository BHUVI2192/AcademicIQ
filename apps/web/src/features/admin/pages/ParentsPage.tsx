import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { Plus, Users, ShieldCheck, ShieldOff, Trash2, Folder, ChevronLeft, GraduationCap, Phone, RefreshCcw } from 'lucide-react';
import {
  useParentsList,
  useParentStudentMappings,
  useLinkParentStudent,
  useToggleMappingVerified,
  useUnlinkParentStudent,
  useCreateParent,
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

  const queryClient = useQueryClient();
  const { data: colleges } = useColleges();
  const lookupCollegeId = targetCollegeId || effectiveCollegeId || undefined;
  
  const { data: parents, isLoading, refetch: refetchParents } = useParentsList(lookupCollegeId);
  const { data: mappings, refetch: refetchMappings } = useParentStudentMappings(undefined, lookupCollegeId);
  const { data: students, refetch: refetchStudents } = useStudents({ collegeId: lookupCollegeId });
  const { data: batches } = useBatches(lookupCollegeId);
  const link = useLinkParentStudent();
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-slate-900 dark:text-slate-100">Parents & Mapping</h1>
          <p className="text-sm text-slate-500">Manage parent accounts organized by batch</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} className="btn btn-ghost inline-flex items-center gap-2" title="Refresh Data">
            <RefreshCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {batchFilter && (
            <button onClick={() => setBatchFilter('')} className="btn btn-ghost inline-flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Back to Batches
            </button>
          )}
          <button
            onClick={() => {
              setInitialBatchId('');
              setInitialRollNumber('');
              setCreateOpen(true);
            }}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Parent
          </button>
        </div>
      </div>

      {/* Batch Folder Grid */}
      {!batchFilter ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(batches ?? []).map((b) => {
            const studentCount = (students ?? []).filter(s => s.batch_id === b.id).length;
            const linkedCount = (students ?? []).filter(s =>
              s.batch_id === b.id && (studentMappingMap.get(s.id)?.length ?? 0) > 0
            ).length;
            return (
              <button
                key={b.id}
                onClick={() => setBatchFilter(b.id)}
                className="card p-4 flex flex-col items-center justify-center gap-3 hover:border-slate-900 transition-all text-center group"
              >
                <div className="p-3 bg-slate-50 dark:bg-slate-900/20 rounded-md group-hover:scale-110 transition-transform">
                  <Folder className="h-8 w-8 text-slate-900 dark:text-white fill-slate-100 dark:fill-slate-900/40" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-slate-100">{b.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{studentCount} students</p>
                  {linkedCount > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">{linkedCount} linked</p>
                  )}
                </div>
              </button>
            );
          })}
          {batches?.length === 0 && (
            <div className="col-span-full">
              <EmptyState icon={Folder} title="No Batches Found" description="Create a batch first to organize students and parents." />
            </div>
          )}
        </div>
      ) : (
        <div className="card p-0">
          {isLoading ? (
            <div className="p-6"><TableSkeleton rows={4} cols={4} /></div>
          ) : filteredStudents.length === 0 ? (
            <EmptyState icon={Users} title="No students found in this batch" />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Roll No.</th>
                    <th>Student Name</th>
                    <th>Linked Parents</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s) => {
                    // Use mappings from real-time data, not cached student join
                    const studentMappings = studentMappingMap.get(s.id) ?? [];
                    return (
                      <tr key={s.id}>
                        <td className="font-mono text-xs">{s.roll_number}</td>
                        <td className="font-medium">{s.full_name}</td>
                        <td>
                          {studentMappings.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">Not linked</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {studentMappings.map((m: any) => (
                                <div
                                  key={m.id}
                                  className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700"
                                >
                                  <span className="font-medium">{m.parent?.full_name}</span>
                                  {m.parent?.phone && (
                                    <span className="text-slate-400 font-mono">{m.parent.phone}</span>
                                  )}
                                  {m.is_verified ? (
                                    <Badge variant="success">Verified</Badge>
                                  ) : (
                                    <Badge variant="warning">Pending</Badge>
                                  )}
                                  <button
                                    onClick={() =>
                                      toggle.mutate(
                                        { id: m.id, is_verified: !m.is_verified },
                                        { onSuccess: () => toast.success('Updated') }
                                      )
                                    }
                                    title={m.is_verified ? 'Unverify' : 'Verify'}
                                    className="text-slate-400 hover:text-slate-700"
                                  >
                                    {m.is_verified ? (
                                      <ShieldOff className="h-3 w-3" />
                                    ) : (
                                      <ShieldCheck className="h-3 w-3" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() =>
                                      unlink.mutate(m.id, {
                                        onSuccess: () => toast.success('Unlinked'),
                                      })
                                    }
                                    title="Unlink"
                                    className="text-slate-400 hover:text-red-600"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => openCreateForStudent(s)}
                            className="btn btn-ghost inline-flex items-center gap-1 text-xs"
                          >
                            <Plus className="h-3 w-3" /> Add Parent
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
        title="Add Parent Account"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Selected student preview */}
          {selectedStudent && (
            <div className="bg-slate-50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-900/30 p-3 rounded-lg flex items-center gap-3">
              <div className="bg-slate-100 dark:bg-slate-900/40 p-2 rounded-md">
                <GraduationCap className="h-4 w-4 text-slate-900 dark:text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 font-medium">Linking parent to student</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {selectedStudent.full_name} ({selectedStudent.roll_number})
                </p>
              </div>
            </div>
          )}

          {/* Temp password info */}
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
            The parent will receive a temporary password: <code className="font-mono font-medium">Parent@123</code>
          </div>

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
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input"
              placeholder="Parent's full name"
              required
            />
          </div>

          {/* Phone — REQUIRED */}
          <div>
            <label className="label">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input pl-10"
                placeholder="+919876543210"
                required
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Used for login. Include country code (+91).</p>
          </div>

          {/* Email — optional, for forgot password */}
          <div>
            <label className="label">Email <span className="text-xs font-normal text-slate-400">(optional, for password reset)</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="parent@example.com"
            />
          </div>

          {/* Student Linking Section */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-medium mb-2">Link to Student</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label">Batch / Section</label>
                <select
                  value={initialBatchId}
                  onChange={(e) => {
                    setInitialBatchId(e.target.value);
                    setInitialRollNumber('');
                  }}
                  className="input"
                >
                  <option value="">Any Batch...</option>
                  {batches?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Student Roll No.</label>
                <input
                  list="students-list-modal"
                  value={initialRollNumber}
                  onChange={(e) => setInitialRollNumber(e.target.value.toUpperCase())}
                  className="input font-mono"
                  placeholder="Search..."
                />
                <datalist id="students-list-modal">
                  {students
                    ?.filter(s => initialBatchId ? s.batch_id === initialBatchId : true)
                    .map(s => (
                      <option key={s.id} value={s.roll_number}>{s.full_name}</option>
                    ))}
                </datalist>
              </div>
              <div>
                <label className="label">Relationship</label>
                <select
                  value={initialRelationship}
                  onChange={(e) => setInitialRelationship(e.target.value)}
                  className="input"
                >
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="guardian">Guardian</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={creating} className="btn btn-primary">
              {creating ? 'Creating...' : 'Create & Link'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
