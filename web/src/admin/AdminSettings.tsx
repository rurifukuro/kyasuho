import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyTenant } from '../lib/types';
import {
  fetchReminderSettings,
  updateTenantFlags,
  updateTenantProfile,
  upsertReminderSettings,
  fetchPointSettings,
  upsertPointSettings,
  fetchPointRewards,
  upsertPointReward,
  deletePointReward,
} from './adminApi';
import type { KyPointReward } from '../lib/types';
import { lookupPostalCode } from '../lib/postalLookup';
import { resolveArea } from '../lib/areaDict';

const PREFECTURES = [
  '', '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

const SNS_PLATFORMS = ['X (Twitter)', 'Instagram', 'TikTok', 'LINE', 'YouTube'];

export function AdminSettings({
  tenant,
  onTenantUpdate,
}: {
  tenant: KyTenant;
  onTenantUpdate: (patch: Partial<KyTenant>) => void;
}) {
  const [busy, setBusy] = useState(false);

  // 店舗プロフィール
  const [storeName, setStoreName] = useState(tenant.name);
  const [genre, setGenre] = useState(tenant.genre);
  const [address, setAddress] = useState(tenant.business_info?.address ?? '');
  const [openHours, setOpenHours] = useState(tenant.business_info?.openHours ?? '');
  const [tel, setTel] = useState(tenant.business_info?.tel ?? '');
  const [note, setNote] = useState(tenant.business_info?.note ?? '');
  const [prefecture, setPrefecture] = useState(tenant.prefecture ?? '');
  const [area, setArea] = useState(tenant.area ?? '');
  const [rankingOptIn, setRankingOptIn] = useState(tenant.ranking_opt_in ?? false);

  const [postalCode, setPostalCode] = useState(tenant.business_info?.postalCode ?? '');
  const [postalBusy, setPostalBusy] = useState(false);
  const [postalMsg, setPostalMsg] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // SNSリンク
  const [snsLinks, setSnsLinks] = useState<{ platform: string; url: string }[]>(
    tenant.sns_links?.length ? tenant.sns_links : [{ platform: 'X (Twitter)', url: '' }],
  );
  const [snsBusy, setSnsBusy] = useState(false);
  const [snsMsg, setSnsMsg] = useState<string | null>(null);

  const toggle = async (flag: 'enable_bottle_keep' | 'enable_vouchers') => {
    const newVal = !tenant[flag];
    setBusy(true);
    try {
      await updateTenantFlags(tenant.id, { [flag]: newVal });
      onTenantUpdate({ [flag]: newVal });
    } catch {
      window.alert('設定の更新に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handlePostalSearch = useCallback(async () => {
    setPostalBusy(true);
    setPostalMsg(null);
    try {
      const result = await lookupPostalCode(postalCode);
      if (!result) {
        setPostalMsg('見つかりませんでした。手入力してください。');
        return;
      }
      setPrefecture(result.prefecture);
      setAddress(result.city + result.town);
      setArea(resolveArea(result.city, result.town));
      setPostalMsg(null);
    } catch {
      setPostalMsg('検索に失敗しました。手入力してください。');
    } finally {
      setPostalBusy(false);
    }
  }, [postalCode]);

  const handleProfileSave = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setProfileBusy(true);
    setProfileMsg(null);
    try {
      const fields = {
        name: storeName.trim(),
        genre: genre.trim(),
        business_info: {
          address: address.trim(),
          openHours: openHours.trim(),
          tel: tel.trim(),
          note: note.trim(),
          postalCode: postalCode.trim() || undefined,
          ...(tenant.business_info?.theme ? { theme: tenant.business_info.theme } : {}),
        },
        prefecture,
        area: area.trim(),
        ranking_opt_in: rankingOptIn,
      };
      await updateTenantProfile(tenant.id, fields);
      onTenantUpdate(fields);
      setProfileMsg('保存しました。');
      window.setTimeout(() => setProfileMsg(null), 3000);
    } catch (err) {
      console.warn('[kyasuho] updateTenantProfile failed:', err);
      setProfileMsg('保存に失敗しました。');
    } finally {
      setProfileBusy(false);
    }
  }, [tenant.id, storeName, genre, address, openHours, tel, note, postalCode, prefecture, area, rankingOptIn, onTenantUpdate]);

  const handleSnsSave = useCallback(async () => {
    setSnsBusy(true);
    setSnsMsg(null);
    try {
      const filtered = snsLinks.filter((l) => l.url.trim());
      await updateTenantProfile(tenant.id, { sns_links: filtered });
      onTenantUpdate({ sns_links: filtered });
      setSnsMsg('保存しました。');
      window.setTimeout(() => setSnsMsg(null), 3000);
    } catch (err) {
      console.warn('[kyasuho] updateSnsLinks failed:', err);
      setSnsMsg('保存に失敗しました。');
    } finally {
      setSnsBusy(false);
    }
  }, [tenant.id, snsLinks, onTenantUpdate]);

  const updateSnsLink = (idx: number, field: 'platform' | 'url', value: string) => {
    setSnsLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const addSnsLink = () => {
    setSnsLinks((prev) => [...prev, { platform: 'X (Twitter)', url: '' }]);
  };

  const removeSnsLink = (idx: number) => {
    setSnsLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <h2 className="admin-page-title">設定</h2>

      {/* 店舗プロフィール */}
      <h3 className="admin-section-title">店舗プロフィール</h3>
      <form className="admin-card" onSubmit={handleProfileSave}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="admin-field">
            <label htmlFor="prof-name">店名</label>
            <input id="prof-name" type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} required />
          </div>
          <div className="admin-field">
            <label htmlFor="prof-genre">ジャンル</label>
            <input id="prof-genre" type="text" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="例：コンカフェ、メイドカフェ" />
          </div>
          <div className="admin-field">
            <label htmlFor="prof-postal">郵便番号</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input id="prof-postal" type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="123-4567" style={{ width: 140 }} />
              <button type="button" className="admin-btn" disabled={postalBusy} onClick={() => void handlePostalSearch()} style={{ whiteSpace: 'nowrap' }}>
                {postalBusy ? '検索中…' : '住所検索'}
              </button>
            </div>
            {postalMsg && <span style={{ fontSize: 12, color: '#dc2626', marginTop: 4, display: 'block' }}>{postalMsg}</span>}
          </div>
          <div className="admin-field" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="prof-address">住所</label>
            <input id="prof-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="住所検索で自動入力されます" />
          </div>
          <div className="admin-field">
            <label htmlFor="prof-hours">営業時間</label>
            <input id="prof-hours" type="text" value={openHours} onChange={(e) => setOpenHours(e.target.value)} placeholder="例：18:00〜24:00" />
          </div>
          <div className="admin-field">
            <label htmlFor="prof-tel">電話番号</label>
            <input id="prof-tel" type="text" value={tel} onChange={(e) => setTel(e.target.value)} />
          </div>
          <div className="admin-field">
            <label htmlFor="prof-pref">都道府県</label>
            <select id="prof-pref" value={prefecture} onChange={(e) => setPrefecture(e.target.value)}>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>{p || '（未設定）'}</option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="prof-area">エリア</label>
            <input id="prof-area" type="text" value={area} onChange={(e) => setArea(e.target.value)} placeholder="例：秋葉原、歌舞伎町" />
          </div>
          <div className="admin-field" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="prof-note">備考</label>
            <input id="prof-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={rankingOptIn} onChange={(e) => setRankingOptIn(e.target.checked)} style={{ width: 18, height: 18 }} />
          <span>
            <strong>ランキングに参加する</strong>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>
              ONにすると姉妹アプリの店舗ランキングに売上データ（順位のみ・金額は非公開）が掲載されます。
            </span>
          </span>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <button type="submit" className="admin-btn primary" disabled={profileBusy}>
            {profileBusy ? '保存中…' : 'プロフィールを保存'}
          </button>
          {profileMsg && <span style={{ fontSize: 13, color: profileMsg.includes('失敗') ? '#dc2626' : '#16a34a' }}>{profileMsg}</span>}
        </div>
      </form>

      {/* SNSリンク */}
      <h3 className="admin-section-title" style={{ marginTop: 24 }}>SNSリンク</h3>
      <div className="admin-card">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          シフト表SNS投稿で使用します。URLが空の行は保存時に除外されます。
        </p>
        {snsLinks.map((link, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select value={link.platform} onChange={(e) => updateSnsLink(idx, 'platform', e.target.value)} style={{ width: 150 }}>
              {SNS_PLATFORMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input
              type="url"
              value={link.url}
              onChange={(e) => updateSnsLink(idx, 'url', e.target.value)}
              placeholder="https://..."
              style={{ flex: 1 }}
            />
            <button type="button" className="admin-btn danger" onClick={() => removeSnsLink(idx)}>×</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="admin-btn" onClick={addSnsLink}>＋ SNSを追加</button>
          <button type="button" className="admin-btn primary" disabled={snsBusy} onClick={() => void handleSnsSave()}>
            {snsBusy ? '保存中…' : 'SNSリンクを保存'}
          </button>
          {snsMsg && <span style={{ fontSize: 13, color: snsMsg.includes('失敗') ? '#dc2626' : '#16a34a' }}>{snsMsg}</span>}
        </div>
      </div>

      {/* 客ページデザイン（§34-3） */}
      <ThemeDesignSection tenant={tenant} onTenantUpdate={onTenantUpdate} />

      {/* シフト提出リマインダー */}
      <ShiftReminderSection tenantId={tenant.id} />

      {/* ポイント・景品設定（§41） */}
      <PointSettingsSection tenantId={tenant.id} />

      {/* オプション機能 */}
      <h3 className="admin-section-title" style={{ marginTop: 24 }}>オプション機能</h3>
      <div className="admin-card">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          ONにすると左メニューに管理画面が追加されます。
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={tenant.enable_bottle_keep}
              disabled={busy}
              onChange={() => void toggle('enable_bottle_keep')}
              style={{ width: 18, height: 18 }}
            />
            <span>
              <strong>ボトルキープ管理</strong>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>
                お客様のボトルキープを預かり日・期限・残量で管理できます。
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={tenant.enable_vouchers}
              disabled={busy}
              onChange={() => void toggle('enable_vouchers')}
              style={{ width: 18, height: 18 }}
            />
            <span>
              <strong>回数券・クーポン券管理</strong>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>
                回数券やクーポン券の発行・使用回数の管理ができます。
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_PRIMARY = '#e55381';
const DEFAULT_ACCENT = '#c03868';
const DEFAULT_CARD_OPACITY = 0.85;

function ThemeDesignSection({
  tenant,
  onTenantUpdate,
}: {
  tenant: KyTenant;
  onTenantUpdate: (patch: Partial<KyTenant>) => void;
}) {
  const theme = tenant.business_info?.theme;
  const [primary, setPrimary] = useState(theme?.primaryColor ?? DEFAULT_PRIMARY);
  const [accent, setAccent] = useState(theme?.accentColor ?? DEFAULT_ACCENT);
  const [cardOpacity, setCardOpacity] = useState(theme?.cardOpacity ?? DEFAULT_CARD_OPACITY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isDefault =
    primary === DEFAULT_PRIMARY &&
    accent === DEFAULT_ACCENT &&
    cardOpacity === DEFAULT_CARD_OPACITY;

  const handleReset = () => {
    setPrimary(DEFAULT_PRIMARY);
    setAccent(DEFAULT_ACCENT);
    setCardOpacity(DEFAULT_CARD_OPACITY);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMsg(null);
    try {
      const bi = tenant.business_info ?? {};
      const newTheme = isDefault
        ? undefined
        : { primaryColor: primary, accentColor: accent, cardOpacity };
      const newBi = { ...bi, theme: newTheme };
      await updateTenantProfile(tenant.id, { business_info: newBi });
      onTenantUpdate({ business_info: newBi });
      setMsg('保存しました。');
      window.setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      console.warn('[kyasuho] theme save failed:', err);
      setMsg('保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }, [tenant.id, tenant.business_info, primary, accent, cardOpacity, isDefault, onTenantUpdate]);

  return (
    <>
      <h3 className="admin-section-title" style={{ marginTop: 24 }}>客ページデザイン</h3>
      <div className="admin-card">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          お客様向け予約ページのカラーを設定できます。未設定の場合は既定のピンクが適用されます。
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="admin-field">
            <label htmlFor="theme-primary">メインカラー</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="theme-primary"
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                style={{ width: 48, height: 36, padding: 2, cursor: 'pointer' }}
              />
              <input
                type="text"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                style={{ width: 90, fontFamily: 'monospace', fontSize: 13 }}
              />
            </div>
          </div>

          <div className="admin-field">
            <label htmlFor="theme-accent">アクセントカラー</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="theme-accent"
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                style={{ width: 48, height: 36, padding: 2, cursor: 'pointer' }}
              />
              <input
                type="text"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                style={{ width: 90, fontFamily: 'monospace', fontSize: 13 }}
              />
            </div>
          </div>

          <div className="admin-field" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="theme-opacity">カード透過度: {Math.round(cardOpacity * 100)}%</label>
            <input
              id="theme-opacity"
              type="range"
              min={0.5}
              max={1}
              step={0.05}
              value={cardOpacity}
              onChange={(e) => setCardOpacity(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              背景画像使用時のカード背景の透明度です（低い＝透ける）
            </span>
          </div>

          {/* ライブプレビュー */}
          <div
            style={{
              gridColumn: 'span 2',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 16,
              background: '#faf8f5',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>プレビュー</div>
            <div
              style={{
                borderRadius: 10,
                padding: 16,
                background: `rgba(255,255,255,${cardOpacity})`,
                border: `1px solid ${primary}22`,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: primary, marginBottom: 4 }}>
                {tenant.name || 'お店の名前'}
              </div>
              <div style={{ fontSize: 12, color: '#6b6b6b', marginBottom: 8 }}>
                {tenant.genre || 'コンカフェ'}
              </div>
              <div
                style={{
                  display: 'inline-block',
                  padding: '6px 20px',
                  borderRadius: 6,
                  background: primary,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                予約する
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: accent,
                  fontWeight: 600,
                }}
              >
                リンク色のプレビュー
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button
            type="button"
            className="admin-btn primary"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? '保存中…' : 'デザインを保存'}
          </button>
          <button
            type="button"
            className="admin-btn"
            disabled={isDefault}
            onClick={handleReset}
          >
            既定に戻す
          </button>
          {msg && (
            <span style={{ fontSize: 13, color: msg.includes('失敗') ? '#dc2626' : '#16a34a' }}>
              {msg}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function calcNextDeadline(deadlineDay: number): { label: string; remindDate: (daysBefore: number) => string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const thisMonth = new Date(y, m, deadlineDay);
  const deadline = now <= thisMonth ? thisMonth : new Date(m === 11 ? y + 1 : y, (m + 1) % 12, deadlineDay);
  const target = new Date(deadline.getFullYear(), deadline.getMonth() + 1, 1);
  const label = `${deadline.getMonth() + 1}/${deadline.getDate()}（${target.getFullYear()}年${target.getMonth() + 1}月分）`;
  return {
    label,
    remindDate: (daysBefore: number) => {
      const d = new Date(deadline);
      d.setDate(d.getDate() - daysBefore);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    },
  };
}

function ShiftReminderSection({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [deadlineDay, setDeadlineDay] = useState(20);
  const [remindDaysBefore, setRemindDaysBefore] = useState(3);
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [remindHour, setRemindHour] = useState(12);

  useEffect(() => {
    setLoading(true);
    fetchReminderSettings(tenantId)
      .then((s) => {
        if (s) {
          setEnabled(s.enabled);
          setDeadlineDay(s.deadline_day);
          setRemindDaysBefore(s.remind_days_before);
          setRepeatDaily(s.repeat_daily);
          setRemindHour(s.remind_hour);
        }
      })
      .catch((e) => console.warn('[kyasuho] fetchReminderSettings:', e))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMsg(null);
    try {
      await upsertReminderSettings(tenantId, {
        enabled,
        deadline_day: deadlineDay,
        remind_days_before: remindDaysBefore,
        repeat_daily: repeatDaily,
        remind_hour: remindHour,
      });
      setMsg('保存しました。');
      window.setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      console.warn('[kyasuho] upsertReminderSettings:', e);
      setMsg('保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }, [tenantId, enabled, deadlineDay, remindDaysBefore, repeatDaily, remindHour]);

  const { label: deadlineLabel, remindDate } = calcNextDeadline(deadlineDay);
  const remindDateLabel = remindDate(remindDaysBefore);

  return (
    <>
      <h3 className="admin-section-title" style={{ marginTop: 24 }}>シフト提出リマインダー</h3>
      <div className="admin-card">
        {loading ? (
          <div className="admin-empty">読み込み中…</div>
        ) : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <span>
                <strong>リマインダー通知を有効にする</strong>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>
                  提出期限前に未提出のキャストへ自動でプッシュ通知が届きます。
                </span>
              </span>
            </label>

            {enabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="admin-field">
                  <label htmlFor="rem-deadline">提出期限（毎月）</label>
                  <select
                    id="rem-deadline"
                    value={deadlineDay}
                    onChange={(e) => setDeadlineDay(Number(e.target.value))}
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>毎月 {d}日</option>
                    ))}
                  </select>
                </div>
                <div className="admin-field">
                  <label htmlFor="rem-before">通知タイミング</label>
                  <select
                    id="rem-before"
                    value={remindDaysBefore}
                    onChange={(e) => setRemindDaysBefore(Number(e.target.value))}
                  >
                    <option value={0}>期限当日</option>
                    {Array.from({ length: 27 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>期限の {d}日前</option>
                    ))}
                  </select>
                </div>
                <div className="admin-field">
                  <label htmlFor="rem-hour">通知時刻</label>
                  <select
                    id="rem-hour"
                    value={remindHour}
                    onChange={(e) => setRemindHour(Number(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                      <option key={h} value={h}>{h}:00</option>
                    ))}
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={repeatDaily}
                    onChange={(e) => setRepeatDaily(e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  <span>
                    <strong>毎日再通知</strong>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>
                      初回通知日から期限日まで毎日通知
                    </span>
                  </span>
                </label>

                <div className="admin-card" style={{ gridColumn: 'span 2', background: 'var(--bg-secondary, #f9fafb)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>次回の通知予定</div>
                  <div style={{ fontSize: 14 }}>
                    次回の期限: <strong>{deadlineLabel}</strong>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--color-primary, #6366f1)' }}>
                    通知予定: <strong>
                      {remindDateLabel}
                      {repeatDaily ? ` 〜 ${deadlineDay}日` : ''}
                      {` ${remindHour}:00`}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <button
                type="button"
                className="admin-btn primary"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? '保存中…' : 'リマインダー設定を保存'}
              </button>
              {msg && (
                <span style={{ fontSize: 13, color: msg.includes('失敗') ? '#dc2626' : '#16a34a' }}>
                  {msg}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function PointSettingsSection({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [yenPerPoint, setYenPerPoint] = useState(500);

  const [rewards, setRewards] = useState<KyPointReward[]>([]);
  const [editReward, setEditReward] = useState<Partial<KyPointReward> | null>(null);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardMsg, setRewardMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchPointSettings(tenantId),
      fetchPointRewards(tenantId),
    ])
      .then(([s, r]) => {
        if (s) {
          setEnabled(s.enabled);
          setYenPerPoint(s.yen_per_point);
        }
        setRewards(r);
      })
      .catch((e) => console.warn('[kyasuho] fetchPointSettings:', e))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleSave = useCallback(async () => {
    if (yenPerPoint < 1) {
      setMsg('単価は1以上を指定してください。');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await upsertPointSettings(tenantId, {
        enabled,
        yen_per_point: yenPerPoint,
      });
      setMsg('保存しました。');
      window.setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      console.warn('[kyasuho] upsertPointSettings:', e);
      setMsg('保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }, [tenantId, enabled, yenPerPoint]);

  const handleRewardSave = useCallback(async () => {
    if (!editReward) return;
    const name = (editReward.name ?? '').trim();
    const pts = editReward.points_required ?? 0;
    if (!name || pts < 1) {
      setRewardMsg('景品名と必要ポイント(1以上)は必須です。');
      return;
    }
    setRewardBusy(true);
    setRewardMsg(null);
    try {
      await upsertPointReward(tenantId, {
        ...editReward,
        name,
        points_required: pts,
      });
      const fresh = await fetchPointRewards(tenantId);
      setRewards(fresh);
      setEditReward(null);
    } catch (e) {
      console.warn('[kyasuho] upsertPointReward:', e);
      setRewardMsg('保存に失敗しました。');
    } finally {
      setRewardBusy(false);
    }
  }, [tenantId, editReward]);

  const handleRewardDelete = useCallback(async (id: string) => {
    if (!window.confirm('この景品を削除しますか？')) return;
    try {
      await deletePointReward(id);
      setRewards((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.warn('[kyasuho] deletePointReward:', e);
      window.alert('削除に失敗しました。');
    }
  }, []);

  return (
    <>
      <h3 className="admin-section-title" style={{ marginTop: 24 }}>ポイント・景品設定</h3>
      <div className="admin-card">
        {loading ? (
          <div className="admin-empty">読み込み中…</div>
        ) : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <span>
                <strong>ポイント制度を有効にする</strong>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>
                  来店金額に応じてポイントを付与し、景品と交換できます。
                </span>
              </span>
            </label>

            {enabled && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="admin-field">
                    <label htmlFor="pt-yen">ポイント単価（円/1pt）</label>
                    <input
                      id="pt-yen"
                      type="number"
                      min={1}
                      value={yenPerPoint}
                      onChange={(e) => setYenPerPoint(Number(e.target.value))}
                      style={{ width: 120 }}
                    />
                  </div>
                  <div className="admin-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', paddingBottom: 8 }}>
                      例: ¥{(yenPerPoint * 10).toLocaleString()} の会計 → 10pt
                    </span>
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <button
                type="button"
                className="admin-btn primary"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? '保存中…' : 'ポイント設定を保存'}
              </button>
              {msg && (
                <span style={{ fontSize: 13, color: msg.includes('失敗') ? '#dc2626' : '#16a34a' }}>
                  {msg}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {enabled && (
        <>
          <h3 className="admin-section-title" style={{ marginTop: 24 }}>景品カタログ</h3>
          <div className="admin-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>景品名</th>
                    <th>必要ポイント</th>
                    <th>説明</th>
                    <th>有効</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                        景品が登録されていません
                      </td>
                    </tr>
                  )}
                  {rewards.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>{r.points_required}pt</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.description || '—'}
                      </td>
                      <td>{r.is_active ? '有効' : '無効'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="admin-btn" onClick={() => setEditReward({ ...r })}>編集</button>
                          <button className="admin-btn danger" onClick={() => void handleRewardDelete(r.id)}>削除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              className="admin-btn"
              style={{ marginTop: 12 }}
              onClick={() => setEditReward({ name: '', points_required: 10, description: '', is_active: true, sort_order: rewards.length })}
            >
              ＋ 景品を追加
            </button>

            {editReward && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  background: 'var(--bg-secondary, #f9fafb)',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                  {editReward.id ? '景品を編集' : '景品を追加'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="admin-field">
                    <label>景品名</label>
                    <input
                      type="text"
                      value={editReward.name ?? ''}
                      onChange={(e) => setEditReward((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                      required
                    />
                  </div>
                  <div className="admin-field">
                    <label>必要ポイント</label>
                    <input
                      type="number"
                      min={1}
                      value={editReward.points_required ?? 10}
                      onChange={(e) => setEditReward((prev) => prev ? { ...prev, points_required: Number(e.target.value) } : prev)}
                    />
                  </div>
                  <div className="admin-field" style={{ gridColumn: 'span 2' }}>
                    <label>説明（任意）</label>
                    <input
                      type="text"
                      value={editReward.description ?? ''}
                      onChange={(e) => setEditReward((prev) => prev ? { ...prev, description: e.target.value } : prev)}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={editReward.is_active ?? true}
                      onChange={(e) => setEditReward((prev) => prev ? { ...prev, is_active: e.target.checked } : prev)}
                    />
                    有効
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="admin-btn primary" disabled={rewardBusy} onClick={() => void handleRewardSave()}>
                    {rewardBusy ? '保存中…' : '保存'}
                  </button>
                  <button className="admin-btn" onClick={() => { setEditReward(null); setRewardMsg(null); }}>キャンセル</button>
                  {rewardMsg && (
                    <span style={{ fontSize: 13, color: rewardMsg.includes('失敗') ? '#dc2626' : '#e67e22' }}>
                      {rewardMsg}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
