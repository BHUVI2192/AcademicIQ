import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  usePendingFeesSubmissions,
  useApproveFeesDraft,
  useRejectFeesDraft,
  usePublishFeesToParents,
  useApproveAllFeesDrafts,
  usePublishAllFeesToParents,
  useApproveBatchFees,
  usePublishBatchFeesToParents
} from '@/hooks/useFees';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Check, X, Send, AlertCircle, Clock,
  MessageSquare, Calendar, ChevronRight, ChevronDown, Folder, FolderOpen
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { formatDate } from '@/lib/utils';

export function AdminFeesApprovalPage() {
  const { user } = useAuth();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [showBulkPublishModal, setShowBulkPublishModal] = useState(false);
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  const [publishingBatchId, setPublishingBatchId] = useState<string | null>(null);
  const [batchDueDate, setBatchDueDate] = useState('');

  // Queries & Mutations
  const { data: submissions, isLoading } = usePendingFeesSubmissions(user?.id);
  const approveFees = useApproveFeesDraft();
  const rejectFees = useRejectFeesDraft();
  const publishFees = usePublishFeesToParents();
  const approveAllFees = useApproveAllFeesDrafts();
  const publishAllFees = usePublishAllFeesToParents();
  const approveBatchFees = useApproveBatchFees();
  const publishBatchFees = usePublishBatchFeesToParents();

  const handleApprove = async (draftId: string) => {
    if (!user?.id) return;
    try {
      await approveFees.mutateAsync({
        fees_draft_id: draftId,
        admin_id: user.id,
      });
    } catch (err) {}
  };

  const handleRejectSubmit = async () => {
    if (!rejectingId || !user?.id || !rejectionRemarks.trim()) {
      toast.error('Rejection remarks are required');
      return;
    }
    try {
      await rejectFees.mutateAsync({
        fees_draft_id: rejectingId,
        admin_id: user.id,
        remarks: rejectionRemarks,
      });
      setRejectingId(null);
      setRejectionRemarks('');
    } catch (err) {}
  };

  const handlePublishSubmit = async () => {
    if (!publishingId || !user?.id) return;
    try {
      await publishFees.mutateAsync({
        fees_draft_id: publishingId,
        admin_id: user.id,
        due_date: dueDate || null,
      });
      setPublishingId(null);
      setDueDate('');
    } catch (err) {}
  };

  const handleApproveAll = async () => {
    if (!user?.id) return;
    try {
      await approveAllFees.mutateAsync({
        admin_id: user.id,
      });
    } catch (err) {}
  };

  const handleBulkPublishSubmit = async () => {
    if (!user?.id) return;
    try {
      await publishAllFees.mutateAsync({
        admin_id: user.id,
        due_date: bulkDueDate || null,
      });
      setShowBulkPublishModal(false);
      setBulkDueDate('');
    } catch (err) {}
  };

  const handleApproveBatch = async (batchId: string) => {
    if (!user?.id) return;
    try {
      await approveBatchFees.mutateAsync({
        batch_id: batchId,
        admin_id: user.id,
      });
    } catch (err) {}
  };

  const handleBatchPublishSubmit = async () => {
    if (!publishingBatchId || !user?.id) return;
    try {
      await publishBatchFees.mutateAsync({
        batch_id: publishingBatchId,
        admin_id: user.id,
        due_date: batchDueDate || null,
      });
      setPublishingBatchId(null);
      setBatchDueDate('');
    } catch (err) {}
  };

  const toggleBatch = (batchId: string) => {
    setExpandedBatches(prev => ({
      ...prev,
      [batchId]: prev[batchId] === true ? false : true // default to true (expanded) if undefined
    }));
  };

  const pendingCount = submissions?.filter(s => s.submission_status === 'submitted').length ?? 0;
  const approvedCount = submissions?.filter(s => s.submission_status === 'approved').length ?? 0;

  // Group submissions by batch_id
  const groupedSubmissions = (submissions ?? []).reduce<Record<string, { batchName: string; items: any[] }>>((acc, sub) => {
    const key = sub.batch_id;
    if (!acc[key]) {
      acc[key] = {
        batchName: sub.batch_name,
        items: []
      };
    }
    acc[key].items.push(sub);
    return acc;
  }, {});

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            to="/admin"
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
            Fees Approval Center
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review fees drafts submitted by faculty. Approve allocations, reject with remarks, or publish to the parent portal.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pending Review</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-3xl font-light mt-2 text-slate-900 dark:text-white">{pendingCount}</p>
        </Card>
        <Card className="p-6">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Approved (Ready to Publish)</span>
            <Check className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-3xl font-light mt-2 text-slate-900 dark:text-white">{approvedCount}</p>
        </Card>
        <Card className="p-6">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Submissions</span>
            <AlertCircle className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-3xl font-light mt-2 text-slate-900 dark:text-white">{submissions?.length ?? 0}</p>
        </Card>
      </div>

      {/* Main Review Section */}
      <Card className="p-6">
        {isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : !submissions || submissions.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={AlertCircle}
              title="No pending submissions"
              description="There are currently no fee drafts awaiting review."
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white">Pending Requests</h3>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleApproveAll}
                  disabled={approveAllFees.isPending || pendingCount === 0}
                  className="flex-1 sm:flex-none btn btn-secondary px-4 py-2 text-xs flex items-center justify-center gap-1.5 font-medium disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  Approve All Pending ({pendingCount})
                </button>
                <button
                  onClick={() => setShowBulkPublishModal(true)}
                  disabled={publishAllFees.isPending || approvedCount === 0}
                  className="flex-1 sm:flex-none btn btn-primary px-4 py-2 text-xs flex items-center justify-center gap-1.5 font-semibold disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:shadow-none"
                >
                  <Send className="h-3.5 w-3.5" />
                  Publish All Approved ({approvedCount})
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries(groupedSubmissions).map(([batchId, group]: any) => {
                const isExpanded = expandedBatches[batchId] !== false; // default to true
                const batchPendingCount = group.items.filter((item: any) => item.submission_status === 'submitted').length;
                const batchApprovedCount = group.items.filter((item: any) => item.submission_status === 'approved').length;

                return (
                  <div key={batchId} className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-950 transition-all">
                    {/* Folder Header */}
                    <div 
                      onClick={() => toggleBatch(batchId)}
                      className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50/50 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer transition-colors gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {isExpanded ? (
                            <FolderOpen className="h-5 w-5 text-blue-500" />
                          ) : (
                            <Folder className="h-5 w-5 text-blue-400" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {group.batchName}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Class ID: {batchId}
                          </p>
                        </div>
                        <div className="flex gap-1.5 ml-2">
                          {batchPendingCount > 0 && (
                            <Badge variant="info" className="bg-blue-100 text-blue-700 border-blue-200 text-[9px] font-semibold px-2 py-0.5">
                              {batchPendingCount} Pending
                            </Badge>
                          )}
                          {batchApprovedCount > 0 && (
                            <Badge variant="success" className="bg-green-100 text-green-700 border-green-200 text-[9px] font-semibold px-2 py-0.5">
                              {batchApprovedCount} Approved
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Actions & Collapse State Indicator */}
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {batchPendingCount > 0 && (
                            <button
                              onClick={() => handleApproveBatch(batchId)}
                              disabled={approveBatchFees.isPending}
                              className="px-3 py-1 text-[11px] font-medium bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white rounded-md transition-colors"
                              title="Approve Class"
                            >
                              Approve Class ({batchPendingCount})
                            </button>
                          )}
                          {batchApprovedCount > 0 && (
                            <button
                              onClick={() => setPublishingBatchId(batchId)}
                              disabled={publishBatchFees.isPending}
                              className="px-3 py-1 text-[11px] font-medium bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-md transition-colors"
                              title="Publish Class"
                            >
                              Publish Class ({batchApprovedCount})
                            </button>
                          )}
                        </div>

                        {/* Chevron collapse trigger */}
                        <button 
                          onClick={() => toggleBatch(batchId)}
                          className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Table (Expanded content) */}
                    {isExpanded && (
                      <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-800/10">
                              <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Student Name</th>
                              <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Total Fee</th>
                              <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Paid Amount</th>
                              <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Remaining</th>
                              <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Submitted By</th>
                              <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
                              <th className="px-6 py-3 text-right text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-900/50">
                            {group.items.map((sub: any) => (
                              <tr key={sub.fees_draft_id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition-colors">
                                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                                  {sub.student_name}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                  ₹{parseFloat(sub.total_amount).toLocaleString('en-IN')}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                  ₹{parseFloat(sub.paid_amount).toLocaleString('en-IN')}
                                </td>
                                <td className="px-6 py-4 text-sm font-semibold text-amber-600">
                                  ₹{parseFloat(sub.remaining_amount).toLocaleString('en-IN')}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-xs font-medium text-slate-900 dark:text-white">{sub.faculty_name}</div>
                                  <div className="text-[9px] text-slate-400">on {formatDate(sub.submitted_at)}</div>
                                </td>
                                <td className="px-6 py-4">
                                  {sub.submission_status === 'submitted' ? (
                                    <Badge variant="info" className="bg-blue-100 text-blue-700 border-blue-200 text-[9px]">Pending</Badge>
                                  ) : (
                                    <Badge variant="success" className="bg-green-100 text-green-700 border-green-200 text-[9px]">Approved</Badge>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    {sub.submission_status === 'submitted' && (
                                      <>
                                        <button
                                          onClick={() => handleApprove(sub.fees_draft_id)}
                                          disabled={approveFees.isPending}
                                          className="p-1.5 rounded bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white transition-colors"
                                          title="Approve Draft"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => setRejectingId(sub.fees_draft_id)}
                                          className="p-1.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white transition-colors"
                                          title="Reject Draft"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </>
                                    )}

                                    {sub.submission_status === 'approved' && (
                                      <button
                                        onClick={() => setPublishingId(sub.fees_draft_id)}
                                        className="btn btn-primary px-2.5 py-1 flex items-center gap-1 text-[11px]"
                                        title="Publish to Parents"
                                      >
                                        <Send className="h-3 w-3" /> Publish
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-red-600">
              <MessageSquare className="h-5 w-5" /> Reject Fee Submission?
            </h2>
            <p className="text-sm text-slate-600">
              Please provide feedback or reason for rejecting this fee record. The faculty will see this message and make updates.
            </p>
            <textarea
              value={rejectionRemarks}
              onChange={(e) => setRejectionRemarks(e.target.value)}
              placeholder="E.g., Incorrect total amount, missing scholarship deduction..."
              rows={4}
              className="w-full input-premium p-3 text-sm"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectionRemarks('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={rejectFees.isPending || !rejectionRemarks.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                {rejectFees.isPending ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Publish Modal */}
      {publishingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-600">
              <Calendar className="h-5 w-5" /> Set Payment Due Date
            </h2>
            <p className="text-sm text-slate-600">
              Assign a deadline for parents to complete this fee transaction. A notification alert will be delivered to their dashboard.
            </p>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full input-premium p-3 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPublishingId(null);
                  setDueDate('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishSubmit}
                disabled={publishFees.isPending}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm"
              >
                {publishFees.isPending ? 'Publishing...' : 'Yes, Publish'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Bulk Publish Modal */}
      {showBulkPublishModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-600">
              <Calendar className="h-5 w-5" /> Set Payment Due Date (Bulk)
            </h2>
            <p className="text-sm text-slate-600">
              Assign a deadline for parents to complete these fee transactions. Notification alerts will be delivered to their dashboards for all {approvedCount} published records.
            </p>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Due Date</label>
              <input
                type="date"
                value={bulkDueDate}
                onChange={(e) => setBulkDueDate(e.target.value)}
                className="w-full input-premium p-3 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBulkPublishModal(false);
                  setBulkDueDate('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkPublishSubmit}
                disabled={publishAllFees.isPending}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm"
              >
                {publishAllFees.isPending ? 'Publishing All...' : 'Yes, Publish All'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Batch Publish Modal */}
      {publishingBatchId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-600">
              <Calendar className="h-5 w-5" /> Set Payment Due Date (Class)
            </h2>
            <p className="text-sm text-slate-600">
              Assign a deadline for parents of this class to complete their fee transactions. Notification alerts will be delivered to their dashboards.
            </p>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Due Date</label>
              <input
                type="date"
                value={batchDueDate}
                onChange={(e) => setBatchDueDate(e.target.value)}
                className="w-full input-premium p-3 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPublishingBatchId(null);
                  setBatchDueDate('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchPublishSubmit}
                disabled={publishBatchFees.isPending}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm"
              >
                {publishBatchFees.isPending ? 'Publishing Class...' : 'Yes, Publish Class'}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
