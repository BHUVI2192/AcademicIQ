import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFacultyList } from '@/hooks/useFaculty';
import { useDirectory } from '@/context/DirectoryContext';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Shield, CheckCircle2, XCircle, Edit2, Save, X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';

export function PermissionsPage() {
  const { user } = useAuth();
  const { selectedCollegeId } = useDirectory();
  const { data: faculty, isLoading: facultyLoading } = useFacultyList(selectedCollegeId);
  const [tab, setTab] = useState<'permissions'>('permissions');
  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<{
    can_add_students: boolean;
    can_manage_fees: boolean;
    can_manage_attendance: boolean;
  }>({ can_add_students: false, can_manage_fees: false, can_manage_attendance: false });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleEditStart = (fac: any) => {
    setEditingFacultyId(fac.id);
    setEditPerms({
      can_add_students: fac.can_add_students ?? false,
      can_manage_fees: fac.can_manage_fees ?? false,
      can_manage_attendance: fac.can_manage_attendance ?? false,
    });
  };

  const handleSave = async () => {
    if (!editingFacultyId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          can_add_students: editPerms.can_add_students,
          can_manage_fees: editPerms.can_manage_fees,
          can_manage_attendance: editPerms.can_manage_attendance,
        })
        .eq('id', editingFacultyId);

      if (error) throw error;
      toast.success('Permissions updated successfully');
      setEditingFacultyId(null);
      queryClient.invalidateQueries({ queryKey: ['faculty-list'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12 animate-fade-in">
      <div className="flex flex-col gap-6">
        <Link
          to="/admin/dashboard"
          className="group inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all w-fit"
        >
          <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 group-hover:scale-110 transition-transform">
            <ArrowLeft className="h-3 w-3" />
          </div>
          Admin Dashboard
        </Link>

        <div className="space-y-1">
          <h1 className="text-4xl font-light tracking-tight text-slate-900 dark:text-white">
            Faculty Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage faculty permissions
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setTab('permissions')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            tab === 'permissions'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Shield className="h-4 w-4 inline mr-2" />
          Faculty Permissions
        </button>
      </div>

      {/* Permissions Tab */}
      {tab === 'permissions' && (
        <div className="space-y-6">
          <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800">
            <div className="flex gap-3">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Permission Types</p>
                <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                  Assign permissions to control what faculty members can access and manage.
                </p>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden border-none shadow-sm">
            {facultyLoading ? (
              <div className="p-8">
                <TableSkeleton rows={8} cols={4} />
              </div>
            ) : !faculty || faculty.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={Shield}
                  title="No faculty members"
                  description="Add faculty members to manage their permissions"
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                      <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Faculty Name
                      </th>
                      <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Email
                      </th>
                      <th className="text-center px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Permissions
                      </th>
                      <th className="text-center px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {faculty.map((f) => (
                      <tr key={f.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900 dark:text-white">{f.full_name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-500 dark:text-slate-400">{f.email}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {f.can_add_students && <Badge variant="outline" className="text-xs">Add Students</Badge>}
                            {f.can_manage_fees && <Badge variant="outline" className="text-xs">Fees</Badge>}
                            {f.can_manage_attendance && <Badge variant="outline" className="text-xs">Attendance</Badge>}
                            {!f.can_add_students && !f.can_manage_fees && !f.can_manage_attendance && (
                              <span className="text-xs text-slate-400">None</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleEditStart(f)}
                            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Edit Permissions Modal */}
      <Modal
        open={!!editingFacultyId}
        onClose={() => setEditingFacultyId(null)}
        title={`Edit Permissions: ${faculty?.find(f => f.id === editingFacultyId)?.full_name}`}
      >
        <div className="space-y-4">
          <label className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              checked={editPerms.can_add_students}
              onChange={(e) => setEditPerms({ ...editPerms, can_add_students: e.target.checked })}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="font-medium text-slate-900 dark:text-white">Add Students</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Allow student registration</p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              checked={editPerms.can_manage_fees}
              onChange={(e) => setEditPerms({ ...editPerms, can_manage_fees: e.target.checked })}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="font-medium text-slate-900 dark:text-white">Manage Fees</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Manage student fees and payments</p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              checked={editPerms.can_manage_attendance}
              onChange={(e) => setEditPerms({ ...editPerms, can_manage_attendance: e.target.checked })}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="font-medium text-slate-900 dark:text-white">Mark Attendance</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Mark and publish class attendance</p>
            </div>
          </label>

          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setEditingFacultyId(null)}
              className="flex-1 px-4 py-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

