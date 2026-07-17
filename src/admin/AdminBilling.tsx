import { useCallback, useState } from 'react';
import type { KyTenant } from '../lib/types';
import { supabase } from '../lib/supabase';
import { MODULES, PACKS, ADDONS, formatPrice, ladderRate, computeMonthlyTotal } from './billingConfig';
import type { ModuleKey } from './billingConfig';

export function AdminBilling({ tenant: _tenant }: { tenant: KyTenant }) {
  const [selected, setSelected] = useState<Set<ModuleKey>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleModule = useCallback((key: ModuleKey) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectPack = useCallback((modules: ModuleKey[]) => {
    setSelected(new Set(modules));
  }, []);

  const selectedModules = MODULES.filter(m => selected.has(m.key));
  const totalBeforeDiscount = selectedModules.reduce((sum, m) => sum + m.price, 0);

  // 割引ラダー＋¥●,800丸めは billingConfig の共有関数（実請求は ky-checkout が同じ式で解決＝WEB13）
  const discountRate = ladderRate(selected.size);
  const isAllIn = selected.size === 8;
  const total = computeMonthlyTotal(selected.size, totalBeforeDiscount);

  const handleCheckout = useCallback(async (priceIds: string[]) => {
    const missing = priceIds.filter(p => !p);
    if (missing.length > 0) {
      setError('Stripe Price ID が未設定のモジュールがあります。管理者に連絡してください。');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('ログインセッションが切れています。再ログインしてください。');
        return;
      }

      const baseUrl = window.location.origin + window.location.pathname;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ky-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({
            priceIds,
            successUrl: `${baseUrl}#/admin/billing?result=success`,
            cancelUrl: `${baseUrl}#/admin/billing?result=cancel`,
          }),
        },
      );

      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? '決済セッションの作成に失敗しました。');
        return;
      }

      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubscribe = useCallback(() => {
    const priceIds = selectedModules.map(m => m.stripePriceId);
    void handleCheckout(priceIds);
  }, [selectedModules, handleCheckout]);

  return (
    <div>
      <h2 className="admin-page-title">料金プラン・ご契約</h2>

      <div className="admin-card" style={{ marginBottom: 20 }}>
        <h3 className="admin-section-title">現在のプラン</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          現在は<strong>初月無料トライアル</strong>期間中です。全機能をご利用いただけます。
        </p>
      </div>

      <div className="admin-card" style={{ marginBottom: 20 }}>
        <h3 className="admin-section-title">パックで選ぶ</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
          よく使われる組み合わせをワンクリックで選択できます。
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {PACKS.map(pack => (
            <button
              key={pack.key}
              type="button"
              className="admin-btn"
              onClick={() => selectPack(pack.modules)}
              style={{ minWidth: 160 }}
            >
              {pack.emoji} {pack.name}（{formatPrice(pack.price)}/月）
            </button>
          ))}
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 20 }}>
        <h3 className="admin-section-title">モジュールを選ぶ（税別）</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
          必要な機能だけ選んで契約。2モジュール以上で自動割引。
        </p>
        <table className="admin-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>モジュール</th>
              <th>概要</th>
              <th style={{ textAlign: 'right' }}>月額</th>
            </tr>
          </thead>
          <tbody>
            {MODULES.map(m => (
              <tr key={m.key}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(m.key)}
                    onChange={() => toggleModule(m.key)}
                  />
                </td>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.desc}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatPrice(m.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {selected.size > 0 && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 14 }}>
                {selected.size}モジュール選択
                {discountRate > 0 && !isAllIn && (
                  <span style={{ color: 'var(--primary)', fontWeight: 600, marginLeft: 8 }}>
                    {Math.round(discountRate * 100)}%OFF
                  </span>
                )}
                {isAllIn && (
                  <span style={{ color: 'var(--primary)', fontWeight: 600, marginLeft: 8 }}>
                    オールイン 41%OFF
                  </span>
                )}
              </span>
              {discountRate > 0 && (
                <span style={{ marginLeft: 12, fontSize: 13, textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                  {formatPrice(totalBeforeDiscount)}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
                {formatPrice(total)}<span style={{ fontSize: 13, fontWeight: 400 }}>/月（税別）</span>
              </span>
              <button
                type="button"
                className="admin-btn primary"
                disabled={loading}
                onClick={handleSubscribe}
              >
                {loading ? '処理中…' : '契約する'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="admin-card" style={{ marginBottom: 20 }}>
        <h3 className="admin-section-title">追加パック（都度購入）</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
          準備中です。もうしばらくお待ちください。
        </p>
        {/* 購入導線は消費配線（ky_addon_grants→クォータ反映）完成まで無効化。
            有効化時は onClick={() => void handleCheckout([addon.stripePriceId])} を戻す */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {ADDONS.map(addon => (
            <button
              key={addon.key}
              type="button"
              className="admin-btn"
              disabled
            >
              {addon.name}（{formatPrice(addon.price)}）準備中
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#b91c1c', fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
        <p>※ 表示価格はすべて税別です。決済時に消費税が加算されます。</p>
        <p>※ 初月無料トライアル期間中は課金されません。トライアル終了後に自動で課金されることはなく、ご契約手続きをいただいた場合のみ課金が始まります。</p>
        <p>※ いつでもキャンセル・プラン変更が可能です。</p>
      </div>
    </div>
  );
}
