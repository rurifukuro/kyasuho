// src/screens/analytics/PayrollView.tsx — 給与ビュー（SPEC §3-F・§23）
//
// 給与設定（店一律4値）→「勤怠から自動生成」→ キャスト別月次集計（展開で日別明細）
// → 明細タップで手修正モーダル（§23: 自動集計＋手修正可）。給与CSV（§23列）出力。

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from '../../components/common/FormModalShell';
import * as payrollService from '../../services/payroll';
import * as attendanceService from '../../services/attendance';
import * as castService from '../../services/casts';
import { calcPayroll, splitMinutes } from '../../utils/payrollCalc';
import { shareCsv } from '../../utils/csv';
import { printPayroll } from '../../services/print';
import { NumberField, parseNum } from './NumberField';
import { dayLabel, formatYen, pad2 } from './common';
import type { AnalyticsViewProps, TFunc } from './common';
import type { Cast, CastPayroll, PayrollSettings, ThemeColor } from '../../types';

type EffectiveSettings = Pick<
  PayrollSettings,
  'baseHourlyRate' | 'nominationBackRate' | 'defaultBackRate' | 'lateDeduction' | 'slideEnabled'
>;

export function PayrollView({ tenant, theme, t, yearMonth }: AnalyticsViewProps) {
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [payroll, setPayroll] = useState<CastPayroll[]>([]);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [expandedCastId, setExpandedCastId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CastPayroll | null>(null);

  const effectiveSettings: EffectiveSettings = settings ?? payrollService.DEFAULT_PAYROLL_SETTINGS;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, pr, castList] = await Promise.all([
        payrollService.fetchPayrollSettings(tenant.id),
        payrollService.fetchPayrollByMonth(tenant.id, yearMonth),
        castService.fetchCasts(tenant.id),
      ]);
      setSettings(st);
      setPayroll(pr);
      setCasts(castList);
    } catch (e: unknown) {
      console.warn('[kyasuho] fetchPayrollByMonth:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant.id, yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const castNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of casts) map.set(c.id, c.name);
    return map;
  }, [casts]);

  // キャスト別月次集計（表示順＝キャスト一覧順・退店キャストは末尾）
  const perCast = useMemo(() => {
    type Agg = { castId: string; days: number; minutes: number; total: number; rows: CastPayroll[] };
    const map = new Map<string, Agg>();
    for (const p of payroll) {
      const agg = map.get(p.castId) ?? { castId: p.castId, days: 0, minutes: 0, total: 0, rows: [] };
      agg.days += 1;
      agg.minutes += p.minutesWorked;
      agg.total += p.totalPay;
      agg.rows.push(p);
      map.set(p.castId, agg);
    }
    const ordered: Agg[] = [];
    for (const c of casts) {
      const agg = map.get(c.id);
      if (agg) {
        ordered.push(agg);
        map.delete(c.id);
      }
    }
    for (const agg of map.values()) ordered.push(agg); // 退店キャスト分
    return ordered;
  }, [payroll, casts]);

  const monthTotal = useMemo(
    () => payroll.reduce((sum, p) => sum + p.totalPay, 0),
    [payroll],
  );

  // 勤怠 → 給与自動生成（既存明細はスキップ＝手修正保護）
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const attendance = await attendanceService.fetchAttendanceByMonth(tenant.id, yearMonth);
      if (attendance.length === 0) {
        Alert.alert(t('payroll.generate'), t('payroll.noAttendance'));
        return;
      }
      const created = await payrollService.generatePayrollFromAttendance(
        tenant.id,
        yearMonth,
        attendance,
        effectiveSettings,
      );
      Alert.alert(
        t('payroll.generate'),
        created > 0
          ? t('payroll.generated', { count: String(created) })
          : t('payroll.generatedNone'),
      );
      await load();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setGenerating(false);
    }
  }, [tenant.id, yearMonth, effectiveSettings, t, load]);

  const handleCsv = useCallback(async () => {
    if (perCast.length === 0) {
      Alert.alert(t('common.error'), t('csv.empty'));
      return;
    }
    const rows: string[][] = [
      t('csv.payroll.headers').split(','),
      ...perCast.map((agg) => {
        const basePay = agg.rows.reduce((s, p) => s + p.basePay, 0);
        const nomBack = agg.rows.reduce((s, p) => s + p.nominationBack, 0);
        const menuBack = agg.rows.reduce((s, p) => s + p.menuBack, 0);
        const otherBack = agg.rows.reduce((s, p) => s + p.otherBack, 0);
        const deductions = agg.rows.reduce((s, p) => s + p.deductions, 0);
        const { hours, minutes } = splitMinutes(agg.minutes);
        return [
          yearMonth,
          castNameById.get(agg.castId) ?? t('payroll.unknownCast'),
          String(agg.days),
          `${hours}:${pad2(minutes)}`,
          String(basePay),
          String(nomBack),
          String(menuBack),
          String(otherBack),
          String(deductions),
          String(agg.total),
        ];
      }),
    ];
    try {
      const ok = await shareCsv(`kyasuho_payroll_${yearMonth}.csv`, rows);
      if (!ok) Alert.alert(t('common.error'), t('csv.notAvailable'));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    }
  }, [perCast, castNameById, yearMonth, t]);

  const handlePrint = useCallback(async () => {
    if (payroll.length === 0) {
      Alert.alert(t('common.error'), t('csv.empty'));
      return;
    }
    try {
      await printPayroll(
        { title: t('payroll.printTitle'), storeName: tenant.name, yearMonth },
        payroll,
        castNameById,
      );
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    }
  }, [payroll, castNameById, tenant.name, yearMonth, t]);

  if (loading && payroll.length === 0 && casts.length === 0) {
    return <ActivityIndicator color={theme.primary} style={pv.spinner} />;
  }

  return (
    <View style={pv.flex}>
      <ScrollView style={pv.flex} contentContainerStyle={pv.bodyContent}>
        {/* 給与設定カード */}
        <View style={[pv.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={pv.settingsHeader}>
            <Text style={[pv.settingsTitle, { color: theme.text }]}>
              {t('payroll.settingsTitle')}
            </Text>
            <TouchableOpacity
              onPress={() => setSettingsVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="cog-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <View style={pv.settingsGrid}>
            <SettingCell label={t('payroll.baseHourlyRate')} value={formatYen(effectiveSettings.baseHourlyRate)} theme={theme} />
            <SettingCell label={t('payroll.nominationBackRate')} value={formatYen(effectiveSettings.nominationBackRate)} theme={theme} />
            <SettingCell label={t('payroll.defaultBackRate')} value={`${effectiveSettings.defaultBackRate}%`} theme={theme} />
            <SettingCell label={t('payroll.lateDeduction')} value={formatYen(effectiveSettings.lateDeduction)} theme={theme} />
          </View>
        </View>

        {/* 月次合計＋操作ボタン */}
        <View style={[pv.totalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={pv.flex}>
            <Text style={[pv.totalLabel, { color: theme.subtext }]}>{t('payroll.monthTotal')}</Text>
            <Text style={[pv.totalValue, { color: theme.primary }]}>{formatYen(monthTotal)}</Text>
          </View>
          <View style={pv.btnRow}>
            <TouchableOpacity style={[pv.csvBtn, { borderColor: theme.primary }]} onPress={handlePrint}>
              <MaterialCommunityIcons name="printer-outline" size={15} color={theme.primary} />
              <Text style={[pv.csvBtnText, { color: theme.primary }]}>{t('common.print')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[pv.csvBtn, { borderColor: theme.primary }]} onPress={handleCsv}>
              <MaterialCommunityIcons name="file-delimited-outline" size={15} color={theme.primary} />
              <Text style={[pv.csvBtnText, { color: theme.primary }]}>{t('payroll.csv')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[pv.generateBtn, { backgroundColor: theme.primary }]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="calendar-sync" size={17} color="#fff" />
              <Text style={pv.generateText}>{t('payroll.generate')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* キャスト別集計（展開で日別明細） */}
        {perCast.length === 0 ? (
          <View style={[pv.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="cash-remove" size={28} color={theme.subtext} />
            <Text style={[pv.emptyText, { color: theme.subtext }]}>{t('payroll.empty')}</Text>
          </View>
        ) : (
          perCast.map((agg) => {
            const expanded = expandedCastId === agg.castId;
            const { hours, minutes } = splitMinutes(agg.minutes);
            return (
              <View key={agg.castId} style={pv.castBlock}>
                <TouchableOpacity
                  style={[pv.castRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => setExpandedCastId(expanded ? null : agg.castId)}
                  activeOpacity={0.7}
                >
                  <View style={pv.flex}>
                    <Text style={[pv.castName, { color: theme.text }]} numberOfLines={1}>
                      {castNameById.get(agg.castId) ?? t('payroll.unknownCast')}
                    </Text>
                    <Text style={[pv.castStats, { color: theme.subtext }]}>
                      {t('payroll.castStats', {
                        days: String(agg.days),
                        hours: String(hours),
                        minutes: pad2(minutes),
                      })}
                    </Text>
                  </View>
                  <View style={pv.castRight}>
                    <Text style={[pv.castTotal, { color: theme.text }]}>{formatYen(agg.total)}</Text>
                    <MaterialCommunityIcons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.subtext}
                    />
                  </View>
                </TouchableOpacity>
                {expanded &&
                  agg.rows.map((p) => {
                    const sm = splitMinutes(p.minutesWorked);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[pv.detailRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                        onPress={() => setEditing(p)}
                        activeOpacity={0.7}
                      >
                        <Text style={[pv.detailDate, { color: theme.text }]}>{dayLabel(p.date)}</Text>
                        <Text style={[pv.detailTime, { color: theme.subtext }]}>
                          {sm.hours}:{pad2(sm.minutes)}
                        </Text>
                        <Text style={[pv.detailPay, { color: theme.text }]}>
                          {formatYen(p.totalPay)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            );
          })
        )}
      </ScrollView>

      {settingsVisible && (
        <PayrollSettingsModal
          visible={settingsVisible}
          current={effectiveSettings}
          tenantId={tenant.id}
          theme={theme}
          t={t}
          onClose={() => setSettingsVisible(false)}
          onSaved={async () => {
            setSettingsVisible(false);
            await load();
          }}
        />
      )}

      {editing && (
        <PayrollEditModal
          visible={editing !== null}
          payroll={editing}
          castName={castNameById.get(editing.castId) ?? t('payroll.unknownCast')}
          settings={effectiveSettings}
          theme={theme}
          t={t}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </View>
  );
}

function SettingCell({ label, value, theme }: { label: string; value: string; theme: ThemeColor }) {
  return (
    <View style={pv.settingCell}>
      <Text style={[pv.settingCellLabel, { color: theme.subtext }]}>{label}</Text>
      <Text style={[pv.settingCellValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

// ── 給与設定モーダル ──

function PayrollSettingsModal({
  visible,
  current,
  tenantId,
  theme,
  t,
  onClose,
  onSaved,
}: {
  visible: boolean;
  current: EffectiveSettings;
  tenantId: string;
  theme: ThemeColor;
  t: TFunc;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [baseRate, setBaseRate] = useState(String(current.baseHourlyRate));
  const [nomRate, setNomRate] = useState(String(current.nominationBackRate));
  const [defaultBackRate, setDefaultBackRate] = useState(String(current.defaultBackRate));
  const [lateDeduction, setLateDeduction] = useState(String(current.lateDeduction));
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await payrollService.savePayrollSettings(tenantId, {
        baseHourlyRate: parseNum(baseRate),
        nominationBackRate: parseNum(nomRate),
        defaultBackRate: parseFloat(defaultBackRate) || 0,
        lateDeduction: parseNum(lateDeduction),
        slideEnabled: current.slideEnabled,
      });
      onSaved();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setSaving(false);
    }
  }, [tenantId, baseRate, nomRate, defaultBackRate, lateDeduction, t, onSaved]);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <ScrollView contentContainerStyle={pv.modalContent}>
        <View style={pv.modalHeader}>
          <Text style={[pv.modalTitle, { color: theme.text }]}>{t('payroll.settingsTitle')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close" size={24} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        <Text style={[pv.settingsNote, { color: theme.subtext }]}>{t('payroll.settingsNote')}</Text>

        <NumberField label={t('payroll.baseHourlyRate')} value={baseRate} onChange={setBaseRate} theme={theme} />
        <NumberField label={t('payroll.nominationBackRate')} value={nomRate} onChange={setNomRate} theme={theme} />
        <NumberField label={t('payroll.defaultBackRate')} value={defaultBackRate} onChange={setDefaultBackRate} theme={theme} />
        <NumberField label={t('payroll.lateDeduction')} value={lateDeduction} onChange={setLateDeduction} theme={theme} />

        <TouchableOpacity
          style={[pv.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={pv.submitText}>{t('common.save')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </FormModalShell>
  );
}

// ── 給与明細の手修正モーダル（§23: 自動値の手修正可） ──

function PayrollEditModal({
  visible,
  payroll,
  castName,
  settings,
  theme,
  t,
  onClose,
  onSaved,
}: {
  visible: boolean;
  payroll: CastPayroll;
  castName: string;
  settings: EffectiveSettings;
  theme: ThemeColor;
  t: TFunc;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = splitMinutes(payroll.minutesWorked);
  const [workHours, setWorkHours] = useState(String(initial.hours));
  const [workMinutes, setWorkMinutes] = useState(String(initial.minutes));
  const [nominationCount, setNominationCount] = useState(String(payroll.nominationCount));
  const [menuBack, setMenuBack] = useState(String(payroll.menuBack));
  const [otherBack, setOtherBack] = useState(String(payroll.otherBack));
  const [deductions, setDeductions] = useState(String(payroll.deductions));
  const [note, setNote] = useState(payroll.note);
  const [saving, setSaving] = useState(false);

  // ライブ再計算（§23式・控除だけは手入力値を採用）
  const preview = useMemo(() => {
    const minutesWorked = parseNum(workHours) * 60 + parseNum(workMinutes);
    const bd = calcPayroll(settings, {
      minutesWorked,
      nominationCount: parseNum(nominationCount),
      menuBack: parseNum(menuBack),
      otherBack: parseNum(otherBack),
      lateCount: 0,
    });
    const ded = parseNum(deductions);
    return {
      minutesWorked,
      basePay: bd.basePay,
      nominationBack: bd.nominationBack,
      menuBack: bd.menuBack,
      otherBack: bd.otherBack,
      deductions: ded,
      totalPay: bd.basePay + bd.nominationBack + bd.menuBack + bd.otherBack - ded,
    };
  }, [workHours, workMinutes, nominationCount, menuBack, otherBack, deductions, settings]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await payrollService.upsertPayroll(payroll.tenantId, payroll.castId, payroll.date, {
        minutesWorked: preview.minutesWorked,
        basePay: preview.basePay,
        nominationCount: parseNum(nominationCount),
        nominationBack: preview.nominationBack,
        drinkCount: payroll.drinkCount,
        menuBack: preview.menuBack,
        otherBack: preview.otherBack,
        deductions: preview.deductions,
        totalPay: preview.totalPay,
        note: note.trim(),
      });
      onSaved();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setSaving(false);
    }
  }, [payroll, preview, nominationCount, note, t, onSaved]);

  const handleDelete = useCallback(() => {
    Alert.alert(t('common.delete'), t('payroll.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await payrollService.deletePayroll(payroll.id);
            onSaved();
          } catch (e: unknown) {
            Alert.alert(t('common.error'), String(e));
          }
        },
      },
    ]);
  }, [payroll.id, t, onSaved]);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <ScrollView contentContainerStyle={pv.modalContent}>
        <View style={pv.modalHeader}>
          <Text style={[pv.modalTitle, { color: theme.text }]} numberOfLines={1}>
            {t('payroll.editTitle', { date: dayLabel(payroll.date), name: castName })}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close" size={24} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        {/* 勤務時間（時＋分の2欄） */}
        <Text style={[pv.label, { color: theme.text }]}>{t('payroll.workTime')}</Text>
        <View style={pv.timeInputRow}>
          <TextInput
            style={[pv.timeInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            value={workHours}
            onChangeText={(v) => setWorkHours(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={theme.subtext}
          />
          <Text style={[pv.timeUnit, { color: theme.text }]}>{t('payroll.hoursUnit')}</Text>
          <TextInput
            style={[pv.timeInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            value={workMinutes}
            onChangeText={(v) => setWorkMinutes(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={theme.subtext}
          />
          <Text style={[pv.timeUnit, { color: theme.text }]}>{t('payroll.minutesUnit')}</Text>
        </View>

        <NumberField label={t('payroll.nominationCount')} value={nominationCount} onChange={setNominationCount} theme={theme} />
        <NumberField label={t('payroll.menuBack')} value={menuBack} onChange={setMenuBack} theme={theme} />
        <NumberField label={t('payroll.otherBack')} value={otherBack} onChange={setOtherBack} theme={theme} />
        <NumberField label={t('payroll.deductions')} value={deductions} onChange={setDeductions} theme={theme} />

        <Text style={[pv.label, { color: theme.text }]}>{t('payroll.note')}</Text>
        <TextInput
          style={[pv.inputMulti, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          value={note}
          onChangeText={setNote}
          placeholder={t('payroll.notePlaceholder')}
          placeholderTextColor={theme.subtext}
          multiline
          numberOfLines={3}
        />

        {/* 内訳プレビュー */}
        <View style={[pv.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <PreviewRow label={t('payroll.basePay')} value={formatYen(preview.basePay)} theme={theme} />
          <PreviewRow label={t('payroll.nominationBack')} value={formatYen(preview.nominationBack)} theme={theme} />
          <PreviewRow label={t('payroll.menuBack')} value={formatYen(preview.menuBack)} theme={theme} />
          <PreviewRow label={t('payroll.otherBack')} value={formatYen(preview.otherBack)} theme={theme} />
          <PreviewRow label={t('payroll.deductions')} value={`-${formatYen(preview.deductions)}`} theme={theme} />
          <View style={[pv.previewDivider, { backgroundColor: theme.border }]} />
          <View style={pv.previewRow}>
            <Text style={[pv.previewTotalLabel, { color: theme.text }]}>{t('payroll.totalPay')}</Text>
            <Text style={[pv.previewTotalValue, { color: theme.primary }]}>
              {formatYen(preview.totalPay)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[pv.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={pv.submitText}>{t('common.save')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={pv.deleteButton} onPress={handleDelete}>
          <Text style={[pv.deleteText, { color: '#d9534f' }]}>{t('common.delete')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </FormModalShell>
  );
}

function PreviewRow({ label, value, theme }: { label: string; value: string; theme: ThemeColor }) {
  return (
    <View style={pv.previewRow}>
      <Text style={[pv.previewLabel, { color: theme.subtext }]}>{label}</Text>
      <Text style={[pv.previewValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const pv = StyleSheet.create({
  flex: { flex: 1 },
  spinner: { marginTop: 32 },
  bodyContent: { padding: 16, paddingBottom: 32 },
  settingsCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsTitle: { fontSize: 14, fontWeight: '700' },
  settingsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  settingCell: { width: '50%', marginBottom: 8 },
  settingCellLabel: { fontSize: 11 },
  settingCellValue: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  totalCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  totalLabel: { fontSize: 12, fontWeight: '500' },
  totalValue: { fontSize: 26, fontWeight: '700', marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 8 },
  csvBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  csvBtnText: { fontSize: 12, fontWeight: '600' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 6, marginBottom: 14 },
  generateText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  emptyCard: { borderRadius: 12, borderWidth: 1, padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  castBlock: { marginBottom: 6 },
  castRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  castName: { fontSize: 15, fontWeight: '600' },
  castStats: { fontSize: 12, marginTop: 2 },
  castRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  castTotal: { fontSize: 16, fontWeight: '700' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, marginTop: 4, marginLeft: 16 },
  detailDate: { fontSize: 13, fontWeight: '500', flex: 1 },
  detailTime: { fontSize: 13, marginRight: 12 },
  detailPay: { fontSize: 14, fontWeight: '600' },
  modalContent: { padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginRight: 8 },
  settingsNote: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  timeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, width: 72, textAlign: 'center' },
  timeUnit: { fontSize: 14 },
  inputMulti: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 72, textAlignVertical: 'top' },
  previewCard: { borderRadius: 10, borderWidth: 1, padding: 14, marginTop: 16 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  previewLabel: { fontSize: 13 },
  previewValue: { fontSize: 14, fontWeight: '500' },
  previewDivider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  previewTotalLabel: { fontSize: 15, fontWeight: '700' },
  previewTotalValue: { fontSize: 18, fontWeight: '700' },
  submitButton: { marginTop: 20, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteButton: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
  deleteText: { fontSize: 14, fontWeight: '600' },
});
