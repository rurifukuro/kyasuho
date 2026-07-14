import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: number;
  expires_at: string | null;
};

export function DevAnnouncementBanner({ audience }: { audience: 'admin' | 'cast' | 'customer' }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from('ky_dev_announcements')
      .select('id, title, body, priority, expires_at')
      .eq('is_active', true)
      .contains('audience', [audience])
      .order('priority', { ascending: false })
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const now = new Date().toISOString();
        setItems(
          (data as Announcement[]).filter((a) => !a.expires_at || a.expires_at > now),
        );
      });
  }, [audience]);

  const visible = items.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="dev-announcements">
      {visible.map((a) => (
        <div key={a.id} className="dev-announcement-banner">
          <span className="dev-announcement-icon">📢</span>
          <div className="dev-announcement-content">
            <strong>{a.title}</strong>
            {a.body && <span className="dev-announcement-body">{a.body}</span>}
          </div>
          <button
            type="button"
            className="dev-announcement-dismiss"
            onClick={() => setDismissed((prev) => new Set([...prev, a.id]))}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
