import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fetchAnnouncements } from '../services/announcements';
import type { DevAnnouncement, AnnouncementAudience } from '../types';

type Props = {
  audience: AnnouncementAudience;
};

export function DevAnnouncementBanner({ audience }: Props) {
  const { theme } = useTheme();
  const [announcements, setAnnouncements] = useState<DevAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    void fetchAnnouncements(audience)
      .then(setAnnouncements)
      .catch(() => {});
  }, [audience]);

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 6 }}>
      {visible.map((a) => (
        <View key={a.id} style={[s.banner, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '40' }]}>
          <MaterialCommunityIcons name="bullhorn-outline" size={16} color={theme.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: theme.text }]}>{a.title}</Text>
            {a.body ? <Text style={[s.body, { color: theme.subtext }]}>{a.body}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={() => setDismissed((prev) => new Set([...prev, a.id]))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="close" size={16} color={theme.subtext} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
  title: { fontSize: 13, fontWeight: '700' },
  body: { fontSize: 12, marginTop: 2, lineHeight: 16 },
});
