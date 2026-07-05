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
