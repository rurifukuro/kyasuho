// きゃすりん 型定義（SPEC §10）
// マルチテナント予約ドメイン ＋ カラーテーマ（テーマは とれはんっ！ src/types/index.ts より流用）。

// ── カラーテーマ（8色・とれはんっ！流用） ────────────────────────────
export type ThemeColor = {
  primary: string;
  primaryLight: string;
  background: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  highlight: string;
};

export const THEMES: Record<string, ThemeColor> = {
  pink: {
    primary: '#BE185D',
    primaryLight: '#EC4899',
    background: '#FFF0F6',
    card: '#FFFFFF',
    text: '#2D1B2E',
    subtext: '#592D44',
    border: '#F5C0D8',
    highlight: '#EC4899',
  },
  purple: {
    primary: '#5B21B6',
    primaryLight: '#8B5CF6',
    background: '#F5F3FF',
    card: '#FFFFFF',
    text: '#1E1A2E',
    subtext: '#42355B',
    border: '#DDD6FE',
    highlight: '#8B5CF6',
  },
  blue: {
    primary: '#1E6FBF',
    primaryLight: '#4A9FEF',
    background: '#F0F6FF',
    card: '#FFFFFF',
    text: '#1A1A2E',
    subtext: '#3F4A58',
    border: '#C8D8EA',
    highlight: '#3B82F6',
  },
  teal: {
    primary: '#0F766E',
    primaryLight: '#2DD4BF',
    background: '#F0FDFA',
    card: '#FFFFFF',
    text: '#0F2B29',
    subtext: '#204D49',
    border: '#99F6E4',
    highlight: '#14B8A6',
  },
  green: {
    primary: '#166534',
    primaryLight: '#22C55E',
    background: '#F0FFF4',
    card: '#FFFFFF',
    text: '#1A2E1A',
    subtext: '#2D4C35',
    border: '#BBF7D0',
    highlight: '#22C55E',
  },
  orange: {
    primary: '#C05700',
    primaryLight: '#FB923C',
    background: '#FFF7ED',
    card: '#FFFFFF',
    text: '#2C1810',
    subtext: '#593520',
    border: '#FED7AA',
    highlight: '#FB923C',
  },
  red: {
    primary: '#B91C1C',
    primaryLight: '#EF4444',
    background: '#FFF5F5',
    card: '#FFFFFF',
    text: '#2C1010',
    subtext: '#592020',
    border: '#FECACA',
    highlight: '#EF4444',
  },
  indigo: {
    primary: '#4338CA',
    primaryLight: '#818CF8',
    background: '#EEF2FF',
    card: '#FFFFFF',
    text: '#1E1B4B',
    subtext: '#363468',
    border: '#C7D2FE',
    highlight: '#6366F1',
  },
};

// ── 予約ドメイン（マルチテナント・SPEC §10） ──────────────────────────
export type ReservationStatus = 'reserved' | 'checked_in' | 'cancelled' | 'no_show';

/** 店舗プロフィールの詳細（jsonb で保持）。 */
export type BusinessInfo = {
  address?: string;
  openHours?: string;
  tel?: string;
  note?: string;
};

/** 店舗＝テナント。slug が客側公開ページのキー。 */
export type Tenant = {
  id: string;
  slug: string;
  name: string;
  genre: string;
  ownerUserId: string;
  businessInfo: BusinessInfo;
  isSuspended: boolean;
};

/** キャスト（コンカフェの出演者）。 */
export type Cast = {
  id: string;
  tenantId: string;
  name: string;
  photoUrl: string | null;
  snsLinks: { label: string; url: string }[];
  bio: string;
  acceptsNomination: boolean;
  sortOrder: number;
};

/** キャストの出勤枠。 */
export type Shift = {
  id: string;
  tenantId: string;
  castId: string;
  date: string; // YYYY-MM-DD
  startAt: string; // HH:MM
  endAt: string; // HH:MM
};

/** 受付解禁ウィンドウ＋自動〆切（concafe-yoyaku unlock_windows ＋ レジさぽっ！ close_at 流用）。 */
export type UnlockWindow = {
  id: string;
  tenantId: string;
  date: string; // YYYY-MM-DD
  openFrom: string;
  closeAt: string | null;
  seats: number;
  setMinutes: number;
};

/** 予約本体。 */
export type Reservation = {
  id: string;
  tenantId: string;
  date: string; // YYYY-MM-DD
  slot: string;
  seatNo: number | null;
  customerName: string;
  contact: string;
  partySize: number;
  castId: string | null; // 指名キャスト
  note: string;
  status: ReservationStatus;
  createdAt: string;
};
