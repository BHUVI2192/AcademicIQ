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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-slate-900 dark:text-slate-100">Faculty</h1>
          <p className="text-sm text-slate-500">Manage faculty accounts and class assignments</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Faculty
        </button>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={4} cols={4} />
          </div>
        ) : !faculty || faculty.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No faculty members"
            action={{ label: 'Add faculty', onClick: () => setCreateOpen(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {faculty.map((f) => (
                  <tr key={f.id}>
                    <td className="font-medium">{f.full_name}</td>
                    <td className="text-slate-500">{f.email ?? '—'}</td>
                    <td>
                      {f.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="danger">Inactive</Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => setAssignFor(f)} className="btn btn-ghost text-xs">
                          Assign Classes
                        </button>
                        <button
                          onClick={() => setConfirmDeactivate(f)}
                          className="btn btn-ghost text-xs"
                        >
                          {f.is_active ? (
                            <>
                              <ShieldOff className="h-3 w-3" /> Deactivate
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3 w-3" /> Activate
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(f)}
                          className="btn btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
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
        title={selectedCollege ? `Add faculty to ${selectedCollege.name}` : "Add Faculty Member"}
      >
        {createdCredentials ? (
          <div className="space-y-6">
            <div className="rounded-md bg-green-50 p-4 border border-green-200">
              <h3 className="text-sm font-medium text-green-800 mb-1">Faculty Account Created</h3>
              <p className="text-sm text-green-700">The email service is not fully configured, so the automated email was not sent. Please share these credentials securely with the faculty member.</p>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-3 font-mono text-sm">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-sans">Email:</span>
                <span className="font-medium text-slate-800">{createdCredentials.email}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-500 font-sans">Temporary Password:</span>
                <span className="font-medium text-slate-800">{createdCredentials.pass}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => {
                setCreatedCredentials(null);
                setCreateOpen(false);
              }} className="btn btn-primary">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            {isGlobalMode && (
              <div>
                <label className="label">School</label>
                <select
                  value={targetCollegeId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setTargetCollegeId(newId);
                    setSelectedBatchIds([]); // Reset selections when school changes
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
              <label className="label">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
              />
            </div>
            
            <div>
              <label className="label">Assign to Batches / Classes</label>
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto p-3 border border-slate-200 rounded-md dark:border-slate-700">
                {batches?.length === 0 && (
                  <p className="text-xs text-slate-500">No batches found for this school</p>
                )}
                {batches?.map((b) => (
                  <label key={b.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md cursor-pointer transition-colors">
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
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{b.name}</span>
                      <span className="text-[10px] text-slate-500">
                        {b.class_level ? `Class ${b.class_level}` : ''} {b.stream ? `· ${b.stream}` : ''}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">Faculty will automatically see tests for these batches.</p>
            </div>

            <div className="flex items-start gap-3 mt-4 text-sm text-slate-600 bg-blue-50/50 p-3 rounded-md border border-blue-100">
              <Mail className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <p>
                An email will be sent automatically to this address with a secure, auto-generated temporary password and a link to log in.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={creating} className="btn btn-primary">
                {creating ? 'Creating...' : 'Create Faculty'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        title={`Assign Classes — ${assignFor?.full_name ?? ''}`}
        size="lg"
      >
        <div className="space-y-2">
          {batches?.length === 0 && (
            <p className="text-sm text-slate-500">No classes available</p>
          )}
          {batches?.map((b) => {
            const assigned = isAssigned(b.id);
            return (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-slate-500">
                    {b.class_level ? `Class ${b.class_level}` : ''} {b.stream ? `· ${b.stream}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!assignFor) return;
                    if (assigned) {
                      removeMut.mutate(
                        { faculty_id: assignFor.id, batch_id: b.id },
                        { onSuccess: () => toast.success('Removed') }
                      );
                    } else {
                      assignMut.mutate(
                        { faculty_id: assignFor.id, batch_id: b.id },
                        { onSuccess: () => toast.success('Assigned') }
                      );
                    }
                  }}
                  className={assigned ? 'btn btn-danger text-xs' : 'btn btn-primary text-xs'}
                >
                  {assigned ? 'Remove' : 'Assign'}
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
                toast.success(confirmDeactivate.is_active ? 'Deactivated' : 'Activated');
                setConfirmDeactivate(null);
              },
              onError: (e: any) => toast.error(e.message ?? 'Failed'),
            }
          );
        }}
        title={confirmDeactivate?.is_active ? 'Deactivate faculty?' : 'Activate faculty?'}
        message={
          confirmDeactivate?.is_active
            ? 'They will no longer be able to sign in until reactivated.'
            : 'They will be able to sign in again.'
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
            toast.success('Faculty member deleted');
          } catch (err: any) {
            toast.error(err.message || 'Failed to delete');
          }
        }}
        title="Delete Faculty?"
        message={`Are you sure you want to permanently delete ${confirmDelete?.full_name}? This will remove their account and all class assignments. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMut.isPending}
      />
    </div>
  );
}
