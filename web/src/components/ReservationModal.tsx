import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { KyCast, KyReservation, KySeatType, KyShift, MakeReservationResult } from '../lib/types';
import { slotToMinutes, minutesToSlot, countAvailableSeats } from '../lib/timeUtils';

const TIME_STEP = 10;

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

  const availableCasts = casts.filter(
    (c) => c.accepts_nomination && shifts.some((s) => {
      if (s.cast_id !== c.id) return false;
      const sStart = slotToMinutes(s.start_at);
      const sEnd = slotToMinutes(s.end_at);
      return startTime >= sStart && endTime <= sEnd;
    }),
  ).sort((a, b) => (a.name_kana || '').localeCompare(b.name_kana || '', 'ja'));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('お名前を入力してください'); return; }
    setSubmitting(true);
    setError(null);

    const slot = minutesToSlot(startTime);
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
