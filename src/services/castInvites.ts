import { supabase } from '../config/supabase';
import type { CastInvite } from '../types';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function toInvite(row: Record<string, unknown>): CastInvite {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    castId: row.cast_id as string,
    code: row.code as string,
    expiresAt: row.expires_at as string,
    usedAt: (row.used_at as string) ?? null,
    usedBy: (row.used_by as string) ?? null,
  };
}

export async function listInvites(tenantId: string): Promise<CastInvite[]> {
  const { data, error } = await supabase
    .from('ky_cast_invites')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toInvite);
}

export async function createInvite(tenantId: string, castId: string): Promise<CastInvite> {
  const code = generateCode();
  const { data, error } = await supabase
    .from('ky_cast_invites')
    .insert({ tenant_id: tenantId, cast_id: castId, code })
    .select()
    .single();
  if (error) throw error;
  return toInvite(data as Record<string, unknown>);
}

export async function deleteInvite(id: string): Promise<void> {
  const { error } = await supabase.from('ky_cast_invites').delete().eq('id', id);
  if (error) throw error;
}
