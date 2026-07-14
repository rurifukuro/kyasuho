import type { KyTenant } from './types';

/** 標準の客向け予約ページURL（GitHub Pages）。 */
export function defaultReserveUrl(slug: string): string {
  return `https://rurifukuro.github.io/kyasuho/#/${slug}`;
}

/**
 * 店舗の予約ページURLを解決する。
 * business_info.customReserveUrl が設定されていればそれを優先し、
 * 未設定（空欄）なら標準URLへフォールバックする。
 * アプリ側 src/utils/reserveUrl.ts と同一ロジック（WEB13両面同期）。
 */
export function reserveUrlFor(tenant: Pick<KyTenant, 'slug' | 'business_info'>): string {
  const custom = tenant.business_info?.customReserveUrl?.trim();
  return custom || defaultReserveUrl(tenant.slug);
}
