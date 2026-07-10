import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { THEMES } from '../types';
import TermsOfUseModal from '../components/TermsOfUseModal';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import ContactFormModal from '../components/ContactFormModal';
import DeleteAccountModal from '../components/DeleteAccountModal';
import StoreProfileModal from '../components/StoreProfileModal';
import PcWorkModal from '../components/PcWorkModal';
import CustomerListModal from '../components/CustomerListModal';
import { ShiftReminderModal } from '../components/ShiftReminderModal';
import appJson from '../../app.json';

export function SettingsScreen() {
  const { theme, themeKey, setThemeKey } = useTheme();
  const { t } = useLanguage();
  const { signOut } = useAuth();
  const { tenant } = useTenant();
  const insets = useSafeAreaInsets();

  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPcWork, setShowPcWork] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const [showShiftReminder, setShowShiftReminder] = useState(false);

  const handleSignOut = useCallback(() => {
    Alert.alert(t('settings.signOutConfirmTitle'), t('settings.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.signOut'), style: 'destructive', onPress: () => signOut() },
    ]);
  }, [t, signOut]);

  const themeKeys = Object.keys(THEMES);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: 16 }}
      >
        {/* 店舗プロフィール */}
        <Text style={[s.sectionHeader, { color: theme.subtext }]}>
          {t('settings.sectionStore')}
        </Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity style={s.row} onPress={() => setShowProfile(true)}>
            <MaterialCommunityIcons name="store" size={20} color={theme.primary} />
            <View style={s.rowContent}>
              <Text style={[s.rowLabel, { color: theme.text }]}>
                {tenant?.name ?? t('settings.storeName')}
              </Text>
              <Text style={[s.rowSub, { color: theme.subtext }]}>
                {tenant?.genre || t('settings.storeGenrePlaceholder')}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        {/* シフト */}
        <Text style={[s.sectionHeader, { color: theme.subtext }]}>
          {t('settings.sectionShift')}
        </Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity style={s.row} onPress={() => setShowShiftReminder(true)}>
            <MaterialCommunityIcons name="bell-ring-outline" size={20} color={theme.primary} />
            <View style={s.rowContent}>
              <Text style={[s.rowLabel, { color: theme.text }]}>{t('shiftReminder.title')}</Text>
              <Text style={[s.rowSub, { color: theme.subtext }]}>{t('settings.shiftReminderSub')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        {/* 顧客管理 */}
        <Text style={[s.sectionHeader, { color: theme.subtext }]}>
          {t('settings.sectionCustomer')}
        </Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity style={s.row} onPress={() => setShowCustomers(true)}>
            <MaterialCommunityIcons name="account-group" size={20} color={theme.primary} />
            <View style={s.rowContent}>
              <Text style={[s.rowLabel, { color: theme.text }]}>{t('customer.title')}</Text>
              <Text style={[s.rowSub, { color: theme.subtext }]}>{t('customer.settingsSub')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        {/* 連携（PCで作業＝§24） */}
        <Text style={[s.sectionHeader, { color: theme.subtext }]}>
          {t('settings.sectionLink')}
        </Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity style={s.row} onPress={() => setShowPcWork(true)}>
            <MaterialCommunityIcons name="monitor" size={20} color={theme.primary} />
            <View style={s.rowContent}>
              <Text style={[s.rowLabel, { color: theme.text }]}>{t('settings.pcWork')}</Text>
              <Text style={[s.rowSub, { color: theme.subtext }]}>{t('settings.pcWorkSub')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        {/* 法務 */}
        <Text style={[s.sectionHeader, { color: theme.subtext }]}>
          {t('settings.sectionLegal')}
        </Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <RowButton
            icon="file-document-outline"
            label={t('settings.terms')}
            theme={theme}
            onPress={() => setShowTerms(true)}
          />
          <View style={[s.divider, { backgroundColor: theme.border }]} />
          <RowButton
            icon="shield-lock-outline"
            label={t('settings.privacy')}
            theme={theme}
            onPress={() => setShowPrivacy(true)}
          />
          <View style={[s.divider, { backgroundColor: theme.border }]} />
          <RowButton
            icon="email-outline"
            label={t('contact.label')}
            theme={theme}
            onPress={() => setShowContact(true)}
          />
        </View>

        {/* テーマ */}
        <Text style={[s.sectionHeader, { color: theme.subtext }]}>
          {t('settings.sectionAppearance')}
        </Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[s.rowLabel, { color: theme.text, padding: 14, paddingBottom: 8 }]}>
            {t('settings.theme')}
          </Text>
          <View style={s.themeGrid}>
            {themeKeys.map((k) => (
              <TouchableOpacity
                key={k}
                style={[
                  s.themeDot,
                  { backgroundColor: THEMES[k].primary },
                  k === themeKey && s.themeDotSelected,
                ]}
                onPress={() => setThemeKey(k)}
              />
            ))}
          </View>
        </View>

        {/* アカウント */}
        <Text style={[s.sectionHeader, { color: theme.subtext }]}>
          {t('settings.sectionAccount')}
        </Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <RowButton
            icon="logout"
            label={t('settings.signOut')}
            theme={theme}
            onPress={handleSignOut}
            danger={false}
          />
          <View style={[s.divider, { backgroundColor: theme.border }]} />
          <RowButton
            icon="account-remove"
            label={t('settings.deleteAccount')}
            theme={theme}
            onPress={() => setShowDelete(true)}
            danger={true}
          />
        </View>

        {/* アプリ情報 */}
        <Text style={[s.sectionHeader, { color: theme.subtext }]}>
          {t('settings.sectionAbout')}
        </Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={s.row}>
            <MaterialCommunityIcons name="information-outline" size={20} color={theme.primary} />
            <View style={s.rowContent}>
              <Text style={[s.rowLabel, { color: theme.text }]}>{t('settings.version')}</Text>
            </View>
            <Text style={[s.rowDetail, { color: theme.subtext }]}>
              {appJson.expo.version}
            </Text>
          </View>
        </View>
      </ScrollView>

      <TermsOfUseModal visible={showTerms} onClose={() => setShowTerms(false)} />
      <PrivacyPolicyModal visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <ContactFormModal visible={showContact} onClose={() => setShowContact(false)} />
      <DeleteAccountModal visible={showDelete} onClose={() => setShowDelete(false)} />
      <StoreProfileModal visible={showProfile} onClose={() => setShowProfile(false)} />
      <PcWorkModal visible={showPcWork} onClose={() => setShowPcWork(false)} />
      <CustomerListModal visible={showCustomers} onClose={() => setShowCustomers(false)} />
      {tenant && (
        <ShiftReminderModal
          visible={showShiftReminder}
          onClose={() => setShowShiftReminder(false)}
          theme={theme}
          t={t}
          tenantId={tenant.id}
        />
      )}
    </View>
  );
}

function RowButton({
  icon,
  label,
  theme,
  onPress,
  detail,
  danger,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  theme: { primary: string; text: string; subtext: string };
  onPress: () => void;
  detail?: string;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={20} color={danger ? '#DC2626' : theme.primary} />
      <View style={s.rowContent}>
        <Text style={[s.rowLabel, { color: danger ? '#DC2626' : theme.text }]}>{label}</Text>
      </View>
      {detail ? (
        <Text style={[s.rowDetail, { color: theme.subtext }]}>{detail}</Text>
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.subtext} />
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  sectionHeader: { fontSize: 13, fontWeight: '600', marginLeft: 20, marginTop: 20, marginBottom: 8 },
  card: { marginHorizontal: 16, borderRadius: 12, borderWidth: 0.5, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15 },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowDetail: { fontSize: 13 },
  divider: { height: 0.5, marginLeft: 46 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingBottom: 14, gap: 12 },
  themeDot: { width: 32, height: 32, borderRadius: 16 },
  themeDotSelected: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4 },
});
