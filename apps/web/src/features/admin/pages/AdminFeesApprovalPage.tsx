import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  usePendingFeesSubmissions,
  useApproveFeesDraft,
  useRejectFeesDraft,
  usePublishFeesToParents
} from '@/hooks/useFees';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Check, X, Send, AlertCircle, Clock,
  MessageSquare, Calendar, ChevronRight
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

  // Queries & Mutations
  const { data: submissions, isLoading } = usePendingFeesSubmissions(user?.id);
  const approveFees = useApproveFeesDraft();
  const rejectFees = useRejectFeesDraft();
  const publishFees = usePublishFeesToParents();

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

  const pendingCount = submissions?.filter(s => s.submission_status === 'submitted').length ?? 0;
  const approvedCount = submissions?.filter(s => s.submission_status === 'approved').length ?? 0;

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
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Class</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Student Name</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Fee</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Paid Amount</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Remaining</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Submitted By</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-900/50">
                {submissions.map((sub: any) => (
                  <tr key={sub.fees_draft_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-6 py-5 text-sm font-mono font-medium text-slate-900 dark:text-white">
                      {sub.batch_name}
                    </td>
                    <td className="px-6 py-5 text-sm font-medium text-slate-900 dark:text-white">
                      {sub.student_name}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
                      ₹{parseFloat(sub.total_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
                      ₹{parseFloat(sub.paid_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-5 text-sm font-semibold text-amber-600">
                      ₹{parseFloat(sub.remaining_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{sub.faculty_name}</div>
                      <div className="text-[10px] text-slate-400">on {formatDate(sub.submitted_at)}</div>
                    </td>
                    <td className="px-6 py-5">
                      {sub.submission_status === 'submitted' ? (
                        <Badge variant="info" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">Pending</Badge>
                      ) : (
                        <Badge variant="success" className="bg-green-100 text-green-700 border-green-200 text-[10px]">Approved</Badge>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        {sub.submission_status === 'submitted' && (
                          <>
                            <button
                              onClick={() => handleApprove(sub.fees_draft_id)}
                              disabled={approveFees.isPending}
                              className="p-2 rounded-md bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white transition-colors"
                              title="Approve Draft"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setRejectingId(sub.fees_draft_id)}
                              className="p-2 rounded-md bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white transition-colors"
                              title="Reject Draft"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}

                        {sub.submission_status === 'approved' && (
                          <button
                            onClick={() => setPublishingId(sub.fees_draft_id)}
                            className="btn btn-primary px-3 py-1.5 flex items-center gap-1 text-xs"
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
    </div>
  );
}
