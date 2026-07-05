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
  is_suspended: boolean;
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
  photo_url: string | null;
  bio: string;
  accepts_nomination: boolean;
  sort_order: number;
}

export interface KyShift {
  id: string;
  cast_id: string;
  date: string;
  start_at: string;
  end_at: string;
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
