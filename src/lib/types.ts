export interface KyTenant {
  id: string;
  slug: string;
  name: string;
  genre: string;
  business_info: {
    address?: string;
    openHours?: string;
    tel?: string;
    note?: string;
  };
  sns_links: { platform: string; url: string }[];
  prefecture: string;
  area: string;
  ranking_opt_in: boolean;
  is_suspended: boolean;
  enable_bottle_keep: boolean;
  enable_vouchers: boolean;
}

export interface KyUnlockWindow {
  id: string;
  tenant_id: string;
  date: string;
  open_from: string;
  close_at: string | null;
  seats: number;
  set_minutes: number;
}

export interface KyCast {
  id: string;
  tenant_id: string;
  name: string;
  name_kana: string;
  photo_url: string | null;
  bio: string;
  accepts_nomination: boolean;
  sort_order: number;
  user_id: string | null;
}

/** 経費（§27）。 */
export interface KyExpense {
  id: string;
  tenant_id: string;
  date: string;
  category: string;
  amount: number;
  memo: string;
  receipt_url: string | null;
}

/** 席種・席料（§29）。 */
export interface KySeatType {
  id: string;
  tenant_id: string;
  name: string;
  seat_fee: number;
  capacity: number;
  sort_order: number;
  is_active: boolean;
}

export interface KyCastInvite {
  id: string;
  tenant_id: string;
  cast_id: string;
  code: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
}

export interface KyShift {
  id: string;
  cast_id: string;
  date: string;
  start_at: string;
  end_at: string;
}

/** シフト表テンプレのお気に入り保存（ky_shift_templates・§22） */
export interface KyShiftTemplate {
  id: string;
  tenant_id: string;
  name: string;
  template_key: string;
  custom_settings: Record<string, unknown>;
  logo_url: string | null;
  created_at: string;
}

export interface KyReservation {
  id: string;
  tenant_id: string;
  date: string;
  slot: string;
  set_minutes: number;
  seat_no: number;
  customer_name: string;
  status: 'reserved' | 'checked_in' | 'cancelled' | 'no_show';
}

/** 管理Web用＝予約の全列（客Webの KyReservation は公開安全な列だけに絞っている）。 */
export interface KyReservationFull extends Omit<KyReservation, 'seat_no'> {
  seat_no: number | null;
  contact: string;
  party_size: number;
  cast_id: string | null;
  seat_type_id: string | null;
  note: string;
  created_at: string;
}

/** 日別売上（ky_sales・テナント×日付で1行）。金額は円。 */
export interface KySales {
  id: string;
  tenant_id: string;
  date: string;
  total_revenue: number;
  set_count: number;
  drink_count: number;
  nomination_count: number;
  other_revenue: number;
  note: string;
  entry_mode: 'manual' | 'auto';
}

/** メニューマスタカテゴリ（§25-2）。 */
export type KyMenuCategory =
  | 'set' | 'extension' | 'nomination' | 'cast_drink'
  | 'drink' | 'food' | 'cheki' | 'other' | 'discount';

/** メニュー項目（ky_menu_items）。 */
export interface KyMenuItem {
  id: string;
  tenant_id: string;
  category: KyMenuCategory;
  name: string;
  price: number;
  needs_cast: boolean;
  sort_order: number;
  is_active: boolean;
}

/** 伝票ステータス（§25-2）。 */
export type KyOrderStatus = 'open' | 'closed' | 'void';

/** 支払方法（§25-2）。 */
export type KyPaymentMethod = 'cash' | 'card' | 'qr' | 'other';

/** 伝票（ky_orders）。 */
export interface KyOrder {
  id: string;
  tenant_id: string;
  biz_date: string;
  seat_no: number | null;
  reservation_id: string | null;
  customer_label: string;
  customer_id: string | null;
  status: KyOrderStatus;
  opened_at: string;
  closed_at: string | null;
  subtotal: number;
  deposit: number;
  change: number;
  payment_method: KyPaymentMethod;
  note: string;
}

/** オーダー明細（ky_order_items・スナップショット）。 */
export interface KyOrderItem {
  id: string;
  order_id: string;
  tenant_id: string;
  menu_item_id: string | null;
  category: string;
  name: string;
  price: number;
  qty: number;
  cast_id: string | null;
}

export type KyAttendanceStatus = 'present' | 'late' | 'early_leave' | 'absent' | 'substitute';

/** 欠勤・遅刻の理由カテゴリ（'' = 未選択）。 */
export type KyAttendanceReason = '' | 'sick' | 'personal' | 'no_show' | 'other';

/** 勤怠記録（ky_attendance・キャスト×日付で1行・実績）。ky_shifts（予定）とは別テーブル。 */
export interface KyAttendance {
  id: string;
  tenant_id: string;
  cast_id: string;
  date: string;
  status: KyAttendanceStatus;
  reason_category: KyAttendanceReason;
  reason_note: string;
  substitute_cast_id: string | null;
  check_in_at: string | null; // HH:MM（null=未入力）
  check_out_at: string | null;
  note: string;
}

/** 給与計算設定（ky_payroll_settings・店一律・テナントで1行）。 */
export interface KyPayrollSettings {
  id: string;
  tenant_id: string;
  base_hourly_rate: number;
  nomination_back_rate: number;
  drink_back_rate: number;
  late_deduction: number;
}

/** キャスト日別給与（ky_cast_payroll・キャスト×日付で1行）。金額は円・勤務時間は分単位。 */
export interface KyCastPayroll {
  id: string;
  tenant_id: string;
  cast_id: string;
  date: string;
  minutes_worked: number;
  base_pay: number;
  nomination_count: number;
  nomination_back: number;
  drink_count: number;
  drink_back: number;
  other_back: number;
  deductions: number;
  total_pay: number;
  note: string;
}

/** 顧客マスタ（ky_customers・テナント毎）。 */
export interface KyCustomer {
  id: string;
  tenant_id: string;
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
  created_at: string;
}

/** スタンプ設定（ky_stamp_settings・テナントで1行）。 */
export interface KyStampSettings {
  id: string;
  tenant_id: string;
  stamps_per_visit: number;
  reward_threshold: number;
  reward_description: string;
  is_active: boolean;
}

/** 店舗イベント（ky_events）。 */
export interface KyEvent {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string;
  is_public: boolean;
  created_at: string;
}

/** ボトルキープ（ky_bottle_keeps）。 */
export interface KyBottleKeep {
  id: string;
  tenant_id: string;
  customer_name: string;
  item_name: string;
  start_date: string;
  expiry_date: string | null;
  remaining: string;
  note: string;
  is_active: boolean;
  created_at: string;
}

/** 回数券/クーポン券（ky_vouchers）。 */
export type KyVoucherType = 'ticket' | 'cheki' | 'other';

export interface KyVoucher {
  id: string;
  tenant_id: string;
  voucher_type: KyVoucherType;
  name: string;
  customer_name: string;
  total_count: number;
  remaining_count: number;
  expiry_date: string | null;
  note: string;
  is_active: boolean;
  created_at: string;
}

export type DayStatus = 'available' | 'low' | 'full';

export interface MakeReservationResult {
  id?: string;
  seat_no?: number;
  error?: 'no_available_seat' | 'not_unlocked';
}

export interface VerifyPinResult {
  ok: boolean;
  reason?: 'no_pin' | 'mismatch';
}

export interface CancelResult {
  ok: boolean;
  error?: 'not_found' | 'pin_mismatch' | 'not_cancellable';
}
