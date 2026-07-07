import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTenant } from '../hooks/useTenant';
import { useUnlockWindows, useNextOpenDate } from '../hooks/useUnlockWindows';
import { useReservations } from '../hooks/useReservations';
import { useCasts, useSeatTypes, useShifts } from '../hooks/useCasts';
import { usePublicEvents } from '../hooks/usePublicEvents';
import { formatDate } from '../lib/timeUtils';
import { Calendar } from './Calendar';
import { TimeSlotList } from './TimeSlotList';
import { ReservationModal } from './ReservationModal';
import { ReservationEditModal } from './ReservationEditModal';
import type { KyReservation } from '../lib/types';

export function TenantPage() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant(slug);

  const today = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<{ slot: string; setMinutes: number } | null>(null);
  const [editTarget, setEditTarget] = useState<KyReservation | null>(null);
  const userPicked = useRef(false);

  const { windows } = useUnlockWindows(tenant?.id, selectedDate);
  const { reservations, refresh: refreshReservations } = useReservations(tenant?.id, selectedDate);
  const { nextDate, loading: nextLoading } = useNextOpenDate(tenant?.id);
  const { casts } = useCasts(tenant?.id);
  const { seatTypes } = useSeatTypes(tenant?.id);
  const { shifts } = useShifts(tenant?.id, selectedDate);
  const { events } = usePublicEvents(tenant?.id);

  useEffect(() => {
    if (!userPicked.current && nextDate && nextDate !== selectedDate) {
      setSelectedDate(nextDate);
    }
  }, [nextDate, selectedDate]);

  function handlePickDate(date: string) {
    userPicked.current = true;
    setSelectedDate(date);
  }

  function handleReserved() {
    setSelectedSlot(null);
    void refreshReservations();
  }

  function handleCancelled() {
    setEditTarget(null);
    void refreshReservations();
  }

  if (tenantLoading) return <div className="loading">読み込み中…</div>;
  if (tenantError || !tenant) {
    return (
      <div className="error-page">
        <h1>店舗が見つかりません</h1>
        <p>{tenantError ?? 'URLをご確認ください'}</p>
      </div>
    );
  }

  const totalSeats = seatTypes.reduce((sum, st) => sum + (st.capacity ?? 1), 0);
  const noWindowToday = windows.length === 0;
  const hasOtherOpenDate = nextDate !== null && nextDate !== selectedDate;

  return (
    <div className="tenant-page">
      <header className="store-header">
        <h1>{tenant.name}</h1>
        {tenant.genre && <p className="store-genre">{tenant.genre}</p>}
        {tenant.business_info.openHours && (
          <p className="store-hours">営業時間: {tenant.business_info.openHours}</p>
        )}
      </header>

      <Calendar
        tenantId={tenant.id}
        selectedDate={selectedDate}
        onSelectDate={handlePickDate}
      />

      {events.length > 0 && (
        <div className="events-section">
          <h3 className="section-title">イベント情報</h3>
          <div className="event-list">
            {events.map((ev) => (
              <div key={ev.id} className="event-card">
                <div className="event-date">{ev.event_date.replace(/-/g, '/')}</div>
                <div className="event-body">
                  <div className="event-title">{ev.title}</div>
                  {ev.start_time && (
                    <div className="event-time">
                      {ev.start_time.slice(0, 5)}
                      {ev.end_time ? `〜${ev.end_time.slice(0, 5)}` : ''}
                    </div>
                  )}
                  {ev.description && <div className="event-desc">{ev.description}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {noWindowToday && !nextLoading && (
        <div className="notice-banner">
          {hasOtherOpenDate ? (
            <>
              <span>この日は受付していません。最短の予約可能日：</span>
              <button type="button" className="notice-link" onClick={() => handlePickDate(nextDate)}>
                {nextDate.replace(/-/g, '/')} を見る
              </button>
            </>
          ) : (
            <span>現在、予約を受け付けている日程がありません。</span>
          )}
        </div>
      )}

      <TimeSlotList
        date={selectedDate}
        windows={windows}
        reservations={reservations}
        casts={casts}
        shifts={shifts}
        totalSeats={totalSeats}
        onPickSlot={(slot, setMinutes) => {
          setEditTarget(null);
          setSelectedSlot({ slot, setMinutes });
        }}
      />

      {reservations.length > 0 && (
        <div className="my-reservations">
          <h3 className="section-title">予約の確認・キャンセル</h3>
          <p className="sub-text">予約をタップして暗証番号を入力すると、キャンセルできます。</p>
          <div className="reservation-list">
            {reservations.map((r) => (
              <button
                key={r.id}
                className="reservation-item"
                onClick={() => {
                  setSelectedSlot(null);
                  setEditTarget(r);
                }}
              >
                <span className="resv-time">{r.slot}〜</span>
                <span className="resv-seat">席{r.seat_no}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedSlot && (
        <ReservationModal
          tenantId={tenant.id}
          date={selectedDate}
          slot={selectedSlot.slot}
          setMinutes={selectedSlot.setMinutes}
          casts={casts}
          shifts={shifts}
          seatTypes={seatTypes}
          onClose={() => setSelectedSlot(null)}
          onReserved={handleReserved}
        />
      )}

      {editTarget && (
        <ReservationEditModal
          reservationId={editTarget.id}
          date={editTarget.date}
          slot={editTarget.slot}
          seatNo={editTarget.seat_no}
          onClose={() => setEditTarget(null)}
          onCancelled={handleCancelled}
        />
      )}

      <footer className="page-footer">
        <p>Powered by きゃすりん</p>
      </footer>
    </div>
  );
}
