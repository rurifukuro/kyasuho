import type { MouseEvent, SyntheticEvent } from 'react';
import type { KyCast, KyReservation, KyShift, KySeatType, KyUnlockWindow } from '../lib/types';
import { slotToMinutes, minutesToSlot } from '../lib/timeUtils';

interface CustomerTimelineProps {
  date: string;
  windows: KyUnlockWindow[];
  reservations: KyReservation[];
  casts: KyCast[];
  shifts: KyShift[];
  seatTypes: KySeatType[];
  totalSeats: number;
  onPickSlot: (slotMinutes: number, windowOpenMin: number, windowEndMin: number, setMinutes: number) => void;
  onPickReservation: (reservation: KyReservation) => void;
}

const PX_PER_MINUTE = 1.5;
const TIME_STEP = 10;

function buildSeatColumns(seatTypes: KySeatType[], totalSeats: number): { label: string; globalIdx: number }[] {
  if (seatTypes.length === 0) {
    return Array.from({ length: Math.max(1, totalSeats) }, (_, i) => ({
      label: `席${i + 1}`,
      globalIdx: i,
    }));
  }
  const cols: { label: string; globalIdx: number }[] = [];
  let idx = 0;
  for (const st of seatTypes) {
    if (!st.is_active) continue;
    for (let i = 0; i < st.capacity; i++) {
      cols.push({
        label: seatTypes.length > 1 ? `${st.name}${i + 1}` : `席${i + 1}`,
        globalIdx: idx,
      });
      idx++;
    }
  }
  return cols.length > 0 ? cols : [{ label: '席1', globalIdx: 0 }];
}

export function CustomerTimeline({
  date,
  windows,
  reservations,
  casts,
  shifts,
  seatTypes,
  totalSeats,
  onPickSlot,
  onPickReservation,
}: CustomerTimelineProps) {
  if (windows.length === 0) {
    return <p className="no-data">この日は受付枠がありません</p>;
  }

  const onDutyCasts = casts.filter((c) =>
    shifts.some((s) => s.cast_id === c.id),
  );

  const windowRanges = windows.map((w) => {
    const start = slotToMinutes(w.open_from);
    const end = w.close_at ? slotToMinutes(w.close_at) : start + 480;
    return { ...w, startMin: start, endMin: end };
  });

  const minStart = Math.min(...windowRanges.map((w) => w.startMin));
  const maxEnd = Math.max(...windowRanges.map((w) => w.endMin));
  const totalHeight = (maxEnd - minStart) * PX_PER_MINUTE;

  const hourLabels: number[] = [];
  const startHour = Math.floor(minStart / 60);
  const endHour = Math.ceil(maxEnd / 60);
  for (let h = startHour; h <= endHour; h++) hourLabels.push(h);

  const columns = buildSeatColumns(seatTypes, totalSeats);
  const colCount = columns.length;

  function handleZoneClick(
    e: MouseEvent<HTMLDivElement>,
    windowStartMin: number,
    windowEndMin: number,
    setMinutes: number,
  ) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let minute = windowStartMin + y / PX_PER_MINUTE;
    minute = Math.round(minute / TIME_STEP) * TIME_STEP;
    const maxStart = windowEndMin - setMinutes;
    if (minute > maxStart) minute = maxStart;
    if (minute < windowStartMin) minute = windowStartMin;
    onPickSlot(minute, windowStartMin, windowEndMin, setMinutes);
  }

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

      <div className="ledger">
        <div className="ledger-header">
          <div className="ledger-time-label" />
          {columns.map((col, i) => (
            <div key={i} className="ledger-seat-label">{col.label}</div>
          ))}
        </div>

        <div className="ledger-body" style={{ height: totalHeight }}>
          {hourLabels.map((h) => {
            const offset = (h * 60 - minStart) * PX_PER_MINUTE;
            if (offset < 0) return null;
            return (
              <div key={h} className="ledger-hour-line" style={{ top: offset }}>
                <span className="ledger-hour-text">{h}:00</span>
              </div>
            );
          })}

          {windowRanges.map((w) => (
            <div
              key={w.id}
              className="ledger-unlock-zone"
              style={{
                top: (w.startMin - minStart) * PX_PER_MINUTE,
                height: (w.endMin - w.startMin) * PX_PER_MINUTE,
              }}
              onClick={(e) => handleZoneClick(e, w.startMin, w.endMin, w.set_minutes)}
              title="タップで予約"
            >
              <span className="ledger-zone-hint">＋ タップで予約</span>
            </div>
          ))}

          {columns.map((_, seatIdx) => (
            <div
              key={seatIdx}
              className="ledger-lane ledger-lane--readonly"
              style={{
                left: `${(seatIdx / colCount) * 100}%`,
                width: `${100 / colCount}%`,
              }}
            />
          ))}

          {reservations.map((r) => {
            const seatIdx = r.seat_no - 1;
            const rStart = slotToMinutes(r.slot);
            const rEnd = rStart + r.set_minutes;
            const top = (rStart - minStart) * PX_PER_MINUTE;
            const height = r.set_minutes * PX_PER_MINUTE;
            const isMine = false;
            function stop(e: SyntheticEvent) {
              e.stopPropagation();
            }
            return (
              <div
                key={r.id}
                className={`ledger-block ledger-block--reserved${isMine ? ' ledger-block--mine ledger-block--clickable' : ''}`}
                style={{
                  top,
                  height,
                  left: `${(seatIdx / colCount) * 100}%`,
                  width: `${100 / colCount}%`,
                }}
                title={`予約済 ${minutesToSlot(rStart)}〜${minutesToSlot(rEnd)}`}
                onClick={
                  isMine
                    ? (e) => { stop(e); onPickReservation(r); }
                    : (e) => stop(e)
                }
              >
                <div className="ledger-block-name">予約済</div>
                <div className="ledger-block-time">
                  {minutesToSlot(rStart)}〜{minutesToSlot(rEnd)}
                </div>
              </div>
            );
          })}
        </div>

        <p className="ledger-legend">
          空いている時間帯（受付中の枠）をタップすると予約できます。
        </p>
      </div>
    </div>
  );
}
