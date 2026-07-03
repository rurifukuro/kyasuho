// src/config/features.ts — 機能フラグ（§14 課金設計）
//
// MVP は全機能無料で出荷する＝IAP_ENABLED=false。
// ON にすると SettingsScreen に購入UI（PlanCard/SubscriptionCard）が現れ、
// 無料上限ゲート（canAddCast / canAcceptReservation）が有効化される想定（ルールGATE-1）。

export const IAP_ENABLED = false;

/** 無料プランの上限（§14 叩き台）。IAP_ENABLED=false の間は上限を適用しない。
 *  上限判定は将来この定数を参照する共通ゲート関数に集約する（散在禁止＝ルールGATE-1）。 */
export const FREE_LIMITS = {
  tenants: 1,
  casts: 3,
  reservationsPerMonth: 100,
} as const;
