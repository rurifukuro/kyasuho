import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from './common/FormModalShell';
import type { ThemeColor, ShiftReminderSettings } from '../types';
import type { TKey } from '../context/LanguageContext';
import * as shiftReqService from '../services/shiftRequests';

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: ThemeColor;
  t: (key: TKey) => string;
  tenantId: string;
};

function calcNextDeadline(deadlineDay: number): { label: string; deadlineDate: Date } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const thisMonthDeadline = new Date(y, m, deadlineDay);
  const deadline =
    now <= thisMonthDeadline
      ? thisMonthDeadline
      : new Date(m === 11 ? y + 1 : y, (m + 1) % 12, deadlineDay);
  const targetMonth = new Date(deadline.getFullYear(), deadline.getMonth() + 1, 1);
  const label = `${deadline.getMonth() + 1}/${deadline.getDate()}（${targetMonth.getFullYear()}年${targetMonth.getMonth() + 1}月分）`;
  return { label, deadlineDate: deadline };
}

function calcRemindDate(deadlineDate: Date, daysBefore: number): string {
  const d = new Date(deadlineDate);
  d.setDate(d.getDate() - daysBefore);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function ShiftReminderModal({ visible, onClose, theme, t, tenantId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [deadlineDay, setDeadlineDay] = useState(20);
  const [remindDaysBefore, setRemindDaysBefore] = useState(3);
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [remindHour, setRemindHour] = useState(12);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    shiftReqService
      .fetchReminderSettings(tenantId)
      .then((s) => {
        if (s) {
          setEnabled(s.enabled);
          setDeadlineDay(s.deadlineDay);
          setRemindDaysBefore(s.remindDaysBefore);
          setRepeatDaily(s.repeatDaily);
          setRemindHour(s.remindHour);
        }
      })
      .catch((e) => console.warn('[kyasuho] fetchReminderSettings:', e))
      .finally(() => setLoading(false));
  }, [visible, tenantId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await shiftReqService.upsertReminderSettings(tenantId, {
        enabled,
        deadlineDay,
        remindDaysBefore,
        repeatDaily,
        remindHour,
      });
      Alert.alert(t('common.saved'));
      onClose();
    } catch (e) {
      console.warn('[kyasuho] upsertReminderSettings:', e);
      Alert.alert(t('common.error'));
    } finally {
      setSaving(false);
    }
  }, [tenantId, enabled, deadlineDay, remindDaysBefore, repeatDaily, remindHour, t, onClose]);

  const { label: deadlineLabel, deadlineDate } = calcNextDeadline(deadlineDay);
  const remindDateLabel = calcRemindDate(deadlineDate, remindDaysBefore);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={[st.header, { borderColor: theme.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: theme.text }]}>
          {t('shiftReminder.title')}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[st.saveBtn, { color: theme.primary, opacity: saving ? 0.5 : 1 }]}>
            {t('common.save')}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View style={[st.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={st.switchRow}>
              <Text style={[st.label, { color: theme.text }]}>{t('shiftReminder.enable')}</Text>
              <Switch value={enabled} onValueChange={setEnabled} />
            </View>
            <Text style={[st.hint, { color: theme.subtext }]}>
              {t('shiftReminder.enableHint')}
            </Text>
          </View>

          {enabled && (
            <>
              <View style={[st.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[st.label, { color: theme.text }]}>{t('shiftReminder.deadlineDay')}</Text>
                <View style={st.stepperRow}>
                  <TouchableOpacity
                    style={[st.stepBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setDeadlineDay((d) => Math.max(1, d - 1))}
                  >
                    <Text style={st.stepBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={[st.stepValue, { color: theme.text }]}>
                    {t('shiftReminder.everyMonth')} {deadlineDay}{t('shiftReminder.day')}
                  </Text>
                  <TouchableOpacity
                    style={[st.stepBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setDeadlineDay((d) => Math.min(28, d + 1))}
                  >
                    <Text style={st.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[st.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[st.label, { color: theme.text }]}>{t('shiftReminder.remindBefore')}</Text>
                <View style={st.stepperRow}>
                  <TouchableOpacity
                    style={[st.stepBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setRemindDaysBefore((d) => Math.max(0, d - 1))}
                  >
                    <Text style={st.stepBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={[st.stepValue, { color: theme.text }]}>
                    {remindDaysBefore === 0
                      ? t('shiftReminder.onDeadline')
                      : `${remindDaysBefore}${t('shiftReminder.daysBefore')}`}
                  </Text>
                  <TouchableOpacity
                    style={[st.stepBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setRemindDaysBefore((d) => Math.min(27, d + 1))}
                  >
                    <Text style={st.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[st.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={st.switchRow}>
                  <Text style={[st.label, { color: theme.text }]}>{t('shiftReminder.repeatDaily')}</Text>
                  <Switch value={repeatDaily} onValueChange={setRepeatDaily} />
                </View>
                <Text style={[st.hint, { color: theme.subtext }]}>
                  {t('shiftReminder.repeatDailyHint')}
                </Text>
              </View>

              <View style={[st.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[st.label, { color: theme.text }]}>{t('shiftReminder.remindHour')}</Text>
                <View style={st.stepperRow}>
                  <TouchableOpacity
                    style={[st.stepBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setRemindHour((h) => Math.max(0, h - 1))}
                  >
                    <Text style={st.stepBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={[st.stepValue, { color: theme.text }]}>
                    {remindHour}:00
                  </Text>
                  <TouchableOpacity
                    style={[st.stepBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setRemindHour((h) => Math.min(23, h + 1))}
                  >
                    <Text style={st.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[st.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[st.label, { color: theme.text }]}>
                  {t('shiftReminder.preview')}
                </Text>
                <View style={{ gap: 4, marginTop: 6 }}>
                  <Text style={[st.previewLine, { color: theme.text }]}>
                    {t('shiftReminder.nextDeadline')}: {deadlineLabel}
                  </Text>
                  <Text style={[st.previewLine, { color: theme.primary }]}>
                    {t('shiftReminder.notifyDate')}: {remindDateLabel}
                    {repeatDaily ? ` 〜 ${deadlineDay}${t('shiftReminder.day')}` : ''}
                    {` ${remindHour}:00`}
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </FormModalShell>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  saveBtn: { fontSize: 16, fontWeight: '600' },
  card: { borderRadius: 12, borderWidth: 0.5, padding: 14 },
  label: { fontSize: 15, fontWeight: '500' },
  hint: { fontSize: 12, marginTop: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  stepValue: { fontSize: 16, fontWeight: '600', minWidth: 120, textAlign: 'center' },
  previewLine: { fontSize: 14 },
});
