import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from './common/FormModalShell';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import * as notifService from '../services/notifications';
import type { InternalNotification, NotificationTargetRole, ThemeColor } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  targetRole: NotificationTargetRole;
  tenantId?: string;
};

export function NotificationPanel({ visible, onClose, targetRole, tenantId: tenantIdProp }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const tenantId = tenantIdProp ?? '';

  const [notifications, setNotifications] = useState<InternalNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || !visible) return;
    setLoading(true);
    try {
      const data = await notifService.fetchNotifications(tenantId, targetRole);
      setNotifications(data);
    } catch (e) {
      console.warn('[kyasuho] notifications load:', e);
    } finally {
      setLoading(false);
    }
  }, [tenantId, visible, targetRole]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const handleMarkAll = async () => {
    await notifService.markAllAsRead(tenantId, targetRole);
    await load();
  };

  const handleTap = async (n: InternalNotification) => {
    if (!n.isRead) {
      await notifService.markAsRead(n.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)),
      );
    }
  };

  const s = makeStyles(theme);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="close" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('notifications.title')}</Text>
        <TouchableOpacity onPress={handleMarkAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="check-all" size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {notifications.length === 0 && !loading ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="bell-off-outline" size={40} color={theme.border} />
          <Text style={{ color: theme.subtext, fontSize: 14, marginTop: 8 }}>{t('notifications.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.row, { backgroundColor: item.isRead ? 'transparent' : theme.primary + '08' }]}
              onPress={() => handleTap(item)}
              activeOpacity={0.7}
            >
              <View style={[s.dot, { backgroundColor: item.isRead ? 'transparent' : theme.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.notifTitle, { color: theme.text }]}>{item.title}</Text>
                {item.body ? <Text style={[s.notifBody, { color: theme.subtext }]} numberOfLines={2}>{item.body}</Text> : null}
                <Text style={[s.notifTime, { color: theme.subtext }]}>
                  {formatRelativeTime(item.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </FormModalShell>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

function makeStyles(theme: ThemeColor) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
    row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
    dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
    notifTitle: { fontSize: 14, fontWeight: '600' },
    notifBody: { fontSize: 12, marginTop: 2, lineHeight: 16 },
    notifTime: { fontSize: 11, marginTop: 4 },
  });
}
