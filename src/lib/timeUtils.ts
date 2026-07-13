const TIME_STEP = 10;

export function slotToMinutes(slot: string): number {
  const [h, m] = slot.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToSlot(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

type ResvLike = { slot: string; set_minutes: number; seat_no: number; status: string };

function rangesOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && s2 < e1;
}

export function countAvailableSeats(
  startMin: number,
  endMin: number,
  reservations: ResvLike[],
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

type WindowLike = { open_from: string; close_at: string | null; set_minutes: number };

export function getAvailableSlots(
  windows: WindowLike[],
  reservations: ResvLike[],
  totalSeats: number,
): { slot: string; minutes: number; setMinutes: number; available: number; total: number }[] {
  const slots: { slot: string; minutes: number; setMinutes: number; available: number; total: number }[] = [];

  for (const w of windows) {
    const wStart = slotToMinutes(w.open_from);
    const wEnd = w.close_at ? slotToMinutes(w.close_at) : wStart + 480;

    for (let t = wStart; t + w.set_minutes <= wEnd; t += TIME_STEP) {
      const avail = countAvailableSeats(t, t + w.set_minutes, reservations, totalSeats);
      slots.push({
        slot: minutesToSlot(t),
        minutes: t,
        setMinutes: w.set_minutes,
        available: avail,
        total: totalSeats,
      });
    }
  }

  return slots;
}
