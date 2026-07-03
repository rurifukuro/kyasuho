import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import type { TKey } from '../../i18n';

type Props = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  titleKey: TKey;
  descKey: TKey;
};

/** 各タブの器（実装前のプレースホルダ）。Rev2 基盤ではこの共通画面を 5 タブが使う。
 *  以降の Rev で ReservationsScreen 等の中身を実装に差し替える。 */
export function PlaceholderScreen({ icon, titleKey, descKey }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.center}>
        <MaterialCommunityIcons name={icon} size={64} color={theme.primaryLight} />
        <Text style={[styles.title, { color: theme.text }]}>{t(titleKey)}</Text>
        <Text style={[styles.desc, { color: theme.subtext }]}>{t(descKey)}</Text>
        <View style={[styles.badge, { backgroundColor: theme.primary }]}>
          <Text style={styles.badgeText}>{t('common.wip')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '700' },
  desc: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  badge: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
