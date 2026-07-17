import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { DayStatus, KyReservation, KySeatType, KyUnlockWindow } from '../lib/types';
import { computeDayStatus, formatDate, getDaysInMonth } from '../lib/timeUtils';

export function useUnlockWindows(tenantId: string | undefined, date: string) {
  const [windows, setWindows] = useState<KyUnlockWindow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    supabase
      .from('ky_unlock_windows')
      // anon の列GRANT範囲に限定（select('*') は非付与列で42501＝SELECT-SYNC）
      .select('id, tenant_id, date, open_from, close_at, seats, set_minutes')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .order('open_from')
      .then(({ data }) => {
        setWindows((data as KyUnlockWindow[] | null) ?? []);
        setLoading(false);
      });
  }, [tenantId, date]);

  return { windows, loading };
}

export function useNextOpenDate(tenantId: string | undefined) {
  const [nextDate, setNextDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const today = formatDate(new Date());
    supabase
      .from('ky_unlock_windows')
      .select('date')
      .eq('tenant_id', tenantId)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0] as { date: string } | undefined;
        setNextDate(row?.date ?? null);
        setLoading(false);
      });
  }, [tenantId]);

  return { nextDate, loading };
}

export function useMonthAvailability(
  tenantId: string | undefined,
  year: number,
  month: number,
) {
  const [unlockedDates, setUnlockedDates] = useState<Set<string>>(new Set());
  const [statusByDate, setStatusByDate] = useState<Map<string, DayStatus>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    const mm = (month + 1).toString().padStart(2, '0');
    const startDate = `${year}-${mm}-01`;
    const lastDay = getDaysInMonth(year, month);
    const endDate = `${year}-${mm}-${lastDay.toString().padStart(2, '0')}`;

    setLoading(true);
    void (async () => {
      const [winRes, resvRes, stRes] = await Promise.all([
        supabase
          .from('ky_unlock_windows')
          .select('date, open_from, close_at, seats, set_minutes')
          .eq('tenant_id', tenantId)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('ky_reservations')
          .select('date, slot, set_minutes, seat_no, status')
          .eq('tenant_id', tenantId)
          .in('status', ['reserved', 'checked_in'])
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('ky_seat_types')
          .select('capacity')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
      ]);
      if (cancelled) return;

      const winRows = (winRes.data ?? []) as KyUnlockWindow[];
      const resvRows = (resvRes.data ?? []) as KyReservation[];
      const stRows = (stRes.data ?? []) as Pick<KySeatType, 'capacity'>[];
      const totalSeats = stRows.reduce((sum, st) => sum + (st.capacity ?? 1), 0);

      const winsByDate = new Map<string, KyUnlockWindow[]>();
      for (const w of winRows) {
        const arr = winsByDate.get(w.date) ?? [];
        arr.push(w);
        winsByDate.set(w.date, arr);
      }
      const resvByDate = new Map<string, KyReservation[]>();
      for (const r of resvRows) {
        const arr = resvByDate.get(r.date) ?? [];
        arr.push(r);
        resvByDate.set(r.date, arr);
      }

      const dates = new Set<string>(winsByDate.keys());
      const statuses = new Map<string, DayStatus>();
      for (const [d, wins] of winsByDate) {
        statuses.set(d, computeDayStatus(wins, resvByDate.get(d) ?? [], totalSeats));
      }

      setUnlockedDates(dates);
      setStatusByDate(statuses);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [tenantId, year, month]);

  return { unlockedDates, statusByDate, loading };
}
