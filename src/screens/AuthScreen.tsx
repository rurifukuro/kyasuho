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
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { KeyboardDoneBar } from '../components/KeyboardDoneBar';
import type { TKey } from '../i18n';

type Mode = 'signin' | 'signup';

// Supabase の英語エラーを代表ケースだけ日本語キーへ寄せる（その他は generic）。
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

  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setError(null);
    setInfo(null);
    const mail = email.trim();
    if (!mail) {
      setError(t('auth.error.emailRequired'));
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
  }, [email, password, mode, signIn, signUp, t]);

  // .env 未設定の案内（クラッシュさせない）
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
          <Text style={[s.tagline, { color: theme.subtext }]}>{t('app.tagline')}</Text>

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
                  {mode === 'signup' ? t('auth.submit.signup') : t('auth.submit.signin')}
                </Text>
              )}
            </TouchableOpacity>

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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* KeyboardDoneBar は KAV の外＝兄弟に置く（メモリ鉄則・二重カウント防止） */}
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
  card: { borderWidth: 1, borderRadius: 16, padding: 24, maxWidth: 420 },
  cardTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  cardDesc: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
