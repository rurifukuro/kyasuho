import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { KyReservation } from '../lib/types';

export function useReservations(tenantId: string | undefined, date: string) {
  const [reservations, setReservations] = useState<KyReservation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('ky_reservations')
      .select('id, tenant_id, date, slot, set_minutes, seat_no, customer_name, status')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .in('status', ['reserved', 'checked_in'])
      .order('slot');
    setReservations((data as KyReservation[] | null) ?? []);
    setLoading(false);
  }, [tenantId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  return { reservations, loading, refresh: load };
}
