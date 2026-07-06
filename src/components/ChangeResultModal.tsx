// src/components/ChangeResultModal.tsx — 会計確定後の「おつり」大表示（レジさぽっ！流用・§25-3）

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import type { ThemeColor } from '../types';

export function ChangeResultModal({ visible, subtotal, deposit, change, onClose }: {
  visible: boolean;
  subtotal: number;
  deposit: number;
  change: number;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const s = makeStyles(theme);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.card, { backgroundColor: theme.card, borderColor: theme.primary }]} onPress={() => {}}>
          <Text style={[s.doneTag, { color: theme.subtext }]}>{t('checkout.done')}</Text>

          <Text style={[s.changeLabel, { color: theme.primary }]}>{t('checkout.change')}</Text>
          <Text style={[s.changeAmt, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
            ¥{change.toLocaleString()}
          </Text>

          <View style={[s.breakdown, { borderTopColor: theme.border }]}>
            <View style={s.bdRow}>
              <Text style={[s.bdLabel, { color: theme.subtext }]}>{t('checkout.total')}</Text>
              <Text style={[s.bdValue, { color: theme.text }]}>¥{subtotal.toLocaleString()}</Text>
            </View>
            <View style={s.bdRow}>
              <Text style={[s.bdLabel, { color: theme.subtext }]}>{t('checkout.received')}</Text>
              <Text style={[s.bdValue, { color: theme.text }]}>¥{deposit.toLocaleString()}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[s.okBtn, { backgroundColor: theme.primary, marginBottom: Math.max(insets.bottom - 8, 0) }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={s.okText}>{t('common.ok')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(theme: ThemeColor) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: { width: '100%', maxWidth: 420, borderRadius: 20, borderWidth: 2, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 20, alignItems: 'center' },
    doneTag: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
    changeLabel: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
    changeAmt: { fontSize: 64, fontWeight: '900', letterSpacing: -1 },
    breakdown: { alignSelf: 'stretch', borderTopWidth: 1, marginTop: 14, paddingTop: 12, gap: 6 },
    bdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    bdLabel: { fontSize: 15 },
    bdValue: { fontSize: 17, fontWeight: '700' },
    okBtn: { alignSelf: 'stretch', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
    okText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  });
}
