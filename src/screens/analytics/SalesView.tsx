// src/screens/analytics/SalesView.tsx — 店舗売上ビュー（SPEC §3-F・§23）
//
// 月の全日リスト（1日〜末日）＝入力済みは金額表示・未入力はタップで入力。
// ヘッダーに月次集計カード＋売上CSV出力（§23列仕様・BOM付き）。

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from '../../components/common/FormModalShell';
import * as salesService from '../../services/sales';
import { shareCsv } from '../../utils/csv';
import { NumberField, parseNum } from './NumberField';
import { dayLabel, formatYen, todayStr } from './common';
import type { AnalyticsViewProps, TFunc } from './common';
import { monthDates } from './common';
import type { DailySales, ThemeColor } from '../../types';

export function SalesView({ tenant, theme, t, yearMonth }: AnalyticsViewProps) {
  const [salesList, setSalesList] = useState<DailySales[]>([]);
  const [loading, setLoading] = useState(false);
  const [editDate, setEditDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await salesService.fetchSalesByMonth(tenant.id, yearMonth);
      setSalesList(data);
    } catch (e: unknown) {
      console.warn('[kyasuho] fetchSalesByMonth:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant.id, yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDate = useMemo(() => new Map(salesList.map((sl) => [sl.date, sl])), [salesList]);
  const dates = useMemo(() => monthDates(yearMonth), [yearMonth]);

  const summary = useMemo(() => {
    return salesList.reduce(
      (acc, sl) => ({
        total: acc.total + sl.totalRevenue,
        days: acc.days + 1,
        sets: acc.sets + sl.setCount,
        drinks: acc.drinks + sl.drinkCount,
        nominations: acc.nominations + sl.nominationCount,
        other: acc.other + sl.otherRevenue,
      }),
      { total: 0, days: 0, sets: 0, drinks: 0, nominations: 0, other: 0 },
    );
  }, [salesList]);

  const handleCsv = useCallback(async () => {
    if (salesList.length === 0) {
      Alert.alert(t('common.error'), t('csv.empty'));
      return;
    }
    const rows: string[][] = [
      t('csv.sales.headers').split(','),
      ...salesList.map((sl) => [
        sl.date,
        String(sl.totalRevenue),
        String(sl.setCount),
        String(sl.drinkCount),
        String(sl.nominationCount),
        String(sl.otherRevenue),
        sl.note,
      ]),
    ];
    try {
      const ok = await shareCsv(`kyasuho_sales_${yearMonth}.csv`, rows);
      if (!ok) Alert.alert(t('common.error'), t('csv.notAvailable'));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    }
  }, [salesList, yearMonth, t]);

  if (loading && salesList.length === 0) {
    return <ActivityIndicator color={theme.primary} style={v.spinner} />;
  }

  return (
    <View style={v.flex}>
      <FlatList
        data={dates}
        keyExtractor={(d) => d}
        contentContainerStyle={v.listContent}
        ListHeaderComponent={
          <View style={[v.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={v.summaryTopRow}>
              <View style={v.flex}>
                <Text style={[v.summaryLabel, { color: theme.subtext }]}>
                  {t('sales.monthTotal')}
                </Text>
                <Text style={[v.summaryTotal, { color: theme.primary }]}>
                  {formatYen(summary.total)}
                </Text>
              </View>
              <TouchableOpacity
                style={[v.csvBtn, { borderColor: theme.primary }]}
                onPress={handleCsv}
              >
                <MaterialCommunityIcons name="file-delimited-outline" size={15} color={theme.primary} />
                <Text style={[v.csvBtnText, { color: theme.primary }]}>{t('sales.csv')}</Text>
              </TouchableOpacity>
            </View>
            <View style={v.summaryGrid}>
              <SummaryCell label={t('sales.dayCount')} value={t('sales.days', { count: String(summary.days) })} theme={theme} />
              <SummaryCell label={t('sales.setTotal')} value={String(summary.sets)} theme={theme} />
              <SummaryCell label={t('sales.drinkTotal')} value={String(summary.drinks)} theme={theme} />
              <SummaryCell label={t('sales.nominationTotal')} value={String(summary.nominations)} theme={theme} />
            </View>
          </View>
        }
        renderItem={({ item: date }) => {
          const sl = byDate.get(date);
          const isToday = date === todayStr();
          return (
            <TouchableOpacity
              style={[
                v.dayRow,
                { backgroundColor: theme.card, borderColor: isToday ? theme.primary : theme.border },
              ]}
              onPress={() => setEditDate(date)}
              activeOpacity={0.7}
            >
              <Text style={[v.dayLabel, { color: theme.text }]}>{dayLabel(date)}</Text>
              {sl ? (
                <View style={v.dayValueWrap}>
                  <Text style={[v.dayValue, { color: theme.text }]}>
                    {formatYen(sl.totalRevenue)}
                  </Text>
                  {sl.note ? (
                    <MaterialCommunityIcons name="note-text-outline" size={14} color={theme.subtext} />
                  ) : null}
                </View>
              ) : (
                <Text style={[v.dayEmpty, { color: theme.subtext }]}>{t('sales.tapToInput')}</Text>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {editDate !== null && (
        <SalesEditModal
          visible={editDate !== null}
          date={editDate}
          existing={byDate.get(editDate) ?? null}
          tenantId={tenant.id}
          theme={theme}
          t={t}
          onClose={() => setEditDate(null)}
          onSaved={async () => {
            setEditDate(null);
            await load();
          }}
        />
      )}
    </View>
  );
}

function SummaryCell({ label, value, theme }: { label: string; value: string; theme: ThemeColor }) {
  return (
    <View style={v.summaryCell}>
      <Text style={[v.summaryCellLabel, { color: theme.subtext }]}>{label}</Text>
      <Text style={[v.summaryCellValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

// ── 売上入力モーダル ──

function SalesEditModal({
  visible,
  date,
  existing,
  tenantId,
  theme,
  t,
  onClose,
  onSaved,
}: {
  visible: boolean;
  date: string;
  existing: DailySales | null;
  tenantId: string;
  theme: ThemeColor;
  t: TFunc;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [totalRevenue, setTotalRevenue] = useState(existing ? String(existing.totalRevenue) : '');
  const [setCount, setSetCount] = useState(existing ? String(existing.setCount) : '');
  const [drinkCount, setDrinkCount] = useState(existing ? String(existing.drinkCount) : '');
  const [nominationCount, setNominationCount] = useState(
    existing ? String(existing.nominationCount) : '',
  );
  const [otherRevenue, setOtherRevenue] = useState(existing ? String(existing.otherRevenue) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await salesService.upsertSales(tenantId, date, {
        totalRevenue: parseNum(totalRevenue),
        setCount: parseNum(setCount),
        drinkCount: parseNum(drinkCount),
        nominationCount: parseNum(nominationCount),
        otherRevenue: parseNum(otherRevenue),
        note: note.trim(),
      });
      onSaved();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setSaving(false);
    }
  }, [tenantId, date, totalRevenue, setCount, drinkCount, nominationCount, otherRevenue, note, t, onSaved]);

  const handleDelete = useCallback(() => {
    if (!existing) return;
    Alert.alert(t('common.delete'), t('sales.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await salesService.deleteSales(existing.id);
            onSaved();
          } catch (e: unknown) {
            Alert.alert(t('common.error'), String(e));
          }
        },
      },
    ]);
  }, [existing, t, onSaved]);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <ScrollView contentContainerStyle={v.modalContent}>
        <View style={v.modalHeader}>
          <Text style={[v.modalTitle, { color: theme.text }]}>
            {t('sales.editTitle', { date: dayLabel(date) })}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close" size={24} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        <NumberField label={t('sales.totalRevenue')} value={totalRevenue} onChange={setTotalRevenue} theme={theme} />
        <NumberField label={t('sales.setCount')} value={setCount} onChange={setSetCount} theme={theme} />
        <NumberField label={t('sales.drinkCount')} value={drinkCount} onChange={setDrinkCount} theme={theme} />
        <NumberField label={t('sales.nominationCount')} value={nominationCount} onChange={setNominationCount} theme={theme} />
        <NumberField label={t('sales.otherRevenue')} value={otherRevenue} onChange={setOtherRevenue} theme={theme} />

        <Text style={[v.label, { color: theme.text }]}>{t('sales.note')}</Text>
        <TextInput
          style={[v.inputMulti, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          value={note}
          onChangeText={setNote}
          placeholder={t('sales.notePlaceholder')}
          placeholderTextColor={theme.subtext}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[v.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={v.submitText}>{t('common.save')}</Text>
          )}
        </TouchableOpacity>

        {existing && (
          <TouchableOpacity style={v.deleteButton} onPress={handleDelete}>
            <Text style={[v.deleteText, { color: '#d9534f' }]}>{t('common.delete')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </FormModalShell>
  );
}

const v = StyleSheet.create({
  flex: { flex: 1 },
  spinner: { marginTop: 32 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  summaryCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  summaryTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  summaryLabel: { fontSize: 12, fontWeight: '500' },
  summaryTotal: { fontSize: 26, fontWeight: '700', marginTop: 2 },
  csvBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  csvBtnText: { fontSize: 12, fontWeight: '600' },
  summaryGrid: { flexDirection: 'row', marginTop: 12 },
  summaryCell: { flex: 1 },
  summaryCellLabel: { fontSize: 11 },
  summaryCellValue: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6 },
  dayLabel: { fontSize: 14, fontWeight: '500' },
  dayValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayValue: { fontSize: 15, fontWeight: '600' },
  dayEmpty: { fontSize: 12 },
  modalContent: { padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  inputMulti: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 72, textAlignVertical: 'top' },
  submitButton: { marginTop: 20, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteButton: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
  deleteText: { fontSize: 14, fontWeight: '600' },
});
