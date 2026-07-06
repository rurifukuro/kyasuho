import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FormModalShell } from './common/FormModalShell';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { guardFields } from '../utils/contentGuard';
import type { TenantSnsLink } from '../types';

const SNS_PLATFORMS = [
  { key: 'x', label: 'X (Twitter)', icon: 'twitter', placeholder: 'https://x.com/...' },
  { key: 'instagram', label: 'Instagram', icon: 'instagram', placeholder: 'https://instagram.com/...' },
  { key: 'tiktok', label: 'TikTok', icon: 'music-note', placeholder: 'https://tiktok.com/@...' },
] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function StoreProfileModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { tenant, updateTenant } = useTenant();

  const [name, setName] = useState('');
  const [genre, setGenre] = useState('');
  const [address, setAddress] = useState('');
  const [openHours, setOpenHours] = useState('');
  const [tel, setTel] = useState('');
  const [note, setNote] = useState('');
  const [snsLinks, setSnsLinks] = useState<TenantSnsLink[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && tenant) {
      setName(tenant.name);
      setGenre(tenant.genre);
      setAddress(tenant.businessInfo.address ?? '');
      setOpenHours(tenant.businessInfo.openHours ?? '');
      setTel(tenant.businessInfo.tel ?? '');
      setNote(tenant.businessInfo.note ?? '');
      setSnsLinks(tenant.snsLinks.length > 0 ? [...tenant.snsLinks] : []);
    }
  }, [visible, tenant]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('settings.storeNameRequired'));
      return;
    }
    if (!guardFields({ name, genre, address, note }, t)) return;
    setSaving(true);
    try {
      const validLinks = snsLinks.filter(l => l.url.trim());
      await updateTenant({
        name: name.trim(),
        genre: genre.trim(),
        businessInfo: {
          address: address.trim() || undefined,
          openHours: openHours.trim() || undefined,
          tel: tel.trim() || undefined,
          note: note.trim() || undefined,
        },
        snsLinks: validLinks.map(l => ({ platform: l.platform, url: l.url.trim() })),
      });
      onClose();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setSaving(false);
    }
  }, [name, genre, address, openHours, tel, note, snsLinks, t, updateTenant, onClose]);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[s.headerBtn, { color: theme.subtext }]}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>
          {t('settings.storeProfile')}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[s.headerBtn, { color: theme.primary, opacity: saving ? 0.4 : 1 }]}>
            {t('settings.save')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Field label={t('settings.storeName')} value={name} onChangeText={setName} theme={theme} />
        <Field label={t('settings.storeGenre')} value={genre} onChangeText={setGenre} theme={theme} placeholder={t('settings.storeGenrePlaceholder')} />
        <Field label={t('settings.storeAddress')} value={address} onChangeText={setAddress} theme={theme} />
        <Field label={t('settings.storeOpenHours')} value={openHours} onChangeText={setOpenHours} theme={theme} placeholder="18:00〜24:00" />
        <Field label={t('settings.storeTel')} value={tel} onChangeText={setTel} theme={theme} keyboardType="phone-pad" />
        <Field label={t('settings.storeNote')} value={note} onChangeText={setNote} theme={theme} multiline />

        <View style={s.snsSection}>
          <Text style={[s.snsSectionTitle, { color: theme.text }]}>{t('settings.snsLinks')}</Text>
          {SNS_PLATFORMS.map(p => {
            const link = snsLinks.find(l => l.platform === p.key);
            return (
              <View key={p.key} style={s.snsRow}>
                <View style={s.snsIconLabel}>
                  <MaterialCommunityIcons name={p.icon as any} size={20} color={theme.primary} />
                  <Text style={[s.snsLabel, { color: theme.subtext }]}>{p.label}</Text>
                </View>
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card, flex: 1 }]}
                  value={link?.url ?? ''}
                  onChangeText={v => {
                    setSnsLinks(prev => {
                      const idx = prev.findIndex(l => l.platform === p.key);
                      if (idx >= 0) {
                        const next = [...prev];
                        next[idx] = { ...next[idx], url: v };
                        return next;
                      }
                      return [...prev, { platform: p.key, url: v }];
                    });
                  }}
                  placeholder={p.placeholder}
                  placeholderTextColor={theme.subtext}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </FormModalShell>
  );
}

function Field({
  label,
  value,
  onChangeText,
  theme,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  theme: { text: string; subtext: string; border: string; card: string };
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: theme.subtext }]}>{label}</Text>
      <TextInput
        style={[
          s.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
          multiline && { height: 80, textAlignVertical: 'top' },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.subtext}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerBtn: { fontSize: 15, fontWeight: '600' },
  body: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 32 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  snsSection: { marginTop: 8, marginBottom: 16 },
  snsSectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  snsRow: { marginBottom: 12 },
  snsIconLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  snsLabel: { fontSize: 13, fontWeight: '600', marginLeft: 6 },
});
