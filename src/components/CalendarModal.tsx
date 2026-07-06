import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

type Props = {
  visible: boolean;
  value: string;
  onSelect: (date: string) => void;
  onClose: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
};

function toDate(s: string): Date {
  if (!s) return new Date();
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CalendarModal({ visible, value, onSelect, onClose, minimumDate, maximumDate }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [temp, setTemp] = useState(() => toDate(value));

  React.useEffect(() => {
    if (visible) setTemp(toDate(value));
  }, [visible, value]);

  if (Platform.OS === 'android') {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={temp}
        mode="date"
        display="default"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={(_e, selected) => {
          onClose();
          if (selected) onSelect(formatDate(selected));
        }}
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <DateTimePicker
            value={temp}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_e, selected) => { if (selected) setTemp(selected); }}
            style={{ height: 200 }}
          />
          <View style={s.btnRow}>
            <TouchableOpacity style={s.btn} onPress={onClose}>
              <Text style={[s.btnText, { color: theme.subtext }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.btn}
              onPress={() => { onSelect(formatDate(temp)); onClose(); }}
            >
              <Text style={[s.btnText, { color: theme.primary, fontWeight: '700' }]}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  card: { width: 320, borderRadius: 14, borderWidth: 0.5, padding: 16 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 12 },
  btn: { paddingHorizontal: 16, paddingVertical: 10 },
  btnText: { fontSize: 16 },
});
