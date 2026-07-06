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
import { supabase } from '../config/supabase';
import type { TKey } from '../i18n';

type Mode = 'signin' | 'signup';
type AccountType = 'owner' | 'cast';

function errorKey(message: string): TKey {
  const m = message.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) {
    return 'auth.error.invalidCredentials';
  }
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) {
    return 'auth.error.alreadyRegistered';
  }
  if (m.includes('not confirmed')) {
    return 'auth.error.emailNotConfirmed';
  }
  return 'auth.error.generic';
}

export function AuthScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { signIn, signUp, configured } = useAuth();

  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);

  const submit = useCallback(async () => {
    setError(null);
    setInfo(null);
    const mail = email.trim();
    if (!mail) {
      setError(t('auth.error.emailRequired'));
      return;
    }

    if (resetMode) {
      setLoading(true);
      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(mail);
        if (resetError) throw resetError;
        setInfo(t('auth.resetEmailSent'));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        setError(t(errorKey(msg)));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password) {
      setError(t('auth.error.passwordRequired'));
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError(t('auth.error.passwordTooShort'));
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { needsEmailConfirm } = await signUp(mail, password);
        if (needsEmailConfirm) setInfo(t('auth.emailConfirmSent'));
      } else {
        await signIn(mail, password);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setError(t(errorKey(msg)));
    } finally {
      setLoading(false);
    }
  }, [email, password, mode, resetMode, signIn, signUp, t]);

  if (!configured) {
    return (
      <View
        style={[
          s.center,
          { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[s.cardTitle, { color: theme.text }]}>{t('auth.notConfigured.title')}</Text>
          <Text style={[s.cardDesc, { color: theme.subtext }]}>{t('auth.notConfigured.desc')}</Text>
        </View>
      </View>
    );
  }

  if (!accountType) {
    return (
      <View style={[s.root, { backgroundColor: theme.background }]}>
        <View style={[s.scroll, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
          <Text style={[s.appName, { color: theme.primary }]}>{t('app.name')}</Text>
          <Text style={[s.tagline, { color: theme.subtext }]}>{t('app.tagline')}</Text>

          <View style={{ marginTop: 36, gap: 16, paddingHorizontal: 24 }}>
            <TouchableOpacity
              style={[s.roleBtn, { backgroundColor: theme.primary }]}
              onPress={() => setAccountType('owner')}
              activeOpacity={0.85}
            >
              <Text style={s.roleBtnTitle}>{t('auth.role.ownerTitle')}</Text>
              <Text style={s.roleBtnDesc}>{t('auth.role.ownerDesc')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.roleBtn, { backgroundColor: theme.card, borderWidth: 2, borderColor: theme.primary }]}
              onPress={() => setAccountType('cast')}
              activeOpacity={0.85}
            >
              <Text style={[s.roleBtnTitle, { color: theme.primary }]}>{t('auth.role.castTitle')}</Text>
              <Text style={[s.roleBtnDesc, { color: theme.subtext }]}>{t('auth.role.castDesc')}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
          <Text style={[s.appName, { color: theme.primary }]}>{t('app.name')}</Text>
          <Text style={[s.tagline, { color: theme.subtext }]}>
            {accountType === 'owner' ? t('auth.role.ownerTitle') : t('auth.role.castTitle')}
          </Text>

          <View style={[s.form, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.label, { color: theme.subtext }]}>{t('auth.email')}</Text>
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={theme.subtext}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {!resetMode && (
              <>
                <Text style={[s.label, { color: theme.subtext, marginTop: 14 }]}>{t('auth.password')}</Text>
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor={theme.subtext}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />
              </>
            )}

            {error ? <Text style={[s.msg, { color: '#D7263D' }]}>{error}</Text> : null}
            {info ? <Text style={[s.msg, { color: theme.primary }]}>{info}</Text> : null}

            <TouchableOpacity
              style={[s.submit, { backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 }]}
              onPress={submit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.submitText}>
                  {resetMode
                    ? t('auth.resetSubmit')
                    : mode === 'signup'
                      ? t('auth.submit.signup')
                      : t('auth.submit.signin')}
                </Text>
              )}
            </TouchableOpacity>

            {!resetMode && (
              <TouchableOpacity
                style={s.switch}
                onPress={() => {
                  setMode(mode === 'signup' ? 'signin' : 'signup');
                  setError(null);
                  setInfo(null);
                }}
                disabled={loading}
              >
                <Text style={[s.switchText, { color: theme.primary }]}>
                  {mode === 'signup' ? t('auth.switchToSignin') : t('auth.switchToSignup')}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={s.switch}
              onPress={() => {
                setResetMode(!resetMode);
                setError(null);
                setInfo(null);
              }}
              disabled={loading}
            >
              <Text style={[s.resetText, { color: theme.subtext }]}>
                {resetMode ? t('auth.backToLogin') : t('auth.forgotPassword')}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={s.backBtn}
            onPress={() => {
              setAccountType(null);
              setError(null);
              setInfo(null);
              setResetMode(false);
              setMode('signin');
            }}
          >
            <Text style={[s.switchText, { color: theme.subtext }]}>{t('auth.backToRoleSelect')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <KeyboardDoneBar theme={theme} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  appName: { fontSize: 30, fontWeight: '800', textAlign: 'center' },
  tagline: { fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  form: { borderWidth: 1, borderRadius: 16, padding: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  msg: { fontSize: 13, marginTop: 14, fontWeight: '600' },
  submit: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  switch: { marginTop: 16, alignItems: 'center' },
  switchText: { fontSize: 14, fontWeight: '600' },
  resetText: { fontSize: 13, textDecorationLine: 'underline' },
  card: { borderWidth: 1, borderRadius: 16, padding: 24, maxWidth: 420 },
  cardTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  cardDesc: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  roleBtn: { borderRadius: 16, padding: 20, alignItems: 'center' },
  roleBtnTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  roleBtnDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6, textAlign: 'center' },
  backBtn: { marginTop: 20, alignItems: 'center' },
});
