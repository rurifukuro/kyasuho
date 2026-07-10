import { supabase } from '../config/supabase';
import type { ShiftRequest, ShiftSubmission, CastShiftDefault } from '../types';

type ShiftRequestRow = {
  id: string;
  tenant_id: string;
  cast_id: string;
  date: string;
  start_at: string;
  end_at: string;
  note: string;
  time_source: 'default' | 'custom';
  status: 'requested' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
};

type ShiftSubmissionRow = {
  id: string;
  tenant_id: string;
  cast_id: string;
  period_start: string;
  period_end: string;
  submitted_at: string;
};

type CastShiftDefaultRow = {
  tenant_id: string;
  cast_id: string;
  start_at: string;
  end_at: string;
  updated_at: string;
};

function rowToRequest(r: ShiftRequestRow): ShiftRequest {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    castId: r.cast_id,
    date: r.date,
    startAt: r.start_at,
    endAt: r.end_at,
    note: r.note,
    timeSource: r.time_source,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToSubmission(r: ShiftSubmissionRow): ShiftSubmission {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    castId: r.cast_id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    submittedAt: r.submitted_at,
  };
}

function rowToDefault(r: CastShiftDefaultRow): CastShiftDefault {
  return {
    tenantId: r.tenant_id,
    castId: r.cast_id,
    startAt: r.start_at,
    endAt: r.end_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchShiftDefaults(
  tenantId: string,
  castId: string,
): Promise<CastShiftDefault | null> {
  const { data } = await supabase
    .from('ky_cast_shift_defaults')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('cast_id', castId)
    .maybeSingle();
  return data ? rowToDefault(data as CastShiftDefaultRow) : null;
}

export async function upsertShiftDefaults(
  tenantId: string,
  castId: string,
  startAt: string,
  endAt: string,
): Promise<void> {
  const { error } = await supabase
    .from('ky_cast_shift_defaults')
    .upsert(
      { tenant_id: tenantId, cast_id: castId, start_at: startAt, end_at: endAt },
      { onConflict: 'tenant_id,cast_id' },
    );
  if (error) throw error;
}

export async function fetchShiftRequests(
  castId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ShiftRequest[]> {
  const { data } = await supabase
    .from('ky_shift_requests')
    .select('*')
    .eq('cast_id', castId)
    .gte('date', periodStart)
    .lte('date', periodEnd)
    .order('date');
  return ((data as ShiftRequestRow[] | null) ?? []).map(rowToRequest);
}

export async function fetchSubmission(
  castId: string,
  periodStart: string,
): Promise<ShiftSubmission | null> {
  const { data } = await supabase
    .from('ky_shift_submissions')
    .select('*')
    .eq('cast_id', castId)
    .eq('period_start', periodStart)
    .maybeSingle();
  return data ? rowToSubmission(data as ShiftSubmissionRow) : null;
}

export async function submitShiftRequests(
  tenantId: string,
  castId: string,
  periodStart: string,
  periodEnd: string,
  days: { date: string; startAt: string; endAt: string; timeSource: 'default' | 'custom' }[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from('ky_shift_requests')
    .delete()
    .eq('cast_id', castId)
    .eq('status', 'requested')
    .gte('date', periodStart)
    .lte('date', periodEnd);
  if (delErr) throw delErr;

  if (days.length > 0) {
    const rows = days.map((d) => ({
      tenant_id: tenantId,
      cast_id: castId,
      date: d.date,
      start_at: d.startAt,
      end_at: d.endAt,
      time_source: d.timeSource,
      status: 'requested' as const,
    }));
    const { error: insErr } = await supabase
      .from('ky_shift_requests')
      .insert(rows);
    if (insErr) throw insErr;
  }

  const { error: subErr } = await supabase
    .from('ky_shift_submissions')
    .upsert(
      { tenant_id: tenantId, cast_id: castId, period_start: periodStart, period_end: periodEnd },
      { onConflict: 'tenant_id,cast_id,period_start' },
    );
  if (subErr) throw subErr;
}

export async function fetchTenantShiftRequests(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ShiftRequest[]> {
  const { data } = await supabase
    .from('ky_shift_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', periodStart)
    .lte('date', periodEnd)
    .order('date')
    .order('created_at');
  return ((data as ShiftRequestRow[] | null) ?? []).map(rowToRequest);
}

export async function fetchTenantSubmissions(
  tenantId: string,
  periodStart: string,
): Promise<ShiftSubmission[]> {
  const { data } = await supabase
    .from('ky_shift_submissions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('period_start', periodStart)
    .order('submitted_at');
  return ((data as ShiftSubmissionRow[] | null) ?? []).map(rowToSubmission);
}

export async function approveShiftRequest(
  requestId: string,
  tenantId: string,
): Promise<void> {
  const { error: upErr } = await supabase
    .from('ky_shift_requests')
    .update({ status: 'approved' })
    .eq('id', requestId);
  if (upErr) throw upErr;

  const { data: req } = await supabase
    .from('ky_shift_requests')
    .select('cast_id, date, start_at, end_at')
    .eq('id', requestId)
    .single();
  if (!req) return;
  const r = req as { cast_id: string; date: string; start_at: string; end_at: string };

  await supabase
    .from('ky_shifts')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('cast_id', r.cast_id)
    .eq('date', r.date);

  const { error: shiftErr } = await supabase
    .from('ky_shifts')
    .insert({ tenant_id: tenantId, cast_id: r.cast_id, date: r.date, start_at: r.start_at, end_at: r.end_at });
  if (shiftErr) throw shiftErr;
}

export async function rejectShiftRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('ky_shift_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId);
  if (error) throw error;
}
