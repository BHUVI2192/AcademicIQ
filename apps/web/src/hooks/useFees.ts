import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { Fee } from '@shared';
import toast from 'react-hot-toast';

export interface BatchFee {
  fee_id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  amount_due: number;
  due_date: string | null;
  status: 'pending' | 'paid';
  is_published: boolean;
  completion_date: string | null;
}

/**
 * Fetch all fees for a batch using the get_batch_fees RPC function
 * Returns student-fee pairs with payment status and publication status
 */
export function useBatchFees(batchId: string | undefined | null) {
  return useQuery({
    queryKey: ['batch-fees', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      
      const { data, error } = await supabase
        .rpc('get_batch_fees', { p_batch_id: batchId })
        .returns<BatchFee[]>();

      if (error) throw error;
      return (data ?? []) as BatchFee[];
    },
    enabled: !!batchId,
  });
}

/**
 * Update a single fee record (amount_due, due_date, remarks, status)
 */
export function useUpdateFee() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: {
      fee_id: string;
      amount_due?: number;
      due_date?: string | null;
      remarks?: string;
      status?: 'pending' | 'paid';
    }) => {
      const { fee_id, amount_due, due_date, remarks, status } = input;
      
      const updates: any = {};
      if (amount_due !== undefined) updates.amount_due = amount_due;
      if (due_date !== undefined) updates.due_date = due_date;
      if (remarks !== undefined) updates.remarks = remarks;
      if (status !== undefined) updates.status = status;

      if (Object.keys(updates).length === 0) {
        throw new Error('No fields to update');
      }

      const { data, error } = await supabase
        .from('fees')
        .update(updates)
        .eq('id', fee_id)
        .select()
        .single();

      if (error) throw error;
      return data as Fee;
    },
    onSuccess: (_, variables) => {
      // Invalidate batch fees queries since the fee updated
      queryClient.invalidateQueries({ queryKey: ['batch-fees'] });
    },
  });
}

/**
 * Publish fees for a batch (bulk operation)
 * Sets is_published=true and published_at=now() for all fees in batch
 */
export function usePublishBatchFees() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: {
      batch_id: string;
      admin_remarks?: string;
    }) => {
      const { batch_id, admin_remarks } = input;

      // Get all students in batch first
      const { data: students, error: studentErr } = await supabase
        .from('students')
        .select('id')
        .eq('batch_id', batch_id);

      if (studentErr) throw studentErr;
      if (!students || students.length === 0) {
        throw new Error('No students found in batch');
      }

      const studentIds = students.map(s => s.id);

      // Update all fees for these students to published
      const { data, error } = await supabase
        .from('fees')
        .update({
          is_published: true,
          published_at: new Date().toISOString(),
        })
        .in('student_id', studentIds)
        .select();

      if (error) throw error;
      
      return {
        published_count: data?.length ?? 0,
        message: `Published fees for ${data?.length ?? 0} students`,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-fees'] });
      toast.success('Fees published to parents');
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to publish fees');
    },
  });
}

/**
 * Mark fees as completed (set completion_date and optionally status)
 */
export function useCompleteFees() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: {
      batch_id: string;
    }) => {
      const { batch_id } = input;

      // Get all students in batch
      const { data: students, error: studentErr } = await supabase
        .from('students')
        .select('id')
        .eq('batch_id', batch_id);

      if (studentErr) throw studentErr;
      if (!students || students.length === 0) {
        throw new Error('No students found in batch');
      }

      const studentIds = students.map(s => s.id);

      // Mark all fees as completed
      const { data, error } = await supabase
        .from('fees')
        .update({
          completion_date: new Date().toISOString(),
          status: 'paid',
        })
        .in('student_id', studentIds)
        .eq('is_published', true)
        .select();

      if (error) throw error;

      return {
        completed_count: data?.length ?? 0,
        message: `Marked ${data?.length ?? 0} fees as completed`,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-fees'] });
      toast.success('Fees marked as completed');
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to complete fees');
    },
  });
}

// ============================================================================
// NEW ENHANCED FEES WORKFLOW HOOKS (V2)
// ============================================================================

/**
 * Fetch all fees drafts for a batch (Faculty side view)
 */
export function useBatchFeesDrafts(batchId: string | undefined | null) {
  return useQuery({
    queryKey: ['batch-fees-drafts', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      const { data, error } = await supabase
        .from('fees_draft')
        .select('*')
        .eq('batch_id', batchId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!batchId,
  });
}

/**
 * Submit fees draft (Faculty submits student fee)
 */
export function useSubmitFeesDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      student_id: string;
      batch_id: string;
      total_amount: number;
      paid_amount: number;
      faculty_id: string;
      due_date?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('submit_fees_draft', {
        p_student_id: input.student_id,
        p_batch_id: input.batch_id,
        p_total_amount: input.total_amount,
        p_paid_amount: input.paid_amount,
        p_faculty_id: input.faculty_id,
        p_due_date: input.due_date || null,
      });

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['batch-fees-drafts', variables.batch_id] });
      queryClient.invalidateQueries({ queryKey: ['batch-fees', variables.batch_id] });
      toast.success('Fees draft submitted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit fees draft');
    },
  });
}

/**
 * Get pending fees submissions for admin review
 */
export function usePendingFeesSubmissions(adminId?: string) {
  return useQuery({
    queryKey: ['pending-fees-submissions', adminId],
    queryFn: async () => {
      if (!adminId) return [];

      const { data, error } = await supabase.rpc('get_pending_fees_submissions', {
        p_admin_id: adminId,
      });

      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!adminId,
  });
}

/**
 * Approve fees draft (Admin approves faculty submission)
 */
export function useApproveFeesDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      fees_draft_id: string;
      admin_id: string;
      remarks?: string;
    }) => {
      const { data, error } = await supabase.rpc('approve_fees_draft', {
        p_fees_draft_id: input.fees_draft_id,
        p_admin_id: input.admin_id,
        p_remarks: input.remarks || null,
      });

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-fees-submissions'] });
      toast.success('Fees draft approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve fees draft');
    },
  });
}

/**
 * Reject fees draft (Admin rejects faculty submission)
 */
export function useRejectFeesDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      fees_draft_id: string;
      admin_id: string;
      remarks: string;
    }) => {
      const { data, error } = await supabase.rpc('reject_fees_draft', {
        p_fees_draft_id: input.fees_draft_id,
        p_admin_id: input.admin_id,
        p_remarks: input.remarks,
      });

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-fees-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['batch-fees-drafts'] });
      toast.success('Fees draft rejected - sent back to draft');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject fees draft');
    },
  });
}

/**
 * Publish fees to parents (Admin publishes approved/draft fees)
 */
export function usePublishFeesToParents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      fees_draft_id: string;
      admin_id: string;
      due_date?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('publish_fees_to_parents', {
        p_fees_draft_id: input.fees_draft_id,
        p_admin_id: input.admin_id,
        p_due_date: input.due_date || null,
      });

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['pending-fees-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['batch-fees'] });
      queryClient.invalidateQueries({ queryKey: ['parent-student-fees'] });
      queryClient.invalidateQueries({ queryKey: ['parent-notifications'] });
      toast.success(`Fees published successfully!`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to publish fees');
    },
  });
}

/**
 * Submit fees draft to admin (Faculty updates draft status to submitted)
 */
export function useSubmitFeesDraftToAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { data, error } = await supabase
        .from('fees_draft')
        .update({ submission_status: 'submitted', updated_at: new Date().toISOString() })
        .eq('id', draftId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-fees-drafts'] });
      toast.success('Fees draft submitted to admin');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit fees draft');
    },
  });
}

/**
 * Set a global fee amount for all active students in a batch
 */
export function useSetGlobalFeesDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      batch_id: string;
      total_amount: number;
      faculty_id: string;
    }) => {
      const { data, error } = await supabase.rpc('set_global_fees_draft', {
        p_batch_id: input.batch_id,
        p_total_amount: input.total_amount,
        p_faculty_id: input.faculty_id,
      });

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['batch-fees-drafts', variables.batch_id] });
      queryClient.invalidateQueries({ queryKey: ['batch-fees', variables.batch_id] });
      toast.success('Global fees set successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to set global fees');
    },
  });
}

/**
 * Submit all draft/rejected fees for a class to the admin
 */
export function useSubmitAllFeesDraftToAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      batch_id: string;
      faculty_id: string;
    }) => {
      const { data, error } = await supabase.rpc('submit_all_fees_draft_to_admin', {
        p_batch_id: input.batch_id,
        p_faculty_id: input.faculty_id,
      });

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['batch-fees-drafts', variables.batch_id] });
      queryClient.invalidateQueries({ queryKey: ['batch-fees', variables.batch_id] });
      toast.success('All draft fees submitted to admin');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit all draft fees');
    },
  });
}

/**
 * Approve all submitted fee drafts (Admin)
 */
export function useApproveAllFeesDrafts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      admin_id: string;
      remarks?: string;
    }) => {
      const { data, error } = await supabase.rpc('approve_all_fees_drafts', {
        p_admin_id: input.admin_id,
        p_remarks: input.remarks || null,
      });

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-fees-submissions'] });
      toast.success('All submitted fees approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve all fees');
    },
  });
}

/**
 * Publish all approved fee drafts to parents (Admin)
 */
export function usePublishAllFeesToParents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      admin_id: string;
      due_date?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('publish_all_fees_to_parents', {
        p_admin_id: input.admin_id,
        p_due_date: input.due_date || null,
      });

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-fees-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['batch-fees'] });
      queryClient.invalidateQueries({ queryKey: ['parent-student-fees'] });
      queryClient.invalidateQueries({ queryKey: ['parent-notifications'] });
      toast.success('All approved fees published successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to publish all fees');
    },
  });
}

/**
 * Approve all submitted fee drafts in a specific batch (Admin)
 */
export function useApproveBatchFees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      batch_id: string;
      admin_id: string;
      remarks?: string;
    }) => {
      const { data, error } = await supabase.rpc('approve_batch_fees_drafts', {
        p_batch_id: input.batch_id,
        p_admin_id: input.admin_id,
        p_remarks: input.remarks || null,
      });

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-fees-submissions'] });
      toast.success('Class submitted fees approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve class fees');
    },
  });
}

/**
 * Publish all approved fee drafts in a specific batch to parents (Admin)
 */
export function usePublishBatchFeesToParents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      batch_id: string;
      admin_id: string;
      due_date?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('publish_batch_fees_to_parents', {
        p_batch_id: input.batch_id,
        p_admin_id: input.admin_id,
        p_due_date: input.due_date || null,
      });

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-fees-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['batch-fees'] });
      queryClient.invalidateQueries({ queryKey: ['parent-student-fees'] });
      queryClient.invalidateQueries({ queryKey: ['parent-notifications'] });
      toast.success('Class approved fees published successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to publish class fees');
    },
  });
}

/**
 * Get published fees history for admin view
 */
export function usePublishedFeesHistory(adminId?: string) {
  return useQuery({
    queryKey: ['published-fees-history', adminId],
    queryFn: async () => {
      if (!adminId) return [];

      const { data, error } = await supabase.rpc('get_published_fees_history', {
        p_admin_id: adminId,
      });

      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!adminId,
  });
}



