import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CancelResult, VerifyPinResult } from '../lib/types';

interface ReservationEditModalProps {
  reservationId: string;
  date: string;
  slot: string;
  seatNo: number;
  onClose: () => void;
  onCancelled: () => void;
}

export function ReservationEditModal({
  reservationId, date, slot, seatNo, onClose, onCancelled,
}: ReservationEditModalProps) {
  const [pin, setPin] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length !== 4) { setError('4桁の暗証番号を入力してください'); return; }
    setProcessing(true);
    setError(null);

    const { data } = await supabase.rpc('ky_verify_reservation_pin', {
      p_reservation_id: reservationId,
      p_pin: pin,
    });
    setProcessing(false);

    const res = data as VerifyPinResult | null;
    if (!res?.ok) {
      if (res?.reason === 'no_pin') setError('この予約には暗証番号が設定されていません');
      else if (res?.reason === 'too_many_attempts') setError('試行回数が上限に達しました。15分ほど待ってからお試しください');
      else setError('暗証番号が一致しません');
      return;
    }
    setVerified(true);
  }

  async function handleCancel() {
    setProcessing(true);
    setError(null);

    const { data } = await supabase.rpc('ky_cancel_reservation', {
      p_reservation_id: reservationId,
      p_pin: pin,
    });
    setProcessing(false);

    const res = data as CancelResult | null;
    if (!res?.ok) {
      if (res?.error === 'too_many_attempts') setError('試行回数が上限に達しました。15分ほど待ってからお試しください');
      else setError('キャンセルに失敗しました');
      return;
    }
    setCancelled(true);
  }

  if (cancelled) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h2>予約をキャンセルしました</h2>
          <p>{date.replace(/-/g, '/')} {slot}〜 席{seatNo}</p>
          <button className="btn-primary" onClick={() => { onCancelled(); onClose(); }}>
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>予約の確認・キャンセル</h2>
        <p className="modal-date">{date.replace(/-/g, '/')} {slot}〜 席{seatNo}</p>

        {!verified ? (
          <form onSubmit={handleVerify}>
            <label>
              暗証番号（4桁）
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                autoFocus
              />
            </label>
            {error && <p className="error-msg">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>戻る</button>
              <button type="submit" className="btn-primary" disabled={processing}>
                {processing ? '確認中…' : '確認'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <p>予約内容を確認しました。</p>
            {error && <p className="error-msg">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>戻る</button>
              <button
                type="button"
                className="btn-danger"
                disabled={processing}
                onClick={handleCancel}
              >
                {processing ? '処理中…' : '予約をキャンセル'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
