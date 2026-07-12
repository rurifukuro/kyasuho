import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useLanguage, type TKey } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { CastPersonalInfoScreen } from './CastPersonalInfoScreen';
import { ShiftTimeEditModal } from '../components/ShiftTimeEditModal';
import * as shiftReqService from '../services/shiftRequests';
import * as timecardService from '../services/timecard';
import type { ShiftRequest, CastShiftDefault } from '../types';
import type { TodayAttendance } from '../services/timecard';

type ShiftRow = { id: string; date: string; start_at: string; end_at: string };
type PayrollRow = {
  date: string;
  total_pay: number;
  minutes_worked: number;
  base_pay: number;
  nomination_count: number;
  nomination_back: number;
  drink_count: number;
  menu_back: number;
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

function getNextMonthPeriod(): { start: string; end: string; label: string } {
  const now = new Date();
  const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const m = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
  const start = `${y}-${pad2(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${pad2(m + 1)}-${pad2(lastDay)}`;
  const label = `${y}年${m + 1}月`;
  return { start, end, label };
}

type CalendarDay = { date: string; dayNum: number; dow: number; inPeriod: boolean };

function buildCalendarGrid(periodStart: string, periodEnd: string): CalendarDay[] {
  const [sy, sm] = periodStart.split('-').map(Number);
  const firstOfMonth = new Date(sy, sm - 1, 1);
  const startDow = firstOfMonth.getDay();
  const [, , ed] = periodEnd.split('-').map(Number);
  const days: CalendarDay[] = [];
  for (let i = 0; i < startDow; i++) {
    days.push({ date: '', dayNum: 0, dow: i, inPeriod: false });
  }
  for (let d = 1; d <= ed; d++) {
    const dateStr = `${sy}-${pad2(sm)}-${pad2(d)}`;
    const dow = (startDow + d - 1) % 7;
    days.push({ date: dateStr, dayNum: d, dow, inPeriod: true });
  }
  return days;
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

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

  const [shiftDefaults, setShiftDefaults] = useState<CastShiftDefault | null>(null);
  const [defaultStart, setDefaultStart] = useState('18:00');
  const [defaultEnd, setDefaultEnd] = useState('23:00');
  const [defaultSaving, setDefaultSaving] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [customTimes, setCustomTimes] = useState<Map<string, { start: string; end: string }>>(new Map());
  const [existingRequests, setExistingRequests] = useState<ShiftRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance>(null);
  const [punchLoading, setPunchLoading] = useState(false);

  const castId = roleResult?.role === 'cast' ? roleResult.castId : null;
  const tenantId = roleResult?.role === 'cast' ? roleResult.tenantId : null;

  const period = useMemo(() => getNextMonthPeriod(), []);
  const calendarDays = useMemo(() => buildCalendarGrid(period.start, period.end), [period]);

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
      } catch (e) {
        // silently fail: 初期ロードの失敗はUI空表示で自明＝キャストに不要なエラー表示を出さない
        if (__DEV__) console.warn('[kyasuho] CastHomeScreen initial load:', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [castId]);

  useEffect(() => {
    if (!castId) return;
    let active = true;
    (async () => {
      try {
        const att = await timecardService.fetchTodayAttendance(castId);
        if (active) setTodayAttendance(att);
      } catch (e) {
        // silently fail: 打刻取得は表示補助＝失敗しても打刻ボタンは動作する
        if (__DEV__) console.warn('[kyasuho] fetchTodayAttendance:', e);
      }
    })();
    return () => { active = false; };
  }, [castId]);

  const handlePunch = useCallback(async (direction: 'in' | 'out') => {
    const msg = direction === 'in' ? t('timecard.confirmIn') : t('timecard.confirmOut');
    Alert.alert(t('timecard.sectionTitle'), msg, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: direction === 'in' ? t('timecard.punchIn') : t('timecard.punchOut'),
        onPress: async () => {
          setPunchLoading(true);
          try {
            const result = await timecardService.castPunch(direction);
            setTodayAttendance({ checkInAt: result.checkInAt, checkOutAt: result.checkOutAt });
            Alert.alert(direction === 'in' ? t('timecard.punchInDone') : t('timecard.punchOutDone'));
          } catch (err) {
            const message = err instanceof Error ? err.message : '';
            if (message.includes('already_punched_in')) {
              Alert.alert(t('timecard.sectionTitle'), t('timecard.confirmReIn'), [
                { text: t('common.cancel'), style: 'cancel' },
              ]);
            } else {
              Alert.alert(t('timecard.punchError'));
            }
          } finally {
            setPunchLoading(false);
          }
        },
      },
    ]);
  }, [t]);

  useEffect(() => {
    if (!castId || !tenantId) return;
    let active = true;
    (async () => {
      try {
        const [defaults, requests, submission] = await Promise.all([
          shiftReqService.fetchShiftDefaults(tenantId, castId),
          shiftReqService.fetchShiftRequests(castId, period.start, period.end),
          shiftReqService.fetchSubmission(castId, period.start),
        ]);
        if (!active) return;
        if (defaults) {
          setShiftDefaults(defaults);
          setDefaultStart(defaults.startAt);
          setDefaultEnd(defaults.endAt);
        }
        setExistingRequests(requests);
        setSubmitted(!!submission);

        const sel = new Set<string>();
        const cust = new Map<string, { start: string; end: string }>();
        for (const r of requests) {
          sel.add(r.date);
          if (r.timeSource === 'custom') {
            cust.set(r.date, { start: r.startAt, end: r.endAt });
          }
        }
        setSelectedDays(sel);
        setCustomTimes(cust);
      } catch (e) {
        // silently fail: シフト希望の読込失敗は空カレンダー表示＝再操作で再取得
        if (__DEV__) console.warn('[kyasuho] fetchShiftRequests:', e);
      }
    })();
    return () => { active = false; };
  }, [castId, tenantId, period.start, period.end]);

  const loadPayroll = useCallback(async () => {
    if (!castId) return;
    setPayrollLoading(true);
    try {
      const monthStart = payrollMonth + '-01';
      const monthEnd = payrollMonth + '-31';
      const { data } = await supabase
        .from('ky_cast_payroll')
        .select('date, total_pay, minutes_worked, base_pay, nomination_count, nomination_back, drink_count, menu_back, other_back, deductions')
        .eq('cast_id', castId)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date');
      setPayroll((data as PayrollRow[] | null) ?? []);
    } catch (e) {
      // silently fail: 給与明細は閲覧専用＝リロードで再試行可能
      if (__DEV__) console.warn('[kyasuho] loadPayroll:', e);
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

  const handleSaveDefaults = useCallback(async () => {
    if (!castId || !tenantId) return;
    setDefaultSaving(true);
    try {
      await shiftReqService.upsertShiftDefaults(tenantId, castId, defaultStart, defaultEnd);
      setShiftDefaults({ tenantId, castId, startAt: defaultStart, endAt: defaultEnd, updatedAt: '' });
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setDefaultSaving(false);
    }
  }, [castId, tenantId, defaultStart, defaultEnd, t]);

  const handleDayToggle = useCallback((date: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
        setCustomTimes((ct) => {
          const n = new Map(ct);
          n.delete(date);
          return n;
        });
      } else {
        next.add(date);
      }
      return next;
    });
  }, []);

  const handleEditTimeSave = useCallback((startAt: string, endAt: string) => {
    if (!editingDate) return;
    setCustomTimes((prev) => {
      const n = new Map(prev);
      n.set(editingDate, { start: startAt, end: endAt });
      return n;
    });
    setEditingDate(null);
  }, [editingDate]);

  const handleResetToDefault = useCallback(() => {
    if (!editingDate) return;
    setCustomTimes((prev) => {
      const n = new Map(prev);
      n.delete(editingDate);
      return n;
    });
    setEditingDate(null);
  }, [editingDate]);

  const handleSubmit = useCallback(async () => {
    if (!castId || !tenantId) return;
    const approvedDates = new Set(
      existingRequests.filter((r) => r.status === 'approved').map((r) => r.date),
    );
    const days = Array.from(selectedDays)
      .filter((d) => !approvedDates.has(d))
      .sort()
      .map((d) => {
        const custom = customTimes.get(d);
        return {
          date: d,
          startAt: custom ? custom.start : defaultStart,
          endAt: custom ? custom.end : defaultEnd,
          timeSource: (custom ? 'custom' : 'default') as 'default' | 'custom',
        };
      });

    const customCount = days.filter((d) => d.timeSource === 'custom').length;
    const summary = t('shiftSubmit.confirmSummary', {
      period: period.label,
      days: String(days.length),
      custom: String(customCount),
    });

    Alert.alert(t('shiftSubmit.confirmTitle'), summary, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('shiftSubmit.submitBtn'),
        onPress: async () => {
          setSubmitting(true);
          try {
            await shiftReqService.submitShiftRequests(
              tenantId, castId, period.start, period.end, days,
            );
            setSubmitted(true);
            Alert.alert(t('shiftSubmit.submitDone'));
          } catch {
            Alert.alert(t('common.error'));
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  }, [castId, tenantId, selectedDays, customTimes, defaultStart, defaultEnd, existingRequests, period, t]);

  const totalPay = payroll.reduce((sum, p) => sum + p.total_pay, 0);
  const totalMinutes = payroll.reduce((sum, p) => sum + p.minutes_worked, 0);
  const workedDays = payroll.length;
  const hasDefaults = !!shiftDefaults;

  const approvedDates = useMemo(
    () => new Set(existingRequests.filter((r) => r.status === 'approved').map((r) => r.date)),
    [existingRequests],
  );

  if (showPersonalInfo) {
    return <CastPersonalInfoScreen onBack={() => setShowPersonalInfo(false)} />;
  }

  const editTarget = editingDate
    ? {
        date: editingDate,
        start: customTimes.get(editingDate)?.start ?? defaultStart,
        end: customTimes.get(editingDate)?.end ?? defaultEnd,
        isCustom: customTimes.has(editingDate),
      }
    : null;

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
            {/* タイムカード */}
            <TimecardSection
              todayAttendance={todayAttendance}
              punchLoading={punchLoading}
              onPunch={handlePunch}
              theme={theme}
              t={t}
            />

            {/* シフト提出 */}
            <View style={[st.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[st.sectionTitle, { color: theme.text }]}>
                {t('shiftSubmit.sectionTitle')} — {period.label}
              </Text>
              {submitted && (
                <View style={[st.badge, { backgroundColor: theme.primary + '20' }]}>
                  <MaterialCommunityIcons name="check-circle" size={16} color={theme.primary} />
                  <Text style={[st.badgeText, { color: theme.primary }]}>
                    {t('shiftSubmit.alreadySubmitted')}
                  </Text>
                </View>
              )}

              {/* 基本出勤時間 */}
              <View style={[st.defaultCard, { borderColor: theme.border }]}>
                <Text style={[st.defaultLabel, { color: theme.text }]}>
                  {t('shiftSubmit.defaultTimeLabel')}
                </Text>
                <Text style={[st.defaultHint, { color: theme.subtext }]}>
                  {t('shiftSubmit.defaultTimeHint')}
                </Text>
                <View style={st.defaultRow}>
                  <TimeStepperCompact
                    label={t('shiftSubmit.startTime')}
                    value={defaultStart}
                    onChange={setDefaultStart}
                    theme={theme}
                  />
                  <Text style={[st.timeSep, { color: theme.subtext }]}>〜</Text>
                  <TimeStepperCompact
                    label={t('shiftSubmit.endTime')}
                    value={defaultEnd}
                    onChange={setDefaultEnd}
                    theme={theme}
                  />
                </View>
                <TouchableOpacity
                  style={[st.defaultSaveBtn, { backgroundColor: theme.primary }]}
                  onPress={handleSaveDefaults}
                  disabled={defaultSaving}
                >
                  {defaultSaving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={st.defaultSaveBtnText}>{t('common.save')}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* 未設定ガード */}
              {!hasDefaults && (
                <Text style={[st.guardText, { color: '#D7263D' }]}>
                  {t('shiftSubmit.defaultRequired')}
                </Text>
              )}

              {/* カレンダーグリッド */}
              <View style={st.calendarWrap}>
                <View style={st.weekRow}>
                  {WEEKDAY_LABELS.map((w, i) => (
                    <View key={w} style={st.weekCell}>
                      <Text style={[st.weekText, { color: i === 0 ? '#D7263D' : i === 6 ? '#2563EB' : theme.subtext }]}>
                        {w}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={st.dayGrid}>
                  {calendarDays.map((day, idx) => {
                    if (!day.inPeriod) {
                      return <View key={`empty-${idx}`} style={st.dayCell} />;
                    }
                    const isSelected = selectedDays.has(day.date);
                    const isApproved = approvedDates.has(day.date);
                    const isCustom = customTimes.has(day.date);
                    const timeLabel = isSelected
                      ? (isCustom
                        ? `✎ ${customTimes.get(day.date)!.start}-${customTimes.get(day.date)!.end}`
                        : `${defaultStart}-${defaultEnd}`)
                      : '';

                    return (
                      <TouchableOpacity
                        key={day.date}
                        style={[
                          st.dayCell,
                          isSelected && { backgroundColor: theme.primary + '20' },
                          isApproved && { backgroundColor: '#22C55E20' },
                        ]}
                        disabled={!hasDefaults || isApproved}
                        onPress={() => handleDayToggle(day.date)}
                        activeOpacity={0.6}
                      >
                        <Text style={[
                          st.dayNum,
                          { color: isApproved ? '#22C55E' : isSelected ? theme.primary : theme.text },
                          day.dow === 0 && { color: '#D7263D' },
                          day.dow === 6 && { color: '#2563EB' },
                          isSelected && { fontWeight: '800', color: theme.primary },
                          isApproved && { color: '#22C55E' },
                        ]}>
                          {day.dayNum}
                        </Text>
                        {isApproved && (
                          <Text style={st.approvedBadge}>✅</Text>
                        )}
                        {isSelected && !isApproved && (
                          <>
                            <Text style={[st.timeChip, { color: isCustom ? theme.primary : theme.subtext }]} numberOfLines={1}>
                              {timeLabel}
                            </Text>
                            <TouchableOpacity
                              style={st.editBtn}
                              onPress={() => setEditingDate(day.date)}
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            >
                              <MaterialCommunityIcons name="pencil" size={12} color={theme.primary} />
                            </TouchableOpacity>
                          </>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 提出ボタン */}
              <TouchableOpacity
                style={[st.submitBtn, { backgroundColor: hasDefaults ? theme.primary : theme.border }]}
                onPress={handleSubmit}
                disabled={!hasDefaults || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={st.submitBtnText}>{t('shiftSubmit.submitBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>

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
                            <PayrollDetailLine label={t('payroll.menuBack')} value={`¥${p.menu_back.toLocaleString()}`} theme={theme} />
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

      {editTarget && (
        <ShiftTimeEditModal
          visible={!!editingDate}
          onClose={() => setEditingDate(null)}
          onSave={handleEditTimeSave}
          onResetToDefault={handleResetToDefault}
          theme={theme}
          t={t}
          date={editTarget.date}
          initialStart={editTarget.start}
          initialEnd={editTarget.end}
          isCustom={editTarget.isCustom}
        />
      )}
    </View>
  );
}

function TimeStepperCompact({
  label,
  value,
  onChange,
  theme,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  theme: { primary: string; text: string; border: string };
}) {
  const step = (delta: number) => {
    const [h, m] = value.split(':').map(Number);
    let slot = h * 4 + Math.floor(m / 15) + delta;
    if (slot < 0) slot = 0;
    if (slot > 29 * 4 + 3) slot = 29 * 4 + 3;
    const nh = Math.floor(slot / 4);
    const nm = (slot % 4) * 15;
    onChange(`${pad2(nh)}:${pad2(nm)}`);
  };

  return (
    <View style={st.compactStepper}>
      <Text style={[st.compactLabel, { color: theme.text }]}>{label}</Text>
      <View style={st.compactControls}>
        <TouchableOpacity onPress={() => step(-1)}>
          <MaterialCommunityIcons name="minus-circle-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[st.compactValue, { color: theme.text }]}>{value}</Text>
        <TouchableOpacity onPress={() => step(1)}>
          <MaterialCommunityIcons name="plus-circle-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>
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

function TimecardSection({
  todayAttendance,
  punchLoading,
  onPunch,
  theme,
  t,
}: {
  todayAttendance: TodayAttendance;
  punchLoading: boolean;
  onPunch: (direction: 'in' | 'out') => void;
  theme: { primary: string; text: string; subtext: string; card: string; border: string; background: string };
  t: (key: TKey) => string;
}) {
  const hasIn = !!todayAttendance?.checkInAt;
  const hasOut = !!todayAttendance?.checkOutAt;

  let statusLabel: string;
  let statusColor: string;
  let statusIcon: 'clock-outline' | 'clock-check' | 'clock-remove';
  if (!hasIn) {
    statusLabel = t('timecard.notPunchedIn');
    statusColor = theme.subtext;
    statusIcon = 'clock-outline';
  } else if (!hasOut) {
    statusLabel = `${t('timecard.working')} ${todayAttendance!.checkInAt}〜`;
    statusColor = '#22C55E';
    statusIcon = 'clock-check';
  } else {
    statusLabel = `${t('timecard.done')} ${todayAttendance!.checkInAt}〜${todayAttendance!.checkOutAt}`;
    statusColor = theme.subtext;
    statusIcon = 'clock-remove';
  }

  return (
    <View style={[st.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[st.sectionTitle, { color: theme.text }]}>{t('timecard.sectionTitle')}</Text>

      <View style={st.tcStatusRow}>
        <MaterialCommunityIcons name={statusIcon} size={24} color={statusColor} />
        <Text style={[st.tcStatusText, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      <View style={st.tcBtnRow}>
        {!hasIn && (
          <TouchableOpacity
            style={[st.tcBtn, { backgroundColor: '#22C55E' }]}
            onPress={() => onPunch('in')}
            disabled={punchLoading}
          >
            {punchLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="login" size={20} color="#fff" />
                <Text style={st.tcBtnText}>{t('timecard.punchIn')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        {hasIn && !hasOut && (
          <TouchableOpacity
            style={[st.tcBtn, { backgroundColor: '#D7263D' }]}
            onPress={() => onPunch('out')}
            disabled={punchLoading}
          >
            {punchLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="logout" size={20} color="#fff" />
                <Text style={st.tcBtnText}>{t('timecard.punchOut')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
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

  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginBottom: 12 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  defaultCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  defaultLabel: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  defaultHint: { fontSize: 12, marginBottom: 8 },
  defaultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  timeSep: { fontSize: 18, fontWeight: '700' },
  defaultSaveBtn: { marginTop: 10, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  defaultSaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  guardText: { fontSize: 13, textAlign: 'center', marginBottom: 8 },

  compactStepper: { alignItems: 'center' },
  compactLabel: { fontSize: 12, marginBottom: 4 },
  compactControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactValue: { fontSize: 18, fontWeight: '700', minWidth: 60, textAlign: 'center' },

  calendarWrap: { marginTop: 8, marginBottom: 12 },
  weekRow: { flexDirection: 'row' },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  weekText: { fontSize: 12, fontWeight: '600' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.285%', minHeight: 56, alignItems: 'center', paddingVertical: 4, borderRadius: 6 },
  dayNum: { fontSize: 14, fontWeight: '600' },
  approvedBadge: { fontSize: 10 },
  timeChip: { fontSize: 8, marginTop: 1 },
  editBtn: { marginTop: 1 },
  submitBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  tcStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  tcStatusText: { fontSize: 16, fontWeight: '700' },
  tcBtnRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  tcBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  tcBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
