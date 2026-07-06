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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { CastPersonalInfoScreen } from './CastPersonalInfoScreen';

type ShiftRow = { id: string; date: string; start_at: string; end_at: string };
type PayrollRow = {
  date: string;
  total_pay: number;
  minutes_worked: number;
  base_pay: number;
  nomination_count: number;
  nomination_back: number;
  drink_count: number;
  drink_back: number;
  other_back: number;
  deductions: number;
};

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${y}年${m}月`;
}

function minutesToHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${pad2(m)}`;
}

export function CastHomeScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { signOut, roleResult } = useAuth();

  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [castName, setCastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  });
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);

  const castId = roleResult?.role === 'cast' ? roleResult.castId : null;

  useEffect(() => {
    if (!castId) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);

        const [nameRes, shiftRes] = await Promise.all([
          supabase.from('ky_casts').select('name').eq('id', castId).single(),
          supabase
            .from('ky_shifts')
            .select('id, date, start_at, end_at')
            .eq('cast_id', castId)
            .gte('date', today)
            .order('date')
            .order('start_at')
            .limit(10),
        ]);

        if (!active) return;
        if (nameRes.data) setCastName((nameRes.data as { name: string }).name);
        setShifts((shiftRes.data as ShiftRow[] | null) ?? []);
      } catch {
        // silently fail
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [castId]);

  const loadPayroll = useCallback(async () => {
    if (!castId) return;
    setPayrollLoading(true);
    try {
      const monthStart = payrollMonth + '-01';
      const monthEnd = payrollMonth + '-31';
      const { data } = await supabase
        .from('ky_cast_payroll')
        .select('date, total_pay, minutes_worked, base_pay, nomination_count, nomination_back, drink_count, drink_back, other_back, deductions')
        .eq('cast_id', castId)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date');
      setPayroll((data as PayrollRow[] | null) ?? []);
    } catch {
      // silently fail
    } finally {
      setPayrollLoading(false);
    }
  }, [castId, payrollMonth]);

  useEffect(() => {
    void loadPayroll();
  }, [loadPayroll]);

  const handleSignOut = useCallback(() => {
    Alert.alert(t('settings.signOutConfirmTitle'), t('castHome.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('castHome.signOut'), style: 'destructive', onPress: () => signOut() },
    ]);
  }, [signOut, t]);

  const totalPay = payroll.reduce((sum, p) => sum + p.total_pay, 0);
  const totalMinutes = payroll.reduce((sum, p) => sum + p.minutes_worked, 0);
  const workedDays = payroll.length;

  if (showPersonalInfo) {
    return <CastPersonalInfoScreen onBack={() => setShowPersonalInfo(false)} />;
  }

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
            {/* 出勤予定 */}
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

            {/* 給与明細 */}
            <View style={[st.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[st.sectionTitle, { color: theme.text }]}>{t('castHome.myPayroll')}</Text>

              {/* 月切替 */}
              <View style={st.monthNav}>
                <TouchableOpacity onPress={() => setPayrollMonth(shiftMonth(payrollMonth, -1))}>
                  <MaterialCommunityIcons name="chevron-left" size={28} color={theme.primary} />
                </TouchableOpacity>
                <Text style={[st.monthLabel, { color: theme.text }]}>{monthLabel(payrollMonth)}</Text>
                <TouchableOpacity onPress={() => setPayrollMonth(shiftMonth(payrollMonth, 1))}>
                  <MaterialCommunityIcons name="chevron-right" size={28} color={theme.primary} />
                </TouchableOpacity>
              </View>

              {payrollLoading ? (
                <ActivityIndicator color={theme.primary} style={{ marginVertical: 12 }} />
              ) : payroll.length === 0 ? (
                <Text style={[st.empty, { color: theme.subtext }]}>{t('castHome.noPayroll')}</Text>
              ) : (
                <>
                  <View style={st.payrollSummary}>
                    <Text style={[st.payTotal, { color: theme.primary }]}>
                      ¥{totalPay.toLocaleString()}
                    </Text>
                    <Text style={[st.payDays, { color: theme.subtext }]}>
                      {t('castHome.workedDays', { count: String(workedDays) })} / {minutesToHM(totalMinutes)}
                    </Text>
                  </View>

                  {/* 日別明細 */}
                  {payroll.map((p) => {
                    const expanded = expandedDate === p.date;
                    return (
                      <View key={p.date}>
                        <TouchableOpacity
                          style={[st.payrollDayRow, { borderBottomColor: theme.border }]}
                          onPress={() => setExpandedDate(expanded ? null : p.date)}
                          activeOpacity={0.7}
                        >
                          <Text style={[st.rowDate, { color: theme.text }]}>{p.date}</Text>
                          <Text style={[st.rowPay, { color: theme.primary }]}>
                            ¥{p.total_pay.toLocaleString()}
                          </Text>
                          <MaterialCommunityIcons
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color={theme.subtext}
                          />
                        </TouchableOpacity>
                        {expanded && (
                          <View style={[st.payrollDetail, { backgroundColor: theme.background }]}>
                            <PayrollDetailLine label={t('payroll.workTime')} value={minutesToHM(p.minutes_worked)} theme={theme} />
                            <PayrollDetailLine label={t('payroll.basePay')} value={`¥${p.base_pay.toLocaleString()}`} theme={theme} />
                            <PayrollDetailLine label={t('payroll.nominationBack')} value={`${p.nomination_count}件 ¥${p.nomination_back.toLocaleString()}`} theme={theme} />
                            <PayrollDetailLine label={t('payroll.drinkBack')} value={`${p.drink_count}杯 ¥${p.drink_back.toLocaleString()}`} theme={theme} />
                            {p.other_back > 0 && (
                              <PayrollDetailLine label={t('payroll.otherBack')} value={`¥${p.other_back.toLocaleString()}`} theme={theme} />
                            )}
                            {p.deductions > 0 && (
                              <PayrollDetailLine label={t('payroll.deductions')} value={`-¥${p.deductions.toLocaleString()}`} theme={theme} highlight />
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              )}
            </View>
          </>
        )}

        {/* 個人情報 */}
        <TouchableOpacity
          style={[st.profileBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => setShowPersonalInfo(true)}
        >
          <MaterialCommunityIcons name="account-edit" size={20} color={theme.primary} />
          <Text style={[st.profileBtnText, { color: theme.primary }]}>{t('personalInfo.title')}</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={theme.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={st.signOut} onPress={handleSignOut}>
          <Text style={[st.signOutText, { color: '#D7263D' }]}>{t('castHome.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function PayrollDetailLine({
  label,
  value,
  theme,
  highlight,
}: {
  label: string;
  value: string;
  theme: { text: string; subtext: string };
  highlight?: boolean;
}) {
  return (
    <View style={st.detailLine}>
      <Text style={[st.detailLabel, { color: theme.subtext }]}>{label}</Text>
      <Text style={[st.detailValue, { color: highlight ? '#D7263D' : theme.text }]}>{value}</Text>
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
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 },
  monthLabel: { fontSize: 16, fontWeight: '700' },
  payrollSummary: { alignItems: 'center', paddingVertical: 8, marginBottom: 8 },
  payTotal: { fontSize: 24, fontWeight: '800' },
  payDays: { fontSize: 14, marginTop: 4 },
  payrollDayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  rowPay: { flex: 1, textAlign: 'right', fontSize: 15, fontWeight: '700' },
  payrollDetail: { padding: 12, borderRadius: 8, marginBottom: 4 },
  detailLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 13, fontWeight: '600' },
  profileBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 24, padding: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
  profileBtnText: { flex: 1, fontSize: 14, fontWeight: '600' },
  signOut: { marginTop: 24, alignItems: 'center', paddingVertical: 12 },
  signOutText: { fontSize: 15, fontWeight: '600' },
});
