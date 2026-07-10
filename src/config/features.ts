// src/config/features.ts — 機能フラグ＋モジュールカタログ（§14 課金設計・docs/BILLING_DESIGN.md 第2部）
//
// MVP は全機能無料で出荷する＝IAP_ENABLED=false。
// 課金は「モジュール選択型（アラカルト）」＝店舗が使う機能を選び、個数×契約期間で料金が決まる
// （BILLING_DESIGN §15〜§16・2026-07-10 ユーザー決定）。
// 有料判定は必ず isModuleEnabled() を通す（散在禁止＝ルールGATE-1）。plan==='pro' の直接比較は書かない。

export const IAP_ENABLED = false;

/** 有料モジュールのキー（BILLING_DESIGN §15-2 カタログ・境界の最終確定はユーザー決定ゲート）。
 *  キーは台帳・レシートに残るため一度出荷したら改名しない（Bundle ID と同じ不変原則）。 */
export const MODULE_KEYS = [
  'shift', // シフト表スタジオ（§22・§31）
  'sales', // 売上・給与（§3-F・§23）
  'register', // オーダー・レジ（§25）
  'attendance', // 勤怠（§3-H）
  'expense', // 経費・申告補助（§27）
  'analytics', // 分析・エクスポート
  'limits', // 上限拡張（FREE_LIMITS 超え）
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** テナントの有効モジュール（ky_tenants.entitlements 由来・service_role のみが書く列）。 */
export interface Entitlements {
  modules: ModuleKey[];
  /** 有効期限（ISO8601）。promo（トライアル）行も同じ形で乗る */
  until: string | null;
}

/** ルールGATE-1: 有料機能の解放判定はこの1関数に集約する。
 *  IAP_ENABLED=false の間は常に true（MVP＝全機能無料と同義・挙動不変）。 */
export function isModuleEnabled(
  moduleKey: ModuleKey,
  entitlements: Entitlements | null,
): boolean {
  if (!IAP_ENABLED) return true;
  if (!entitlements) return false;
  if (entitlements.until !== null && new Date(entitlements.until).getTime() < Date.now()) {
    return false;
  }
  return entitlements.modules.includes(moduleKey);
}

/** 無料プランの上限（§14 叩き台）。IAP_ENABLED=false の間は上限を適用しない。
 *  上限判定は将来この定数を参照する共通ゲート関数に集約する（散在禁止＝ルールGATE-1）。
 *  上限解放は 'limits' モジュール（isModuleEnabled('limits', ...)）で判定する。 */
export const FREE_LIMITS = {
  tenants: 1,
  casts: 3,
  reservationsPerMonth: 100,
} as const;
