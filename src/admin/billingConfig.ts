// Stripe 商品カタログ（BILL-0で作成済み・Sandbox）
// price_xxx は Stripe Dashboard から取得して埋める
// 本番キー切替時にライブモードの Price ID へ差し替え

export type ModuleKey =
  | 'base' | 'register' | 'shift' | 'sales'
  | 'analytics' | 'customer' | 'attendance' | 'expense';

export type PackKey = 'hospitality' | 'staff' | 'management' | 'all_in';

export type AddonKey = 'ai_extra_50' | 'ocr_extra_300';

export interface ModuleDef {
  key: ModuleKey;
  name: string;
  desc: string;
  price: number;
  stripePriceId: string;
}

export interface PackDef {
  key: PackKey;
  name: string;
  emoji: string;
  modules: ModuleKey[];
  price: number;
  stripePriceId: string;
}

export interface AddonDef {
  key: AddonKey;
  name: string;
  price: number;
  stripePriceId: string;
}

export const MODULES: ModuleDef[] = [
  { key: 'base',       name: '予約基盤 (base)',       desc: '予約台帳・受付設定・キャスト管理・客Web・通知・Q&A AI・管理Web基盤', price: 12800, stripePriceId: 'price_1TsG8t2Hu4EraAZOXuiMbo8I' },
  { key: 'register',   name: 'レジ (register)',       desc: 'オーダー・伝票・会計・席料・日報・印刷・在庫',                       price: 9800,  stripePriceId: 'price_1TsG9t2Hu4EraAZO6LKPV7Tr' },
  { key: 'shift',      name: 'シフト (shift)',        desc: 'テンプレ40種・AIデザイン月100回・デイリー・SNS投稿',                 price: 8800,  stripePriceId: 'price_1TsGAI2Hu4EraAZOYoSDTMMl' },
  { key: 'sales',      name: '売上/給与 (sales)',     desc: '売上集計・給与計算・バック・スライド時給',                             price: 8800,  stripePriceId: 'price_1TsGAf2Hu4EraAZOtt7rlJBe' },
  { key: 'analytics',  name: '分析 (analytics)',      desc: '期間集計・ランキング・グラフ・ダッシュボード',                         price: 7800,  stripePriceId: 'price_1TsGB22Hu4EraAZONskdR3S1' },
  { key: 'customer',   name: '顧客 (customer)',       desc: 'お客様モード・ポイント・景品・スタンプ',                               price: 7800,  stripePriceId: 'price_1TsGBP2Hu4EraAZO8Wr9D5Ee' },
  { key: 'attendance', name: '勤怠 (attendance)',      desc: '打刻・欠勤遅刻早退・月次集計',                                       price: 5800,  stripePriceId: 'price_1TsGBm2Hu4EraAZOJclUyDk3' },
  { key: 'expense',    name: '経費 (expense)',         desc: '経費管理・定期固定経費・OCR月300枚',                                 price: 5800,  stripePriceId: 'price_1TsGC92Hu4EraAZO6p5gZShf' },
];

export const PACKS: PackDef[] = [
  { key: 'hospitality', name: '接客パック',   emoji: '🏪', modules: ['base', 'register', 'customer'],    price: 24800, stripePriceId: 'price_1TsGEx2Hu4EraAZOzkie6jjG' },
  { key: 'staff',       name: 'スタッフパック', emoji: '👥', modules: ['base', 'shift', 'attendance'],      price: 21800, stripePriceId: 'price_1TsGFO2Hu4EraAZOSOiDc7KL' },
  { key: 'management',  name: '経営パック',   emoji: '📈', modules: ['sales', 'expense', 'analytics'],    price: 17800, stripePriceId: 'price_1TsGFo2Hu4EraAZO0faqfMTq' },
  { key: 'all_in',      name: 'オールイン',   emoji: '👑', modules: ['base', 'register', 'shift', 'sales', 'analytics', 'customer', 'attendance', 'expense'], price: 39800, stripePriceId: 'price_1TsGGH2Hu4EraAZOr6DyfFEN' },
];

export const ADDONS: AddonDef[] = [
  { key: 'ai_extra_50',   name: 'AI生成 追加50回',  price: 1980, stripePriceId: 'price_1TsGGp2Hu4EraAZOqBMdCn9X' },
  { key: 'ocr_extra_300', name: 'OCR 追加300枚',    price: 980,  stripePriceId: 'price_1TsGHE2Hu4EraAZONudK3u28' },
];

export function formatPrice(yen: number): string {
  return `¥${yen.toLocaleString()}`;
}

// ---- 個数割引ラダー（改定 2026-07-15・パック優位設計）----
// 1個=定価 / 2個=5% / 3個=10% / 4-5個=20% / 6-7個=30% / 8個=¥39,800固定
// 丸め: 割引後を最寄りの ¥●,800 へ。
// 実請求はサーバー（supabase/functions/ky-checkout）が同じ式で解決する＝改定時は両方更新（WEB13）。

export const ALL_IN_PRICE = 39800;

export function ladderRate(count: number): number {
  if (count >= 8) return 0; // 8個は固定価格（率でなく ALL_IN_PRICE）
  if (count >= 6) return 0.30;
  if (count >= 4) return 0.20;
  if (count === 3) return 0.10;
  if (count === 2) return 0.05;
  return 0;
}

export function roundTo800(x: number): number {
  return Math.round((x - 800) / 1000) * 1000 + 800;
}

/** 選択モジュール数と定価合計 → 月額（ラダー＋¥●,800丸め） */
export function computeMonthlyTotal(count: number, listTotal: number): number {
  if (count >= 8) return ALL_IN_PRICE;
  if (count >= 2) return roundTo800(listTotal * (1 - ladderRate(count)));
  return listTotal;
}
