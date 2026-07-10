import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from './common/FormModalShell';
import type { ThemeColor } from '../types';
import type { TKey } from '../i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (startAt: string, endAt: string) => void;
  onResetToDefault: () => void;
  theme: ThemeColor;
  t: (key: TKey, params?: Record<string, string>) => string;
  date: string;
  initialStart: string;
  initialEnd: string;
  isCustom: boolean;
};

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function timeToSlot(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 4 + Math.floor(m / 15);
}

function slotToTime(slot: number): string {
  const h = Math.floor(slot / 4);
  const m = (slot % 4) * 15;
  return `${pad2(h)}:${pad2(m)}`;
}

const MIN_SLOT = 0;
const MAX_SLOT = 29 * 4 + 3;

export function ShiftTimeEditModal({
  visible,
  onClose,
  onSave,
  onResetToDefault,
  theme,
  t,
  date,
  initialStart,
  initialEnd,
  isCustom,
}: Props) {
  const [startSlot, setStartSlot] = useState(0);
  const [endSlot, setEndSlot] = useState(0);

  useEffect(() => {
    if (visible) {
      setStartSlot(timeToSlot(initialStart));
      setEndSlot(timeToSlot(initialEnd));
    }
  }, [visible, initialStart, initialEnd]);

  const handleSave = () => {
    onSave(slotToTime(startSlot), slotToTime(endSlot));
  };

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={st.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialCommunityIcons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: theme.text }]}>
          {t('shiftSubmit.editTime')} — {date}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={st.body}>
        <TimeStepper
          label={t('shiftSubmit.startTime')}
          slot={startSlot}
          onChange={setStartSlot}
          theme={theme}
        />
        <TimeStepper
          label={t('shiftSubmit.endTime')}
          slot={endSlot}
          onChange={setEndSlot}
          theme={theme}
        />

        {isCustom && (
          <TouchableOpacity
            style={[st.resetBtn, { borderColor: theme.border }]}
            onPress={onResetToDefault}
          >
            <MaterialCommunityIcons name="restore" size={18} color={theme.subtext} />
            <Text style={[st.resetText, { color: theme.subtext }]}>
              {t('shiftSubmit.resetToDefault')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={st.footer}>
        <TouchableOpacity
          style={[st.saveBtn, { backgroundColor: theme.primary }]}
          onPress={handleSave}
        >
          <Text style={st.saveBtnText}>{t('common.save')}</Text>
        </TouchableOpacity>
      </View>
    </FormModalShell>
  );
}

function TimeStepper({
  label,
  slot,
  onChange,
  theme,
}: {
  label: string;
  slot: number;
  onChange: (s: number) => void;
  theme: ThemeColor;
}) {
  return (
    <View style={st.stepperRow}>
      <Text style={[st.stepperLabel, { color: theme.text }]}>{label}</Text>
      <View style={st.stepperControls}>
        <TouchableOpacity
          onPress={() => onChange(Math.max(MIN_SLOT, slot - 1))}
          disabled={slot <= MIN_SLOT}
        >
          <MaterialCommunityIcons
            name="minus-circle-outline"
            size={32}
            color={slot <= MIN_SLOT ? theme.border : theme.primary}
          />
        </TouchableOpacity>
        <Text style={[st.stepperValue, { color: theme.text }]}>{slotToTime(slot)}</Text>
        <TouchableOpacity
          onPress={() => onChange(Math.min(MAX_SLOT, slot + 1))}
          disabled={slot >= MAX_SLOT}
        >
          <MaterialCommunityIcons
            name="plus-circle-outline"
            size={32}
            color={slot >= MAX_SLOT ? theme.border : theme.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  body: { padding: 20, gap: 24 },
  stepperRow: { gap: 8 },
  stepperLabel: { fontSize: 14, fontWeight: '600' },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  stepperValue: { fontSize: 28, fontWeight: '700', minWidth: 90, textAlign: 'center' },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
  },
  resetText: { fontSize: 14 },
  footer: { padding: 16 },
  saveBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
