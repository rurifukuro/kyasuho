import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage, LANGUAGE_OPTIONS } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import TermsOfUseModal from '../components/TermsOfUseModal';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import ContactFormModal from '../components/ContactFormModal';
import DeleteAccountModal from '../components/DeleteAccountModal';
import type { Language } from '../i18n';
import { CUSTOMER_LANGUAGES } from '../i18n';

export function CustomerSettingsScreen() {
  const { theme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [termsVisible, setTermsVisible] = useState(false);
  const [ppVisible, setPpVisible] = useState(false);
  const [contactVisible, setContactVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const handleSignOut = useCallback(() => {
    Alert.alert(t('settings.signOutConfirmTitle'), t('settings.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.signOut'), style: 'destructive', onPress: () => signOut() },
    ]);
  }, [t, signOut]);

  const handleLanguageChange = useCallback(async (lang: Language) => {
    await setLanguage(lang);
  }, [setLanguage]);

  const customerLangOptions = LANGUAGE_OPTIONS.filter(
    (opt) => CUSTOMER_LANGUAGES.includes(opt.code),
  );

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <Text style={[s.headerTitle, { color: theme.primary }]}>{t('customer.settingsTitle')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <Text style={[s.sectionTitle, { color: theme.subtext }]}>{t('customer.settingsLanguage')}</Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {customerLangOptions.map((opt) => (
            <TouchableOpacity
              key={opt.code}
              style={[s.row, { borderBottomColor: theme.border }]}
              onPress={() => handleLanguageChange(opt.code)}
              activeOpacity={0.7}
            >
              <Text style={[s.rowLabel, { color: theme.text }]}>{opt.label}</Text>
              {language === opt.code && (
                <MaterialCommunityIcons name="check" size={20} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.sectionTitle, { color: theme.subtext }]}>{t('customer.settingsLegal')}</Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity style={[s.row, { borderBottomColor: theme.border }]} onPress={() => setTermsVisible(true)}>
            <Text style={[s.rowLabel, { color: theme.text }]}>{t('settings.terms')}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.row, { borderBottomColor: theme.border }]} onPress={() => setPpVisible(true)}>
            <Text style={[s.rowLabel, { color: theme.text }]}>{t('settings.privacy')}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.row, { borderBottomColor: theme.border }]} onPress={() => setContactVisible(true)}>
            <Text style={[s.rowLabel, { color: theme.text }]}>{t('customer.settingsContact')}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        <Text style={[s.sectionTitle, { color: theme.subtext }]}>{t('customer.settingsAccount')}</Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity style={[s.row, { borderBottomColor: theme.border }]} onPress={handleSignOut}>
            <Text style={[s.rowLabel, { color: theme.text }]}>{t('settings.signOut')}</Text>
            <MaterialCommunityIcons name="logout" size={20} color={theme.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={s.row} onPress={() => setDeleteVisible(true)}>
            <Text style={[s.rowLabel, { color: '#D7263D' }]}>{t('settings.deleteAccount')}</Text>
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#D7263D" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TermsOfUseModal visible={termsVisible} onClose={() => setTermsVisible(false)} />
      <PrivacyPolicyModal visible={ppVisible} onClose={() => setPpVisible(false)} />
      <ContactFormModal visible={contactVisible} onClose={() => setContactVisible(false)} />
      <DeleteAccountModal visible={deleteVisible} onClose={() => setDeleteVisible(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginTop: 24, marginBottom: 8, marginLeft: 20, textTransform: 'uppercase' },
  card: { marginHorizontal: 16, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 16 },
});
