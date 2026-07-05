// src/components/PcWorkModal.tsx — 「PCで作業」モーダル（§24 アプリ→Web導線）
//
// 管理Web（#/admin）のURLをQR・コピー付きで提示する。アカウントは
// Supabase Auth共有＝アプリと同じメール＋パスワードでログインできる旨を案内。

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { FormModalShell } from './common/FormModalShell';
import { QrLinkCard } from './QrLinkCard';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

/** 管理Web（PC版）のURL。GitHub Pages公開先（WEB2/WEB3）。 */
export const ADMIN_WEB_URL = 'https://rurifukuro.github.io/kyasuho/#/admin';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function PcWorkModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[s.headerBtn, { color: theme.subtext }]}>{t('common.close')}</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('pcWork.title')}</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body}>
        <Text style={[s.desc, { color: theme.text }]}>{t('pcWork.desc')}</Text>
        <QrLinkCard
          title={t('pcWork.urlTitle')}
          url={ADMIN_WEB_URL}
          hint={t('pcWork.qrHint')}
          theme={theme}
          copyLabel={t('common.copyUrl')}
          copiedLabel={t('common.copied')}
        />
        <View style={[s.loginCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[s.loginHint, { color: theme.subtext }]}>{t('pcWork.loginHint')}</Text>
        </View>
      </ScrollView>
    </FormModalShell>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  headerBtn: { fontSize: 15 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSpacer: { width: 40 },
  body: { padding: 16, gap: 14 },
  desc: { fontSize: 14, lineHeight: 21 },
  loginCard: { borderRadius: 12, borderWidth: 0.5, padding: 14 },
  loginHint: { fontSize: 12, lineHeight: 18 },
});
