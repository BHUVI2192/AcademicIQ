import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVerifiedChildren } from '@/hooks/useChildResults';
import { useGetStudentAttendance } from '@/hooks/useAttendance';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { formatDate } from '@/lib/utils';

export function ParentAttendancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: children, isLoading: lsChildren } = useVerifiedChildren(user?.id);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => sessionStorage.getItem('aiq.selectedChildId')
  );

  useEffect(() => {
    if (lsChildren) return;
    if (!children || children.length === 0) {
      navigate('/parent/pending', { replace: true });
      return;
    }
    if (!selectedId || !children.find((c) => c.student_id === selectedId)) {
      if (children.length === 1) {
        sessionStorage.setItem('aiq.selectedChildId', children[0].student_id);
        setSelectedId(children[0].student_id);
      } else {
        navigate('/parent/select-child', { replace: true });
      }
    }
  }, [children, lsChildren, selectedId, navigate]);

  const child = children?.find((c) => c.student_id === selectedId) ?? null;
  const { data: attendance, isLoading: lsAttendance } = useGetStudentAttendance(child?.student_id);

  if (lsChildren || !child) return <CardSkeleton />;

  const presentCount = attendance?.filter(a => a.students_attendance[child.student_id] === 'present').length || 0;
  const totalCount = attendance?.length || 0;
  const attendancePercentage = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in space-y-12 py-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <button
            onClick={() => navigate('/parent/dashboard')}
            className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Dashboard
          </button>
          <div className="space-y-1">
            <h1 className="text-4xl font-light tracking-tight text-slate-900 dark:text-white leading-tight">
              Attendance Records
            </h1>
            <p className="max-w-xl text-lg text-slate-500 font-light leading-relaxed">
              Monitoring presence for <span className="text-slate-900 dark:text-white font-medium">{child.full_name}</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-8 border-none shadow-sm shadow-slate-200/50 dark:shadow-none transition-transform hover:-translate-y-1 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Overall Rate</span>
            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-4xl font-light text-slate-900 dark:text-white">{attendancePercentage.toFixed(1)}%</p>
        </div>
        
        <div className="card p-8 border-none shadow-sm shadow-slate-200/50 dark:shadow-none transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Classes Attended</span>
            <div className="p-2 rounded-md bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-4xl font-light text-slate-900 dark:text-white">{presentCount}</p>
        </div>

        <div className="card p-8 border-none shadow-sm shadow-slate-200/50 dark:shadow-none transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Classes</span>
            <div className="p-2 rounded-md bg-slate-200 dark:bg-slate-800">
              <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
          </div>
          <p className="text-4xl font-light text-slate-900 dark:text-white">{totalCount}</p>
        </div>
      </div>

      {/* Attendance History */}
      <div className="card p-8 border-none shadow-sm shadow-slate-200/50 dark:shadow-none">
        <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">Attendance History</h2>
        
        {lsAttendance ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : attendance && attendance.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {attendance.map((record) => (
              <div key={record.id} className="flex items-center justify-between py-4">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {formatDate(record.attendance_date)}
                  </div>
                  <div className="text-sm text-slate-500 capitalize">
                    {record.session} Session
                  </div>
                </div>
                <div>
                  {record.students_attendance[child.student_id] === 'present' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Present
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                      <XCircle className="h-3.5 w-3.5" />
                      Absent
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-500 font-light">No attendance records found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
