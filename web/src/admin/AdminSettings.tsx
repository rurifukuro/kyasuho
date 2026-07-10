import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyTenant } from '../lib/types';
import { updateTenantFlags, updateTenantProfile } from './adminApi';
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
        business_info: { address: address.trim(), openHours: openHours.trim(), tel: tel.trim(), note: note.trim(), postalCode: postalCode.trim() || undefined },
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
