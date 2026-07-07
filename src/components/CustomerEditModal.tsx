import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { FormModalShell } from './common/FormModalShell';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { guardFields } from '../utils/contentGuard';
import type { Customer } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSave: (fields: {
    name: string;
    nameKana: string;
    contact: string;
    personaNotes: string;
    internalNotes: string;
    isBanned: boolean;
    banReason: string;
  }) => Promise<void>;
  onDelete?: () => void;
};

export default function CustomerEditModal({ visible, onClose, customer, onSave, onDelete }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [nameKana, setNameKana] = useState('');
  const [contact, setContact] = useState('');
  const [personaNotes, setPersonaNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (customer) {
        setName(customer.name);
        setNameKana(customer.nameKana);
        setContact(customer.contact);
        setPersonaNotes(customer.personaNotes);
        setInternalNotes(customer.internalNotes);
        setIsBanned(customer.isBanned);
        setBanReason(customer.banReason);
      } else {
        setName('');
        setNameKana('');
        setContact('');
        setPersonaNotes('');
        setInternalNotes('');
        setIsBanned(false);
        setBanReason('');
      }
    }
  }, [visible, customer]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('customer.nameRequired'));
      return;
    }
    if (!guardFields({ name, personaNotes, internalNotes, banReason }, t)) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        nameKana: nameKana.trim(),
        contact: contact.trim(),
        personaNotes: personaNotes.trim(),
        internalNotes: internalNotes.trim(),
        isBanned,
        banReason: banReason.trim(),
      });
      onClose();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setSaving(false);
    }
  }, [name, nameKana, contact, personaNotes, internalNotes, isBanned, banReason, t, onSave, onClose]);

  const handleDelete = useCallback(() => {
    if (!onDelete) return;
    Alert.alert(t('customer.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: onDelete },
    ]);
  }, [t, onDelete]);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[s.headerBtn, { color: theme.subtext }]}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>
          {customer ? t('customer.edit') : t('customer.add')}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[s.headerBtn, { color: theme.primary, opacity: saving ? 0.4 : 1 }]}>
            {t('settings.save')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Field label={t('customer.name')} value={name} onChangeText={setName} theme={theme} />
        <Field label={t('customer.nameKana')} value={nameKana} onChangeText={setNameKana} theme={theme} placeholder={t('customer.nameKanaPlaceholder')} />
        <Field label={t('customer.contact')} value={contact} onChangeText={setContact} theme={theme} placeholder={t('customer.contactPlaceholder')} />
        <Field label={t('customer.personaNotes')} value={personaNotes} onChangeText={setPersonaNotes} theme={theme} placeholder={t('customer.personaNotesPlaceholder')} multiline />
        <Field label={t('customer.internalNotes')} value={internalNotes} onChangeText={setInternalNotes} theme={theme} placeholder={t('customer.internalNotesPlaceholder')} multiline />

        {/* 出禁 */}
        <View style={[s.banSection, { borderColor: theme.border }]}>
          <View style={s.banRow}>
            <Text style={[s.banLabel, { color: isBanned ? '#DC2626' : theme.text }]}>
              {t('customer.isBanned')}
            </Text>
            <Switch
              value={isBanned}
              onValueChange={setIsBanned}
              trackColor={{ false: theme.border, true: '#FCA5A5' }}
              thumbColor={isBanned ? '#DC2626' : '#f4f3f4'}
            />
          </View>
          {isBanned && (
            <Field label={t('customer.banReason')} value={banReason} onChangeText={setBanReason} theme={theme} placeholder={t('customer.banReasonPlaceholder')} multiline />
          )}
        </View>

        {/* 統計（編集時のみ・読取専用） */}
        {customer && (
          <View style={[s.statsSection, { borderColor: theme.border }]}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>{t('customer.stats')}</Text>
            <StatRow label={t('customer.stampCount')} value={String(customer.stampCount)} theme={theme} />
            <StatRow label={t('customer.totalVisits')} value={t('customer.visitsUnit', { count: String(customer.totalVisits) })} theme={theme} />
            <StatRow label={t('customer.lastVisit')} value={customer.lastVisitDate ?? '—'} theme={theme} />
          </View>
        )}

        {/* 削除（編集時のみ） */}
        {customer && onDelete && (
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
            <Text style={s.deleteBtnText}>{t('customer.delete')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </FormModalShell>
  );
}

function Field({
  label, value, onChangeText, theme, placeholder, multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  theme: { text: string; subtext: string; border: string; card: string };
  placeholder?: string;
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
        multiline={multiline}
      />
    </View>
  );
}

function StatRow({ label, value, theme }: { label: string; value: string; theme: { text: string; subtext: string } }) {
  return (
    <View style={s.statRow}>
      <Text style={[s.statLabel, { color: theme.subtext }]}>{label}</Text>
      <Text style={[s.statValue, { color: theme.text }]}>{value}</Text>
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
  banSection: { borderTopWidth: 0.5, marginTop: 8, paddingTop: 16, marginBottom: 16 },
  banRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  banLabel: { fontSize: 15, fontWeight: '700' },
  statsSection: { borderTopWidth: 0.5, marginTop: 8, paddingTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  statLabel: { fontSize: 14 },
  statValue: { fontSize: 14, fontWeight: '600' },
  deleteBtn: { marginTop: 24, alignItems: 'center', paddingVertical: 14 },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
});
