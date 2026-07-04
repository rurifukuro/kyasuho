import { supabase } from '../config/supabase';

export async function fetchBlockedUsers(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('ky_blocks')
    .select('blocked_user_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.blocked_user_id);
}

export async function blockUser(userId: string, blockedUserId: string): Promise<void> {
  const { error } = await supabase.from('ky_blocks').upsert(
    { user_id: userId, blocked_user_id: blockedUserId },
    { onConflict: 'user_id,blocked_user_id' },
  );
  if (error) throw error;
}

export async function unblockUser(userId: string, blockedUserId: string): Promise<void> {
  const { error } = await supabase
    .from('ky_blocks')
    .delete()
    .eq('user_id', userId)
    .eq('blocked_user_id', blockedUserId);
  if (error) throw error;
}
