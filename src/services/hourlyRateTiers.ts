import { supabase } from '../config/supabase';
import type { HourlyRateTier, SlideMetric } from '../types';

type TierRow = {
  id: string;
  tenant_id: string;
  metric: string;
  threshold: number;
  hourly_rate: number;
  sort_order: number;
};

function rowToTier(r: TierRow): HourlyRateTier {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    metric: r.metric as SlideMetric,
    threshold: r.threshold,
    hourlyRate: r.hourly_rate,
    sortOrder: r.sort_order,
  };
}

export async function fetchHourlyRateTiers(
  tenantId: string,
): Promise<HourlyRateTier[]> {
  const { data, error } = await supabase
    .from('ky_hourly_rate_tiers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order');
  if (error) throw error;
  return ((data ?? []) as TierRow[]).map(rowToTier);
}

export type TierInput = {
  metric: SlideMetric;
  threshold: number;
  hourlyRate: number;
  sortOrder: number;
};

export async function createHourlyRateTier(
  tenantId: string,
  input: TierInput,
): Promise<HourlyRateTier> {
  const { data, error } = await supabase
    .from('ky_hourly_rate_tiers')
    .insert({
      tenant_id: tenantId,
      metric: input.metric,
      threshold: input.threshold,
      hourly_rate: input.hourlyRate,
      sort_order: input.sortOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTier(data as TierRow);
}

export async function updateHourlyRateTier(
  id: string,
  input: Partial<TierInput>,
): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.metric !== undefined) updates.metric = input.metric;
  if (input.threshold !== undefined) updates.threshold = input.threshold;
  if (input.hourlyRate !== undefined) updates.hourly_rate = input.hourlyRate;
  if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;
  const { error } = await supabase
    .from('ky_hourly_rate_tiers')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteHourlyRateTier(id: string): Promise<void> {
  const { error } = await supabase
    .from('ky_hourly_rate_tiers')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
