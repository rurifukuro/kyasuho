import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/timeUtils';
import type { KyEvent } from '../lib/types';

export function usePublicEvents(tenantId: string | undefined) {
  const [events, setEvents] = useState<KyEvent[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const today = formatDate(new Date());
    supabase
      .from('ky_events')
      // anon の列GRANT範囲に限定（select('*') は非付与列で42501＝SELECT-SYNC）
      .select('id, tenant_id, title, description, event_date, start_time, end_time, event_type, is_public')
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
