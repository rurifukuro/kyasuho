import { supabase } from '../config/supabase';
import type { StoreEvent } from '../types';

type EventRow = {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string;
  is_public: boolean;
  created_at: string;
};

function toStoreEvent(r: EventRow): StoreEvent {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    title: r.title,
    description: r.description,
    eventDate: r.event_date,
    startTime: r.start_time,
    endTime: r.end_time,
    eventType: r.event_type,
    isPublic: r.is_public,
    createdAt: r.created_at,
  };
}

export async function fetchEventsByMonth(tenantId: string, yearMonth: string): Promise<StoreEvent[]> {
  const { data, error } = await supabase
    .from('ky_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('event_date', `${yearMonth}-01`)
    .lte('event_date', `${yearMonth}-31`)
    .order('event_date', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as EventRow[]).map(toStoreEvent);
}
