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
  { key: 'base',       name: '予約基盤 (base)',       desc: '予約台帳・受付設定・キャスト管理・客Web・通知・Q&A AI・管理Web基盤', price: 12800, stripePriceId: '' },
  { key: 'register',   name: 'レジ (register)',       desc: 'オーダー・伝票・会計・席料・日報・印刷・在庫',                       price: 9800,  stripePriceId: '' },
  { key: 'shift',      name: 'シフト (shift)',        desc: 'テンプレ40種・AIデザイン月100回・デイリー・SNS投稿',                 price: 8800,  stripePriceId: '' },
  { key: 'sales',      name: '売上/給与 (sales)',     desc: '売上集計・給与計算・バック・スライド時給',                             price: 8800,  stripePriceId: '' },
  { key: 'analytics',  name: '分析 (analytics)',      desc: '期間集計・ランキング・グラフ・ダッシュボード',                         price: 7800,  stripePriceId: '' },
  { key: 'customer',   name: '顧客 (customer)',       desc: 'お客様モード・ポイント・景品・スタンプ',                               price: 7800,  stripePriceId: '' },
  { key: 'attendance', name: '勤怠 (attendance)',      desc: '打刻・欠勤遅刻早退・月次集計',                                       price: 5800,  stripePriceId: '' },
  { key: 'expense',    name: '経費 (expense)',         desc: '経費管理・定期固定経費・OCR月300枚',                                 price: 5800,  stripePriceId: '' },
];

export const PACKS: PackDef[] = [
  { key: 'hospitality', name: '接客パック',   emoji: '🏪', modules: ['base', 'register', 'customer'],    price: 24800, stripePriceId: '' },
  { key: 'staff',       name: 'スタッフパック', emoji: '👥', modules: ['base', 'shift', 'attendance'],      price: 21800, stripePriceId: '' },
  { key: 'management',  name: '経営パック',   emoji: '📈', modules: ['sales', 'expense', 'analytics'],    price: 17800, stripePriceId: '' },
  { key: 'all_in',      name: 'オールイン',   emoji: '👑', modules: ['base', 'register', 'shift', 'sales', 'analytics', 'customer', 'attendance', 'expense'], price: 39800, stripePriceId: '' },
];

export const ADDONS: AddonDef[] = [
  { key: 'ai_extra_50',   name: 'AI生成 追加50回',  price: 1980, stripePriceId: '' },
  { key: 'ocr_extra_300', name: 'OCR 追加300枚',    price: 980,  stripePriceId: '' },
];

export function formatPrice(yen: number): string {
  return `¥${yen.toLocaleString()}`;
}
