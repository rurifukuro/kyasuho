import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { KeyboardDoneBar } from '../components/KeyboardDoneBar';
import CalendarModal from '../components/CalendarModal';
import * as profileService from '../services/castProfile';
import { lookupPostalCode } from '../utils/postalLookup';
import type { CastPersonalInfo, AccountType } from '../types';

export function CastPersonalInfoScreen({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [furigana, setFurigana] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [postalBusy, setPostalBusy] = useState(false);
  const [postalMsg, setPostalMsg] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [nearestStation, setNearestStation] = useState('');
  const [commuteMethod, setCommuteMethod] = useState('');
  const [commuteMinutes, setCommuteMinutes] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [desiredDays, setDesiredDays] = useState('');
  const [desiredHours, setDesiredHours] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showAvailPicker, setShowAvailPicker] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const info = await profileService.fetchPersonalInfo(userId);
        if (!active || !info) return;
        setFullName(info.fullName);
        setFurigana(info.furigana);
        setDateOfBirth(info.dateOfBirth ?? '');
        setGender(info.gender);
        setAddress(info.address);
        setPhone(info.phone);
        setEmail(info.email);
        setEmergencyName(info.emergencyContactName);
        setEmergencyPhone(info.emergencyContactPhone);
        setEmergencyRelation(info.emergencyContactRelation);
        setNearestStation(info.nearestStation);
        setCommuteMethod(info.commuteMethod);
        setCommuteMinutes(info.commuteMinutes != null ? String(info.commuteMinutes) : '');
        setBankName(info.bankName);
        setBankBranch(info.bankBranch);
        setAccountType(info.accountType);
        setAccountNumber(info.accountNumber);
        setAccountHolderName(info.accountHolderName);
        setDesiredDays(info.desiredWorkDaysPerWeek != null ? String(info.desiredWorkDaysPerWeek) : '');
        setDesiredHours(info.desiredHours);
        setAvailableFrom(info.availableFrom ?? '');
        setQualifications(info.qualifications);
        setSpecialNotes(info.specialNotes);
      } catch (e: unknown) {
        console.warn('[kyasuho] fetchPersonalInfo:', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [userId]);

  const handlePostalSearch = useCallback(async () => {
    setPostalBusy(true);
    setPostalMsg('');
    try {
      const result = await lookupPostalCode(postalCode);
      if (!result) {
        setPostalMsg(t('personalInfo.postalNotFound'));
        return;
      }
      setAddress(`〒${postalCode} ${result.prefecture}${result.city}${result.town}`);
    } catch {
      setPostalMsg(t('personalInfo.postalError'));
    } finally {
      setPostalBusy(false);
    }
  }, [postalCode, t]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await profileService.upsertPersonalInfo(userId, {
        fullName,
        furigana,
        dateOfBirth: dateOfBirth || null,
        gender,
        address,
        phone,
        email,
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
        emergencyContactRelation: emergencyRelation,
        nearestStation,
        commuteMethod,
        commuteMinutes: commuteMinutes ? parseInt(commuteMinutes, 10) : null,
        bankName,
        bankBranch,
        accountType,
        accountNumber,
        accountHolderName,
        desiredWorkDaysPerWeek: desiredDays ? parseInt(desiredDays, 10) : null,
        desiredHours,
        availableFrom: availableFrom || null,
        qualifications,
        specialNotes,
      });
      Alert.alert('', t('personalInfo.saved'));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setSaving(false);
    }
  }, [
    userId, fullName, furigana, dateOfBirth, gender, address, phone, email,
    emergencyName, emergencyPhone, emergencyRelation,
    nearestStation, commuteMethod, commuteMinutes,
    bankName, bankBranch, accountType, accountNumber, accountHolderName,
    desiredDays, desiredHours, availableFrom, qualifications, specialNotes, t,
  ]);

  return (
    <View style={[st.root, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[st.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: theme.text }]}>{t('personalInfo.title')}</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={st.content}>
            <Text style={[st.desc, { color: theme.subtext }]}>{t('personalInfo.desc')}</Text>

            <SectionHeader title={t('personalInfo.sectionBasic')} theme={theme} />
            <Field label={t('personalInfo.fullName')} value={fullName} onChange={setFullName} theme={theme} />
            <Field label={t('personalInfo.furigana')} value={furigana} onChange={setFurigana} theme={theme} />
            <DatePickerField label={t('personalInfo.dateOfBirth')} value={dateOfBirth} onPress={() => setShowDobPicker(true)} theme={theme} />
            <Field label={t('personalInfo.gender')} value={gender} onChange={setGender} theme={theme} />
            <View style={st.field}>
              <Text style={[st.fieldLabel, { color: theme.text }]}>{t('personalInfo.postalCode')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={[st.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card, width: 140 }]}
                  value={postalCode}
                  onChangeText={setPostalCode}
                  placeholder="123-4567"
                  placeholderTextColor={theme.subtext}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={[st.postalSearchBtn, { backgroundColor: theme.primary, opacity: postalBusy ? 0.5 : 1 }]}
                  onPress={handlePostalSearch}
                  disabled={postalBusy}
                >
                  <Text style={st.postalSearchBtnText}>{postalBusy ? t('personalInfo.postalSearching') : t('personalInfo.postalSearch')}</Text>
                </TouchableOpacity>
              </View>
              {postalMsg ? <Text style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{postalMsg}</Text> : null}
            </View>
            <Field label={t('personalInfo.address')} value={address} onChange={setAddress} theme={theme} multiline />
            <Field label={t('personalInfo.phone')} value={phone} onChange={setPhone} theme={theme} keyboardType="phone-pad" />
            <Field label={t('personalInfo.email')} value={email} onChange={setEmail} theme={theme} keyboardType="email-address" />

            <SectionHeader title={t('personalInfo.sectionEmergency')} theme={theme} />
            <Field label={t('personalInfo.emergencyName')} value={emergencyName} onChange={setEmergencyName} theme={theme} />
            <Field label={t('personalInfo.emergencyPhone')} value={emergencyPhone} onChange={setEmergencyPhone} theme={theme} keyboardType="phone-pad" />
            <Field label={t('personalInfo.emergencyRelation')} value={emergencyRelation} onChange={setEmergencyRelation} theme={theme} />

            <SectionHeader title={t('personalInfo.sectionCommute')} theme={theme} />
            <Field label={t('personalInfo.nearestStation')} value={nearestStation} onChange={setNearestStation} theme={theme} />
            <Field label={t('personalInfo.commuteMethod')} value={commuteMethod} onChange={setCommuteMethod} theme={theme} />
            <Field label={t('personalInfo.commuteMinutes')} value={commuteMinutes} onChange={setCommuteMinutes} theme={theme} keyboardType="numeric" />

            <SectionHeader title={t('personalInfo.sectionBank')} theme={theme} />
            <Field label={t('personalInfo.bankName')} value={bankName} onChange={setBankName} theme={theme} />
            <Field label={t('personalInfo.bankBranch')} value={bankBranch} onChange={setBankBranch} theme={theme} />
            <View style={st.accountTypeRow}>
              <Text style={[st.fieldLabel, { color: theme.text }]}>{t('personalInfo.accountType')}</Text>
              <View style={st.accountTypeBtns}>
                {(['savings', 'checking'] as const).map((typ) => (
                  <TouchableOpacity
                    key={typ}
                    style={[
                      st.accountTypeBtn,
                      { borderColor: accountType === typ ? theme.primary : theme.border },
                      accountType === typ && { backgroundColor: theme.primary + '15' },
                    ]}
                    onPress={() => setAccountType(accountType === typ ? '' : typ)}
                  >
                    <Text style={{ color: accountType === typ ? theme.primary : theme.text, fontSize: 13 }}>
                      {typ === 'savings' ? t('personalInfo.accountTypeSavings') : t('personalInfo.accountTypeChecking')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Field label={t('personalInfo.accountNumber')} value={accountNumber} onChange={setAccountNumber} theme={theme} keyboardType="numeric" />
            <Field label={t('personalInfo.accountHolderName')} value={accountHolderName} onChange={setAccountHolderName} theme={theme} />

            <SectionHeader title={t('personalInfo.sectionWork')} theme={theme} />
            <Field label={t('personalInfo.desiredDays')} value={desiredDays} onChange={setDesiredDays} theme={theme} keyboardType="numeric" />
            <Field label={t('personalInfo.desiredHours')} value={desiredHours} onChange={setDesiredHours} theme={theme} placeholder={t('personalInfo.desiredHoursPlaceholder')} />
            <DatePickerField label={t('personalInfo.availableFrom')} value={availableFrom} onPress={() => setShowAvailPicker(true)} theme={theme} />
            <Field label={t('personalInfo.qualifications')} value={qualifications} onChange={setQualifications} theme={theme} multiline />
            <Field label={t('personalInfo.specialNotes')} value={specialNotes} onChange={setSpecialNotes} theme={theme} multiline />

            <TouchableOpacity
              style={[st.saveBtn, { backgroundColor: theme.primary }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={st.saveBtnText}>{t('common.save')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      <KeyboardDoneBar theme={theme} />
      <CalendarModal
        visible={showDobPicker}
        value={dateOfBirth}
        onSelect={setDateOfBirth}
        onClose={() => setShowDobPicker(false)}
        maximumDate={new Date()}
      />
      <CalendarModal
        visible={showAvailPicker}
        value={availableFrom}
        onSelect={setAvailableFrom}
        onClose={() => setShowAvailPicker(false)}
      />
    </View>
  );
}

function SectionHeader({ title, theme }: { title: string; theme: { text: string; border: string } }) {
  return (
    <View style={[st.sectionHeader, { borderBottomColor: theme.border }]}>
      <Text style={[st.sectionTitle, { color: theme.text }]}>{title}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  theme,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  theme: { text: string; subtext: string; border: string; card: string };
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
}) {
  return (
    <View style={st.field}>
      <Text style={[st.fieldLabel, { color: theme.text }]}>{label}</Text>
      <TextInput
        style={[
          multiline ? st.inputMulti : st.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.subtext}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="none"
      />
    </View>
  );
}

function DatePickerField({
  label,
  value,
  onPress,
  theme,
}: {
  label: string;
  value: string;
  onPress: () => void;
  theme: { text: string; subtext: string; border: string; card: string };
}) {
  return (
    <View style={st.field}>
      <Text style={[st.fieldLabel, { color: theme.text }]}>{label}</Text>
      <TouchableOpacity
        style={[st.input, { borderColor: theme.border, backgroundColor: theme.card, justifyContent: 'center' }]}
        onPress={onPress}
      >
        <Text style={{ color: value ? theme.text : theme.subtext, fontSize: 15 }}>
          {value || '—'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 60 },
  desc: { fontSize: 13, marginBottom: 8 },
  sectionHeader: { marginTop: 20, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  field: { marginTop: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  inputMulti: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 70, textAlignVertical: 'top' },
  accountTypeRow: { marginTop: 10 },
  accountTypeBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  accountTypeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  saveBtn: { marginTop: 28, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  postalSearchBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  postalSearchBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
