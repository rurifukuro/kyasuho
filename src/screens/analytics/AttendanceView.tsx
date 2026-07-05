// src/screens/analytics/AttendanceView.tsx — 勤怠ビュー（SPEC §3-H・§23）
//
// 日付チップ（月内1日〜末日）→ その日の全キャスト行（記録済み＝ステータスバッジ／未記録）。
// 行タップで記録モーダル（ステータス5値・理由・入退店時刻・代打）。下部に月次集計＋勤怠CSV。

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
  TextInput,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from '../../components/common/FormModalShell';
import * as attendanceService from '../../services/attendance';
import * as castService from '../../services/casts';
import { shareCsv } from '../../utils/csv';
import { dayLabel, monthDates, pad2, todayStr } from './common';
import type { AnalyticsViewProps, TFunc } from './common';
import type {
  Attendance,
  AttendanceReasonCategory,
  AttendanceStatus,
  Cast,
  ThemeColor,
} from '../../types';
import type { TKey } from '../../i18n';

const STATUS_LIST: AttendanceStatus[] = ['present', 'late', 'early_leave', 'absent', 'substitute'];

const STATUS_KEYS: Record<AttendanceStatus, TKey> = {
  present: 'attendance.status.present',
  late: 'attendance.status.late',
  early_leave: 'attendance.status.early_leave',
  absent: 'attendance.status.absent',
  substitute: 'attendance.status.substitute',
};

/** ステータス色（テーマ非依存の意味色）。 */
const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: '#3d9e58',
  late: '#e8960c',
  early_leave: '#3a8fb7',
  absent: '#d9534f',
  substitute: '#8e6bc0',
};

const REASON_LIST: AttendanceReasonCategory[] = ['', 'sick', 'personal', 'no_show', 'other'];

const REASON_KEYS: Record<AttendanceReasonCategory, TKey> = {
  '': 'attendance.reason.none',
  sick: 'attendance.reason.sick',
  personal: 'attendance.reason.personal',
  no_show: 'attendance.reason.no_show',
  other: 'attendance.reason.other',
};

export function AttendanceView({ tenant, theme, t, yearMonth }: AnalyticsViewProps) {
  const dates = useMemo(() => monthDates(yearMonth), [yearMonth]);
  const initialDate = useMemo(() => {
    const today = todayStr();
    return today.startsWith(yearMonth) ? today : dates[0];
  }, [yearMonth, dates]);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCast, setEditingCast] = useState<Cast | null>(null);

  // 月が変わったら選択日をリセット
  useEffect(() => {
    setSelectedDate(initialDate);
  }, [initialDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [att, castList] = await Promise.all([
        attendanceService.fetchAttendanceByMonth(tenant.id, yearMonth),
        castService.fetchCasts(tenant.id),
      ]);
      setAttendance(att);
      setCasts(castList);
    } catch (e: unknown) {
      console.warn('[kyasuho] fetchAttendanceByMonth:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant.id, yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const byCastDate = useMemo(() => {
    const map = new Map<string, Attendance>();
    for (const a of attendance) map.set(`${a.castId}|${a.date}`, a);
    return map;
  }, [attendance]);

  const castNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of casts) map.set(c.id, c.name);
    return map;
  }, [casts]);

  // 月次集計（キャスト別: 出勤日数・遅刻・欠勤・出勤率）
  const monthlySummary = useMemo(() => {
    return casts.map((c) => {
      const records = attendance.filter((a) => a.castId === c.id);
      const worked = records.filter((a) => a.status !== 'absent').length;
      const late = records.filter((a) => a.status === 'late').length;
      const absent = records.filter((a) => a.status === 'absent').length;
      const rate = records.length > 0 ? Math.round((worked / records.length) * 100) : null;
      return { cast: c, worked, late, absent, rate };
    });
  }, [casts, attendance]);

  const handleCsv = useCallback(async () => {
    if (attendance.length === 0) {
      Alert.alert(t('common.error'), t('csv.empty'));
      return;
    }
    const rows: string[][] = [
      t('csv.attendance.headers').split(','),
      ...attendance.map((a) => {
        const reasonLabel = a.reasonCategory ? t(REASON_KEYS[a.reasonCategory]) : '';
        const reason = [reasonLabel, a.reasonNote].filter(Boolean).join(': ');
        return [
          a.date,
          castNameById.get(a.castId) ?? '',
          t(STATUS_KEYS[a.status]),
          a.checkInAt ?? '',
          a.checkOutAt ?? '',
          reason,
        ];
      }),
    ];
    try {
      const ok = await shareCsv(`kyasuho_attendance_${yearMonth}.csv`, rows);
      if (!ok) Alert.alert(t('common.error'), t('csv.notAvailable'));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    }
  }, [attendance, castNameById, yearMonth, t]);

  if (loading && attendance.length === 0 && casts.length === 0) {
    return <ActivityIndicator color={theme.primary} style={av.spinner} />;
  }

  const initialIndex = Math.max(0, dates.indexOf(selectedDate));

  return (
    <View style={av.flex}>
      {/* 日付ストリップ（月内） */}
      <FlatList
        horizontal
        data={dates}
        keyExtractor={(d) => d}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: 72, offset: 72 * index, index })}
        style={[av.dateStrip, { borderBottomColor: theme.border }]}
        contentContainerStyle={av.dateStripContent}
        renderItem={({ item }) => {
          const active = item === selectedDate;
          return (
            <TouchableOpacity
              style={[
                av.dateChip,
                { backgroundColor: active ? theme.primary : theme.card, borderColor: theme.border },
              ]}
              onPress={() => setSelectedDate(item)}
            >
              <Text style={[av.dateChipText, { color: active ? '#fff' : theme.text }]}>
                {dayLabel(item)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <ScrollView style={av.flex} contentContainerStyle={av.bodyContent}>
        {/* 選択日のキャスト別勤怠 */}
        {casts.length === 0 ? (
          <View style={[av.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="account-off-outline" size={28} color={theme.subtext} />
            <Text style={[av.emptyText, { color: theme.subtext }]}>{t('attendance.noCasts')}</Text>
          </View>
        ) : (
          casts.map((c) => {
            const record = byCastDate.get(`${c.id}|${selectedDate}`);
            return (
              <TouchableOpacity
                key={c.id}
                style={[av.castRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => setEditingCast(c)}
                activeOpacity={0.7}
              >
                <Text style={[av.castName, { color: theme.text }]} numberOfLines={1}>
                  {c.name}
                </Text>
                {record ? (
                  <View style={av.recordWrap}>
                    {record.checkInAt ? (
                      <Text style={[av.timeText, { color: theme.subtext }]}>
                        {record.checkInAt}〜{record.checkOutAt ?? ''}
                      </Text>
                    ) : null}
                    <View style={[av.statusBadge, { backgroundColor: STATUS_COLORS[record.status] + '22' }]}>
                      <Text style={[av.statusBadgeText, { color: STATUS_COLORS[record.status] }]}>
                        {t(STATUS_KEYS[record.status])}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[av.unrecorded, { color: theme.subtext }]}>
                    {t('attendance.unrecorded')}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })
        )}

        {/* 月次集計 */}
        {casts.length > 0 && (
          <>
            <View style={av.summaryHeader}>
              <Text style={[av.summaryTitle, { color: theme.text }]}>
                {t('attendance.monthSummary')}
              </Text>
              <TouchableOpacity
                style={[av.csvBtn, { borderColor: theme.primary }]}
                onPress={handleCsv}
              >
                <MaterialCommunityIcons name="file-delimited-outline" size={15} color={theme.primary} />
                <Text style={[av.csvBtnText, { color: theme.primary }]}>{t('attendance.csv')}</Text>
              </TouchableOpacity>
            </View>
            {monthlySummary.map(({ cast, worked, late, absent, rate }) => (
              <View
                key={cast.id}
                style={[av.summaryRow, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <Text style={[av.summaryName, { color: theme.text }]} numberOfLines={1}>
                  {cast.name}
                </Text>
                <Text style={[av.summaryStats, { color: theme.subtext }]}>
                  {t('attendance.summaryLine', {
                    worked: String(worked),
                    late: String(late),
                    absent: String(absent),
                  })}
                  {rate !== null ? `　${t('attendance.presentRate')} ${rate}%` : ''}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {editingCast && (
        <AttendanceEditModal
          visible={editingCast !== null}
          cast={editingCast}
          casts={casts}
          date={selectedDate}
          existing={byCastDate.get(`${editingCast.id}|${selectedDate}`) ?? null}
          tenantId={tenant.id}
          theme={theme}
          t={t}
          onClose={() => setEditingCast(null)}
          onSaved={async () => {
            setEditingCast(null);
            await load();
          }}
        />
      )}
    </View>
  );
}

// ── 勤怠記録モーダル ──

function AttendanceEditModal({
  visible,
  cast,
  casts,
  date,
  existing,
  tenantId,
  theme,
  t,
  onClose,
  onSaved,
}: {
  visible: boolean;
  cast: Cast;
  casts: Cast[];
  date: string;
  existing: Attendance | null;
  tenantId: string;
  theme: ThemeColor;
  t: TFunc;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<AttendanceStatus>(existing?.status ?? 'present');
  const [reasonCategory, setReasonCategory] = useState<AttendanceReasonCategory>(
    existing?.reasonCategory ?? '',
  );
  const [reasonNote, setReasonNote] = useState(existing?.reasonNote ?? '');
  const [substituteCastId, setSubstituteCastId] = useState<string | null>(
    existing?.substituteCastId ?? null,
  );

  const parseHm = (v: string | null): { h: number; m: number } | null => {
    if (!v) return null;
    const mm = /^(\d{1,2}):(\d{2})$/.exec(v);
    if (!mm) return null;
    return { h: Number(mm[1]), m: Number(mm[2]) };
  };
  const existingIn = parseHm(existing?.checkInAt ?? null);
  const existingOut = parseHm(existing?.checkOutAt ?? null);

  const [timeEnabled, setTimeEnabled] = useState(existingIn !== null);
  const [inHour, setInHour] = useState(existingIn?.h ?? 18);
  const [inMin, setInMin] = useState(existingIn?.m ?? 0);
  const [outHour, setOutHour] = useState(existingOut?.h ?? 23);
  const [outMin, setOutMin] = useState(existingOut?.m ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (status === 'substitute' && !substituteCastId) {
      Alert.alert(t('common.error'), t('attendance.errorSubstituteRequired'));
      return;
    }
    setSaving(true);
    try {
      await attendanceService.upsertAttendance(tenantId, cast.id, date, {
        status,
        reasonCategory,
        reasonNote: reasonNote.trim(),
        substituteCastId: status === 'substitute' ? substituteCastId : null,
        checkInAt: timeEnabled ? `${pad2(inHour)}:${pad2(inMin)}` : null,
        checkOutAt: timeEnabled ? `${pad2(outHour)}:${pad2(outMin)}` : null,
        note: existing?.note ?? '',
      });
      onSaved();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setSaving(false);
    }
  }, [
    status, reasonCategory, reasonNote, substituteCastId, timeEnabled,
    inHour, inMin, outHour, outMin, tenantId, cast.id, date, existing, t, onSaved,
  ]);

  const handleClear = useCallback(() => {
    if (!existing) return;
    Alert.alert(t('common.delete'), t('attendance.clearConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await attendanceService.deleteAttendance(existing.id);
            onSaved();
          } catch (e: unknown) {
            Alert.alert(t('common.error'), String(e));
          }
        },
      },
    ]);
  }, [existing, t, onSaved]);

  const otherCasts = casts.filter((c) => c.id !== cast.id);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <ScrollView contentContainerStyle={av.modalContent}>
        <View style={av.modalHeader}>
          <Text style={[av.modalTitle, { color: theme.text }]}>
            {t('attendance.editTitle', { date: dayLabel(date), name: cast.name })}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close" size={24} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        {/* ステータス */}
        <Text style={[av.label, { color: theme.text }]}>{t('attendance.statusLabel')}</Text>
        <View style={av.chipWrap}>
          {STATUS_LIST.map((st) => {
            const active = status === st;
            return (
              <TouchableOpacity
                key={st}
                style={[
                  av.chip,
                  {
                    backgroundColor: active ? STATUS_COLORS[st] : theme.card,
                    borderColor: active ? STATUS_COLORS[st] : theme.border,
                  },
                ]}
                onPress={() => setStatus(st)}
              >
                <Text style={[av.chipText, { color: active ? '#fff' : theme.text }]}>
                  {t(STATUS_KEYS[st])}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 代打キャスト（substitute のみ） */}
        {status === 'substitute' && (
          <>
            <Text style={[av.label, { color: theme.text }]}>{t('attendance.substituteCast')}</Text>
            <View style={av.chipWrap}>
              {otherCasts.map((c) => {
                const active = substituteCastId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      av.chip,
                      {
                        backgroundColor: active ? theme.primary : theme.card,
                        borderColor: active ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setSubstituteCastId(c.id)}
                  >
                    <Text style={[av.chipText, { color: active ? '#fff' : theme.text }]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* 理由（カテゴリ＋メモ） */}
        <Text style={[av.label, { color: theme.text }]}>{t('attendance.reason')}</Text>
        <View style={av.chipWrap}>
          {REASON_LIST.map((rc) => {
            const active = reasonCategory === rc;
            return (
              <TouchableOpacity
                key={rc || 'none'}
                style={[
                  av.chip,
                  {
                    backgroundColor: active ? theme.primary : theme.card,
                    borderColor: active ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setReasonCategory(rc)}
              >
                <Text style={[av.chipText, { color: active ? '#fff' : theme.text }]}>
                  {t(REASON_KEYS[rc])}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={[av.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          value={reasonNote}
          onChangeText={setReasonNote}
          placeholder={t('attendance.reasonNotePlaceholder')}
          placeholderTextColor={theme.subtext}
        />

        {/* 入退店時刻 */}
        <View style={av.switchRow}>
          <Text style={[av.label, { color: theme.text, marginTop: 0, marginBottom: 0 }]}>
            {t('attendance.recordTime')}
          </Text>
          <Switch
            value={timeEnabled}
            onValueChange={setTimeEnabled}
            trackColor={{ false: '#ccc', true: theme.primaryLight }}
            thumbColor={timeEnabled ? theme.primary : '#f4f3f4'}
          />
        </View>
        {timeEnabled && (
          <View style={av.timeRow}>
            <View style={av.timeCol}>
              <Text style={[av.timeColLabel, { color: theme.subtext }]}>
                {t('attendance.checkIn')}
              </Text>
              <TimeStepper
                hour={inHour}
                minute={inMin}
                onChangeHour={setInHour}
                onChangeMinute={setInMin}
                theme={theme}
              />
            </View>
            <View style={av.timeCol}>
              <Text style={[av.timeColLabel, { color: theme.subtext }]}>
                {t('attendance.checkOut')}
              </Text>
              <TimeStepper
                hour={outHour}
                minute={outMin}
                onChangeHour={setOutHour}
                onChangeMinute={setOutMin}
                theme={theme}
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[av.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={av.submitText}>{t('common.save')}</Text>
          )}
        </TouchableOpacity>

        {existing && (
          <TouchableOpacity style={av.deleteButton} onPress={handleClear}>
            <Text style={[av.deleteText, { color: '#d9534f' }]}>{t('attendance.clear')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </FormModalShell>
  );
}

// ── 時刻 Stepper（CastsScreen の AddShiftModal と同型・0〜29時対応） ──

function TimeStepper({
  hour,
  minute,
  onChangeHour,
  onChangeMinute,
  theme,
}: {
  hour: number;
  minute: number;
  onChangeHour: (h: number) => void;
  onChangeMinute: (m: number) => void;
  theme: ThemeColor;
}) {
  return (
    <View style={av.stepperRow}>
      <StepperControl
        value={hour}
        format={(v) => pad2(v)}
        onUp={() => onChangeHour(Math.min(29, hour + 1))}
        onDown={() => onChangeHour(Math.max(0, hour - 1))}
        theme={theme}
      />
      <Text style={[av.stepperColon, { color: theme.text }]}>:</Text>
      <StepperControl
        value={minute}
        format={(v) => pad2(v)}
        onUp={() => onChangeMinute(minute + 15 > 59 ? 0 : minute + 15)}
        onDown={() => onChangeMinute(minute - 15 < 0 ? 45 : minute - 15)}
        theme={theme}
      />
    </View>
  );
}

function StepperControl({
  value,
  format,
  onUp,
  onDown,
  theme,
}: {
  value: number;
  format: (v: number) => string;
  onUp: () => void;
  onDown: () => void;
  theme: ThemeColor;
}) {
  return (
    <View style={av.stepperBox}>
      <TouchableOpacity onPress={onUp} style={av.stepperBtn}>
        <MaterialCommunityIcons name="chevron-up" size={22} color={theme.primary} />
      </TouchableOpacity>
      <Text style={[av.stepperValue, { color: theme.text }]}>{format(value)}</Text>
      <TouchableOpacity onPress={onDown} style={av.stepperBtn}>
        <MaterialCommunityIcons name="chevron-down" size={22} color={theme.primary} />
      </TouchableOpacity>
    </View>
  );
}

const av = StyleSheet.create({
  flex: { flex: 1 },
  spinner: { marginTop: 32 },
  dateStrip: { maxHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth },
  dateStripContent: { paddingHorizontal: 12, alignItems: 'center' },
  dateChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, marginRight: 6, minWidth: 66, alignItems: 'center' },
  dateChipText: { fontSize: 12, fontWeight: '500' },
  bodyContent: { padding: 16, paddingBottom: 32 },
  emptyCard: { borderRadius: 12, borderWidth: 1, padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  castRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6 },
  castName: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  recordWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeText: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  unrecorded: { fontSize: 12 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 },
  summaryTitle: { fontSize: 16, fontWeight: '700' },
  csvBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  csvBtnText: { fontSize: 12, fontWeight: '600' },
  summaryRow: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6 },
  summaryName: { fontSize: 14, fontWeight: '600' },
  summaryStats: { fontSize: 12, marginTop: 4 },
  modalContent: { padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginRight: 8 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  timeCol: { alignItems: 'center' },
  timeColLabel: { fontSize: 12, marginBottom: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  stepperColon: { fontSize: 24, fontWeight: '700', marginHorizontal: 4 },
  stepperBox: { alignItems: 'center' },
  stepperBtn: { padding: 4 },
  stepperValue: { fontSize: 22, fontWeight: '600', minWidth: 36, textAlign: 'center' },
  submitButton: { marginTop: 22, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteButton: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
  deleteText: { fontSize: 14, fontWeight: '600' },
});
