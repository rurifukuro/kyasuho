import { supabase } from '../lib/supabase';
import type {
  KyAttendance,
  KyBottleKeep,
  KyCast,
  KyCastInvite,
  KyCastPayroll,
  KyCustomer,
  KyEvent,
  KyExpense,
  KyMenuItem,
  KyOrder,
  KyOrderItem,
  KyPayrollSettings,
  KyReservationFull,
  KySales,
  KySeatType,
  KyShift,
  KyShiftTemplate,
  KyStampSettings,
  KyTenant,
  KyUnlockWindow,
  KyVoucher,
  MakeReservationResult,
} from '../lib/types';
import { calcMinutesWorked, calcPayroll, monthRange } from './payrollCalc';
import type { PayrollCalcSettings } from './payrollCalc';

/** ログイン中ユーザーが所有するテナントを1件取得する（無ければ null）。 */
export async function fetchOwnTenant(): Promise<KyTenant | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('ky_tenants')
    .select('id, slug, name, genre, business_info, sns_links, prefecture, area, ranking_opt_in, is_suspended, enable_bottle_keep, enable_vouchers')
    .eq('owner_user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return (data as KyTenant | null) ?? null;
}

// ---- 予約台帳 ----

export async function fetchAllReservations(
  tenantId: string,
  date: string,
): Promise<KyReservationFull[]> {
  const { data, error } = await supabase
    .from('ky_reservations')
    .select(
      'id, tenant_id, date, slot, set_minutes, seat_no, customer_name, contact, party_size, cast_id, note, status, created_at',
    )
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .order('slot');
  if (error) throw error;
  return (data ?? []) as KyReservationFull[];
}

export async function updateReservationStatus(
  id: string,
  status: KyReservationFull['status'],
): Promise<void> {
  const { error } = await supabase.from('ky_reservations').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function removeReservation(id: string): Promise<void> {
  const { error } = await supabase.from('ky_reservations').delete().eq('id', id);
  if (error) throw error;
}

export async function adminMakeReservation(input: {
  tenantId: string;
  date: string;
  slot: string;
  customerName: string;
  contact: string;
  partySize: number;
  castId: string | null;
  note: string;
}): Promise<MakeReservationResult> {
  const { data, error } = await supabase.rpc('ky_make_reservation', {
    p_tenant_id: input.tenantId,
    p_date: input.date,
    p_slot: input.slot,
    p_customer_name: input.customerName,
    p_contact: input.contact,
    p_party_size: input.partySize,
    p_cast_id: input.castId,
    p_note: input.note,
    p_pin: null,
  });
  if (error) throw error;
  return data as MakeReservationResult;
}

export async function countNoShowByContacts(
  tenantId: string,
  contacts: string[],
): Promise<Map<string, number>> {
  const unique = [...new Set(contacts.filter((c) => c.trim()))];
  const map = new Map<string, number>();
  if (unique.length === 0) return map;
  const { data, error } = await supabase
    .from('ky_reservations')
    .select('contact')
    .eq('tenant_id', tenantId)
    .in('contact', unique)
    .eq('status', 'no_show');
  if (error) throw error;
  for (const row of data ?? []) {
    const c = (row as { contact: string }).contact;
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  return map;
}

// ---- 受付枠 ----

export async function fetchWindows(tenantId: string, date: string): Promise<KyUnlockWindow[]> {
  const { data, error } = await supabase
    .from('ky_unlock_windows')
    .select('id, tenant_id, date, open_from, close_at, seats, set_minutes')
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .order('open_from');
  if (error) throw error;
  return (data ?? []) as KyUnlockWindow[];
}

export async function addWindow(input: {
  tenantId: string;
  date: string;
  openFrom: string;
  closeAt: string | null;
  setMinutes: number;
}): Promise<void> {
  const { error } = await supabase.from('ky_unlock_windows').insert({
    tenant_id: input.tenantId,
    date: input.date,
    open_from: input.openFrom,
    close_at: input.closeAt,
    seats: 0,
    set_minutes: input.setMinutes,
  });
  if (error) throw error;
}

export async function removeWindow(id: string): Promise<void> {
  const { error } = await supabase.from('ky_unlock_windows').delete().eq('id', id);
  if (error) throw error;
}

// ---- キャスト ----

export async function fetchCastList(tenantId: string): Promise<KyCast[]> {
  const { data, error } = await supabase
    .from('ky_casts')
    .select('id, tenant_id, name, photo_url, bio, accepts_nomination, sort_order, user_id')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return (data ?? []) as KyCast[];
}

export async function addCast(input: {
  tenantId: string;
  name: string;
  nameKana?: string;
  bio: string;
  acceptsNomination: boolean;
}): Promise<void> {
  const { error } = await supabase.from('ky_casts').insert({
    tenant_id: input.tenantId,
    name: input.name,
    name_kana: input.nameKana ?? '',
    bio: input.bio,
    accepts_nomination: input.acceptsNomination,
    sns_links: [],
  });
  if (error) throw error;
}

export async function updateCast(
  id: string,
  fields: { name?: string; nameKana?: string; bio?: string; acceptsNomination?: boolean },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (fields.name !== undefined) update.name = fields.name;
  if (fields.nameKana !== undefined) update.name_kana = fields.nameKana;
  if (fields.bio !== undefined) update.bio = fields.bio;
  if (fields.acceptsNomination !== undefined) update.accepts_nomination = fields.acceptsNomination;
  const { error } = await supabase.from('ky_casts').update(update).eq('id', id);
  if (error) throw error;
}

export async function removeCast(id: string): Promise<void> {
  const { error } = await supabase.from('ky_casts').delete().eq('id', id);
  if (error) throw error;
}

// ---- シフト ----

export async function fetchShiftList(tenantId: string, date: string): Promise<KyShift[]> {
  const { data, error } = await supabase
    .from('ky_shifts')
    .select('id, cast_id, date, start_at, end_at')
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .order('start_at');
  if (error) throw error;
  return (data ?? []) as KyShift[];
}

export async function addShift(input: {
  tenantId: string;
  castId: string;
  date: string;
  startAt: string;
  endAt: string;
}): Promise<void> {
  const { error } = await supabase.from('ky_shifts').insert({
    tenant_id: input.tenantId,
    cast_id: input.castId,
    date: input.date,
    start_at: input.startAt,
    end_at: input.endAt,
  });
  if (error) throw error;
}

export async function removeShift(id: string): Promise<void> {
  const { error } = await supabase.from('ky_shifts').delete().eq('id', id);
  if (error) throw error;
}

// ---- 売上（ky_sales・アプリ src/services/sales.ts と同クエリ） ----

export async function fetchSalesByMonth(tenantId: string, yearMonth: string): Promise<KySales[]> {
  const { from, toExclusive } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from('ky_sales')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lt('date', toExclusive)
    .order('date');
  if (error) throw error;
  return (data ?? []) as KySales[];
}

export async function upsertSales(
  tenantId: string,
  date: string,
  input: {
    totalRevenue: number;
    setCount: number;
    drinkCount: number;
    nominationCount: number;
    otherRevenue: number;
    note: string;
  },
): Promise<void> {
  const { error } = await supabase.from('ky_sales').upsert(
    {
      tenant_id: tenantId,
      date,
      total_revenue: input.totalRevenue,
      set_count: input.setCount,
      drink_count: input.drinkCount,
      nomination_count: input.nominationCount,
      other_revenue: input.otherRevenue,
      note: input.note,
      entry_mode: 'manual',
    },
    { onConflict: 'tenant_id,date' },
  );
  if (error) throw error;
}

export async function deleteSales(id: string): Promise<void> {
  const { error } = await supabase.from('ky_sales').delete().eq('id', id);
  if (error) throw error;
}

// ---- 勤怠（ky_attendance・アプリ src/services/attendance.ts と同クエリ） ----

export async function fetchAttendanceByMonth(
  tenantId: string,
  yearMonth: string,
): Promise<KyAttendance[]> {
  const { from, toExclusive } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from('ky_attendance')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lt('date', toExclusive)
    .order('date');
  if (error) throw error;
  return (data ?? []) as KyAttendance[];
}

export async function upsertAttendance(
  tenantId: string,
  castId: string,
  date: string,
  input: {
    status: KyAttendance['status'];
    reasonCategory: KyAttendance['reason_category'];
    reasonNote: string;
    substituteCastId: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
    note: string;
  },
): Promise<void> {
  const { error } = await supabase.from('ky_attendance').upsert(
    {
      tenant_id: tenantId,
      cast_id: castId,
      date,
      status: input.status,
      reason_category: input.reasonCategory,
      reason_note: input.reasonNote,
      substitute_cast_id: input.substituteCastId,
      check_in_at: input.checkInAt,
      check_out_at: input.checkOutAt,
      note: input.note,
    },
    { onConflict: 'cast_id,date' },
  );
  if (error) throw error;
}

export async function deleteAttendance(id: string): Promise<void> {
  const { error } = await supabase.from('ky_attendance').delete().eq('id', id);
  if (error) throw error;
}

// ---- 給与（ky_payroll_settings / ky_cast_payroll・アプリ src/services/payroll.ts と同クエリ） ----

/** migration 0009 の default と同じ値（設定未保存テナントの計算に使う）。 */
export const DEFAULT_PAYROLL_SETTINGS: PayrollCalcSettings = {
  baseHourlyRate: 1200,
  nominationBackRate: 300,
  drinkBackRate: 100,
  lateDeduction: 0,
};

export async function fetchPayrollSettings(tenantId: string): Promise<KyPayrollSettings | null> {
  const { data, error } = await supabase
    .from('ky_payroll_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  return (data as KyPayrollSettings | null) ?? null;
}

export async function savePayrollSettings(
  tenantId: string,
  input: PayrollCalcSettings,
): Promise<void> {
  const { error } = await supabase.from('ky_payroll_settings').upsert(
    {
      tenant_id: tenantId,
      base_hourly_rate: input.baseHourlyRate,
      nomination_back_rate: input.nominationBackRate,
      drink_back_rate: input.drinkBackRate,
      late_deduction: input.lateDeduction,
    },
    { onConflict: 'tenant_id' },
  );
  if (error) throw error;
}

export async function fetchPayrollByMonth(
  tenantId: string,
  yearMonth: string,
): Promise<KyCastPayroll[]> {
  const { from, toExclusive } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from('ky_cast_payroll')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lt('date', toExclusive)
    .order('date');
  if (error) throw error;
  return (data ?? []) as KyCastPayroll[];
}

/** 給与明細1行を upsert（キャスト×日付で1行＝unique(cast_id, date)・手修正の保存に使う）。 */
export async function upsertPayroll(
  tenantId: string,
  castId: string,
  date: string,
  input: {
    minutesWorked: number;
    basePay: number;
    nominationCount: number;
    nominationBack: number;
    drinkCount: number;
    drinkBack: number;
    otherBack: number;
    deductions: number;
    totalPay: number;
    note: string;
  },
): Promise<void> {
  const { error } = await supabase.from('ky_cast_payroll').upsert(
    {
      tenant_id: tenantId,
      cast_id: castId,
      date,
      minutes_worked: input.minutesWorked,
      base_pay: input.basePay,
      nomination_count: input.nominationCount,
      nomination_back: input.nominationBack,
      drink_count: input.drinkCount,
      drink_back: input.drinkBack,
      other_back: input.otherBack,
      deductions: input.deductions,
      total_pay: input.totalPay,
      note: input.note,
    },
    { onConflict: 'cast_id,date' },
  );
  if (error) throw error;
}

export async function deletePayroll(id: string): Promise<void> {
  const { error } = await supabase.from('ky_cast_payroll').delete().eq('id', id);
  if (error) throw error;
}

/**
 * 指定月の指名数を「castId|date」→件数 のマップで返す（§23）。
 * キャンセル済み予約は数えない（no_show は「予約は入っていた」ため数える）。
 */
export async function countNominationsByMonth(
  tenantId: string,
  yearMonth: string,
): Promise<Map<string, number>> {
  const { from, toExclusive } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from('ky_reservations')
    .select('cast_id, date')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lt('date', toExclusive)
    .not('cast_id', 'is', null)
    .neq('status', 'cancelled');
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { cast_id: string; date: string }[]) {
    const key = `${row.cast_id}|${row.date}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** 給与行を生成する出勤扱いステータス（absent は生成しない）。 */
const WORKED_STATUSES: ReadonlySet<string> = new Set([
  'present',
  'late',
  'early_leave',
  'substitute',
]);

/**
 * 当月の勤怠実績から給与明細を自動生成する（アプリ側 generatePayrollFromAttendance と同ロジック）。
 * - 出勤扱い（present/late/early_leave/substitute）の勤怠だけが対象
 * - 勤務分数＝入退店時刻から算出（未入力は0＝あとで手修正）
 * - 指名数＝ky_reservations から自動集計
 * - **既に明細がある（castId×date）日はスキップ**＝手修正を上書きしない
 * 戻り値＝新規作成した行数。
 */
export async function generatePayrollFromAttendance(
  tenantId: string,
  yearMonth: string,
  attendance: KyAttendance[],
  settings: PayrollCalcSettings,
): Promise<number> {
  const existing = await fetchPayrollByMonth(tenantId, yearMonth);
  const existingKeys = new Set(existing.map((p) => `${p.cast_id}|${p.date}`));
  const [nominations, castDrinks] = await Promise.all([
    countNominationsByMonth(tenantId, yearMonth),
    countCastDrinksByMonth(tenantId, yearMonth),
  ]);

  const rows = attendance
    .filter((a) => WORKED_STATUSES.has(a.status))
    .filter((a) => !existingKeys.has(`${a.cast_id}|${a.date}`))
    .map((a) => {
      const minutesWorked = calcMinutesWorked(a.check_in_at, a.check_out_at);
      const nominationCount = nominations.get(`${a.cast_id}|${a.date}`) ?? 0;
      const drinkCount = castDrinks.get(`${a.cast_id}|${a.date}`) ?? 0;
      const breakdown = calcPayroll(settings, {
        minutesWorked,
        nominationCount,
        drinkCount,
        otherBack: 0,
        lateCount: a.status === 'late' ? 1 : 0,
      });
      return {
        tenant_id: tenantId,
        cast_id: a.cast_id,
        date: a.date,
        minutes_worked: minutesWorked,
        base_pay: breakdown.basePay,
        nomination_count: nominationCount,
        nomination_back: breakdown.nominationBack,
        drink_count: drinkCount,
        drink_back: breakdown.drinkBack,
        other_back: breakdown.otherBack,
        deductions: breakdown.deductions,
        total_pay: breakdown.totalPay,
        note: '',
      };
    });

  if (rows.length === 0) return 0;
  const { error } = await supabase
    .from('ky_cast_payroll')
    .upsert(rows, { onConflict: 'cast_id,date', ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

// ── シフト表画像生成（§22・AdminShiftImage用） ──

/** 対象月の出勤枠を全件取得（シフト表描画用）。 */
export async function fetchShiftsByMonth(tenantId: string, yearMonth: string): Promise<KyShift[]> {
  const { from, toExclusive } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from('ky_shifts')
    .select('id, cast_id, date, start_at, end_at')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lt('date', toExclusive)
    .order('date')
    .order('start_at');
  if (error) throw error;
  return (data ?? []) as KyShift[];
}

/** シフト表テンプレのお気に入り一覧（新しい順）。 */
export async function fetchShiftTemplateList(tenantId: string): Promise<KyShiftTemplate[]> {
  const { data, error } = await supabase
    .from('ky_shift_templates')
    .select('id, tenant_id, name, template_key, custom_settings, logo_url, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as KyShiftTemplate[];
}

/** シフト表テンプレのお気に入り保存（custom_settings＝palette/motif等の上書き差分・§22）。 */
export async function addShiftTemplate(input: {
  tenantId: string;
  name: string;
  templateKey: string;
  customSettings: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('ky_shift_templates').insert({
    tenant_id: input.tenantId,
    name: input.name,
    template_key: input.templateKey,
    custom_settings: input.customSettings,
  });
  if (error) throw error;
}

export async function removeShiftTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('ky_shift_templates').delete().eq('id', id);
  if (error) throw error;
}

/**
 * AIシフトデザイン生成（Edge Function `ky-shift-design`・SPEC §22）。
 * 返り値は raw デザイン（検証・完全定義化は shiftTemplates/aiDesign.ts の buildAiDefinition）。
 * 失敗時は Edge Function のエラーコード（rate_limit / global_limit 等）を message に載せて投げる。
 */
export async function requestAiShiftDesign(mood: string, storeName: string): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('ky-shift-design', {
    body: { mood, store_name: storeName },
  });
  if (error) {
    let code = '';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        code = ((await ctx.json()) as { error?: string }).error ?? '';
      }
    } catch (e) {
      console.warn('[kyasuho] ky-shift-design error body unreadable:', e);
    }
    throw new Error(code || error.message);
  }
  const design = (data as { design?: unknown } | null)?.design;
  if (design === undefined || design === null) throw new Error('bad_ai_output');
  return design;
}

// ---- 招待管理（ky_cast_invites・T13） ----

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function fetchInvites(tenantId: string): Promise<KyCastInvite[]> {
  const { data, error } = await supabase
    .from('ky_cast_invites')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as KyCastInvite[];
}

export async function createInvite(tenantId: string, castId: string): Promise<KyCastInvite> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('ky_cast_invites')
    .insert({
      tenant_id: tenantId,
      cast_id: castId,
      code: generateInviteCode(),
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error) throw error;
  return data as KyCastInvite;
}

export async function deleteInvite(id: string): Promise<void> {
  const { error } = await supabase.from('ky_cast_invites').delete().eq('id', id);
  if (error) throw error;
}

// ---- オーダー管理（ky_orders/ky_order_items/ky_menu_items・§25） ----

export async function fetchOrdersByDate(tenantId: string, date: string): Promise<KyOrder[]> {
  const { data, error } = await supabase
    .from('ky_orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('biz_date', date)
    .order('opened_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as KyOrder[];
}

export async function fetchOrderItems(orderId: string): Promise<KyOrderItem[]> {
  const { data, error } = await supabase
    .from('ky_order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as KyOrderItem[];
}

export async function fetchMenuItems(tenantId: string): Promise<KyMenuItem[]> {
  const { data, error } = await supabase
    .from('ky_menu_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return (data ?? []) as KyMenuItem[];
}

export async function upsertMenuItem(
  tenantId: string,
  input: {
    id?: string;
    category: string;
    name: string;
    price: number;
    needsCast: boolean;
    sortOrder: number;
    isActive: boolean;
  },
): Promise<void> {
  const row = {
    tenant_id: tenantId,
    category: input.category,
    name: input.name,
    price: input.price,
    needs_cast: input.needsCast,
    sort_order: input.sortOrder,
    is_active: input.isActive,
    ...(input.id ? { id: input.id } : {}),
  };
  const { error } = input.id
    ? await supabase.from('ky_menu_items').update(row).eq('id', input.id)
    : await supabase.from('ky_menu_items').insert(row);
  if (error) throw error;
}

export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from('ky_menu_items').delete().eq('id', id);
  if (error) throw error;
}

/** §25-5: 指定月のキャストドリンク数を「castId|date」→杯数 のマップで返す */
export async function countCastDrinksByMonth(
  tenantId: string,
  yearMonth: string,
): Promise<Map<string, number>> {
  const { from, toExclusive } = monthRange(yearMonth);
  const { data: orders, error: ordErr } = await supabase
    .from('ky_orders')
    .select('id, biz_date')
    .eq('tenant_id', tenantId)
    .gte('biz_date', from)
    .lt('biz_date', toExclusive)
    .eq('status', 'closed');
  if (ordErr) throw ordErr;
  if (!orders || orders.length === 0) return new Map();

  const orderIds = (orders as { id: string; biz_date: string }[]).map((o) => o.id);
  const dateById = new Map((orders as { id: string; biz_date: string }[]).map((o) => [o.id, o.biz_date]));

  const { data: items, error: itemErr } = await supabase
    .from('ky_order_items')
    .select('order_id, cast_id, qty')
    .in('order_id', orderIds)
    .eq('category', 'cast_drink')
    .not('cast_id', 'is', null);
  if (itemErr) throw itemErr;

  const counts = new Map<string, number>();
  for (const row of (items ?? []) as { order_id: string; cast_id: string; qty: number }[]) {
    const bizDate = dateById.get(row.order_id);
    if (!bizDate) continue;
    const key = `${row.cast_id}|${bizDate}`;
    counts.set(key, (counts.get(key) ?? 0) + row.qty);
  }
  return counts;
}

// ── 席種・席料（§29） ──────────────────────────────────────────

export async function fetchSeatTypes(tenantId: string): Promise<KySeatType[]> {
  const { data, error } = await supabase
    .from('ky_seat_types')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return (data ?? []) as KySeatType[];
}

export async function addSeatType(
  tenantId: string,
  name: string,
  seatFee: number,
  capacity: number,
): Promise<KySeatType> {
  const { data: maxRow } = await supabase
    .from('ky_seat_types')
    .select('sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();
  const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('ky_seat_types')
    .insert({ tenant_id: tenantId, name, seat_fee: seatFee, capacity, sort_order: nextOrder })
    .select()
    .single();
  if (error) throw error;
  return data as KySeatType;
}

export async function updateSeatType(
  id: string,
  fields: Partial<{ name: string; seat_fee: number; capacity: number; sort_order: number; is_active: boolean }>,
): Promise<void> {
  const { error } = await supabase.from('ky_seat_types').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteSeatType(id: string): Promise<void> {
  const { error } = await supabase.from('ky_seat_types').delete().eq('id', id);
  if (error) throw error;
}

// ---- キャスト写真 ----

const PHOTO_BUCKET = 'ky-cast-photos';

export async function uploadCastShopPhoto(
  tenantId: string,
  castId: string,
  file: File,
): Promise<string> {
  const path = `${tenantId}/${castId}/shop.jpg`;
  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) throw upErr;
  const { data: urlData } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
  const { error: updErr } = await supabase
    .from('ky_casts')
    .update({ photo_url: publicUrl })
    .eq('id', castId);
  if (updErr) throw updErr;
  return publicUrl;
}

// ---- 経費 (§27) ----

export async function fetchExpenses(
  tenantId: string,
  startDate: string,
  endDate: string,
): Promise<KyExpense[]> {
  const { data, error } = await supabase
    .from('ky_expenses')
    .select('id, tenant_id, date, category, amount, memo')
    .eq('tenant_id', tenantId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data as KyExpense[] | null) ?? [];
}

export async function addExpense(
  tenantId: string,
  date: string,
  category: string,
  amount: number,
  memo: string,
): Promise<KyExpense> {
  const { data, error } = await supabase
    .from('ky_expenses')
    .insert({ tenant_id: tenantId, date, category, amount, memo })
    .select('id, tenant_id, date, category, amount, memo')
    .single();
  if (error) throw error;
  return data as KyExpense;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('ky_expenses').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchMonthlySalesTotal(
  tenantId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('ky_sales')
    .select('total_revenue')
    .eq('tenant_id', tenantId)
    .gte('date', startDate)
    .lte('date', endDate);
  if (error) throw error;
  return ((data as { total_revenue: number }[] | null) ?? []).reduce(
    (sum, r) => sum + r.total_revenue,
    0,
  );
}

export async function fetchMonthlyPayrollTotal(
  tenantId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('ky_cast_payroll')
    .select('total_pay')
    .eq('tenant_id', tenantId)
    .gte('date', startDate)
    .lte('date', endDate);
  if (error) throw error;
  return ((data as { total_pay: number }[] | null) ?? []).reduce(
    (sum, r) => sum + r.total_pay,
    0,
  );
}

// ---- 店舗テンプレ背景（§22-3） ----

// ---- 顧客管理（ky_customers・§32-2） ----

const CUSTOMER_SELECT =
  'id, tenant_id, name, name_kana, contact, persona_notes, internal_notes, is_banned, ban_reason, stamp_count, total_visits, last_visit_date, created_at';

export async function fetchCustomerList(tenantId: string): Promise<KyCustomer[]> {
  const { data, error } = await supabase
    .from('ky_customers')
    .select(CUSTOMER_SELECT)
    .eq('tenant_id', tenantId)
    .order('name_kana')
    .order('name');
  if (error) throw error;
  return (data ?? []) as KyCustomer[];
}

export async function addCustomerRecord(
  tenantId: string,
  input: {
    name: string;
    name_kana: string;
    contact: string;
    persona_notes: string;
    internal_notes: string;
  },
): Promise<KyCustomer> {
  const { data, error } = await supabase
    .from('ky_customers')
    .insert({ tenant_id: tenantId, ...input })
    .select(CUSTOMER_SELECT)
    .single();
  if (error) throw error;
  return data as KyCustomer;
}

export async function updateCustomerRecord(
  id: string,
  fields: Partial<{
    name: string;
    name_kana: string;
    contact: string;
    persona_notes: string;
    internal_notes: string;
    is_banned: boolean;
    ban_reason: string;
    stamp_count: number;
    total_visits: number;
    last_visit_date: string | null;
  }>,
): Promise<void> {
  const { error } = await supabase.from('ky_customers').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteCustomerRecord(id: string): Promise<void> {
  const { error } = await supabase.from('ky_customers').delete().eq('id', id);
  if (error) throw error;
}

// ---- スタンプ設定（ky_stamp_settings） ----

export async function fetchStampSettingsRecord(tenantId: string): Promise<KyStampSettings | null> {
  const { data, error } = await supabase
    .from('ky_stamp_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  return (data as KyStampSettings | null) ?? null;
}

export async function saveStampSettingsRecord(
  tenantId: string,
  input: {
    stamps_per_visit: number;
    reward_threshold: number;
    reward_description: string;
    is_active: boolean;
  },
): Promise<void> {
  const { error } = await supabase.from('ky_stamp_settings').upsert(
    { tenant_id: tenantId, ...input },
    { onConflict: 'tenant_id' },
  );
  if (error) throw error;
}

// ---- 店舗テンプレ背景（§22-3） ----

export async function uploadShiftBackground(
  tenantId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${tenantId}/bg_${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('ky-shift-backgrounds')
    .upload(path, file, { cacheControl: '86400', upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage
    .from('ky-shift-backgrounds')
    .getPublicUrl(path);
  return urlData.publicUrl;
}

// ---- イベント（ky_events・§19-㉞） ----

export async function fetchEvents(tenantId: string): Promise<KyEvent[]> {
  const { data, error } = await supabase
    .from('ky_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('event_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as KyEvent[];
}

export async function addEvent(
  tenantId: string,
  input: { title: string; description: string; eventDate: string; startTime: string | null; endTime: string | null; eventType: string; isPublic: boolean },
): Promise<void> {
  const { error } = await supabase.from('ky_events').insert({
    tenant_id: tenantId,
    title: input.title,
    description: input.description,
    event_date: input.eventDate,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    event_type: input.eventType,
    is_public: input.isPublic,
  });
  if (error) throw error;
}

export async function updateEvent(
  id: string,
  input: { title: string; description: string; eventDate: string; startTime: string | null; endTime: string | null; eventType: string; isPublic: boolean },
): Promise<void> {
  const { error } = await supabase.from('ky_events').update({
    title: input.title,
    description: input.description,
    event_date: input.eventDate,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    event_type: input.eventType,
    is_public: input.isPublic,
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('ky_events').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchPublicEvents(tenantId: string): Promise<KyEvent[]> {
  const { data, error } = await supabase
    .from('ky_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_public', true)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as KyEvent[];
}

// ---- テナント機能フラグ更新（§19-㊲） ----

export async function updateTenantFlags(
  tenantId: string,
  flags: Partial<{ enable_bottle_keep: boolean; enable_vouchers: boolean }>,
): Promise<void> {
  const { error } = await supabase.from('ky_tenants').update(flags).eq('id', tenantId);
  if (error) throw error;
}

// ---- テナントプロフィール更新 ----

export async function updateTenantProfile(
  tenantId: string,
  fields: Partial<{
    name: string;
    genre: string;
    business_info: { address?: string; openHours?: string; tel?: string; note?: string };
    sns_links: { platform: string; url: string }[];
    prefecture: string;
    area: string;
    ranking_opt_in: boolean;
  }>,
): Promise<void> {
  const { error } = await supabase.from('ky_tenants').update(fields).eq('id', tenantId);
  if (error) throw error;
}

// ---- ボトルキープ（ky_bottle_keeps） ----

export async function fetchBottleKeeps(tenantId: string): Promise<KyBottleKeep[]> {
  const { data, error } = await supabase
    .from('ky_bottle_keeps')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as KyBottleKeep[];
}

export async function addBottleKeep(
  tenantId: string,
  input: {
    customerName: string;
    itemName: string;
    startDate: string;
    expiryDate: string | null;
    remaining: string;
    note: string;
  },
): Promise<void> {
  const { error } = await supabase.from('ky_bottle_keeps').insert({
    tenant_id: tenantId,
    customer_name: input.customerName,
    item_name: input.itemName,
    start_date: input.startDate,
    expiry_date: input.expiryDate || null,
    remaining: input.remaining,
    note: input.note,
  });
  if (error) throw error;
}

export async function updateBottleKeep(
  id: string,
  fields: Partial<{
    customer_name: string;
    item_name: string;
    start_date: string;
    expiry_date: string | null;
    remaining: string;
    note: string;
    is_active: boolean;
  }>,
): Promise<void> {
  const { error } = await supabase.from('ky_bottle_keeps').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteBottleKeep(id: string): Promise<void> {
  const { error } = await supabase.from('ky_bottle_keeps').delete().eq('id', id);
  if (error) throw error;
}

// ---- 回数券・クーポン券（ky_vouchers） ----

export async function fetchVouchers(tenantId: string): Promise<KyVoucher[]> {
  const { data, error } = await supabase
    .from('ky_vouchers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as KyVoucher[];
}

export async function addVoucher(
  tenantId: string,
  input: {
    voucherType: string;
    name: string;
    customerName: string;
    totalCount: number;
    expiryDate: string | null;
    note: string;
  },
): Promise<void> {
  const { error } = await supabase.from('ky_vouchers').insert({
    tenant_id: tenantId,
    voucher_type: input.voucherType,
    name: input.name,
    customer_name: input.customerName,
    total_count: input.totalCount,
    remaining_count: input.totalCount,
    expiry_date: input.expiryDate || null,
    note: input.note,
  });
  if (error) throw error;
}

export async function updateVoucher(
  id: string,
  fields: Partial<{
    voucher_type: string;
    name: string;
    customer_name: string;
    total_count: number;
    remaining_count: number;
    expiry_date: string | null;
    note: string;
    is_active: boolean;
  }>,
): Promise<void> {
  const { error } = await supabase.from('ky_vouchers').update(fields).eq('id', id);
  if (error) throw error;
}

export async function useVoucher(id: string, currentRemaining: number): Promise<void> {
  if (currentRemaining <= 0) return;
  const { error } = await supabase
    .from('ky_vouchers')
    .update({ remaining_count: currentRemaining - 1 })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteVoucher(id: string): Promise<void> {
  const { error } = await supabase.from('ky_vouchers').delete().eq('id', id);
  if (error) throw error;
}
