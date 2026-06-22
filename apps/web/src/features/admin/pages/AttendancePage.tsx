import { useState, useEffect } from 'react';
import { Card } from '@/components/Card';
import { Skeleton } from '@/components/LoadingSkeleton';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { 
  Search, Calendar, ChevronDown, CheckCircle, XCircle, 
  CheckCircle2, Save, Send, AlertCircle, ShieldAlert, Check, Users, Sparkles
} from 'lucide-react';
import { useBatches } from '@/hooks/useBatches';
import { 
  useGetBatchAttendanceHistory, 
  useGetBatchAttendanceDetails, 
  useSaveAttendance, 
  useApproveAttendance, 
  usePublishAttendance 
} from '@/hooks/useAttendance';
import { useStudentsInBatch } from '@/hooks/useStudents';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export function AttendancePage() {
  const [activeTab, setActiveTab] = useState<'history' | 'mark'>('history');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const { data: batches, isLoading: isLoadingBatches } = useBatches();
  
  const filteredBatches = batches?.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.stream ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header & Tab Toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight font-outfit">Attendance Control</h1>
          <p className="text-slate-600">Mark student attendance records directly or review history logs</p>
        </div>
        <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl self-start md:self-auto border border-slate-200 shadow-inner">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 font-outfit ${
              activeTab === 'history'
                ? 'bg-white text-slate-950 shadow-md ring-1 ring-black/5'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            Attendance History
          </button>
          <button
            onClick={() => setActiveTab('mark')}
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 font-outfit ${
              activeTab === 'mark'
                ? 'bg-white text-slate-950 shadow-md ring-1 ring-black/5'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            Mark Attendance
          </button>
        </div>
      </div>

      {activeTab === 'history' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Batches List */}
          <div className="col-span-1 space-y-4">
            <Card className="p-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search batches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>
              
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {isLoadingBatches ? (
                  [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)
                ) : filteredBatches?.length ? (
                  filteredBatches.map(batch => (
                    <button
                      key={batch.id}
                      onClick={() => setSelectedBatchId(batch.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedBatchId === batch.id
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-medium text-slate-900">{batch.name}</div>
                      <div className="text-sm text-slate-500">{batch.stream || 'GENERAL'}</div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No batches found
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Attendance History */}
          <div className="col-span-2">
            {selectedBatchId ? (
              <BatchAttendanceHistory batchId={selectedBatchId} />
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg text-slate-500">
                <Calendar className="h-12 w-12 text-slate-300 mb-4 animate-pulse" />
                <p className="font-semibold text-slate-700">Select a batch to view its attendance history</p>
                <p className="text-xs text-slate-500 mt-1">Pick a batch from the sidebar to inspect complete historical logs</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <MarkAttendanceSection />
      )}
    </div>
  );
}

function BatchAttendanceHistory({ batchId }: { batchId: string }) {
  const { data: history, isLoading } = useGetBatchAttendanceHistory(batchId);

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-800 border border-slate-200',
    submitted: 'bg-amber-50 text-amber-800 border border-amber-200',
    approved: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    published: 'bg-blue-50 text-blue-800 border border-blue-200',
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900 font-outfit">Historical Records</h2>
        {history && history.length > 0 && (
          <Badge className="bg-slate-100 text-slate-800">
            {history.length} Session{history.length > 1 ? 's' : ''} Logs
          </Badge>
        )}
      </div>
      
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : history && history.length > 0 ? (
        <div className="space-y-4">
          {history.map((record) => (
            <div key={record.id} className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition duration-300 bg-white shadow-sm/50">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900 text-base">
                      {format(new Date(record.attendance_date), 'MMMM d, yyyy')}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${statusColors[record.approval_status] || 'bg-slate-100 text-slate-800 border border-slate-200'}`}>
                      {record.approval_status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 flex items-center gap-1.5 font-medium">
                    <span className="capitalize px-2 py-0.5 bg-slate-100 rounded text-slate-700 text-xs font-semibold">{record.session} Session</span>
                    <span>•</span>
                    <span>Marked by <span className="font-semibold text-slate-700">{record.profiles?.full_name || 'Unknown Faculty'}</span></span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-light text-slate-900 tracking-tight font-outfit">{Object.keys(record.students_attendance || {}).length}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Students</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-500 bg-slate-50/20 border border-dashed border-slate-200 rounded-lg">
          <Calendar className="h-10 w-10 mx-auto text-slate-300 mb-3" />
          <p className="font-semibold text-slate-700">No attendance records found</p>
          <p className="text-xs text-slate-500 mt-1">This batch does not have any recorded attendance sessions.</p>
        </div>
      )}
    </Card>
  );
}

function MarkAttendanceSection() {
  const { user, role } = useAuth();
  
  // State
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSession, setSelectedSession] = useState<'morning' | 'evening'>('morning');
  const [attendanceData, setAttendanceData] = useState<Record<string, 'present' | 'absent'>>({});
  const [isProcessingPublish, setIsProcessingPublish] = useState(false);

  // Queries
  const { data: batches, isLoading: batchesLoading } = useBatches();
  const { data: students, isLoading: studentsLoading } = useStudentsInBatch(selectedBatchId);
  const { data: existingAttendance, isLoading: attendanceLoading } = useGetBatchAttendanceDetails(
    selectedBatchId,
    selectedDate,
    selectedSession
  );

  // Mutations
  const saveAttendance = useSaveAttendance();
  const approveAttendance = useApproveAttendance();
  const publishAttendance = usePublishAttendance();

  // Populate data when existing attendance or students change
  useEffect(() => {
    if (existingAttendance && existingAttendance.length > 0) {
      const data: Record<string, 'present' | 'absent'> = {};
      existingAttendance.forEach((record: any) => {
        data[record.student_id] = record.status;
      });
      setAttendanceData(data);
    } else if (students && students.length > 0) {
      // Default new marking forms to all present
      const data: Record<string, 'present' | 'absent'> = {};
      students.forEach((student: any) => {
        data[student.id] = attendanceData[student.id] || 'present';
      });
      setAttendanceData(data);
    } else {
      setAttendanceData({});
    }
  }, [existingAttendance, students, selectedBatchId]);

  const handleToggleAttendance = (studentId: string) => {
    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present',
    }));
  };

  const handleBulkToggle = (status: 'present' | 'absent') => {
    if (!students || students.length === 0) return;
    const data: Record<string, 'present' | 'absent'> = {};
    students.forEach((student: any) => {
      data[student.id] = status;
    });
    setAttendanceData(data);
    toast.success(`Marked all students as ${status}`);
  };

  const handleSave = async () => {
    if (!selectedBatchId || !user?.id) {
      toast.error('Please select a valid batch first');
      return;
    }

    try {
      await saveAttendance.mutateAsync({
        batch_id: selectedBatchId,
        attendance_date: selectedDate,
        session: selectedSession,
        students_attendance: attendanceData,
        user_id: user.id,
      });
    } catch (err) {
      console.error('Error saving attendance:', err);
    }
  };

  const handleSaveAndPublish = async () => {
    if (!selectedBatchId || !user?.id) {
      toast.error('Please select a valid batch first');
      return;
    }

    setIsProcessingPublish(true);
    const loadingToast = toast.loading('Executing publish sequence...');

    try {
      // Step 1: Save attendance as draft/updated record
      const saved = await saveAttendance.mutateAsync({
        batch_id: selectedBatchId,
        attendance_date: selectedDate,
        session: selectedSession,
        students_attendance: attendanceData,
        user_id: user.id,
      });

      if (!saved || !saved.id) {
        throw new Error('Save transaction failed');
      }

      const attendanceId = saved.id;
      const currentStatus = saved.approval_status || 'draft';

      // Step 2: Auto-approve if in draft or submitted stage (requires approved status to publish)
      if (currentStatus === 'draft' || currentStatus === 'submitted') {
        await approveAttendance.mutateAsync({
          attendance_id: attendanceId,
          user_id: user.id,
          user_role: role || 'admin',
          remarks: 'Approved directly by Administrator during marking override',
        });
      }

      // Step 3: Trigger publish to make it visible to parents
      await publishAttendance.mutateAsync({
        attendance_id: attendanceId,
        user_id: user.id,
        user_role: role || 'admin',
      });

      toast.success('Attendance saved and published to parents successfully!', { id: loadingToast });
    } catch (err: any) {
      console.error('Publish transaction failed:', err);
      toast.error(err.message || 'Failed to complete publish sequence', { id: loadingToast });
    } finally {
      setIsProcessingPublish(false);
    }
  };

  const presentCount = Object.values(attendanceData).filter((status) => status === 'present').length;
  const absentCount = Object.values(attendanceData).filter((status) => status === 'absent').length;
  const totalCount = students?.length || 0;

  const approvalStatus = existingAttendance?.[0]?.approval_status || null;
  const markedByName = existingAttendance?.[0]?.marked_by_name;
  const markedByRole = existingAttendance?.[0]?.marked_by_role;

  return (
    <div className="space-y-6">
      {/* Configuration Header Card */}
      <Card className="p-6 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          {/* Batch */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-850 font-outfit">Select Batch</label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white outline-none font-medium text-slate-800 transition"
              disabled={batchesLoading}
            >
              <option value="">Choose batch...</option>
              {batches?.map((batch: any) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-850 font-outfit">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white outline-none font-medium text-slate-800 transition"
            />
          </div>

          {/* Session Toggle */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-850 font-outfit">Session</label>
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              {(['morning', 'evening'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSession(s)}
                  className={`flex-1 py-1.5 rounded-md font-semibold text-sm transition-all duration-300 font-outfit ${
                    selectedSession === s
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'text-slate-650 hover:text-slate-950'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Summarized Quick Stats */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-around text-center">
            <div>
              <div className="text-xl font-bold text-emerald-600">{presentCount}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Present</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-xl font-bold text-rose-600">{absentCount}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Absent</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-xl font-bold text-slate-950">{totalCount}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Record State and Markers Banner */}
      {selectedBatchId && (
        approvalStatus ? (
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            approvalStatus === 'published'
              ? 'bg-blue-55/10 border-blue-200 text-blue-900'
              : approvalStatus === 'approved'
              ? 'bg-emerald-55/10 border-emerald-200 text-emerald-900'
              : approvalStatus === 'submitted'
              ? 'bg-amber-55/10 border-amber-200 text-amber-900 animate-pulse'
              : 'bg-slate-55/10 border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {approvalStatus === 'published' ? (
                  <Send className="h-5 w-5 text-blue-600" />
                ) : approvalStatus === 'approved' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-amber-600" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-sm font-outfit">
                  {approvalStatus === 'published'
                    ? 'Published to Parents'
                    : approvalStatus === 'approved'
                    ? 'Attendance Approved'
                    : approvalStatus === 'submitted'
                    ? 'Awaiting Review'
                    : 'Draft Attendance Saved'}
                </h4>
                <p className="text-xs opacity-90 mt-0.5 font-medium">
                  This record was marked by <span className="font-semibold text-slate-950">{markedByName || 'System'}</span> ({markedByRole?.toUpperCase() || 'UNKNOWN'}).
                  {approvalStatus === 'published' 
                    ? ' It is currently live and visible on the parent portal.' 
                    : ' Changes are editable but parents will only see details once published.'}
                </p>
              </div>
            </div>
            <Badge className={`self-start sm:self-auto ${
              approvalStatus === 'published'
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : approvalStatus === 'approved'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : approvalStatus === 'submitted'
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-slate-200 text-slate-800 border border-slate-300'
            }`}>
              {approvalStatus.toUpperCase()}
            </Badge>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/10 text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <AlertCircle className="h-5 w-5 text-rose-600 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-sm font-outfit">Attendance Not Marked Yet</h4>
                <p className="text-xs opacity-90 mt-0.5 font-medium">
                  No attendance record exists for this batch, date, and session combination. You can configure and save a new attendance roster below.
                </p>
              </div>
            </div>
            <Badge className="bg-rose-100 text-rose-805 border border-rose-200 self-start sm:self-auto uppercase font-bold">
              Not Marked
            </Badge>
          </div>
        )
      )}

      {/* Main Student Roster Grid */}
      {selectedBatchId ? (
        <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
          {studentsLoading || attendanceLoading ? (
            <div className="space-y-3.5">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : students && students.length > 0 ? (
            <>
              {/* Presets and Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-700 font-outfit">Student Roster ({students.length})</span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleBulkToggle('present')}
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg transition duration-200 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    All Present
                  </button>
                  <button
                    onClick={() => handleBulkToggle('absent')}
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition duration-200 flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    All Absent
                  </button>
                </div>
              </div>

              {/* Roster Header */}
              <div className="grid grid-cols-12 gap-4 font-semibold text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5">
                <div className="col-span-2 sm:col-span-1 pl-2">Roll</div>
                <div className="col-span-6 sm:col-span-7">Student Name</div>
                <div className="col-span-4 text-center">Attendance Status</div>
              </div>

              {/* Student Rows */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {students.map((student: any) => {
                  const isPresent = attendanceData[student.id] === 'present';
                  return (
                    <div
                      key={student.id}
                      className={`grid grid-cols-12 gap-4 p-3 rounded-xl items-center border transition-all duration-300 ${
                        isPresent
                          ? 'bg-emerald-50/20 border-emerald-100'
                          : 'bg-rose-50/10 border-rose-100'
                      }`}
                    >
                      <div className="col-span-2 sm:col-span-1 text-sm font-semibold text-slate-800 pl-2">
                        {student.roll_number || 'N/A'}
                      </div>
                      <div className="col-span-6 sm:col-span-7">
                        <div className="text-sm font-bold text-slate-900 font-outfit">{student.full_name}</div>
                        <div className="text-[10px] text-slate-400 font-medium">UID: {student.id.slice(0, 8)}</div>
                      </div>
                      <div className="col-span-4 flex justify-center gap-1.5">
                        <button
                          onClick={() => handleToggleAttendance(student.id)}
                          className={`px-4 py-2 rounded-lg font-bold text-xs transition duration-300 flex items-center gap-1.5 border shadow-sm ${
                            isPresent
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Present</span>
                        </button>
                        <button
                          onClick={() => handleToggleAttendance(student.id)}
                          className={`px-4 py-2 rounded-lg font-bold text-xs transition duration-300 flex items-center gap-1.5 border shadow-sm ${
                            !isPresent
                              ? 'bg-rose-600 text-white border-rose-700'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Absent</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-100">
                <button
                  onClick={handleSave}
                  disabled={saveAttendance.isPending}
                  className="flex-1 py-3 px-4 border border-slate-250 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition duration-300 flex items-center justify-center gap-2 disabled:opacity-50 font-outfit"
                >
                  <Save className="h-4.5 w-4.5" />
                  Save Draft
                </button>
                <button
                  onClick={handleSaveAndPublish}
                  disabled={isProcessingPublish}
                  className="flex-1 py-3 px-4 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-sm transition duration-300 flex items-center justify-center gap-2 shadow-md disabled:opacity-50 font-outfit"
                >
                  <Send className="h-4.5 w-4.5" />
                  {isProcessingPublish ? 'Publishing...' : 'Save & Publish to Parents'}
                </button>
              </div>
            </>
          ) : (
            <EmptyState
              title="No Students Found"
              description="This batch does not contain any registered students."
              icon={AlertCircle}
            />
          )}
        </Card>
      ) : (
        <Card className="text-center py-16 border-2 border-dashed border-slate-200 bg-slate-50/10 rounded-xl">
          <Sparkles className="h-10 w-10 mx-auto text-slate-450 mb-3 animate-pulse" />
          <p className="font-semibold text-slate-700 font-outfit">Start Marking Attendance</p>
          <p className="text-xs text-slate-500 mt-1">Select a batch from the configurations above to load the student roster.</p>
        </Card>
      )}
    </div>
  );
}
