import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

export interface ParentNotification {
  id: string;
  parent_id: string;
  student_id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch notifications for a parent
 */
export function useParentNotifications(parentId: string | undefined | null) {
  return useQuery({
    queryKey: ['parent-notifications', parentId],
    queryFn: async () => {
      if (!parentId) return [];
      const { data, error } = await supabase
        .from('parent_notifications')
        .select('*')
        .eq('parent_id', parentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as ParentNotification[];
    },
    enabled: !!parentId,
  });
}

/**
 * Mark a single notification as read
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase
        .from('parent_notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-notifications'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update notification');
    },
  });
}
