import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  sender_role: string;
  is_read: boolean;
  created_at: string;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

export function AdminNotificationBell({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('ky_notifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('target_role', 'admin')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setItems(data as Notification[]);
      setUnread((data as Notification[]).filter((n) => !n.is_read).length);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const handleMarkAll = async () => {
    await supabase
      .from('ky_notifications')
      .update({ is_read: true })
      .eq('tenant_id', tenantId)
      .eq('target_role', 'admin')
      .eq('is_read', false);
    void load();
  };

  const handleTap = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from('ky_notifications').update({ is_read: true }).eq('id', n.id);
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)));
      setUnread((c) => Math.max(0, c - 1));
    }
  };

  return (
    <div className="admin-notif-bell-wrapper">
      <button
        type="button"
        className="admin-notif-bell"
        onClick={() => { setOpen(!open); if (!open) void load(); }}
        title="通知"
      >
        🔔
        {unread > 0 && <span className="admin-notif-badge" />}
      </button>

      {open && (
        <div className="admin-notif-dropdown">
          <div className="admin-notif-header">
            <span>通知</span>
            <button type="button" className="admin-notif-markall" onClick={() => void handleMarkAll()}>
              すべて既読
            </button>
          </div>
          {items.length === 0 ? (
            <div className="admin-notif-empty">通知はありません</div>
          ) : (
            <div className="admin-notif-list">
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`admin-notif-item${n.is_read ? '' : ' unread'}`}
                  onClick={() => void handleTap(n)}
                >
                  <div className="admin-notif-item-title">{n.title}</div>
                  {n.body && <div className="admin-notif-item-body">{n.body}</div>}
                  <div className="admin-notif-item-time">{relativeTime(n.created_at)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
