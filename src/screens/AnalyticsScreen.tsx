// src/screens/AnalyticsScreen.tsx — 分析タブ（SPEC §3-F/H・§23）
//
// 売上／給与／勤怠の3ビューをセグメント切替で束ねるコンテナ。月ナビゲーション（'YYYY-MM'）を
// 共有し、各ビューは props で受けた yearMonth の範囲だけを読む。

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { SalesView } from './analytics/SalesView';
import { PayrollView } from './analytics/PayrollView';
import { AttendanceView } from './analytics/AttendanceView';
import { currentYearMonth, shiftYearMonth } from './analytics/common';
import type { TKey } from '../i18n';

type Segment = 'sales' | 'payroll' | 'attendance';

const SEGMENT_KEYS: Record<Segment, TKey> = {
  sales: 'analytics.segment.sales',
  payroll: 'analytics.segment.payroll',
  attendance: 'analytics.segment.attendance',
};

const SEGMENT_ICONS: Record<
  Segment,
  React.ComponentProps<typeof MaterialCommunityIcons>['name']
> = {
  sales: 'cash-register',
  payroll: 'account-cash',
  attendance: 'calendar-account',
};

const SEGMENTS: Segment[] = ['sales', 'payroll', 'attendance'];

export function AnalyticsScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { tenant } = useTenant();
  const insets = useSafeAreaInsets();

  const [segment, setSegment] = useState<Segment>('sales');
  const [yearMonth, setYearMonth] = useState(currentYearMonth());

  if (!tenant) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const [year, month] = yearMonth.split('-');
  const monthLabel = t('analytics.monthLabel', {
    year,
    month: String(Number(month)),
  });

  return (
    <View style={[s.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('analytics.title')}</Text>
      </View>

      {/* 月ナビゲーション */}
      <View style={s.monthNav}>
        <TouchableOpacity
          onPress={() => setYearMonth(shiftYearMonth(yearMonth, -1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[s.monthLabel, { color: theme.text }]}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={() => setYearMonth(shiftYearMonth(yearMonth, 1))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="chevron-right" size={28} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* セグメント切替（売上/給与/勤怠） */}
      <View style={[s.segmentRow, { borderColor: theme.border }]}>
        {SEGMENTS.map((seg) => {
          const active = segment === seg;
          return (
            <TouchableOpacity
              key={seg}
              style={[
                s.segmentBtn,
                { backgroundColor: active ? theme.primary : theme.card, borderColor: theme.border },
              ]}
              onPress={() => setSegment(seg)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={SEGMENT_ICONS[seg]}
                size={16}
                color={active ? '#fff' : theme.subtext}
              />
              <Text style={[s.segmentText, { color: active ? '#fff' : theme.text }]}>
                {t(SEGMENT_KEYS[seg])}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {segment === 'sales' && (
        <SalesView tenant={tenant} theme={theme} t={t} yearMonth={yearMonth} />
      )}
      {segment === 'payroll' && (
        <PayrollView tenant={tenant} theme={theme} t={t} yearMonth={yearMonth} />
      )}
      {segment === 'attendance' && (
        <AttendanceView tenant={tenant} theme={theme} t={t} yearMonth={yearMonth} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 16 },
  monthLabel: { fontSize: 17, fontWeight: '700', minWidth: 120, textAlign: 'center' },
  segmentRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, gap: 8 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 18, borderWidth: 1, gap: 5 },
  segmentText: { fontSize: 13, fontWeight: '600' },
});
