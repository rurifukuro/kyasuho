import React, { createContext, useContext, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { registerForPushNotificationsAsync, savePushToken } from '../services/pushTokens';
import { useLanguage } from './LanguageContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

type NotificationContextValue = {
  expoPushToken: string | null;
};

const NotificationContext = createContext<NotificationContextValue>({ expoPushToken: null });

export function useNotification() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { t } = useLanguage();
  const tokenRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user || !tenant) return;

    void (async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        tokenRef.current = token;
        await savePushToken(tenant.id, user.id, token);
      }
    })();
  }, [user, tenant]);

  useEffect(() => {
    if (!tenant) return;

    const channel = supabase
      .channel(`ky_reservations_${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ky_reservations',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          const row = payload.new as { customer_name?: string; slot?: string; date?: string };
          void Notifications.scheduleNotificationAsync({
            content: {
              title: t('notification.newReservation'),
              body: t('notification.newReservationBody', {
                name: row.customer_name ?? '',
                date: row.date ?? '',
                time: row.slot ?? '',
              }),
              sound: 'default',
            },
            trigger: null,
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ky_reservations',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          const row = payload.new as { customer_name?: string; slot?: string; date?: string; status?: string };
          const old = payload.old as { status?: string };
          if (row.status === old.status) return;
          const isCancelled = row.status === 'cancelled';
          void Notifications.scheduleNotificationAsync({
            content: {
              title: isCancelled
                ? t('notification.reservationCancelled')
                : t('notification.reservationChanged'),
              body: isCancelled
                ? t('notification.reservationCancelledBody', {
                    name: row.customer_name ?? '',
                    date: row.date ?? '',
                    time: row.slot ?? '',
                  })
                : t('notification.reservationChangedBody', {
                    name: row.customer_name ?? '',
                    date: row.date ?? '',
                    time: row.slot ?? '',
                  }),
              sound: 'default',
            },
            trigger: null,
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [tenant, t]);

  return (
    <NotificationContext.Provider value={{ expoPushToken: tokenRef.current }}>
      {children}
    </NotificationContext.Provider>
  );
}
