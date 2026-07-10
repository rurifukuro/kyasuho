import { supabase } from '../lib/supabase';

export async function checkPlatformAdmin(): Promise<boolean> {
  const { data } = await supabase
    .from('ky_platform_admins')
    .select('user_id')
    .limit(1)
    .maybeSingle();
  return data != null;
}

export interface RevenueMonthly {
  month: string;
  channel: string;
  gross: number;
  fee: number;
  net: number;
  has_estimated: boolean;
}

export async function fetchRevenueMonthly(from: string, to: string): Promise<RevenueMonthly[]> {
  const { data, error } = await supabase.rpc('ky_dev_revenue_monthly', {
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return (data as RevenueMonthly[]) ?? [];
}

export interface DevKpis {
  total_tenants: number;
  revenue_30d: number;
  active_subscriptions: number;
  trialing: number;
  mrr_estimate: number;
  churn_30d: number;
}

export async function fetchDevKpis(): Promise<DevKpis> {
  const { data, error } = await supabase.rpc('ky_dev_kpis');
  if (error) throw error;
  return data as DevKpis;
}
