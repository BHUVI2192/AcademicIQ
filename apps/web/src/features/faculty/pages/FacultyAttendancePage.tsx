import { useState, useEffect } from 'react';
import { ChevronRight, Save, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useFacultyAssignedBatches } from '@/hooks/useBatches';
import { useGetBatchAttendanceDetails, useSaveAttendance, useCheckSessionLock, useSubmitAttendance } from '@/hooks/useAttendance';
import { useStudentsInBatch } from '@/hooks/useStudents';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Skeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';

export function FacultyAttendancePage() {
  const { user, role } = useAuth();
  const isFaculty = role === 'faculty';

  // State
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSession, setSelectedSession] = useState<'morning' | 'evening'>('morning');
  const [attendanceData, setAttendanceData] = useState<Record<string, 'present' | 'absent'>>({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Queries
  const { data: batches, isLoading: batchesLoading } = useFacultyAssignedBatches(user?.id);
  const { data: students, isLoading: studentsLoading } = useStudentsInBatch(selectedBatchId);
  const { data: existingAttendance, isLoading: attendanceLoading } = useGetBatchAttendanceDetails(
    selectedBatchId,
    selectedDate,
    selectedSession
  );
  const { data: sessionLock, isLoading: lockLoading } = useCheckSessionLock(
    selectedBatchId,
    selectedDate,
    selectedSession,
    user?.id
  );

  // Mutations
  const saveAttendance = useSaveAttendance();
  const submitAttendance = useSubmitAttendance();

  // Initialize attendance data from existing records or from students list
  useEffect(() => {
    if (existingAttendance && existingAttendance.length > 0) {
      const data: Record<string, 'present' | 'absent'> = {};
      existingAttendance.forEach((record: any) => {
        data[record.student_id] = record.status;
      });
      setAttendanceData(data);
    } else if (students && students.length > 0) {
      // Initialize all students as unmarked
      const data: Record<string, 'present' | 'absent'> = {};
      students.forEach((student: any) => {
        data[student.id] = attendanceData[student.id] || 'present'; // Default to present if not set
      });
      setAttendanceData(data);
    }
  }, [existingAttendance, students]);

  // Permission check
  if (!isFaculty) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-500">Only faculty can mark attendance</p>
      </div>
    );
  }

  if (!batches || batches.length === 0) {
    return (
      <EmptyState
        title="No Batches Assigned"
        description="You don't have any batches assigned to you yet."
        icon={AlertCircle}
      />
    );
  }

  const selectedBatch = batches.find((b: any) => b.id === selectedBatchId);

  const handleToggleAttendance = (studentId: string) => {
    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present',
    }));
  };

  const handleSave = async () => {
    if (!selectedBatchId || !user?.id) {
      console.error('Missing batch or user');
      return;
    }

    await saveAttendance.mutateAsync({
      batch_id: selectedBatchId,
      attendance_date: selectedDate,
      session: selectedSession,
      students_attendance: attendanceData,
      user_id: user.id,
    });
  };

  const handleSubmit = async () => {
    if (!selectedBatchId || !user?.id) return;
    await submitAttendance.mutateAsync({
      batch_id: selectedBatchId,
      attendance_date: selectedDate,
      session: selectedSession,
      students_attendance: attendanceData,
      user_id: user.id,
    });
    setShowSubmitModal(false);
  };

  const presentCount = Object.values(attendanceData).filter((s) => s === 'present').length;
  const absentCount = Object.values(attendanceData).filter((s) => s === 'absent').length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Mark Attendance</h1>
        <p className="text-slate-600">Select batch, date and mark student attendance</p>
      </div>

      {/* Controls */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Batch Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Batch</label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={batchesLoading}
            >
              <option value="">Select a batch...</option>
              {batches?.map((batch: any) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Session */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Session</label>
            <div className="flex gap-2">
              {(['morning', 'evening'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSession(s)}
                  className={`flex-1 py-2 rounded-lg font-medium transition ${
                    selectedSession === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Summary</label>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Present:</span>
                <span className="font-bold text-green-600">{presentCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Absent:</span>
                <span className="font-bold text-red-600">{absentCount}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Students List */}
      {selectedBatchId ? (
        <Card className="space-y-2">
          {studentsLoading || attendanceLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : students && students.length > 0 ? (
            <>
              {sessionLock?.is_locked && (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/20 text-amber-800 dark:text-amber-300 flex items-center gap-3 mb-4">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Attendance Session Locked</p>
                    <p className="text-xs">
                      This session is locked because it was marked by {sessionLock.locked_by_role === 'admin' ? 'an Admin' : `Faculty (${sessionLock.locked_by_user})`}. Edits are disabled.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-12 gap-4 mb-4 font-semibold text-slate-700 dark:text-slate-300 border-b pb-3">
                <div className="col-span-1">Roll</div>
                <div className="col-span-6">Student Name</div>
                <div className="col-span-5">Attendance</div>
              </div>

              <div className="space-y-2">
                {students.map((student: any) => (
                  <div
                    key={student.id}
                    className={`grid grid-cols-12 gap-4 p-3 rounded-lg items-center transition ${
                      attendanceData[student.id] === 'present'
                        ? 'bg-green-50 border border-green-200'
                        : attendanceData[student.id] === 'absent'
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="col-span-1 text-sm font-medium">{student.roll_number}</div>
                    <div className="col-span-6 text-sm">{student.full_name}</div>
                    <div className="col-span-5 flex gap-2">
                      <button
                        onClick={() => handleToggleAttendance(student.id)}
                        disabled={sessionLock?.is_locked}
                        className={`flex-1 py-2 rounded-lg font-medium text-sm transition ${
                          attendanceData[student.id] === 'present'
                            ? 'bg-green-500 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        } ${sessionLock?.is_locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <CheckCircle2 className="inline mr-1 h-4 w-4" />
                        Present
                      </button>
                      <button
                        onClick={() => handleToggleAttendance(student.id)}
                        disabled={sessionLock?.is_locked}
                        className={`flex-1 py-2 rounded-lg font-medium text-sm transition ${
                          attendanceData[student.id] === 'absent'
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        } ${sessionLock?.is_locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        Absent
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="No Students" description="This batch has no students." />
          )}
        </Card>
      ) : (
        <Card className="text-center py-12">
          <p className="text-slate-500">Select a batch to mark attendance</p>
        </Card>
      )}

      {/* Action Buttons */}
      {selectedBatchId && students && students.length > 0 && (
        <div className="flex gap-4 sticky bottom-4">
          <button
            onClick={handleSave}
            disabled={saveAttendance.isPending || sessionLock?.is_locked}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5" />
            {saveAttendance.isPending ? 'Saving...' : 'Save Changes'}
          </button>

          <button
            onClick={() => setShowSubmitModal(true)}
            disabled={submitAttendance.isPending || sessionLock?.is_locked}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
            {submitAttendance.isPending ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md space-y-4">
            <h2 className="text-xl font-bold">Submit Attendance?</h2>
            <p className="text-slate-600">
              You're about to submit {presentCount} students as present and {absentCount} as absent for {selectedBatch?.name} on{' '}
              {format(new Date(selectedDate), 'MMM dd, yyyy')} ({selectedSession}).
            </p>
            <p className="text-sm text-slate-500">
              After submission, only admins can approve or reject this record.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitAttendance.isPending}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {submitAttendance.isPending ? 'Submitting...' : 'Yes, Submit'}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
