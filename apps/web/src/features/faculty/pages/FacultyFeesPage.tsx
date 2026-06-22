import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFacultyAssignedBatches } from '@/hooks/useBatches';
import { useStudentsInBatch } from '@/hooks/useStudents';
import {
  useBatchFeesDrafts,
  useSubmitFeesDraft,
  useSubmitFeesDraftToAdmin,
  useSetGlobalFeesDraft,
  useSubmitAllFeesDraftToAdmin
} from '@/hooks/useFees';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, DollarSign, Calendar, Check, Send, Edit2, Save, X,
  Layers, AlertCircle, Clock, ChevronDown, Search, ArrowRight
} from 'lucide-react';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { formatDate } from '@/lib/utils';

interface FeeEdit {
  student_id: string;
  total_amount: number;
  paid_amount: number;
  due_date: string | null;
}

export function FacultyFeesPage() {
  const { user } = useAuth();
  const { data: batches, isLoading: batchesLoading } = useFacultyAssignedBatches(user?.id);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, FeeEdit>>({});
  const [search, setSearch] = useState('');
  const [globalFeeVal, setGlobalFeeVal] = useState<string>('');

  // Queries
  const { data: students, isLoading: studentsLoading } = useStudentsInBatch(selectedBatchId);
  const { data: drafts, isLoading: draftsLoading } = useBatchFeesDrafts(selectedBatchId);

  // Mutations
  const submitDraft = useSubmitFeesDraft();
  const submitToAdmin = useSubmitFeesDraftToAdmin();
  const setGlobalFee = useSetGlobalFeesDraft();
  const submitAllToAdmin = useSubmitAllFeesDraftToAdmin();

  const selectedBatch = batches?.find(b => b.id === selectedBatchId);

  // Merge students with their corresponding fee drafts
  const mergedFees = students?.map(student => {
    const draft = drafts?.find(d => d.student_id === student.id);
    return {
      student_id: student.id,
      student_name: student.full_name,
      roll_number: student.roll_number,
      draft_id: draft?.id || null,
      total_amount: draft?.total_amount ? parseFloat(draft.total_amount) : 0,
      paid_amount: draft?.paid_amount ? parseFloat(draft.paid_amount) : 0,
      remaining_amount: draft?.remaining_amount ? parseFloat(draft.remaining_amount) : 0,
      due_date: draft?.due_date || null,
      status: draft?.submission_status || 'no_draft',
      admin_remarks: draft?.admin_remarks || null,
    };
  }) || [];

  const filteredFees = mergedFees.filter(f =>
    f.student_name.toLowerCase().includes(search.toLowerCase()) ||
    f.roll_number.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (fee: any) => {
    setEditingStudentId(fee.student_id);
    setEditValues(prev => ({
      ...prev,
      [fee.student_id]: {
        student_id: fee.student_id,
        total_amount: fee.total_amount || 0,
        paid_amount: fee.paid_amount || 0,
        due_date: fee.due_date,
      },
    }));
  };

  const cancelEdit = () => {
    setEditingStudentId(null);
    setEditValues({});
  };

  const handleSaveDraft = async (studentId: string) => {
    const values = editValues[studentId];
    if (!values || !user?.id) return;

    try {
      await submitDraft.mutateAsync({
        student_id: studentId,
        batch_id: selectedBatchId,
        total_amount: values.total_amount,
        paid_amount: values.paid_amount,
        faculty_id: user.id,
        due_date: values.due_date,
      });
      setEditingStudentId(null);
    } catch (err: any) {
      // toast.error is already handled by hook
    }
  };

  const handleSubmitToAdmin = async (draftId: string) => {
    if (!draftId) return;
    try {
      await submitToAdmin.mutateAsync(draftId);
    } catch (err: any) {
      // toast.error is already handled by hook
    }
  };

  const handleSetGlobalFee = async () => {
    if (!selectedBatchId || !user?.id || !globalFeeVal.trim()) {
      toast.error('Please enter a valid global fee amount');
      return;
    }
    const amount = parseFloat(globalFeeVal);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid positive number');
      return;
    }
    try {
      await setGlobalFee.mutateAsync({
        batch_id: selectedBatchId,
        total_amount: amount,
        faculty_id: user.id,
      });
      setGlobalFeeVal('');
    } catch (err) {}
  };

  const handleSubmitAllToAdmin = async () => {
    if (!selectedBatchId || !user?.id) return;
    try {
      await submitAllToAdmin.mutateAsync({
        batch_id: selectedBatchId,
        faculty_id: user.id,
      });
    } catch (err) {}
  };

  const draftsCount = mergedFees.filter(f => f.status === 'draft' || f.status === 'rejected').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge variant="success" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-2.5 py-1">Published</Badge>;
      case 'approved':
        return <Badge variant="success" className="bg-green-100 text-green-700 border-green-200 text-[10px] px-2.5 py-1">Approved</Badge>;
      case 'submitted':
        return <Badge variant="info" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] px-2.5 py-1">Submitted</Badge>;
      case 'rejected':
        return <Badge variant="danger" className="bg-red-100 text-red-700 border-red-200 text-[10px] px-2.5 py-1">Rejected</Badge>;
      case 'draft':
        return <Badge variant="warning" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-2.5 py-1">Draft</Badge>;
      default:
        return <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-slate-200 text-[10px] px-2.5 py-1">No Draft</Badge>;
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 animate-fade-in">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            to="/faculty"
            className="group inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
          >
            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 group-hover:scale-110 transition-transform">
              <ArrowLeft className="h-3 w-3" />
            </div>
            Faculty Dashboard
          </Link>
        </div>

        <div className="space-y-1">
          <h1 className="text-4xl font-light tracking-tight text-slate-900 dark:text-white">
            Fees Management (Draft Workflow)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Submit fees draft allocations for admin approval. Total minus paid amount auto-calculates remaining dues.
          </p>
        </div>
      </div>

      {/* Batch Selector & Bulk Actions */}
      <Card className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
          {/* Class Selector */}
          <div className="w-full">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">
              <Layers className="inline h-3 w-3 mr-1" /> Select Class
            </label>
            <div className="relative">
              <Layers className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <select
                value={selectedBatchId}
                onChange={(e) => {
                  setSelectedBatchId(e.target.value);
                  setSearch('');
                  setEditingStudentId(null);
                }}
                className="input-premium w-full pl-12 pr-10 py-3"
              >
                <option value="">Choose a class…</option>
                {batches?.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {selectedBatchId && (
            <>
              {/* Global Fee Setter */}
              <div className="w-full">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">
                  <DollarSign className="inline h-3 w-3 mr-1" /> Set Global Fee (Class)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">₹</span>
                    <input
                      type="number"
                      value={globalFeeVal}
                      onChange={(e) => setGlobalFeeVal(e.target.value)}
                      placeholder="e.g. 50000"
                      className="input-premium w-full pl-8 py-3 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleSetGlobalFee}
                    disabled={setGlobalFee.isPending || !globalFeeVal.trim()}
                    className="btn btn-secondary px-4 py-3 text-sm flex items-center gap-1 font-medium whitespace-nowrap"
                  >
                    {setGlobalFee.isPending ? 'Applying...' : 'Apply Fee'}
                  </button>
                </div>
              </div>

              {/* Submit All to Admin */}
              <div className="w-full">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">
                  <Send className="inline h-3 w-3 mr-1" /> Finalize Submission
                </label>
                <button
                  onClick={handleSubmitAllToAdmin}
                  disabled={submitAllToAdmin.isPending || draftsCount === 0}
                  className="btn btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 font-semibold shadow-md disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:shadow-none"
                >
                  <Send className="h-4 w-4" />
                  {submitAllToAdmin.isPending ? 'Submitting...' : `Submit All to Admin (${draftsCount})`}
                </button>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Fees Table */}
      {selectedBatchId ? (
        <Card className="p-6 border-none shadow-sm">
          <div className="space-y-4 mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or roll number…"
                className="input-premium w-full pl-12"
              />
            </div>
          </div>

          {studentsLoading || draftsLoading ? (
            <TableSkeleton rows={8} cols={6} />
          ) : filteredFees.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={AlertCircle}
                title="No students found"
                description="This class has no students assigned."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Roll No.
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Student Name
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Total Fee
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Paid Amount
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Remaining
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Due Date
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-900/50">
                  {filteredFees.map((fee) => {
                    const isEditing = editingStudentId === fee.student_id;
                    const edited = editValues[fee.student_id];
                    const remainingVal = isEditing
                      ? (edited.total_amount || 0) - (edited.paid_amount || 0)
                      : fee.remaining_amount;

                    return (
                      <tr key={fee.student_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="px-6 py-5">
                          <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                            {fee.roll_number}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <span className="text-sm text-slate-900 dark:text-white font-medium">
                              {fee.student_name}
                            </span>
                            {fee.status === 'rejected' && fee.admin_remarks && (
                              <div className="text-[10px] text-red-600 bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded border border-red-100 dark:border-red-900/50 max-w-xs">
                                <strong>Rejection remarks:</strong> {fee.admin_remarks}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {isEditing ? (
                            <input
                              type="number"
                              value={edited.total_amount}
                              onChange={(e) =>
                                setEditValues(prev => ({
                                  ...prev,
                                  [fee.student_id]: {
                                    ...prev[fee.student_id],
                                    total_amount: parseFloat(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="input-premium py-1 w-28"
                              placeholder="Total"
                            />
                          ) : (
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                              ₹{fee.total_amount.toLocaleString('en-IN')}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          {isEditing ? (
                            <input
                              type="number"
                              value={edited.paid_amount}
                              onChange={(e) =>
                                setEditValues(prev => ({
                                  ...prev,
                                  [fee.student_id]: {
                                    ...prev[fee.student_id],
                                    paid_amount: parseFloat(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="input-premium py-1 w-28"
                              placeholder="Paid"
                            />
                          ) : (
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                              ₹{fee.paid_amount.toLocaleString('en-IN')}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`text-sm font-semibold ${remainingVal > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
                            ₹{remainingVal.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          {isEditing ? (
                            <input
                              type="date"
                              value={edited.due_date || ''}
                              onChange={(e) =>
                                setEditValues(prev => ({
                                  ...prev,
                                  [fee.student_id]: {
                                    ...prev[fee.student_id],
                                    due_date: e.target.value || null,
                                  },
                                }))
                              }
                              className="input-premium py-1 w-36 text-xs"
                            />
                          ) : (
                            <span className="text-sm text-slate-500">
                              {fee.due_date ? formatDate(fee.due_date) : '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          {getStatusBadge(fee.status)}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveDraft(fee.student_id)}
                                  disabled={submitDraft.isPending}
                                  className="p-2 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors"
                                  title="Save Draft"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                {/* Edit Button (allowed if status is draft, rejected, or no draft yet) */}
                                {(fee.status === 'draft' || fee.status === 'rejected' || fee.status === 'no_draft') && (
                                  <button
                                    onClick={() => startEdit(fee)}
                                    className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
                                    title="Edit Draft"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                )}

                                {/* Submit to Admin Button (only if draft exists and status is draft or rejected) */}
                                {(fee.status === 'draft' || fee.status === 'rejected') && fee.draft_id && (
                                  <button
                                    onClick={() => handleSubmitToAdmin(fee.draft_id!)}
                                    disabled={submitToAdmin.isPending}
                                    className="p-2 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                                    title="Submit to Admin"
                                  >
                                    <Send className="h-4 w-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-12 border-dashed">
          <div className="text-center space-y-4">
            <DollarSign className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-700" />
            <div>
              <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
                Select a class to view fees
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-600">
                Choose from the list above to manage student fees staging
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
