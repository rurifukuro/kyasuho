import { supabase } from '../config/supabase';

export type FollowedTenant = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_genre: string | null;
  tenant_slug: string;
  open_hours: string | null;
};

export async function getFollowedTenants(accountId: string): Promise<FollowedTenant[]> {
  const { data, error } = await supabase
    .from('ky_customer_follows')
    .select('id, tenant_id, ky_tenants(name, genre, slug, business_info)')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data) return [];
  return (data as Record<string, unknown>[]).map((row) => {
    const t = row.ky_tenants as Record<string, unknown> | null;
    const bi = t?.business_info as Record<string, unknown> | null;
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      tenant_name: (t?.name as string) ?? '',
      tenant_genre: (t?.genre as string) ?? null,
      tenant_slug: (t?.slug as string) ?? '',
      open_hours: (bi?.openHours as string) ?? null,
    };
  });
}

export async function followTenantBySlug(
  accountId: string,
  slug: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: tenant, error: tErr } = await supabase
    .from('ky_tenants')
    .select('id, is_suspended')
    .eq('slug', slug)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!tenant) return { ok: false, error: 'not_found' };
  if ((tenant as Record<string, unknown>).is_suspended) return { ok: false, error: 'suspended' };

  const tenantId = (tenant as Record<string, unknown>).id as string;
  const { error } = await supabase
    .from('ky_customer_follows')
    .insert({ account_id: accountId, tenant_id: tenantId });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'already_following' };
    throw error;
  }
  return { ok: true };
}

export async function unfollowTenant(followId: string): Promise<void> {
  const { error } = await supabase
    .from('ky_customer_follows')
    .delete()
    .eq('id', followId);
  if (error) throw error;
}
