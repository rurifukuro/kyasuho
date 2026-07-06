import { supabase } from '../config/supabase';
import type { CastEvaluation, CastWorkHistory, CastPersonalInfo } from '../types';

// ── T17: キャスト人物像・評価（オーナー記入・テナント×キャスト単位） ──

type EvalRow = {
  id: string;
  tenant_id: string;
  cast_id: string;
  persona_notes: string;
  strengths: string;
  areas_for_improvement: string;
  customer_feedback_summary: string;
  internal_notes: string;
};

function rowToEval(row: EvalRow): CastEvaluation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    castId: row.cast_id,
    personaNotes: row.persona_notes,
    strengths: row.strengths,
    areasForImprovement: row.areas_for_improvement,
    customerFeedbackSummary: row.customer_feedback_summary,
    internalNotes: row.internal_notes,
  };
}

export async function fetchEvaluation(tenantId: string, castId: string): Promise<CastEvaluation | null> {
  const { data, error } = await supabase
    .from('ky_cast_evaluations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('cast_id', castId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToEval(data as EvalRow) : null;
}

export async function upsertEvaluation(
  tenantId: string,
  castId: string,
  fields: {
    personaNotes: string;
    strengths: string;
    areasForImprovement: string;
    customerFeedbackSummary: string;
    internalNotes: string;
  },
): Promise<void> {
  const { error } = await supabase.from('ky_cast_evaluations').upsert(
    {
      tenant_id: tenantId,
      cast_id: castId,
      persona_notes: fields.personaNotes,
      strengths: fields.strengths,
      areas_for_improvement: fields.areasForImprovement,
      customer_feedback_summary: fields.customerFeedbackSummary,
      internal_notes: fields.internalNotes,
    },
    { onConflict: 'tenant_id,cast_id' },
  );
  if (error) throw error;
}

// ── T17: 店舗遍歴（キャストuser_id単位・テナント横断） ──

type HistoryRow = {
  id: string;
  cast_user_id: string;
  tenant_name: string;
  position: string;
  start_date: string | null;
  end_date: string | null;
  notes: string;
  visibility: 'public' | 'private';
  created_by: string | null;
};

function rowToHistory(row: HistoryRow): CastWorkHistory {
  return {
    id: row.id,
    castUserId: row.cast_user_id,
    tenantName: row.tenant_name,
    position: row.position,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    visibility: row.visibility,
    createdBy: row.created_by,
  };
}

export async function fetchWorkHistory(castUserId: string): Promise<CastWorkHistory[]> {
  const { data, error } = await supabase
    .from('ky_cast_work_history')
    .select('*')
    .eq('cast_user_id', castUserId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as HistoryRow[]).map(rowToHistory);
}

export async function fetchPublicWorkHistory(castUserId: string): Promise<CastWorkHistory[]> {
  const { data, error } = await supabase
    .from('ky_cast_work_history')
    .select('*')
    .eq('cast_user_id', castUserId)
    .eq('visibility', 'public')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as HistoryRow[]).map(rowToHistory);
}

// ── T18: 個人情報（キャストuser_id単位・面接書類代替） ──

type PersonalInfoRow = {
  id: string;
  cast_user_id: string;
  full_name: string;
  furigana: string;
  date_of_birth: string | null;
  gender: string;
  address: string;
  phone: string;
  email: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  nearest_station: string;
  commute_method: string;
  commute_minutes: number | null;
  bank_name: string;
  bank_branch: string;
  account_type: '' | 'savings' | 'checking';
  account_number: string;
  account_holder_name: string;
  desired_work_days_per_week: number | null;
  desired_hours: string;
  available_from: string | null;
  qualifications: string;
  special_notes: string;
};

function rowToPersonalInfo(row: PersonalInfoRow): CastPersonalInfo {
  return {
    id: row.id,
    castUserId: row.cast_user_id,
    fullName: row.full_name,
    furigana: row.furigana,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    address: row.address,
    phone: row.phone,
    email: row.email,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    emergencyContactRelation: row.emergency_contact_relation,
    nearestStation: row.nearest_station,
    commuteMethod: row.commute_method,
    commuteMinutes: row.commute_minutes,
    bankName: row.bank_name,
    bankBranch: row.bank_branch,
    accountType: row.account_type,
    accountNumber: row.account_number,
    accountHolderName: row.account_holder_name,
    desiredWorkDaysPerWeek: row.desired_work_days_per_week,
    desiredHours: row.desired_hours,
    availableFrom: row.available_from,
    qualifications: row.qualifications,
    specialNotes: row.special_notes,
  };
}

export async function fetchPersonalInfo(castUserId: string): Promise<CastPersonalInfo | null> {
  const { data, error } = await supabase
    .from('ky_cast_personal_info')
    .select('*')
    .eq('cast_user_id', castUserId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToPersonalInfo(data as PersonalInfoRow) : null;
}

export async function upsertPersonalInfo(
  castUserId: string,
  fields: Omit<CastPersonalInfo, 'id' | 'castUserId'>,
): Promise<void> {
  const { error } = await supabase.from('ky_cast_personal_info').upsert(
    {
      cast_user_id: castUserId,
      full_name: fields.fullName,
      furigana: fields.furigana,
      date_of_birth: fields.dateOfBirth || null,
      gender: fields.gender,
      address: fields.address,
      phone: fields.phone,
      email: fields.email,
      emergency_contact_name: fields.emergencyContactName,
      emergency_contact_phone: fields.emergencyContactPhone,
      emergency_contact_relation: fields.emergencyContactRelation,
      nearest_station: fields.nearestStation,
      commute_method: fields.commuteMethod,
      commute_minutes: fields.commuteMinutes,
      bank_name: fields.bankName,
      bank_branch: fields.bankBranch,
      account_type: fields.accountType,
      account_number: fields.accountNumber,
      account_holder_name: fields.accountHolderName,
      desired_work_days_per_week: fields.desiredWorkDaysPerWeek,
      desired_hours: fields.desiredHours,
      available_from: fields.availableFrom || null,
      qualifications: fields.qualifications,
      special_notes: fields.specialNotes,
    },
    { onConflict: 'cast_user_id' },
  );
  if (error) throw error;
}
