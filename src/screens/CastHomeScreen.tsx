import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';

type ShiftRow = { id: string; date: string; start_at: string; end_at: string };
type PayrollRow = { date: string; total_pay: number; minutes_worked: number };

export function CastHomeScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { signOut, roleResult } = useAuth();

  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [castName, setCastName] = useState('');
  const [loading, setLoading] = useState(true);

  const castId = roleResult?.role === 'cast' ? roleResult.castId : null;

  useEffect(() => {
    if (!castId) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const monthStart = today.slice(0, 7) + '-01';

        const [nameRes, shiftRes, payRes] = await Promise.all([
          supabase.from('ky_casts').select('name').eq('id', castId).single(),
          supabase
            .from('ky_shifts')
            .select('id, date, start_at, end_at')
            .eq('cast_id', castId)
            .gte('date', today)
            .order('date')
            .order('start_at')
            .limit(10),
          supabase
            .from('ky_cast_payroll')
            .select('date, total_pay, minutes_worked')
            .eq('cast_id', castId)
            .gte('date', monthStart)
            .order('date'),
        ]);

        if (!active) return;
        if (nameRes.data) setCastName((nameRes.data as { name: string }).name);
        setShifts((shiftRes.data as ShiftRow[] | null) ?? []);
        setPayroll((payRes.data as PayrollRow[] | null) ?? []);
      } catch {
        // silently fail
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [castId]);

  const handleSignOut = useCallback(() => {
    Alert.alert(t('settings.signOutConfirmTitle'), t('castHome.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('castHome.signOut'), style: 'destructive', onPress: () => signOut() },
    ]);
  }, [signOut, t]);

  const totalPay = payroll.reduce((sum, p) => sum + p.total_pay, 0);
  const workedDays = payroll.length;

  return (
    <View style={[st.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      >
        <Text style={[st.header, { color: theme.primary }]}>{t('castHome.title')}</Text>
        {castName ? (
          <Text style={[st.welcome, { color: theme.text }]}>{t('castHome.welcome')}、{castName}</Text>
        ) : null}

        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={[st.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[st.sectionTitle, { color: theme.text }]}>{t('castHome.myShifts')}</Text>
              {shifts.length === 0 ? (
                <Text style={[st.empty, { color: theme.subtext }]}>{t('castHome.noShifts')}</Text>
              ) : (
                shifts.map((s) => (
                  <View key={s.id} style={[st.row, { borderBottomColor: theme.border }]}>
                    <Text style={[st.rowDate, { color: theme.text }]}>{s.date}</Text>
                    <Text style={[st.rowTime, { color: theme.subtext }]}>
                      {s.start_at} – {s.end_at}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={[st.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[st.sectionTitle, { color: theme.text }]}>{t('castHome.myPayroll')}</Text>
              {payroll.length === 0 ? (
                <Text style={[st.empty, { color: theme.subtext }]}>{t('castHome.noPayroll')}</Text>
              ) : (
                <View style={st.payrollSummary}>
                  <Text style={[st.payTotal, { color: theme.primary }]}>
                    {t('castHome.totalPay')}: ¥{totalPay.toLocaleString()}
                  </Text>
                  <Text style={[st.payDays, { color: theme.subtext }]}>
                    {t('castHome.workedDays', { count: workedDays })}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        <TouchableOpacity style={st.signOut} onPress={handleSignOut}>
          <Text style={[st.signOutText, { color: '#D7263D' }]}>{t('castHome.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: { fontSize: 26, fontWeight: '800' },
  welcome: { fontSize: 15, marginTop: 4 },
  section: { marginTop: 24, borderWidth: 1, borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowDate: { fontSize: 15, fontWeight: '600' },
  rowTime: { fontSize: 14 },
  payrollSummary: { alignItems: 'center', paddingVertical: 8 },
  payTotal: { fontSize: 24, fontWeight: '800' },
  payDays: { fontSize: 14, marginTop: 4 },
  signOut: { marginTop: 40, alignItems: 'center', paddingVertical: 12 },
  signOutText: { fontSize: 15, fontWeight: '600' },
});
