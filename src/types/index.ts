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
export type TenantTheme = {
  primaryColor?: string;
  accentColor?: string;
  bgImageUrl?: string;
  cardOpacity?: number;
};

export type BusinessInfo = {
  address?: string;
  openHours?: string;
  tel?: string;
  note?: string;
  postalCode?: string;
  theme?: TenantTheme;
};

/** 店舗＝テナント。slug が客側公開ページのキー。 */
export type TenantSnsLink = {
  platform: string;
  url: string;
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  genre: string;
  ownerUserId: string;
  businessInfo: BusinessInfo;
  snsLinks: TenantSnsLink[];
  prefecture: string;
  area: string;
  rankingOptIn: boolean;
  isSuspended: boolean;
  enableBottleKeep: boolean;
  enableVouchers: boolean;
};

/** キャスト（コンカフェの出演者）。 */
export type Cast = {
  id: string;
  tenantId: string;
  name: string;
  nameKana: string;
  photoUrl: string | null;
  snsLinks: { label: string; url: string }[];
  bio: string;
  acceptsNomination: boolean;
  sortOrder: number;
  userId: string | null;
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

/** 経費カテゴリ固定リスト（§27）。 */
export type ExpenseCategory =
  | 'purchase'
  | 'rent'
  | 'utilities'
  | 'communication'
  | 'advertising'
  | 'costume'
  | 'supplies'
  | 'outsourcing'
  | 'misc'
  | (string & {});

export type CustomExpenseCategory = {
  id: string;
  tenantId: string;
  key: string;
  label: string;
  sortOrder: number;
};

/** 経費（§27）。 */
export type Expense = {
  id: string;
  tenantId: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  memo: string;
  receiptUrl: string | null;
  sourceRecurringId: string | null;
};

/** 定期固定経費テンプレート（§42）。 */
export type RecurringExpense = {
  id: string;
  tenantId: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  isActive: boolean;
};

/** 席種・席料（§29）。 */
export type SeatType = {
  id: string;
  tenantId: string;
  name: string;
  seatFee: number;
  capacity: number;
  sortOrder: number;
  isActive: boolean;
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
  seatTypeId: string | null; // 席種（§29・null=未指定）
  note: string;
  status: ReservationStatus;
  createdAt: string;
};

// ── 売上・給与・勤怠ドメイン（SPEC §3-F/H・§23／migration 0009） ──────

/** 勤怠ステータス（出勤/遅刻/早退/欠勤/代打）。 */
export type AttendanceStatus = 'present' | 'late' | 'early_leave' | 'absent' | 'substitute';

/** 欠勤・遅刻の理由カテゴリ（'' = 未選択）。 */
export type AttendanceReasonCategory = '' | 'sick' | 'personal' | 'no_show' | 'other';

/** 勤怠記録（キャスト×日付で1行・実績）。ky_shifts（予定）とは別テーブル。 */
export type Attendance = {
  id: string;
  tenantId: string;
  castId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  reasonCategory: AttendanceReasonCategory;
  reasonNote: string;
  substituteCastId: string | null; // status=substitute のとき代打キャスト
  checkInAt: string | null; // HH:MM（実入店・null=未入力）
  checkOutAt: string | null; // HH:MM（実退店・null=未入力）
  note: string;
  editedByOwner: boolean;
};

/** 日別売上（テナント×日付で1行）。金額は円。 */
export type DailySales = {
  id: string;
  tenantId: string;
  date: string; // YYYY-MM-DD
  totalRevenue: number;
  setCount: number;
  drinkCount: number;
  nominationCount: number;
  otherRevenue: number;
  note: string;
  entryMode: 'manual' | 'auto';
};

// ── オーダー管理ドメイン（SPEC §25・migration 0013） ──────────────────

/** メニューマスタのカテゴリ（§25-2）。discount は定型割引（負のprice）。 */
export type MenuCategory =
  | 'set' | 'extension' | 'nomination' | 'cast_drink'
  | 'drink' | 'food' | 'cheki' | 'other' | 'discount';

/** メニュー項目（ky_menu_items）。 */
export type MenuItem = {
  id: string;
  tenantId: string;
  category: MenuCategory;
  name: string;
  price: number;
  needsCast: boolean;
  sortOrder: number;
  isActive: boolean;
  backRate: number | null;
  backAmount: number | null;
};

/** 伝票ステータス（§25-2）。 */
export type OrderStatus = 'open' | 'closed' | 'void';

/** 支払方法（§25-2）。 */
export type PaymentMethod = 'cash' | 'card' | 'qr' | 'other';

/** 伝票（ky_orders）。 */
export type Order = {
  id: string;
  tenantId: string;
  bizDate: string; // YYYY-MM-DD
  seatNo: number | null;
  reservationId: string | null;
  customerLabel: string;
  customerId: string | null;
  status: OrderStatus;
  openedAt: string;
  closedAt: string | null;
  subtotal: number;
  deposit: number;
  change: number;
  paymentMethod: PaymentMethod;
  note: string;
};

/** オーダー明細（ky_order_items・スナップショット）。 */
export type OrderItem = {
  id: string;
  orderId: string;
  tenantId: string;
  menuItemId: string | null;
  category: string;
  name: string;
  price: number;
  qty: number;
  castId: string | null;
};

/** キャスト日別給与（キャスト×日付で1行）。金額は円・勤務時間は分単位。 */
export type CastPayroll = {
  id: string;
  tenantId: string;
  castId: string;
  date: string; // YYYY-MM-DD
  minutesWorked: number; // 分単位（§23: 小数回避）
  basePay: number;
  nominationCount: number;
  nominationBack: number;
  drinkCount: number;
  menuBack: number;
  otherBack: number;
  deductions: number;
  totalPay: number;
  note: string;
};

/** 給与計算設定（店一律・テナントで1行）。 */
export type PayrollSettings = {
  id: string;
  tenantId: string;
  baseHourlyRate: number; // 円/時
  nominationBackRate: number; // 円/件
  defaultBackRate: number; // %（メニュー個別設定が無い商品に適用）
  lateDeduction: number; // 円/回（遅刻控除）
  slideEnabled: boolean;
};

export type SlideMetric = 'monthly_sales' | 'monthly_nominations';

export type HourlyRateTier = {
  id: string;
  tenantId: string;
  metric: SlideMetric;
  threshold: number;
  hourlyRate: number;
  sortOrder: number;
};

// ── ロール判定（T13 キャストアカウント基盤） ──────────────────────────

/** ログインユーザーのロール。owner=店舗オーナー、cast=キャスト個人、none=未紐付け。 */
export type UserRole = 'owner' | 'cast' | 'none';

/** キャスト招待（ky_cast_invites）。 */
export type CastInvite = {
  id: string;
  tenantId: string;
  castId: string;
  code: string;
  expiresAt: string;
  usedAt: string | null;
  usedBy: string | null;
};

// ── キャスト人物像・遍歴・個人情報（T17/T18） ──────────────────────────

/** オーナーが記入するキャスト人物像・評価（ky_cast_evaluations）。 */
export type CastEvaluation = {
  id: string;
  tenantId: string;
  castId: string;
  personaNotes: string;
  strengths: string;
  areasForImprovement: string;
  customerFeedbackSummary: string;
  internalNotes: string;
};

/** 店舗遍歴（ky_cast_work_history・テナント横断）。 */
export type CastWorkHistory = {
  id: string;
  castUserId: string;
  tenantName: string;
  position: string;
  startDate: string | null;
  endDate: string | null;
  notes: string;
  visibility: 'public' | 'private';
  createdBy: string | null;
};

/** 口座種別。 */
export type AccountType = '' | 'savings' | 'checking';

/** キャスト個人情報（ky_cast_personal_info・面接書類代替）。 */
export type CastPersonalInfo = {
  id: string;
  castUserId: string;
  fullName: string;
  furigana: string;
  dateOfBirth: string | null;
  gender: string;
  address: string;
  phone: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  nearestStation: string;
  commuteMethod: string;
  commuteMinutes: number | null;
  bankName: string;
  bankBranch: string;
  accountType: AccountType;
  accountNumber: string;
  accountHolderName: string;
  desiredWorkDaysPerWeek: number | null;
  desiredHours: string;
  availableFrom: string | null;
  qualifications: string;
  specialNotes: string;
};

// ── 顧客名簿＋スタンプ（§32-2） ──────────────────────────

/** 顧客マスタ（テナント毎）。 */
export type Customer = {
  id: string;
  tenantId: string;
  name: string;
  nameKana: string;
  contact: string;
  personaNotes: string;
  internalNotes: string;
  isBanned: boolean;
  banReason: string;
  stampCount: number;
  totalVisits: number;
  lastVisitDate: string | null;
  createdAt: string;
};

/** スタンプ設定（テナントで1行）。 */
export type StampSettings = {
  id: string;
  tenantId: string;
  stampsPerVisit: number;
  rewardThreshold: number;
  rewardDescription: string;
  isActive: boolean;
};

/** ボトルキープ（ky_bottle_keeps）。 */
export type BottleKeep = {
  id: string;
  tenantId: string;
  customerName: string;
  itemName: string;
  startDate: string;
  expiryDate: string | null;
  remaining: string;
  note: string;
  isActive: boolean;
  createdAt: string;
};

/** 回数券/クーポン券種別。 */
export type VoucherType = 'ticket' | 'cheki' | 'other';

/** 回数券/クーポン券（ky_vouchers）。 */
export type Voucher = {
  id: string;
  tenantId: string;
  voucherType: VoucherType;
  name: string;
  customerName: string;
  totalCount: number;
  remainingCount: number;
  expiryDate: string | null;
  note: string;
  isActive: boolean;
  createdAt: string;
};

/** 店舗イベント（ky_events）。 */
export type StoreEvent = {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  eventType: string;
  isPublic: boolean;
  createdAt: string;
};

export type ShiftRequestStatus = 'requested' | 'approved' | 'rejected';

export type ShiftRequestTimeSource = 'default' | 'custom';

export type ShiftRequest = {
  id: string;
  tenantId: string;
  castId: string;
  date: string;
  startAt: string;
  endAt: string;
  note: string;
  timeSource: ShiftRequestTimeSource;
  status: ShiftRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type ShiftSubmission = {
  id: string;
  tenantId: string;
  castId: string;
  periodStart: string;
  periodEnd: string;
  submittedAt: string;
};

export type CastShiftDefault = {
  tenantId: string;
  castId: string;
  startAt: string;
  endAt: string;
  updatedAt: string;
};

export type ShiftReminderSettings = {
  tenantId: string;
  enabled: boolean;
  periodType: string;
  deadlineDay: number;
  remindDaysBefore: number;
  repeatDaily: boolean;
  remindHour: number;
  updatedAt: string;
};

/** ポイント設定（ky_point_settings・§41）。 */
export type PointSettings = {
  tenantId: string;
  enabled: boolean;
  yenPerPoint: number;
};

/** 景品カタログ（ky_point_rewards・§41）。 */
export type PointReward = {
  id: string;
  tenantId: string;
  pointsRequired: number;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
};

// ── 在庫管理（§47） ──────────────────────────────────────────────

export type InventoryMoveKind = 'in' | 'sale' | 'adjust' | 'out';

export type InventoryItem = {
  id: string;
  tenantId: string;
  name: string;
  unit: string;
  menuItemId: string | null;
  stockQty: number;
  alertThreshold: number | null;
  isActive: boolean;
  sortOrder: number;
};

export type InventoryMove = {
  id: string;
  tenantId: string;
  itemId: string;
  kind: InventoryMoveKind;
  qty: number;
  orderId: string | null;
  memo: string;
  createdAt: string;
};
