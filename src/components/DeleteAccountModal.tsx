import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { KeyboardDoneBar } from './KeyboardDoneBar';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function DeleteAccountModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!user) return;
    Alert.alert(
      t('settings.deleteAccountConfirmTitle'),
      t('settings.deleteAccountConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error: rpcError } = await supabase.rpc('ky_delete_account');
              if (rpcError) throw rpcError;
              await supabase.auth.signOut();
            } catch (e: unknown) {
              Alert.alert(t('common.error'), String(e));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [user, t]);

  const confirmMatch = confirmText === t('settings.deleteConfirmWord');

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
            {t('settings.deleteAccount')}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[s.closeText, { color: theme.primary }]}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.body, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={[s.warningTitle, { color: '#DC2626' }]}>
            {t('settings.deleteAccountWarningTitle')}
          </Text>
          <Text style={[s.warningBody, { color: theme.text }]}>
            {t('settings.deleteAccountWarningBody')}
          </Text>

          <Text style={[s.label, { color: theme.text }]}>
            {t('settings.deleteAccountConfirmLabel')}
          </Text>
          <TextInput
            style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={t('settings.deleteConfirmWord')}
            placeholderTextColor={theme.subtext}
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[s.deleteButton, { opacity: confirmMatch && !deleting ? 1 : 0.4 }]}
            onPress={handleDelete}
            disabled={!confirmMatch || deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.deleteButtonText}>{t('settings.deleteAccountButton')}</Text>
            )}
          </TouchableOpacity>
        </View>
        <KeyboardDoneBar />
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
  body: { padding: 20 },
  warningTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  warningBody: { fontSize: 14, lineHeight: 21, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 24 },
  deleteButton: { backgroundColor: '#DC2626', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
