import { supabase } from '../config/supabase';

export type ReportTargetType = 'cast' | 'reservation' | 'tenant';

export async function submitReport(
  tenantId: string,
  reporterUserId: string,
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.from('ky_reports').insert({
    tenant_id: tenantId,
    reporter_user_id: reporterUserId,
    target_type: targetType,
    target_id: targetId,
    reason,
  });
  if (error) throw error;
}

export async function fetchMyReports(reporterUserId: string) {
  const { data, error } = await supabase
    .from('ky_reports')
    .select('id, tenant_id, target_type, target_id, reason, status, created_at')
    .eq('reporter_user_id', reporterUserId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
