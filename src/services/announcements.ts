import { supabase } from '../config/supabase';
import type { DevAnnouncement, AnnouncementAudience } from '../types';

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  audience: string[];
  is_active: boolean;
  priority: number;
  published_at: string;
  expires_at: string | null;
};

function rowToAnnouncement(row: AnnouncementRow): DevAnnouncement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience as AnnouncementAudience[],
    isActive: row.is_active,
    priority: row.priority,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
  };
}

export async function fetchAnnouncements(
  audience: AnnouncementAudience,
): Promise<DevAnnouncement[]> {
  const { data, error } = await supabase
    .from('ky_dev_announcements')
    .select('*')
    .eq('is_active', true)
    .contains('audience', [audience])
    .order('priority', { ascending: false })
    .order('published_at', { ascending: false });
  if (error) throw error;
  const now = new Date().toISOString();
  return ((data ?? []) as AnnouncementRow[])
    .filter((r) => !r.expires_at || r.expires_at > now)
    .map(rowToAnnouncement);
}
