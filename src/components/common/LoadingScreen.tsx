import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

// 全画面ローディング（初回セッション復元中など）。テーマ背景＋中央スピナー。
export function LoadingScreen({ label }: { label?: string }) {
  const { theme } = useTheme();
  return (
    <View style={[s.wrap, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      {label ? <Text style={[s.label, { color: theme.subtext }]}>{label}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: 12, fontSize: 14 },
});
