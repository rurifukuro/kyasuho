import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from './common/FormModalShell';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { createNotification } from '../services/notifications';
import type { ThemeColor } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function SendNotificationModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { tenant } = useTenant();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert(t('common.error'), t('notifications.titleRequired'));
      return;
    }
    if (!tenant) return;
    setSending(true);
    try {
      await createNotification(tenant.id, {
        type: 'admin_message',
        title: trimmed,
        body: body.trim(),
        senderRole: 'admin',
        targetRole: 'cast',
      });
      Alert.alert('', t('notifications.sent'));
      setTitle('');
      setBody('');
      onClose();
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setSending(false);
    }
  };

  const s = makeStyles(theme);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="close" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('notifications.sendToCast')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={s.form}>
        <Text style={[s.label, { color: theme.subtext }]}>{t('notifications.inputTitle')}</Text>
        <TextInput
          style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          value={title}
          onChangeText={setTitle}
          placeholder={t('notifications.inputTitlePlaceholder')}
          placeholderTextColor={theme.subtext}
          maxLength={100}
        />

        <Text style={[s.label, { color: theme.subtext, marginTop: 16 }]}>{t('notifications.inputBody')}</Text>
        <TextInput
          style={[s.input, s.multiline, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          value={body}
          onChangeText={setBody}
          placeholder={t('notifications.inputBodyPlaceholder')}
          placeholderTextColor={theme.subtext}
          multiline
          maxLength={500}
        />

        <TouchableOpacity
          style={[s.sendBtn, { backgroundColor: theme.primary, opacity: sending ? 0.5 : 1 }]}
          onPress={handleSend}
          disabled={sending}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="send" size={18} color="#fff" />
          <Text style={s.sendText}>{t('notifications.sendBtn')}</Text>
        </TouchableOpacity>
      </View>
    </FormModalShell>
  );
}

function makeStyles(theme: ThemeColor) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    form: { padding: 20 },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
    multiline: { minHeight: 80, textAlignVertical: 'top' },
    sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, paddingVertical: 13, borderRadius: 10 },
    sendText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  });
}
