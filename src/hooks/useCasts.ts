import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { KyCast, KyShift } from '../lib/types';

export function useCasts(tenantId: string | undefined) {
  const [casts, setCasts] = useState<KyCast[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('ky_casts')
      .select('id, tenant_id, name, photo_url, bio, accepts_nomination, sort_order')
      .eq('tenant_id', tenantId)
      .order('sort_order')
      .then(({ data }) => {
        setCasts((data as KyCast[] | null) ?? []);
      });
  }, [tenantId]);

  return { casts };
}

export function useShifts(tenantId: string | undefined, date: string) {
  const [shifts, setShifts] = useState<KyShift[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('ky_shifts')
      .select('id, cast_id, date, start_at, end_at')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .order('start_at')
      .then(({ data }) => {
        setShifts((data as KyShift[] | null) ?? []);
      });
  }, [tenantId, date]);

  return { shifts };
}
