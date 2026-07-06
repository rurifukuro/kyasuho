import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { CONTACT_FORM_EMBED_URL } from '../config/contact';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ContactFormModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (visible) setLoading(true);
  }, [visible]);

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
            {t('contact.label')}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[s.closeText, { color: theme.primary }]}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.body, { paddingBottom: insets.bottom }]}>
          {visible && (
            <WebView
              originWhitelist={['*']}
              source={{ uri: CONTACT_FORM_EMBED_URL }}
              style={{ flex: 1, backgroundColor: theme.background }}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              onLoadEnd={() => setLoading(false)}
            />
          )}
          {loading && (
            <View style={[s.loading, { backgroundColor: theme.background }]} pointerEvents="none">
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[s.loadingText, { color: theme.subtext }]}>
                {t('contact.loading')}
              </Text>
            </View>
          )}
        </View>
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
  body: { flex: 1 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 13, fontWeight: '600' },
});
