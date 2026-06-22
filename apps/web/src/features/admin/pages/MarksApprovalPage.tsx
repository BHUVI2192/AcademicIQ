import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  RefreshCw,
  Loader,
  Search,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDirectory } from '@/context/DirectoryContext';
import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { formatDate } from '@/lib/utils';
import type { ApprovalStatus } from '@shared';

interface PendingTest {
  test_id: string;
  test_title: string;
  batch_name: string;
  exam_category: string;
  submitted_by_name: string;
  submitted_by_email: string;
  marks_count: number;
  submitted_at: string;
  marks_status: string;
}

interface TestMarks {
  id: string;
  student_id: string;
  student_roll_number: string;
  student_name: string;
  subject_id: string;
  subject_name: string;
  max_marks: number;
  marks_obtained: number | null;
  num_attempted: number | null;
  num_incorrect: number | null;
  is_absent: boolean;
  entered_by_name: string;
  approval_status: ApprovalStatus;
}

function usePendingApprovals(collegeId?: string | null) {
  return useQuery({
    queryKey: ['pending-marks-approvals', collegeId],
    queryFn: async () => {
      if (!collegeId) return [];

      const { data, error } = await supabase
        .rpc('get_pending_marks_approvals', { p_college_id: collegeId });

      if (error) {
        console.error('Error fetching pending approvals:', error);
        return [];
      }

      return (data as PendingTest[]) || [];
    },
    enabled: !!collegeId,
  });
}

function useTestMarksDetails(testId?: string) {
  return useQuery({
    queryKey: ['test-marks-details', testId],
    queryFn: async () => {
      if (!testId) return [];

      const { data, error } = await supabase
        .from('marks')
        .select(`
          id,
          student_id,
          subject_id,
          marks_obtained,
          num_attempted,
          num_incorrect,
          is_absent,
          approval_status,
          admin_remarks,
          entered_by,
          entered_at,
          students:student_id(roll_number, full_name),
          test_subjects:subject_id(subject_name, max_marks),
          profiles:entered_by(full_name)
        `)
        .eq('test_id', testId)
        .order('students(roll_number)');

      if (error) {
        console.error('Error fetching marks details:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!testId,
  });
}

export function MarksApprovalPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedCollegeId } = useDirectory();

  const { data: pendingTests, isLoading } = usePendingApprovals(selectedCollegeId);
  const [selectedTest, setSelectedTest] = useState<PendingTest | null>(null);
  const { data: testMarks } = useTestMarksDetails(selectedTest?.test_id);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  const [remarksOpen, setRemarksOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  const filtered = useMemo(() => {
    let result = pendingTests || [];

    if (search) {
      result = result.filter(
        (t) =>
          t.test_title.toLowerCase().includes(search.toLowerCase()) ||
          t.batch_name.toLowerCase().includes(search.toLowerCase()) ||
          t.submitted_by_name.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (filterCategory) {
      result = result.filter((t) => t.exam_category === filterCategory);
    }

    return result;
  }, [pendingTests, search, filterCategory]);

  const categories = useMemo(() => {
    const cats = new Set((pendingTests || []).map((t) => t.exam_category));
    return Array.from(cats).sort();
  }, [pendingTests]);

  const handleApprove = async () => {
    if (!selectedTest || !user) return;

    setApproving(true);
    try {
      const { data, error } = await supabase
        .rpc('approve_marks_for_test', {
          p_test_id: selectedTest.test_id,
          p_admin_id: user.id,
          p_remarks: remarks || null,
        });

      if (error) {
        console.error('Error approving marks:', error);
        toast.error('Failed to approve marks');
        return;
      }

      const res = data as any;
      if (!res?.success) {
        toast.error(res?.message || 'Failed to approve marks');
        return;
      }

      toast.success(`✓ ${res.marks_count} marks approved`);
      setSelectedTest(null);
      setRemarks('');
      setRemarksOpen(false);

      // Refresh the list
      queryClient.invalidateQueries({ queryKey: ['pending-marks-approvals'] });
    } catch (err) {
      console.error('Approval error:', err);
      toast.error('Error approving marks');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTest || !user) return;

    if (!remarks.trim()) {
      toast.error('Please provide remarks for rejection');
      return;
    }

    setRejecting(true);
    try {
      const { data, error } = await supabase
        .rpc('reject_marks_for_test', {
          p_test_id: selectedTest.test_id,
          p_admin_id: user.id,
          p_remarks: remarks,
        });

      if (error) {
        console.error('Error rejecting marks:', error);
        toast.error('Failed to reject marks');
        return;
      }

      const res = data as any;
      if (!res?.success) {
        toast.error(res?.message || 'Failed to reject marks');
        return;
      }

      toast.success(`✗ ${res.marks_count} marks rejected - Faculty notified`);
      setSelectedTest(null);
      setRemarks('');
      setRemarksOpen(false);
      setConfirmReject(false);

      // Refresh the list
      queryClient.invalidateQueries({ queryKey: ['pending-marks-approvals'] });
    } catch (err) {
      console.error('Rejection error:', err);
      toast.error('Error rejecting marks');
    } finally {
      setRejecting(false);
    }
  };

  if (!selectedTest) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900">Marks Approval Queue</h1>
            <p className="text-gray-600">Review and approve marks submitted by faculty</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
            Back
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center bg-white p-4 rounded-lg border border-gray-200">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search by test, batch, or faculty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 outline-none text-gray-900"
          />
          {categories.length > 0 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">All Exams</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Pending Tests List */}
        {isLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No Pending Approvals"
            description="All marks have been reviewed. Great work!"
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((test) => (
              <div
                key={test.test_id}
                className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition cursor-pointer"
                onClick={() => setSelectedTest(test)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{test.test_title}</h3>
                        <p className="text-sm text-gray-600">
                          {test.batch_name} · {test.exam_category}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-sm text-gray-600">Submitted by</p>
                      <p className="font-semibold text-gray-900">{test.submitted_by_name}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">{test.marks_count} Marks</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(test.submitted_at)}
                      </p>
                    </div>

                    <Badge variant="warning">
                      <span className="flex items-center gap-1">
                        <Clock size={16} />
                        Pending
                      </span>
                    </Badge>

                    <ChevronDown size={20} className="text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Detailed Review View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelectedTest(null)}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <ArrowLeft size={20} />
          Back to Queue
        </button>
      </div>

      {/* Test Info Card */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{selectedTest.test_title}</h2>
            <p className="text-gray-600">
              {selectedTest.batch_name} · {selectedTest.exam_category}
            </p>
          </div>
          <Badge variant="warning">
            <span className="flex items-center gap-1">
              <Clock size={16} />
              Awaiting Approval
            </span>
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Submitted by</p>
            <p className="font-semibold text-gray-900">{selectedTest.submitted_by_name}</p>
            <p className="text-xs text-gray-500">{selectedTest.submitted_by_email}</p>
          </div>
          <div>
            <p className="text-gray-600">Marks Count</p>
            <p className="font-semibold text-gray-900">{selectedTest.marks_count}</p>
          </div>
          <div>
            <p className="text-gray-600">Submitted</p>
            <p className="font-semibold text-gray-900">{formatDate(selectedTest.submitted_at)}</p>
          </div>
        </div>
      </div>

      {/* Marks Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  Student
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  Subject
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                  Max Marks
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                  Marks Obtained
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                  Attempted
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {testMarks && testMarks.length > 0 ? (
                testMarks.map((mark: any) => (
                  <tr key={mark.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {mark.students?.roll_number} · {mark.students?.full_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {mark.test_subjects?.subject_name}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                      {mark.test_subjects?.max_marks}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                      {mark.is_absent ? (
                        <span className="text-red-600">Absent</span>
                      ) : (
                        mark.marks_obtained
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {mark.num_attempted || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={
                          mark.approval_status === 'approved'
                            ? 'success'
                            : mark.approval_status === 'rejected'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {mark.approval_status.charAt(0).toUpperCase() +
                          mark.approval_status.slice(1)}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-600">
                    No marks found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 sticky bottom-0 bg-white p-4 border-t border-gray-200 rounded-lg">
        <button
          onClick={() => setRemarksOpen(true)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 font-medium transition"
        >
          <ThumbsUp size={20} />
          Approve Marks
        </button>
        <button
          onClick={() => setConfirmReject(true)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium transition"
        >
          <ThumbsDown size={20} />
          Reject Marks
        </button>
        <button
          onClick={() => setSelectedTest(null)}
          className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium transition"
        >
          Cancel
        </button>
      </div>

      {/* Remarks Modal */}
      <Modal
        open={remarksOpen}
        onClose={() => setRemarksOpen(false)}
        title="Approve Marks"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 mb-2">Optionally add remarks visible to faculty</p>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Remarks (Optional)
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Verified all calculations. Marks approved."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
            >
              {approving ? <Loader size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
              {approving ? 'Approving...' : 'Approve Marks'}
            </button>
            <button
              onClick={() => setRemarksOpen(false)}
              className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Reject Dialog */}
      <Modal
        open={confirmReject}
        onClose={() => setConfirmReject(false)}
        title="Reject Marks?"
      >
        <div className="space-y-4">
          <div className="flex gap-3 mb-2">
            <div className="shrink-0">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Faculty will be notified and can re-enter marks. Provide remarks explaining what needs to be corrected.
            </p>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Remarks for Rejection
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Explain what needs to be corrected..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (remarks.trim()) {
                  handleReject();
                } else {
                  toast.error('Please provide remarks for rejection');
                }
              }}
              disabled={rejecting}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
            >
              {rejecting ? <Loader size={20} className="animate-spin" /> : <ThumbsDown size={20} />}
              {rejecting ? 'Rejecting...' : 'Reject Marks'}
            </button>
            <button
              onClick={() => setConfirmReject(false)}
              className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
