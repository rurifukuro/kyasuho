import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { KyCast, KyMenuItemPublic, KyReservation, KySeatType, KyShift, MakeReservationResult, KyPreorderItem } from '../lib/types';
import { slotToMinutes, minutesToSlot, countAvailableSeats } from '../lib/timeUtils';

const TIME_STEP = 10;

const PREORDER_CATEGORIES: { key: string; label: string }[] = [
  { key: 'nomination', label: '指名' },
  { key: 'cast_drink', label: 'キャストドリンク♥' },
  { key: 'drink', label: 'ドリンク' },
  { key: 'food', label: 'フード' },
  { key: 'cheki', label: 'チェキ' },
  { key: 'other', label: 'その他' },
];
const PREORDER_CATEGORY_KEYS = new Set(PREORDER_CATEGORIES.map((c) => c.key));

interface ReservationModalProps {
  tenantId: string;
  date: string;
  initialSlotMinutes: number;
  windowStartMin: number;
  windowEndMin: number;
  setMinutes: number;
  casts: KyCast[];
  shifts: KyShift[];
  seatTypes: KySeatType[];
  reservations: KyReservation[];
  totalSeats: number;
  onClose: () => void;
  onReserved: () => void;
}

export function ReservationModal({
  tenantId, date, initialSlotMinutes, windowStartMin, windowEndMin, setMinutes,
  casts, shifts, seatTypes, reservations, totalSeats, onClose, onReserved,
}: ReservationModalProps) {
  const startOptions = useMemo(() => {
    const opts: number[] = [];
    for (let t = windowStartMin; t + setMinutes <= windowEndMin; t += TIME_STEP) {
      opts.push(t);
    }
    return opts.length > 0 ? opts : [initialSlotMinutes];
  }, [windowStartMin, windowEndMin, setMinutes, initialSlotMinutes]);

  const [startTime, setStartTime] = useState(initialSlotMinutes);

  useEffect(() => {
    if (!startOptions.includes(startTime)) {
      const below = startOptions.filter((t) => t <= initialSlotMinutes);
      setStartTime(below.length > 0 ? below[below.length - 1]! : startOptions[0]!);
    }
  }, [startOptions, startTime, initialSlotMinutes]);

  const maxSets = Math.max(1, Math.floor((windowEndMin - startTime) / setMinutes));
  const [sets, setSets] = useState(1);
  const effectiveSets = Math.min(sets, maxSets);
  const endTime = startTime + effectiveSets * setMinutes;

  const available = countAvailableSeats(startTime, endTime, reservations, totalSeats);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [castId, setCastId] = useState('');
  const [seatTypeId, setSeatTypeId] = useState('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; seatNo: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<KyMenuItemPublic[]>([]);
  const [menuUndecided, setMenuUndecided] = useState(true);
  const [orderQty, setOrderQty] = useState<Record<string, number>>({});
  const [orderCastId, setOrderCastId] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from('ky_menu_items')
      // anon は列レベルGRANT（0045）＝select('*')不可。公開列を明示する。
      .select('id, tenant_id, category, name, price, needs_cast, sort_order, is_active, nomination_kind')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setMenuItems(data as KyMenuItemPublic[]);
      });
  }, [tenantId]);

  const preorderItems = useMemo(
    () => menuItems.filter((m) => PREORDER_CATEGORY_KEYS.has(m.category)),
    [menuItems],
  );

  const groupedMenu = useMemo(() => {
    const map = new Map<string, KyMenuItemPublic[]>();
    for (const item of preorderItems) {
      let list = map.get(item.category);
      if (!list) { list = []; map.set(item.category, list); }
      list.push(item);
    }
    return PREORDER_CATEGORIES.filter((c) => map.has(c.key)).map((c) => ({
      ...c,
      items: map.get(c.key)!,
    }));
  }, [preorderItems]);

  const availableCasts = casts.filter(
    (c) => c.accepts_nomination && shifts.some((s) => {
      if (s.cast_id !== c.id) return false;
      const sStart = slotToMinutes(s.start_at);
      const sEnd = slotToMinutes(s.end_at);
      return startTime >= sStart && endTime <= sEnd;
    }),
  ).sort((a, b) => (a.name_kana || '').localeCompare(b.name_kana || '', 'ja'));

  const selectedSeatType = seatTypes.find((st) => st.id === seatTypeId);
  const seatFee = selectedSeatType?.seat_fee ?? 0;

  const preorderTotal = useMemo(() => {
    let total = 0;
    for (const item of preorderItems) {
      const qty = orderQty[item.id] ?? 0;
      if (qty > 0) total += item.price * qty;
    }
    return total;
  }, [preorderItems, orderQty]);

  const estimateSubtotal = seatFee * effectiveSets + preorderTotal;
  const hasPreorder = !menuUndecided && Object.values(orderQty).some((q) => q > 0);

  function buildPreorderSnapshot(): KyPreorderItem[] | null {
    if (menuUndecided) return null;
    const items: KyPreorderItem[] = [];
    for (const m of preorderItems) {
      const qty = orderQty[m.id] ?? 0;
      if (qty <= 0) continue;
      items.push({
        menu_item_id: m.id,
        category: m.category,
        name: m.name,
        price: m.price,
        qty,
        cast_id: m.needs_cast ? (orderCastId[m.id] || null) : null,
      });
    }
    return items.length > 0 ? items : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('お名前を入力してください'); return; }
    setSubmitting(true);
    setError(null);

    const slot = minutesToSlot(startTime);
    const preorder = buildPreorderSnapshot();
    const { data, error: rpcError } = await supabase.rpc('ky_make_reservation', {
      p_tenant_id: tenantId,
      p_date: date,
      p_slot: slot,
      p_customer_name: name.trim(),
      p_contact: contact.trim(),
      p_party_size: partySize,
      p_cast_id: castId || null,
      p_note: note.trim(),
      p_pin: pin.length === 4 ? pin : null,
      p_seat_type_id: seatTypeId || null,
      p_preorder: preorder,
      p_menu_undecided: menuUndecided,
    });

    setSubmitting(false);
    const res = data as MakeReservationResult | null;

    if (rpcError) {
      setError('予約に失敗しました。時間をおいて再度お試しください。');
      return;
    }
    if (res?.error === 'no_available_seat') {
      setError('この時間は満席です。別の時間をお試しください。');
      return;
    }
    if (res?.error === 'not_unlocked') {
      setError('この時間は受付していません。');
      return;
    }
    if (res?.error === 'duplicate_contact') {
      setError('同じ連絡先でこの時間帯に既に予約があります。');
      return;
    }
    if (res?.error === 'cast_not_available') {
      setError('指名キャストはこの時間に出勤していません。別のキャストまたは時間をお選びください。');
      return;
    }
    if (res?.id && res.seat_no != null) {
      setResult({ id: res.id, seatNo: res.seat_no });
    }
  }

  if (result) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h2>予約が完了しました</h2>
          <div className="confirm-box">
            <p><strong>{date.replace(/-/g, '/')}</strong> {minutesToSlot(startTime)}〜{minutesToSlot(endTime)}</p>
            <p>席番号: {result.seatNo}</p>
            {hasPreorder && (
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>ご注文予定はスタッフに共有されます。</p>
            )}
            {pin.length === 4 && (
              <div className="pin-display">
                <p>暗証番号（予約変更・キャンセル用）</p>
                <span className="pin-code">{pin}</span>
                <p className="pin-notice">この番号は予約の確認・変更に必要です。メモしてください。</p>
              </div>
            )}
          </div>
          <button className="btn-primary" onClick={() => { onReserved(); onClose(); }}>
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>予約</h2>
        <p className="modal-date">{date.replace(/-/g, '/')}</p>

        <form onSubmit={handleSubmit}>
          <label>
            開始時刻
            <select
              value={startTime}
              onChange={(e) => { setStartTime(Number(e.target.value)); setSets(1); }}
            >
              {startOptions.map((t) => (
                <option key={t} value={t}>{minutesToSlot(t)}</option>
              ))}
            </select>
          </label>

          <label>
            セット数（1セット = {setMinutes}分）
            <select
              value={effectiveSets}
              onChange={(e) => setSets(Number(e.target.value))}
            >
              {Array.from({ length: maxSets }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}セット（{minutesToSlot(startTime)}〜{minutesToSlot(startTime + n * setMinutes)}）
                </option>
              ))}
            </select>
          </label>

          {available <= 0 && (
            <p className="error-msg">この時間帯は空席がありません。</p>
          )}

          <label>
            お名前 <span className="required">*</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="予約者名" />
          </label>

          <label>
            連絡先
            <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="電話番号・LINE等" />
          </label>

          <label>
            人数
            <select value={partySize} onChange={(e) => setPartySize(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}名</option>
              ))}
            </select>
          </label>

          {availableCasts.length > 0 && (
            <label>
              指名キャスト
              <select value={castId} onChange={(e) => setCastId(e.target.value)}>
                <option value="">指名なし</option>
                {availableCasts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}

          {seatTypes.length > 0 && (
            <label>
              席種
              <select value={seatTypeId} onChange={(e) => setSeatTypeId(e.target.value)}>
                <option value="">指定なし</option>
                {seatTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.seat_fee > 0 ? `${st.name}（¥${st.seat_fee.toLocaleString()}）` : st.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {preorderItems.length > 0 && (
            <>
              <div style={{ margin: '12px 0 4px', borderTop: '1px solid var(--border, #e5e7eb)', paddingTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={menuUndecided}
                    onChange={(e) => setMenuUndecided(e.target.checked)}
                  />
                  当日にメニューを決める
                </label>
              </div>

              {!menuUndecided && (
                <div style={{ margin: '8px 0', padding: '8px 0' }}>
                  <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                    事前にご注文を選べます。当日変更も可能です。
                  </p>
                  {groupedMenu.map((group) => (
                    <div key={group.key} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary, #e91e63)', marginBottom: 4 }}>
                        {group.label}
                      </div>
                      {group.items.map((item) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', flexWrap: 'wrap' }}>
                          <span style={{ flex: 1, fontSize: 14, minWidth: 100 }}>
                            {item.name}
                            <span style={{ marginLeft: 6, fontSize: 12, color: '#6b7280' }}>
                              ¥{item.price.toLocaleString()}
                            </span>
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ width: 28, height: 28, padding: 0, fontSize: 16, lineHeight: '28px' }}
                              onClick={() => setOrderQty((prev) => ({
                                ...prev,
                                [item.id]: Math.max(0, (prev[item.id] ?? 0) - 1),
                              }))}
                              disabled={(orderQty[item.id] ?? 0) <= 0}
                            >
                              −
                            </button>
                            <span style={{ width: 24, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
                              {orderQty[item.id] ?? 0}
                            </span>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ width: 28, height: 28, padding: 0, fontSize: 16, lineHeight: '28px' }}
                              onClick={() => setOrderQty((prev) => ({
                                ...prev,
                                [item.id]: (prev[item.id] ?? 0) + 1,
                              }))}
                            >
                              ＋
                            </button>
                          </div>
                          {item.needs_cast && (orderQty[item.id] ?? 0) > 0 && availableCasts.length > 0 && (
                            <select
                              style={{ fontSize: 12, padding: '2px 4px', width: '100%', maxWidth: 160, marginTop: 2 }}
                              value={orderCastId[item.id] ?? ''}
                              onChange={(e) => setOrderCastId((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            >
                              <option value="">キャスト未選択</option>
                              {availableCasts.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {(hasPreorder || seatFee > 0) && (
                <div style={{
                  margin: '8px 0 12px',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--border, #e5e7eb)',
                  background: 'var(--bg-secondary, #f9fafb)',
                  fontSize: 13,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>会計目安</div>
                  {seatFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>席料（{selectedSeatType?.name} × {effectiveSets}セット）</span>
                      <span>¥{(seatFee * effectiveSets).toLocaleString()}</span>
                    </div>
                  )}
                  {hasPreorder && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>ご注文予定</span>
                      <span>¥{preorderTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border, #e5e7eb)', fontWeight: 700 }}>
                    <span>小計</span>
                    <span>¥{estimateSubtotal.toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, lineHeight: 1.4 }}>
                    ※目安です。当日のご会計と異なる場合があります。
                  </p>
                </div>
              )}
            </>
          )}

          <label>
            ご要望・備考
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="備考・要望など" rows={2} />
          </label>

          <label>
            暗証番号（4桁・任意）
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="予約変更・キャンセルに使用"
            />
          </label>

          {error && <p className="error-msg">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>キャンセル</button>
            <button type="submit" className="btn-primary" disabled={submitting || !name.trim() || available <= 0}>
              {submitting ? '送信中…' : '予約する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
