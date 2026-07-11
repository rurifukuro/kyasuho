// src/services/points.ts — ポイント設定・景品カタログ（SPEC §41）

import { supabase } from '../config/supabase';
import type { PointSettings, PointReward } from '../types';

// ── ポイント設定（テナント×1行） ──

type PointSettingsRow = {
  tenant_id: string;
  enabled: boolean;
  yen_per_point: number;
};

export const DEFAULT_POINT_SETTINGS: PointSettings = {
  tenantId: '',
  enabled: false,
  yenPerPoint: 500,
};

function rowToSettings(row: PointSettingsRow): PointSettings {
  return {
    tenantId: row.tenant_id,
    enabled: row.enabled,
    yenPerPoint: row.yen_per_point,
  };
}

export async function fetchPointSettings(tenantId: string): Promise<PointSettings | null> {
  const { data, error } = await supabase
    .from('ky_point_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSettings(data as PointSettingsRow) : null;
}

export async function savePointSettings(
  tenantId: string,
  input: { enabled: boolean; yenPerPoint: number },
): Promise<void> {
  const { error } = await supabase.from('ky_point_settings').upsert(
    {
      tenant_id: tenantId,
      enabled: input.enabled,
      yen_per_point: input.yenPerPoint,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id' },
  );
  if (error) throw error;
}

// ── 景品カタログ ──

type PointRewardRow = {
  id: string;
  tenant_id: string;
  points_required: number;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
};

function rowToReward(row: PointRewardRow): PointReward {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    pointsRequired: row.points_required,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

export async function fetchPointRewards(tenantId: string): Promise<PointReward[]> {
  const { data, error } = await supabase
    .from('ky_point_rewards')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return ((data ?? []) as PointRewardRow[]).map(rowToReward);
}

export type PointRewardInput = {
  pointsRequired: number;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
};

export async function createPointReward(
  tenantId: string,
  input: PointRewardInput,
): Promise<PointReward> {
  const { data, error } = await supabase
    .from('ky_point_rewards')
    .insert({
      tenant_id: tenantId,
      points_required: input.pointsRequired,
      name: input.name,
      description: input.description,
      is_active: input.isActive,
      sort_order: input.sortOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToReward(data as PointRewardRow);
}

export async function updatePointReward(
  id: string,
  input: Partial<PointRewardInput>,
): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.pointsRequired !== undefined) updates.points_required = input.pointsRequired;
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.isActive !== undefined) updates.is_active = input.isActive;
  if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;
  const { error } = await supabase
    .from('ky_point_rewards')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deletePointReward(id: string): Promise<void> {
  const { error } = await supabase.from('ky_point_rewards').delete().eq('id', id);
  if (error) throw error;
}
