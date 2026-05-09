import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, UserCog, ShieldOff, ShieldCheck, Mail, Key, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDirectory } from '@/context/DirectoryContext';
import {
  useFacultyList,
  useFacultyAssignments,
  useAssignFacultyToBatch,
  useRemoveFacultyFromBatch,
  useToggleFacultyActive,
  useCreateFaculty,
  useDeleteFaculty,
} from '@/hooks/useFaculty';
import { useBatches } from '@/hooks/useBatches';
import { useColleges } from '@/hooks/useColleges';

import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { isEmail } from '@/lib/validators';
import { useQueryClient } from '@tanstack/react-query';
import type { Profile } from '@shared';

export function FacultyPage() {
  const { role } = useAuth();
  const { selectedCollegeId, selectedCollege, isGlobalMode } = useDirectory();
  const effectiveCollegeId = selectedCollegeId;

  const { data: faculty, isLoading } = useFacultyList(effectiveCollegeId);
  const { data: colleges } = useColleges();
  const [targetCollegeId, setTargetCollegeId] = useState<string>('');
  const { data: batches } = useBatches(targetCollegeId || effectiveCollegeId);
  const create = useCreateFaculty();
  const queryClient = useQueryClient();
  const toggleActive = useToggleFacultyActive(effectiveCollegeId);

  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [creating, setCreating] = useState(false);

  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);

  const [createdCredentials, setCreatedCredentials] = useState<{email: string, pass: string} | null>(null);

  const [assignFor, setAssignFor] = useState<Profile | null>(null);
  const { data: assignments } = useFacultyAssignments(assignFor?.id);
  const assignMut = useAssignFacultyToBatch();
  const removeMut = useRemoveFacultyFromBatch();
  const deleteMut = useDeleteFaculty();

  useEffect(() => {
    if (createOpen) {
      setTargetCollegeId(selectedCollegeId || '');
    } else if (!assignFor) {
      setTargetCollegeId('');
    }
  }, [createOpen, selectedCollegeId, assignFor]);

  useEffect(() => {
    if (assignFor) {
      setTargetCollegeId(assignFor.college_id || '');
    }
  }, [assignFor]);

  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Profile | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCollegeId) {
      toast.error('Please select a college/school');
      return;
    }
    if (!isEmail(email) || !fullName.trim()) {
      toast.error('Enter a valid email and name');
      return;
    }
    setCreating(true);
    setCreatedCredentials(null);
    try {
      const res = await create.mutateAsync({
        college_id: targetCollegeId,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
      });
      
      if (res.email_sent) {
        toast.success('Faculty created & email sent successfully');
        setCreateOpen(false);
      } else {
        toast.success('Faculty created (Email skipped)');
        if (res.temp_password) {
          setCreatedCredentials({ email: email.trim().toLowerCase(), pass: res.temp_password });
        } else {
          setCreateOpen(false);
        }
      }
      
      setEmail('');
      setFullName('');
      
      // 2. Assign to batches if selected
      if (selectedBatchIds.length > 0 && res.faculty_id) {
        for (const batchId of selectedBatchIds) {
          try {
            await assignMut.mutateAsync({
              faculty_id: res.faculty_id,
              batch_id: batchId,
            });
          } catch (assignErr) {
            console.error(`Failed to assign batch ${batchId}:`, assignErr);
            // We don't toast error here to avoid spamming, but ideally we'd show a summary
          }
        }
        toast.success(`Assigned to ${selectedBatchIds.length} classes`);
        setSelectedBatchIds([]);
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create');
    } finally {
      setCreating(false);
    }
  };


  const isAssigned = (batchId: string) =>
    !!assignments?.find((a) => a.batch_id === batchId);

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-academic-cyan/10 border border-academic-cyan/20">
            <UserCog className="h-3.5 w-3.5 text-academic-cyan" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-academic-cyan">
              Academic Staff
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-5xl font-bold tracking-tight text-academic-navy leading-tight">Faculty Registry</h1>
            <p className="max-w-xl text-lg text-muted-foreground font-medium leading-relaxed">
              Manage faculty accounts, monitor status, and configure academic section assignments.
            </p>
          </div>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-premium btn-primary px-8">
          <Plus className="h-4 w-4 mr-2" /> Add Faculty
        </button>
      </div>

      <div className="glass-card overflow-hidden border-none shadow-2xl shadow-academic-navy/5 p-0">
        {isLoading ? (
          <div className="p-12">
            <TableSkeleton rows={6} cols={4} />
          </div>
        ) : !faculty || faculty.length === 0 ? (
          <div className="py-24">
            <EmptyState
              icon={UserCog}
              title="No faculty members registered"
              description="Onboard your teaching staff to start assigning them to classes and batches."
              action={{ label: 'Add Faculty', onClick: () => setCreateOpen(true) }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead className="bg-academic-navy/[0.03]">
                <tr>
                  <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Faculty Member</span>
                  </th>
                  <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Email Address</span>
                  </th>
                  <th className="px-8 py-6 text-left border-b border-academic-navy/5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Status</span>
                  </th>
                  <th className="px-8 py-6 text-right border-b border-academic-navy/5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-academic-navy/60">Management</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-academic-navy/5">
                {faculty.map((f) => (
                  <tr key={f.id} className="group hover:bg-academic-navy/[0.01] transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-academic-cyan/10 flex items-center justify-center text-academic-cyan">
                          <UserCog className="h-5 w-5" />
                        </div>
                        <div className="font-bold text-academic-navy group-hover:text-academic-cyan transition-colors text-lg">
                          {f.full_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-academic-navy/60 font-medium">
                        <Mail className="h-4 w-4 opacity-40" />
                        {f.email ?? '—'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {f.is_active ? (
                        <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold uppercase text-[10px] px-4 py-1.5 rounded-full">Active</Badge>
                      ) : (
                        <Badge variant="danger" className="bg-rose-100 text-rose-700 border-rose-200 font-bold uppercase text-[10px] px-4 py-1.5 rounded-full">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setAssignFor(f)} 
                          className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-academic-blue hover:bg-academic-blue/5 rounded-lg transition-colors border border-academic-blue/10"
                        >
                          Assign Classes
                        </button>
                        <button
                          onClick={() => setConfirmDeactivate(f)}
                          className="p-2 text-academic-navy/40 hover:text-academic-navy hover:bg-academic-navy/5 rounded-lg transition-all"
                          title={f.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {f.is_active ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(f)}
                          className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete Faculty"
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
        open={createOpen} 
        onClose={() => {
          if (!createdCredentials) setCreateOpen(false);
        }} 
        title={selectedCollege ? `Onboard Faculty: ${selectedCollege.name}` : "Faculty Onboarding"}
        size="md"
      >
        {createdCredentials ? (
          <div className="space-y-8 py-4">
            <div className="rounded-2xl bg-amber-50 p-6 border border-amber-200">
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Key className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-amber-900 mb-1 text-academic-navy">Credentials Generated</h3>
                  <p className="text-sm text-amber-800/80 leading-relaxed font-medium">
                    Automated email delivery is currently in sandbox mode. Please share these secure access credentials directly with the faculty member.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="glass-card border-none shadow-xl bg-academic-navy/[0.02] p-8 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-academic-navy/40">Registered Email</label>
                <div className="text-lg font-bold text-academic-navy font-mono tracking-tight">{createdCredentials.email}</div>
              </div>
              <div className="h-px bg-academic-navy/5" />
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-academic-navy/40">Secure Temporary Password</label>
                <div className="text-lg font-bold text-academic-blue font-mono tracking-widest">{createdCredentials.pass}</div>
              </div>
            </div>

            <button onClick={() => {
              setCreatedCredentials(null);
              setCreateOpen(false);
            }} className="btn-premium btn-primary w-full py-4 shadow-xl shadow-academic-blue/20">
              Complete Onboarding
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-6 py-4">
            {isGlobalMode && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Academic Institution</label>
                <select
                  value={targetCollegeId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setTargetCollegeId(newId);
                    setSelectedBatchIds([]);
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
                <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Full Legal Name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-premium w-full"
                  placeholder="e.g. Dr. Sarah Chen"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Institutional Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-premium w-full"
                  placeholder="sarah.chen@university.edu"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-academic-navy/60 ml-1">Class Assignments</label>
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {batches?.length === 0 && (
                  <div className="p-8 text-center bg-academic-navy/[0.02] rounded-2xl border border-dashed border-academic-navy/10">
                    <p className="text-sm font-medium text-muted-foreground">No classes available for selection.</p>
                  </div>
                )}
                {batches?.map((b) => (
                  <label key={b.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedBatchIds.includes(b.id) 
                      ? 'bg-academic-blue/5 border-academic-blue/30 shadow-sm' 
                      : 'bg-white border-academic-navy/5 hover:border-academic-navy/20'
                  }`}>
                    <input
                      type="checkbox"
                      checked={selectedBatchIds.includes(b.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBatchIds([...selectedBatchIds, b.id]);
                        } else {
                          setSelectedBatchIds(selectedBatchIds.filter(id => id !== b.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-academic-navy/20 text-academic-blue focus:ring-academic-blue"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-academic-navy">{b.name}</div>
                      <div className="text-[10px] font-bold text-academic-navy/40 uppercase tracking-wider">
                        {b.class_level ? `Grade ${b.class_level}` : ''} {b.stream ? `· ${b.stream}` : ''}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-academic-blue/5 rounded-2xl border border-academic-blue/10">
              <Mail className="h-5 w-5 text-academic-blue shrink-0" />
              <p className="text-[12px] font-medium text-academic-navy/70 leading-relaxed">
                New faculty will receive an invitation email containing their secure login credentials and platform walkthrough.
              </p>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-academic-navy transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={creating} className="btn-premium btn-primary px-10">
                {creating ? 'Onboarding...' : 'Register Faculty'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        title={`Academic Assignments — ${assignFor?.full_name ?? ''}`}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {batches?.length === 0 && (
            <div className="col-span-full py-12 text-center bg-academic-navy/[0.02] rounded-3xl border border-dashed border-academic-navy/10">
              <p className="text-muted-foreground font-medium">No available sections to assign.</p>
            </div>
          )}
          {batches?.map((b) => {
            const assigned = isAssigned(b.id);
            return (
              <div
                key={b.id}
                className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${
                  assigned ? 'bg-academic-blue/5 border-academic-blue/20 shadow-sm' : 'bg-white border-academic-navy/5'
                }`}
              >
                <div className="space-y-1">
                  <div className="font-bold text-academic-navy">{b.name}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-academic-navy/40">
                    {b.class_level ? `Grade ${b.class_level}` : ''} {b.stream ? `· ${b.stream}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!assignFor) return;
                    if (assigned) {
                      removeMut.mutate(
                        { faculty_id: assignFor.id, batch_id: b.id },
                        { onSuccess: () => toast.success('Section Assignment Removed') }
                      );
                    } else {
                      assignMut.mutate(
                        { faculty_id: assignFor.id, batch_id: b.id },
                        { onSuccess: () => toast.success('Section Assigned Successfully') }
                      );
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                    assigned 
                      ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100' 
                      : 'bg-academic-blue text-white hover:bg-academic-navy shadow-lg shadow-academic-blue/20'
                  }`}
                >
                  {assigned ? 'Unassign' : 'Assign'}
                </button>
              </div>
            );
          })}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDeactivate}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={() => {
          if (!confirmDeactivate) return;
          toggleActive.mutate(
            { id: confirmDeactivate.id, is_active: !confirmDeactivate.is_active },
            {
              onSuccess: () => {
                toast.success(confirmDeactivate.is_active ? 'Access Revoked' : 'Access Restored');
                setConfirmDeactivate(null);
              },
              onError: (e: any) => toast.error(e.message ?? 'Operation Failed'),
            }
          );
        }}
        title={confirmDeactivate?.is_active ? 'Revoke Faculty Access?' : 'Restore Faculty Access?'}
        message={
          confirmDeactivate?.is_active
            ? 'This member will be immediately barred from accessing the platform until their status is restored by an administrator.'
            : 'Access will be restored, allowing the faculty member to log in and manage their assigned sections.'
        }
        variant={confirmDeactivate?.is_active ? 'destructive' : 'primary'}
        loading={toggleActive.isPending}
      />
      
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await deleteMut.mutateAsync(confirmDelete.id);
            toast.success('Faculty Record Purged');
          } catch (err: any) {
            toast.error(err.message || 'Deletion Failed');
          }
        }}
        title="Purge Faculty Record?"
        message={`Are you sure you want to permanently delete ${confirmDelete?.full_name}? All institutional mappings and historical assignments will be permanently removed. This action is irreversible.`}
        confirmLabel="Purge Record"
        variant="destructive"
        loading={deleteMut.isPending}
      />
    </div>
  );
}
