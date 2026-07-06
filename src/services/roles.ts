import { supabase } from '../config/supabase';
import type { UserRole } from '../types';

export type RoleResult =
  | { role: 'owner'; tenantId: string }
  | { role: 'cast'; tenantId: string; castId: string }
  | { role: 'none' };

export async function resolveUserRole(userId: string): Promise<RoleResult> {
  const { data: tenant } = await supabase
    .from('ky_tenants')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (tenant) return { role: 'owner', tenantId: tenant.id as string };

  const { data: cast } = await supabase
    .from('ky_casts')
    .select('id, tenant_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (cast) return { role: 'cast', tenantId: cast.tenant_id as string, castId: cast.id as string };

  return { role: 'none' };
}

export async function redeemCastInvite(code: string): Promise<{ ok: boolean; error?: string; castId?: string; tenantId?: string }> {
  const { data, error } = await supabase.rpc('ky_redeem_cast_invite', { p_code: code });
  if (error) throw error;
  const result = data as Record<string, unknown>;
  if (result.error) return { ok: false, error: result.error as string };
  return { ok: true, castId: result.cast_id as string, tenantId: result.tenant_id as string };
}
