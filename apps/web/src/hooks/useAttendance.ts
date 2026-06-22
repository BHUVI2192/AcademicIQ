import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

// ============================================================================
// Types
// ============================================================================

export interface AttendanceRecord {
  id: string;
  batch_id: string;
  attendance_date: string;
  session: 'morning' | 'evening';
  students_attendance: Record<string, 'present' | 'absent'>;
  marked_by: string;
  approval_status: 'draft' | 'submitted' | 'approved' | 'published';
  admin_remarks?: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
  } | null;
}

export interface PendingAttendanceItem {
  id: string;
  batch_id: string;
  batch_name: string;
  attendance_date: string;
  session: string;
  marked_by_id: string;
  faculty_name: string;
  approval_status: string;
  student_count: number;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get attendance records for a specific student (parent view)
 */
export function useGetStudentAttendance(studentId?: string) {
  return useQuery({
    queryKey: ['student-attendance', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .or(`students_attendance.cs.{"${studentId}":"present"},students_attendance.cs.{"${studentId}":"absent"}`)
        .order('attendance_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
    enabled: !!studentId,
  });
}

/**
 * Get attendance history for a specific batch
 */
export function useGetBatchAttendanceHistory(batchId?: string) {
  return useQuery({
    queryKey: ['batch-attendance-history', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select(`*, profiles:marked_by(full_name)`)
        .eq('batch_id', batchId)
        .order('attendance_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
    enabled: !!batchId,
  });
}

/**
 * Get attendance details for a specific batch/date/session (student-level breakdown)
 */
export function useGetBatchAttendanceDetails(
  batchId?: string,
  attendanceDate?: string,
  session?: 'morning' | 'evening'
) {
  return useQuery({
    queryKey: ['batch-attendance-details', batchId, attendanceDate, session],
    queryFn: async () => {
      if (!batchId || !attendanceDate || !session) return [];
      const { data, error } = await supabase.rpc('get_batch_attendance_details', {
        p_batch_id: batchId,
        p_attendance_date: attendanceDate,
        p_session: session,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!batchId && !!attendanceDate && !!session,
  });
}

/**
 * Save attendance as draft (faculty)
 * Creates or updates the attendance record for this batch/date/session.
 */
export function useSaveAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      batch_id: string;
      attendance_date: string;
      session: 'morning' | 'evening';
      students_attendance: Record<string, 'present' | 'absent'>;
      user_id: string;
    }) => {
      // Check if ANY record exists for this batch/date/session (unique constraint enforces 1 per slot)
      const { data: existing, error: checkError } = await supabase
        .from('attendance')
        .select('id, approval_status, marked_by')
        .eq('batch_id', input.batch_id)
        .eq('attendance_date', input.attendance_date)
        .eq('session', input.session)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        // Only the owner can edit, and only if it's draft/submitted
        if (existing.marked_by !== input.user_id) {
          throw new Error('This attendance session was marked by another user. Only the original marker can edit it.');
        }
        if (!['draft', 'submitted'].includes(existing.approval_status)) {
          throw new Error('Cannot edit attendance that has already been approved or published.');
        }
        const { data, error } = await supabase
          .from('attendance')
          .update({
            students_attendance: input.students_attendance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('attendance')
          .insert({
            batch_id: input.batch_id,
            attendance_date: input.attendance_date,
            session: input.session,
            students_attendance: input.students_attendance,
            marked_by: input.user_id,
            approval_status: 'draft',
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-attendance-details'] });
      queryClient.invalidateQueries({ queryKey: ['session-lock'] });
      toast.success('Attendance saved as draft');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save attendance');
    },
  });
}

/**
 * Submit attendance for admin review (faculty)
 * Saves the current data AND sets approval_status to 'submitted' atomically.
 */
export function useSubmitAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      batch_id: string;
      attendance_date: string;
      session: 'morning' | 'evening';
      students_attendance: Record<string, 'present' | 'absent'>;
      user_id: string;
    }) => {
      // Check if ANY record exists for this batch/date/session (unique constraint enforces 1 per slot)
      const { data: existing, error: checkError } = await supabase
        .from('attendance')
        .select('id, approval_status, marked_by')
        .eq('batch_id', input.batch_id)
        .eq('attendance_date', input.attendance_date)
        .eq('session', input.session)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        // Only the owner can submit
        if (existing.marked_by !== input.user_id) {
          throw new Error('This attendance session was already marked by another user. You cannot submit it.');
        }
        if (!['draft', 'submitted'].includes(existing.approval_status)) {
          throw new Error('Cannot submit attendance that has already been approved or published.');
        }
        // Update data and set submitted
        const { data, error } = await supabase
          .from('attendance')
          .update({
            students_attendance: input.students_attendance,
            approval_status: 'submitted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // No record exists — create new record directly as submitted
        const { data, error } = await supabase
          .from('attendance')
          .insert({
            batch_id: input.batch_id,
            attendance_date: input.attendance_date,
            session: input.session,
            students_attendance: input.students_attendance,
            marked_by: input.user_id,
            approval_status: 'submitted',
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-attendance-details'] });
      queryClient.invalidateQueries({ queryKey: ['session-lock'] });
      queryClient.invalidateQueries({ queryKey: ['pending-attendance-for-review'] });
      toast.success('Attendance submitted for admin review');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit attendance');
    },
  });
}

/**
 * Check if a session is locked (to prevent duplicate marking).
 * A session is locked if it already has a submitted/approved/published record
 * or if another user has a draft for this slot.
 */
export function useCheckSessionLock(
  batchId?: string,
  date?: string,
  session?: 'morning' | 'evening',
  userId?: string
) {
  return useQuery({
    queryKey: ['session-lock', batchId, date, session, userId],
    queryFn: async () => {
      if (!batchId || !date || !session || !userId) return null;
      const { data, error } = await supabase.rpc('is_attendance_session_locked', {
        p_batch_id: batchId,
        p_date: date,
        p_session: session,
        p_user_id: userId,
      });
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!(batchId && date && session && userId),
  });
}

/**
 * Get all pending attendance records for admin review (V1 - single table)
 */
export function usePendingAttendanceForReview(userRole: string | null) {
  return useQuery({
    queryKey: ['pending-attendance-for-review', userRole],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pending_attendance_for_review', {
        p_user_role: userRole,
      });
      if (error) throw error;
      return (data ?? []) as PendingAttendanceItem[];
    },
    enabled: userRole === 'admin',
  });
}

/**
 * Approve attendance (Admin only)
 */
export function useApproveAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      attendance_id: string;
      user_id: string;
      user_role: string;
      remarks?: string;
    }) => {
      const { data, error } = await supabase.rpc('approve_attendance', {
        p_attendance_id: input.attendance_id,
        p_user_id: input.user_id,
        p_user_role: input.user_role,
        p_remarks: input.remarks ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-attendance-for-review'] });
      queryClient.invalidateQueries({ queryKey: ['batch-attendance-history'] });
      toast.success('Attendance approved');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve attendance');
    },
  });
}

/**
 * Reject attendance (Admin only) - sends back to draft so faculty can re-submit
 */
export function useRejectAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      attendance_id: string;
      user_id: string;
      user_role: string;
      remarks: string;
    }) => {
      const { data, error } = await supabase.rpc('reject_attendance', {
        p_attendance_id: input.attendance_id,
        p_user_id: input.user_id,
        p_user_role: input.user_role,
        p_remarks: input.remarks,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-attendance-for-review'] });
      queryClient.invalidateQueries({ queryKey: ['session-lock'] });
      toast.success('Attendance rejected — faculty can re-submit');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject attendance');
    },
  });
}

/**
 * Publish attendance (Admin only) - makes it visible to parents
 */
export function usePublishAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      attendance_id: string;
      user_id: string;
      user_role: string;
    }) => {
      const { data, error } = await supabase.rpc('publish_attendance', {
        p_attendance_id: input.attendance_id,
        p_user_id: input.user_id,
        p_user_role: input.user_role,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-attendance-for-review'] });
      queryClient.invalidateQueries({ queryKey: ['batch-attendance-history'] });
      toast.success('Attendance published to parents');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to publish attendance');
    },
  });
}
