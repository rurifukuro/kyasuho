import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { PRIVACY_POLICY } from '../data/privacyPolicy';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function PrivacyPolicyModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View
        style={{
          flex: 1,
          paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : insets.top,
          backgroundColor: theme.background,
        }}
      >
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <Text style={[s.title, { color: theme.text }]} numberOfLines={1}>
            {t('settings.privacy')}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[s.closeText, { color: theme.primary }]}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
        >
          <Text style={[s.updated, { color: theme.subtext }]}>
            {t('settings.lastUpdated')}: {PRIVACY_POLICY.lastUpdated}
          </Text>
          {PRIVACY_POLICY.sections.map((sec, i) => (
            <View key={i} style={s.section}>
              <Text style={[s.heading, { color: theme.text }]}>{sec.heading}</Text>
              <Text style={[s.text, { color: theme.text }]}>{sec.body}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  closeText: { fontSize: 15, fontWeight: '600' },
  body: { paddingHorizontal: 18, paddingTop: 16 },
  updated: { fontSize: 12, marginBottom: 16 },
  section: { marginBottom: 18 },
  heading: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  text: { fontSize: 14, lineHeight: 21 },
});
