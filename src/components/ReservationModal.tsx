import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { KyCast, KySeatType, KyShift, MakeReservationResult } from '../lib/types';
import { slotToMinutes } from '../lib/timeUtils';

interface ReservationModalProps {
  tenantId: string;
  date: string;
  slot: string;
  setMinutes: number;
  casts: KyCast[];
  shifts: KyShift[];
  seatTypes: KySeatType[];
  onClose: () => void;
  onReserved: () => void;
}

export function ReservationModal({
  tenantId, date, slot, setMinutes, casts, shifts, seatTypes, onClose, onReserved,
}: ReservationModalProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [castId, setCastId] = useState<string>('');
  const [seatTypeId, setSeatTypeId] = useState<string>('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; seatNo: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slotMin = slotToMinutes(slot);
  const availableCasts = casts.filter(
    (c) => c.accepts_nomination && shifts.some((s) => {
      if (s.cast_id !== c.id) return false;
      const sStart = slotToMinutes(s.start_at);
      const sEnd = slotToMinutes(s.end_at);
      return slotMin >= sStart && slotMin + setMinutes <= sEnd;
    }),
  ).sort((a, b) => (a.name_kana || '').localeCompare(b.name_kana || '', 'ja'));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('お名前を入力してください'); return; }
    setSubmitting(true);
    setError(null);

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
            <p><strong>{date.replace(/-/g, '/')}</strong> {slot}〜</p>
            <p>席番号: {result.seatNo}</p>
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
        <p className="modal-date">{date.replace(/-/g, '/')} {slot}〜（{setMinutes}分）</p>

        <form onSubmit={handleSubmit}>
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
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? '送信中…' : '予約する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
