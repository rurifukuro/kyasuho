import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fetchUnreadCount } from '../services/notifications';
import { NotificationPanel } from './NotificationPanel';
import type { NotificationTargetRole } from '../types';

type Props = {
  targetRole: NotificationTargetRole;
  tenantId?: string;
};

export function NotificationBell({ targetRole, tenantId: tenantIdProp }: Props) {
  const { theme } = useTheme();
  const tenantId = tenantIdProp ?? '';
  const [count, setCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    try {
      const n = await fetchUnreadCount(tenantId, targetRole);
      setCount(n);
    } catch {
      // silent
    }
  }, [tenantId, targetRole]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleClose = () => {
    setShowPanel(false);
    void refresh();
  };

  return (
    <>
      <TouchableOpacity onPress={() => setShowPanel(true)} style={s.btn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <MaterialCommunityIcons name="bell-outline" size={22} color={theme.text} />
        {count > 0 && (
          <View style={[s.badge, { backgroundColor: theme.primary }]} />
        )}
      </TouchableOpacity>
      <NotificationPanel visible={showPanel} onClose={handleClose} targetRole={targetRole} tenantId={tenantId} />
    </>
  );
}

const s = StyleSheet.create({
  btn: { position: 'relative', padding: 4 },
  badge: { position: 'absolute', top: 2, right: 2, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: '#fff' },
});
