import { supabase } from '../config/supabase';
import type { InternalNotification, NotificationSenderRole, NotificationTargetRole } from '../types';

type NotificationRow = {
  id: string;
  tenant_id: string;
  type: string;
  title: string;
  body: string;
  sender_role: string;
  target_role: string;
  sender_id: string | null;
  is_read: boolean;
  created_at: string;
};

function rowToNotification(row: NotificationRow): InternalNotification {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type,
    title: row.title,
    body: row.body,
    senderRole: row.sender_role as NotificationSenderRole,
    targetRole: row.target_role as NotificationTargetRole,
    senderId: row.sender_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export async function fetchNotifications(
  tenantId: string,
  targetRole: NotificationTargetRole,
): Promise<InternalNotification[]> {
  const { data, error } = await supabase
    .from('ky_notifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('target_role', targetRole)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map(rowToNotification);
}

export async function fetchUnreadCount(
  tenantId: string,
  targetRole: NotificationTargetRole,
): Promise<number> {
  const { count, error } = await supabase
    .from('ky_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('target_role', targetRole)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('ky_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function markAllAsRead(
  tenantId: string,
  targetRole: NotificationTargetRole,
): Promise<void> {
  const { error } = await supabase
    .from('ky_notifications')
    .update({ is_read: true })
    .eq('tenant_id', tenantId)
    .eq('target_role', targetRole)
    .eq('is_read', false);
  if (error) throw error;
}

export type CreateNotificationInput = {
  type: string;
  title: string;
  body?: string;
  senderRole: NotificationSenderRole;
  targetRole: NotificationTargetRole;
  senderId?: string | null;
};

export async function createNotification(
  tenantId: string,
  input: CreateNotificationInput,
): Promise<void> {
  const { error } = await supabase
    .from('ky_notifications')
    .insert({
      tenant_id: tenantId,
      type: input.type,
      title: input.title,
      body: input.body ?? '',
      sender_role: input.senderRole,
      target_role: input.targetRole,
      sender_id: input.senderId ?? null,
    });
  if (error) throw error;
}
