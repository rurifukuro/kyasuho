import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from './common/FormModalShell';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { supabase } from '../config/supabase';
import * as dailyReportsService from '../services/dailyReports';
import { fetchOpenOrders } from '../services/orders';
import { todayStr, formatYen } from '../screens/analytics/common';
import type { ThemeColor } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onClosed: () => void;
};

export function CloseDayModal({ visible, onClose, onClosed }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? '';

  const [loading, setLoading] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [summary, setSummary] = useState<{
    totalRevenue: number; orderCount: number; guestCount: number; cashExpected: number;
    castSummary: { castId: string; orderCount: number; revenue: number }[];
  } | null>(null);
  const [cashActual, setCashActual] = useState('');
  const [memo, setMemo] = useState('');
  const [alreadyClosed, setAlreadyClosed] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || !visible) return;
    setLoading(true);
    try {
      const bizDate = todayStr();

      const existing = await dailyReportsService.fetchDailyReport(tenantId, bizDate);
      if (existing?.closedAt) {
        setAlreadyClosed(true);
        setLoading(false);
        return;
      }
      setAlreadyClosed(false);

      const openOrders = await fetchOpenOrders(tenantId);
      setOpenCount(openOrders.length);

      const s = await dailyReportsService.generateReportSummary(tenantId, bizDate);
      setSummary(s);
    } catch (e) {
      console.warn('[kyasuho] CloseDayModal load:', e);
    } finally {
      setLoading(false);
    }
  }, [tenantId, visible]);

  useEffect(() => {
    if (visible) {
      setCashActual('');
      setMemo('');
      void load();
    }
  }, [visible, load]);

  const handleConfirm = () => {
    if (!summary) return;
    Alert.alert(t('closeDay.confirmAlert'), t('closeDay.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('closeDay.confirm'), style: 'destructive', onPress: doClose },
    ]);
  };

  const doClose = async () => {
    if (!summary || !tenantId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await dailyReportsService.upsertDailyReport(
        tenantId,
        todayStr(),
        summary,
        cashActual ? parseInt(cashActual, 10) : 0,
        memo.trim(),
        user?.id ?? '',
      );
      Alert.alert(t('closeDay.done'));
      onClosed();
      onClose();
    } catch (e) {
      console.warn('[kyasuho] closeDay error:', e);
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  };

  const cashActualNum = cashActual ? parseInt(cashActual, 10) : 0;
  const diff = summary ? cashActualNum - summary.cashExpected : 0;
  const s = makeStyles(theme);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={[s.headerBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="close" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('closeDay.title')}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : alreadyClosed ? (
        <View style={s.center}>
          <MaterialCommunityIcons name="check-circle" size={48} color={theme.primary} />
          <Text style={[s.message, { color: theme.subtext }]}>{t('closeDay.alreadyClosed')}</Text>
        </View>
      ) : openCount > 0 ? (
        <View style={s.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EAB308" />
          <Text style={[s.message, { color: theme.text }]}>
            {t('closeDay.openOrdersWarning', { count: String(openCount) })}
          </Text>
        </View>
      ) : !summary || summary.orderCount === 0 ? (
        <View style={s.center}>
          <MaterialCommunityIcons name="receipt" size={48} color={theme.border} />
          <Text style={[s.message, { color: theme.subtext }]}>{t('closeDay.noOrders')}</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={[s.sectionTitle, { color: theme.primary }]}>{t('closeDay.summary')}</Text>

          <View style={[s.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <SummaryRow label={t('closeDay.revenue')} value={formatYen(summary.totalRevenue)} theme={theme} />
            <SummaryRow label={t('closeDay.orderCount')} value={t('closeDay.unit.orders', { count: String(summary.orderCount) })} theme={theme} />
            <SummaryRow label={t('closeDay.guestCount')} value={t('closeDay.unit.guests', { count: String(summary.guestCount) })} theme={theme} />
            <SummaryRow label={t('closeDay.cashExpected')} value={formatYen(summary.cashExpected)} theme={theme} bold />
          </View>

          <Text style={[s.sectionTitle, { color: theme.primary, marginTop: 20 }]}>{t('closeDay.cashActual')}</Text>
          <TextInput
            style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
            value={cashActual}
            onChangeText={setCashActual}
            keyboardType="number-pad"
            placeholder={t('closeDay.cashActualPlaceholder')}
            placeholderTextColor={theme.subtext}
          />

          {cashActual !== '' && (
            <View style={[s.diffRow, { backgroundColor: diff === 0 ? '#F0FFF4' : '#FFF5F5' }]}>
              <Text style={[s.diffLabel, { color: diff === 0 ? '#166534' : '#B91C1C' }]}>{t('closeDay.cashDiff')}</Text>
              <Text style={[s.diffValue, { color: diff === 0 ? '#166534' : '#B91C1C' }]}>
                {diff > 0 ? '+' : ''}{formatYen(diff)}
              </Text>
            </View>
          )}

          <Text style={[s.sectionTitle, { color: theme.primary, marginTop: 20 }]}>{t('closeDay.memo')}</Text>
          <TextInput
            style={[s.input, s.memoInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
            value={memo}
            onChangeText={setMemo}
            multiline
            placeholder={t('closeDay.memoPlaceholder')}
            placeholderTextColor={theme.subtext}
          />

          <TouchableOpacity
            style={[s.confirmBtn, { backgroundColor: theme.primary }]}
            onPress={handleConfirm}
            disabled={loading}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="check-bold" size={18} color="#fff" />
            <Text style={s.confirmText}>{t('closeDay.confirm')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </FormModalShell>
  );
}

function SummaryRow({ label, value, theme, bold }: { label: string; value: string; theme: ThemeColor; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ fontSize: 14, color: theme.subtext }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: bold ? '800' : '600', color: theme.text }}>{value}</Text>
    </View>
  );
}

function makeStyles(theme: ThemeColor) {
  return StyleSheet.create({
    headerBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    message: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
    sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
    summaryCard: { borderWidth: 1, borderRadius: 12, padding: 14 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
    memoInput: { minHeight: 80, textAlignVertical: 'top' },
    diffRow: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 10, padding: 12, marginTop: 10 },
    diffLabel: { fontSize: 14, fontWeight: '600' },
    diffValue: { fontSize: 16, fontWeight: '800' },
    confirmBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderRadius: 14, paddingVertical: 16, marginTop: 24,
    },
    confirmText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
}
