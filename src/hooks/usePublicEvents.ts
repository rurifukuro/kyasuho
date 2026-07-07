import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { KyEvent } from '../lib/types';

export function usePublicEvents(tenantId: string | undefined) {
  const [events, setEvents] = useState<KyEvent[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from('ky_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_public', true)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .then(({ data }) => {
        setEvents((data as KyEvent[] | null) ?? []);
      });
  }, [tenantId]);

  return { events };
}
