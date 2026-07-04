import type { DayStatus, KyReservation, KyUnlockWindow } from './types';

const TIME_STEP = 10;
const LOW_AVAILABILITY_RATIO = 0.34;

export function slotToMinutes(slot: string): number {
  const [h, m] = slot.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToSlot(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function rangesOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && s2 < e1;
}

export function countAvailableSeats(
  startMin: number,
  endMin: number,
  reservations: KyReservation[],
  totalSeats: number,
): number {
  const occupied = new Set<number>();
  for (const r of reservations) {
    const rStart = slotToMinutes(r.slot);
    const rEnd = rStart + r.set_minutes;
    if (rangesOverlap(startMin, endMin, rStart, rEnd)) {
      occupied.add(r.seat_no);
    }
  }
  return totalSeats - occupied.size;
}

export function computeDayStatus(
  windows: KyUnlockWindow[],
  reservations: KyReservation[],
): DayStatus {
  if (windows.length === 0) return 'full';

  let totalSlots = 0;
  let freeSlots = 0;
  let anyBookable = false;

  for (const w of windows) {
    const wStart = slotToMinutes(w.open_from);
    const wEnd = w.close_at ? slotToMinutes(w.close_at) : wStart + 480;

    for (let t = wStart; t + w.set_minutes <= wEnd; t += w.set_minutes) {
      const avail = countAvailableSeats(t, t + w.set_minutes, reservations, w.seats);
      totalSlots += w.seats;
      freeSlots += Math.max(0, avail);
    }

    for (let t = wStart; t + w.set_minutes <= wEnd; t += TIME_STEP) {
      if (countAvailableSeats(t, t + w.set_minutes, reservations, w.seats) > 0) {
        anyBookable = true;
      }
    }
  }

  if (!anyBookable || freeSlots <= 0) return 'full';
  const freeRatio = totalSlots > 0 ? freeSlots / totalSlots : 1;
  if (freeRatio <= LOW_AVAILABILITY_RATIO) return 'low';
  return 'available';
}

export function getAvailableSlots(
  windows: KyUnlockWindow[],
  reservations: KyReservation[],
): { slot: string; setMinutes: number; available: number; total: number }[] {
  const slots: { slot: string; setMinutes: number; available: number; total: number }[] = [];

  for (const w of windows) {
    const wStart = slotToMinutes(w.open_from);
    const wEnd = w.close_at ? slotToMinutes(w.close_at) : wStart + 480;

    for (let t = wStart; t + w.set_minutes <= wEnd; t += TIME_STEP) {
      const avail = countAvailableSeats(t, t + w.set_minutes, reservations, w.seats);
      slots.push({
        slot: minutesToSlot(t),
        setMinutes: w.set_minutes,
        available: avail,
        total: w.seats,
      });
    }
  }

  return slots;
}
