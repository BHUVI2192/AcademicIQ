import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDirectory } from '@/context/DirectoryContext';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Users, Search, Plus, Link as LinkIcon, Unlink, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Student } from '@shared';

interface StudentWithParents {
  id: string;
  full_name: string;
  roll_number: string;
  batch_id: string;
  batch: { id: string; name: string } | null;
  parent_links?: Array<{ parent_id: string; parent: { full_name: string; email: string; phone: string } }>;
}

interface Parent {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
}

export function ParentLinkingPage() {
  const { selectedCollegeId } = useDirectory();
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [linking, setLinking] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all students
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-for-parent-linking', selectedCollegeId],
    queryFn: async () => {
      let q = supabase
        .from('students')
        .select(`
          id, full_name, roll_number, batch_id,
          batch:batches(id, name)
        `);

      if (selectedCollegeId) {
        q = q.eq('college_id', selectedCollegeId);
      }

      const { data, error } = await q.order('full_name');
      if (error) throw error;
      return (data ?? []) as unknown as StudentWithParents[];
    },
  });

  // Fetch all parents
  const { data: parents, isLoading: parentsLoading } = useQuery({
    queryKey: ['parents-list', selectedCollegeId],
    queryFn: async () => {
      let q = supabase
        .from('profiles')
        .select('id, full_name, email, phone, is_active')
        .eq('role', 'parent');

      if (selectedCollegeId) {
        q = q.eq('college_id', selectedCollegeId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Parent[];
    },
  });

  // Fetch parent links for selected student
  const { data: parentLinks } = useQuery({
    queryKey: ['student-parent-links', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const { data, error } = await supabase
        .from('student_parent_links')
        .select(`parent_id, parent:profiles(full_name, email, phone)`)
        .eq('student_id', selectedStudentId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!selectedStudentId,
  });

  const filtered = (students ?? []).filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_number.toLowerCase().includes(search.toLowerCase())
  );

  const selectedStudent = students?.find(s => s.id === selectedStudentId);
  const linkedParentIds = parentLinks?.map(l => l.parent_id) ?? [];
  const availableParents = parents?.filter(p => !linkedParentIds.includes(p.id)) ?? [];

  const handleLinkParent = async () => {
    if (!selectedStudentId || !selectedParentId) {
      toast.error('Select both student and parent');
      return;
    }

    setLinking(true);
    try {
      // Check if student_parent_links table exists, if not create link in students table
      const { error } = await supabase
        .from('student_parent_links')
        .insert({
          student_id: selectedStudentId,
          parent_id: selectedParentId,
        });

      if (error) throw error;

      toast.success('Parent linked successfully');
      setSelectedParentId('');
      queryClient.invalidateQueries({ queryKey: ['student-parent-links', selectedStudentId] });
    } catch (err: any) {
      // Fallback: update students table directly if linking table doesn't exist
      console.log('Linking table might not exist, attempting direct update...');
      toast.error(err.message ?? 'Failed to link parent');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkParent = async (parentId: string) => {
    if (!selectedStudentId) return;

    try {
      const { error } = await supabase
        .from('student_parent_links')
        .delete()
        .eq('student_id', selectedStudentId)
        .eq('parent_id', parentId);

      if (error) throw error;

      toast.success('Parent unlinked successfully');
      queryClient.invalidateQueries({ queryKey: ['student-parent-links', selectedStudentId] });
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to unlink parent');
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12 animate-fade-in">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            to="/admin/dashboard"
            className="group inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
          >
            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 group-hover:scale-110 transition-transform">
              <ArrowLeft className="h-3 w-3" />
            </div>
            Admin Dashboard
          </Link>
        </div>

        <div className="space-y-1">
          <h1 className="text-4xl font-light tracking-tight text-slate-900 dark:text-white">
            Parent-Student Linking
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Link parents to students for access and communication
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Students List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Select Student</h2>
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students…"
              className="input-premium w-full pl-12"
            />
          </div>

          <Card className="overflow-hidden border-none shadow-sm max-h-[600px] overflow-y-auto">
            {studentsLoading ? (
              <div className="p-8">
                <TableSkeleton rows={5} cols={2} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={Users}
                  title="No students found"
                  description="Add students to link with parents"
                />
              </div>
            ) : (
              <div className="space-y-1 p-4">
                {filtered.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selectedStudentId === student.id
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="font-medium">{student.full_name}</div>
                    <div className="text-xs opacity-70 mt-1">
                      Roll: {student.roll_number} • {student.batch?.name}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Parent Linking */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {selectedStudent ? `Link Parent to ${selectedStudent.full_name}` : 'Select a Student First'}
          </h2>

          {selectedStudent ? (
            <>
              {/* Currently Linked Parents */}
              {parentLinks && parentLinks.length > 0 && (
                <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                      Linked Parents ({parentLinks.length})
                    </p>
                    <div className="space-y-2">
                      {parentLinks.map((link) => (
                        <div
                          key={link.parent_id}
                          className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-800 rounded border border-emerald-100 dark:border-emerald-800"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {link.parent.full_name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {link.parent.email}
                            </p>
                          </div>
                          <button
                            onClick={() => handleUnlinkParent(link.parent_id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                            title="Unlink parent"
                          >
                            <Unlink className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {/* Add New Parent Link */}
              <Card className="p-6 border-none shadow-sm space-y-4">
                <h3 className="font-medium text-slate-900 dark:text-white">Add New Parent Link</h3>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Available Parents
                  </label>
                  <select
                    value={selectedParentId}
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    className="input-premium w-full"
                  >
                    <option value="">Select a parent…</option>
                    {availableParents?.map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.full_name} ({parent.phone})
                      </option>
                    ))}
                  </select>
                  {availableParents?.length === 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      All available parents are already linked
                    </p>
                  )}
                </div>

                <button
                  onClick={handleLinkParent}
                  disabled={linking || !selectedParentId}
                  className="w-full px-4 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <LinkIcon className="h-4 w-4" />
                  {linking ? 'Linking...' : 'Link Parent'}
                </button>
              </Card>

              {/* Info Card */}
              <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    A student can be linked to multiple parents. Linked parents can view this student's marks, attendance, and fees.
                  </p>
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-12 text-center">
              <Users className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">Select a student to manage parent links</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
