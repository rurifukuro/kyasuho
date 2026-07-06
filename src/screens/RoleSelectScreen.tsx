import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { KeyboardDoneBar } from '../components/KeyboardDoneBar';
import { redeemCastInvite } from '../services/roles';
import { ensureTenant } from '../services/tenants';
import type { TKey } from '../i18n';

export function RoleSelectScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { user, signOut, refreshRole, roleLoading } = useAuth();

  const [showInvite, setShowInvite] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleOwnerSetup = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await ensureTenant(user.id);
      await refreshRole();
    } catch {
      setError(t('role.inviteError.generic'));
    } finally {
      setLoading(false);
    }
  }, [user, refreshRole, t]);

  const handleRedeem = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const result = await redeemCastInvite(trimmed);
      if (!result.ok) {
        const key = `role.inviteError.${result.error}` as TKey;
        setError(t(key));
      } else {
        setInfo(t('role.inviteSuccess'));
        await refreshRole();
      }
    } catch {
      setError(t('role.inviteError.generic'));
    } finally {
      setLoading(false);
    }
  }, [code, refreshRole, t]);

  const handleSignOut = useCallback(() => {
    Alert.alert(t('settings.signOutConfirmTitle'), t('settings.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('role.signOut'), style: 'destructive', onPress: () => signOut() },
    ]);
  }, [signOut, t]);

  if (roleLoading) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[s.loadingText, { color: theme.subtext }]}>{t('role.roleLoading')}</Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            s.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[s.title, { color: theme.primary }]}>{t('role.selectTitle')}</Text>
          <Text style={[s.desc, { color: theme.subtext }]}>{t('role.selectDesc')}</Text>

          <View style={{ marginTop: 28, gap: 16 }}>
            <TouchableOpacity
              style={[s.roleBtn, { backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 }]}
              onPress={handleOwnerSetup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading && !showInvite ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={s.roleBtnTitle}>{t('role.ownerSetup')}</Text>
                  <Text style={s.roleBtnDesc}>{t('role.ownerSetupDesc')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.roleBtn,
                {
                  backgroundColor: showInvite ? theme.card : theme.card,
                  borderWidth: 2,
                  borderColor: theme.primary,
                },
              ]}
              onPress={() => setShowInvite(!showInvite)}
              activeOpacity={0.85}
            >
              <Text style={[s.roleBtnTitle, { color: theme.primary }]}>{t('role.castJoin')}</Text>
              <Text style={[s.roleBtnDesc, { color: theme.subtext }]}>{t('role.castJoinDesc')}</Text>
            </TouchableOpacity>

            {showInvite && (
              <View style={[s.inviteForm, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                  value={code}
                  onChangeText={setCode}
                  placeholder={t('role.inviteCodePlaceholder')}
                  placeholderTextColor={theme.subtext}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!loading}
                />
                {error ? <Text style={[s.msg, { color: '#D7263D' }]}>{error}</Text> : null}
                {info ? <Text style={[s.msg, { color: theme.primary }]}>{info}</Text> : null}
                <TouchableOpacity
                  style={[s.submit, { backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 }]}
                  onPress={handleRedeem}
                  disabled={loading || !code.trim()}
                  activeOpacity={0.85}
                >
                  {loading && showInvite ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.submitText}>{t('role.inviteSubmit')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
            <Text style={[s.signOutText, { color: theme.subtext }]}>{t('role.signOut')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <KeyboardDoneBar />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  desc: { fontSize: 14, textAlign: 'center', marginTop: 6 },
  roleBtn: { borderRadius: 16, padding: 20, alignItems: 'center' },
  roleBtnTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  roleBtnDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6, textAlign: 'center' },
  inviteForm: { borderWidth: 1, borderRadius: 16, padding: 16 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 18, textAlign: 'center', letterSpacing: 2 },
  msg: { fontSize: 13, marginTop: 10, fontWeight: '600', textAlign: 'center' },
  submit: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  signOutBtn: { marginTop: 32, alignItems: 'center' },
  signOutText: { fontSize: 14, textDecorationLine: 'underline' },
});
