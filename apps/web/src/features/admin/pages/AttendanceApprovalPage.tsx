import { useState, useMemo } from 'react';
import { ChevronDown, Check, X, Send, AlertCircle, Clock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import {
  usePendingAttendanceForReview,
  useApproveAttendance,
  useRejectAttendance,
  usePublishAttendance,
} from '@/hooks/useAttendance';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Skeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';

export function AdminAttendanceApprovalPage() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionRecordId, setActionRecordId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | null>(null);
  const [remarks, setRemarks] = useState('');

  // V1: query directly from the attendance table via RPC
  const { data: pendingRecords, isLoading, refetch } = usePendingAttendanceForReview(role);

  const approveAttendance = useApproveAttendance();
  const rejectAttendance = useRejectAttendance();
  const publishAttendance = usePublishAttendance();

  const filteredRecords = useMemo(() => {
    if (!pendingRecords) return [];
    const term = searchTerm.toLowerCase();
    return pendingRecords.filter(
      (r) =>
        r.batch_name.toLowerCase().includes(term) ||
        r.faculty_name.toLowerCase().includes(term)
    );
  }, [pendingRecords, searchTerm]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-500">Only admins can access this page</p>
      </div>
    );
  }

  const handleApprove = async (record: any) => {
    if (!user?.id) return;
    await approveAttendance.mutateAsync({
      attendance_id: record.id,
      user_id: user.id,
      user_role: role || 'admin',
      remarks: remarks || undefined,
    });
    setActionRecordId(null);
    setSelectedAction(null);
    setRemarks('');
    refetch();
  };

  const handleReject = async (record: any) => {
    if (!user?.id) return;
    await rejectAttendance.mutateAsync({
      attendance_id: record.id,
      user_id: user.id,
      user_role: role || 'admin',
      remarks: remarks || 'Rejected by admin',
    });
    setActionRecordId(null);
    setSelectedAction(null);
    setRemarks('');
    refetch();
  };

  const handlePublish = async (record: any) => {
    if (!user?.id) return;
    await publishAttendance.mutateAsync({
      attendance_id: record.id,
      user_id: user.id,
      user_role: role || 'admin',
    });
    setActionRecordId(null);
    refetch();
  };

  const statusColors: Record<string, string> = {
    submitted: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    published: 'bg-blue-100 text-blue-800',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Attendance Approval</h1>
        <p className="text-slate-600">
          Review and approve attendance submitted by faculty. Once approved, publish to make it visible to parents.
        </p>
      </div>

      {/* Search */}
      <Card>
        <div className="flex gap-3 items-center p-1">
          <Search className="h-5 w-5 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by batch or faculty name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent focus:outline-none text-slate-900 placeholder-slate-400 text-sm"
          />
        </div>
      </Card>

      {/* Records List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : filteredRecords && filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <Card key={record.id} className="space-y-3">
              {/* Header Row */}
              <div
                className="flex items-start justify-between cursor-pointer gap-4"
                onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900">{record.batch_name}</h3>
                    <Badge
                      className={
                        statusColors[record.approval_status] || 'bg-slate-100 text-slate-800'
                      }
                    >
                      {record.approval_status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {format(new Date(record.attendance_date), 'MMM dd, yyyy')} •{' '}
                    <span className="capitalize">{record.session}</span> session
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-slate-900">{record.student_count} students</div>
                  <div className="text-xs text-slate-500">{record.faculty_name}</div>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-slate-400 transition-transform flex-shrink-0 ${
                    expandedId === record.id ? 'rotate-180' : ''
                  }`}
                />
              </div>

              {/* Expanded Details */}
              {expandedId === record.id && (
                <div className="border-t pt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Date</div>
                      <div className="font-semibold">
                        {format(new Date(record.attendance_date), 'MMMM dd, yyyy')}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Session</div>
                      <div className="font-semibold capitalize">{record.session}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Students</div>
                      <div className="font-semibold">{record.student_count}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Submitted by</div>
                      <div className="font-semibold">{record.faculty_name}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Batch</div>
                      <div className="font-semibold">{record.batch_name}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Status</div>
                      <Badge className={statusColors[record.approval_status] || 'bg-slate-100 text-slate-800'}>
                        {record.approval_status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Remarks input */}
                  {actionRecordId === record.id && selectedAction && (
                    <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        {selectedAction === 'approve' ? 'Approval' : 'Rejection'} Remarks
                        {selectedAction === 'reject' && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                        {selectedAction === 'approve' && (
                          <span className="text-slate-400 text-xs ml-1">(optional)</span>
                        )}
                      </label>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder={`Enter ${selectedAction} remarks…`}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        rows={3}
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {/* --- SUBMITTED: show Approve / Reject --- */}
                    {record.approval_status === 'submitted' && (
                      <>
                        {actionRecordId === record.id && selectedAction === 'approve' ? (
                          <>
                            <button
                              onClick={() => {
                                setActionRecordId(null);
                                setSelectedAction(null);
                                setRemarks('');
                              }}
                              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleApprove(record)}
                              disabled={approveAttendance.isPending}
                              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <Check className="h-4 w-4" />
                              {approveAttendance.isPending ? 'Approving…' : 'Confirm Approve'}
                            </button>
                          </>
                        ) : actionRecordId === record.id && selectedAction === 'reject' ? (
                          <>
                            <button
                              onClick={() => {
                                setActionRecordId(null);
                                setSelectedAction(null);
                                setRemarks('');
                              }}
                              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleReject(record)}
                              disabled={rejectAttendance.isPending || !remarks.trim()}
                              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <X className="h-4 w-4" />
                              {rejectAttendance.isPending ? 'Rejecting…' : 'Confirm Reject'}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setActionRecordId(record.id);
                                setSelectedAction('approve');
                                setRemarks('');
                              }}
                              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center justify-center gap-2"
                            >
                              <Check className="h-4 w-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setActionRecordId(record.id);
                                setSelectedAction('reject');
                                setRemarks('');
                              }}
                              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center justify-center gap-2"
                            >
                              <X className="h-4 w-4" />
                              Reject
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {/* --- APPROVED: show Publish --- */}
                    {record.approval_status === 'approved' && (
                      <button
                        onClick={() => handlePublish(record)}
                        disabled={publishAttendance.isPending}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Send className="h-4 w-4" />
                        {publishAttendance.isPending ? 'Publishing…' : 'Publish to Parents'}
                      </button>
                    )}

                    {/* --- PUBLISHED --- */}
                    {record.approval_status === 'published' && (
                      <div className="flex-1 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-center text-sm font-medium text-green-700 flex items-center justify-center gap-2">
                        <Check className="h-4 w-4" />
                        Published to Parents
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))
        ) : (
          <EmptyState
            title="No Pending Attendance"
            description="All faculty submissions have been reviewed, or no submissions have been made yet."
            icon={AlertCircle}
          />
        )}
      </div>
    </div>
  );
}
