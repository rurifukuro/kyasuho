import { getAvailableSlots } from '../lib/timeUtils';
import type { KyCast, KyReservation, KyShift, KyUnlockWindow } from '../lib/types';

interface TimeSlotListProps {
  date: string;
  windows: KyUnlockWindow[];
  reservations: KyReservation[];
  casts: KyCast[];
  shifts: KyShift[];
  totalSeats: number;
  onPickSlot: (slot: string, setMinutes: number) => void;
}

export function TimeSlotList({ date, windows, reservations, casts, shifts, totalSeats, onPickSlot }: TimeSlotListProps) {
  const slots = getAvailableSlots(windows, reservations, totalSeats);

  if (windows.length === 0) {
    return <p className="no-data">この日は受付枠がありません</p>;
  }

  const onDutyCasts = casts.filter((c) =>
    shifts.some((s) => s.cast_id === c.id),
  );

  return (
    <div className="timeslot-section">
      <h3 className="section-title">{date.replace(/-/g, '/')} の空き状況</h3>

      {onDutyCasts.length > 0 && (
        <div className="cast-chips">
          <span className="cast-label">出勤キャスト：</span>
          {onDutyCasts.map((c) => (
            <span key={c.id} className="cast-chip">{c.name}</span>
          ))}
        </div>
      )}

      <div className="slot-grid">
        {slots.map((s) => {
          const isFull = s.available <= 0;
          return (
            <button
              key={s.slot}
              className={`slot-btn ${isFull ? 'full' : 'open'}`}
              disabled={isFull}
              onClick={() => onPickSlot(s.slot, s.setMinutes)}
            >
              <span className="slot-time">{s.slot}</span>
              <span className="slot-seats">
                {isFull ? '満席' : `残${s.available}/${s.total}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
