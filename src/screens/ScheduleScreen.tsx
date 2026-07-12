import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { FormModalShell } from '../components/common/FormModalShell';
import { QrLinkCard } from '../components/QrLinkCard';
import * as scheduleService from '../services/schedule';
import * as seatTypeService from '../services/seatTypes';
import type { UnlockWindow, SeatType, ThemeColor } from '../types';
import type { TKey } from '../i18n';
import { formatDateKey, dateLabel, pad2 } from '../utils/dateFormat';

function buildDateList(days: number): Date[] {
  const list: Date[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    list.push(d);
  }
  return list;
}

const DATE_LIST = buildDateList(60);

export function ScheduleScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { tenant } = useTenant();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [windows, setWindows] = useState<UnlockWindow[]>([]);
  const [seatTypes, setSeatTypes] = useState<SeatType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [seatTypeModalVisible, setSeatTypeModalVisible] = useState(false);
  const [editingSeatType, setEditingSeatType] = useState<SeatType | null>(null);

  const loadWindows = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await scheduleService.fetchWindows(tenant.id, selectedDate);
      setWindows(data);
    } catch (e: unknown) {
      console.warn('[kyasuho] fetchWindows:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant, selectedDate]);

  useEffect(() => {
    void loadWindows();
  }, [loadWindows]);

  const loadSeatTypes = useCallback(async () => {
    if (!tenant) return;
    try {
      const data = await seatTypeService.fetchSeatTypes(tenant.id);
      setSeatTypes(data);
    } catch (e: unknown) {
      console.warn('[kyasuho] fetchSeatTypes:', e);
    }
  }, [tenant]);

  useEffect(() => {
    void loadSeatTypes();
  }, [loadSeatTypes]);

  const handleSeatTypeSave = useCallback(
    async (name: string, seatFee: number, capacity: number, id?: string) => {
      if (!tenant) return;
      try {
        if (id) {
          await seatTypeService.updateSeatType(id, { name, seatFee, capacity });
        } else {
          await seatTypeService.addSeatType(tenant.id, name, seatFee, capacity);
        }
        setSeatTypeModalVisible(false);
        setEditingSeatType(null);
        await loadSeatTypes();
      } catch (e: unknown) {
        Alert.alert(t('common.error'), String(e));
      }
    },
    [tenant, loadSeatTypes, t],
  );

  const handleSeatTypeDelete = useCallback(
    async (id: string) => {
      try {
        await seatTypeService.deleteSeatType(id);
        await loadSeatTypes();
      } catch (e: unknown) {
        Alert.alert(t('common.error'), String(e));
      }
    },
    [loadSeatTypes, t],
  );

  const handleSeatTypeToggle = useCallback(
    async (st: SeatType) => {
      try {
        await seatTypeService.updateSeatType(st.id, { isActive: !st.isActive });
        await loadSeatTypes();
      } catch (e: unknown) {
        Alert.alert(t('common.error'), String(e));
      }
    },
    [loadSeatTypes, t],
  );

  const handleRemove = useCallback(
    async (id: string) => {
      try {
        await scheduleService.removeWindow(id);
        await loadWindows();
      } catch (e: unknown) {
        Alert.alert(t('common.error'), String(e));
      }
    },
    [loadWindows, t],
  );

  const handleAdd = useCallback(
    async (openFrom: string, closeAt: string | null, setMinutes: number) => {
      if (!tenant) return;
      try {
        await scheduleService.addWindow(tenant.id, selectedDate, openFrom, closeAt, setMinutes);
        setModalVisible(false);
        await loadWindows();
      } catch (e: unknown) {
        Alert.alert(t('common.error'), String(e));
      }
    },
    [tenant, selectedDate, loadWindows, t],
  );

  const publicUrl = tenant ? `https://rurifukuro.github.io/kyasuho/#/${tenant.slug}` : '';

  if (!tenant) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('schedule.title')}</Text>
      </View>

      <FlatList
        horizontal
        data={DATE_LIST}
        keyExtractor={(d) => formatDateKey(d)}
        showsHorizontalScrollIndicator={false}
        style={[s.dateStrip, { borderBottomColor: theme.border }]}
        contentContainerStyle={s.dateStripContent}
        renderItem={({ item }) => {
          const key = formatDateKey(item);
          const active = key === selectedDate;
          return (
            <TouchableOpacity
              style={[
                s.dateChip,
                { backgroundColor: active ? theme.primary : theme.card, borderColor: theme.border },
              ]}
              onPress={() => setSelectedDate(key)}
            >
              <Text style={[s.dateChipText, { color: active ? '#fff' : theme.text }]}>
                {dateLabel(item)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
        <Text style={[s.sectionTitle, { color: theme.text }]}>
          {t('schedule.windowsForDate', { date: selectedDate })}
        </Text>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={s.spinner} />
        ) : windows.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="calendar-blank" size={32} color={theme.subtext} />
            <Text style={[s.emptyText, { color: theme.subtext }]}>{t('schedule.noWindows')}</Text>
          </View>
        ) : (
          windows.map((w) => (
            <View key={w.id} style={[s.windowCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={s.windowMain}>
                <MaterialCommunityIcons name="clock-outline" size={20} color={theme.primary} />
                <Text style={[s.windowTime, { color: theme.text }]}>
                  {w.openFrom} 〜 {w.closeAt ?? t('schedule.manualClose')}
                </Text>
              </View>
              <View style={s.windowMeta}>
                <Text style={[s.windowMetaText, { color: theme.subtext }]}>
                  {t('schedule.setMinutes', { min: String(w.setMinutes) })}
                </Text>
              </View>
              <TouchableOpacity
                style={s.deleteBtn}
                onPress={() =>
                  Alert.alert(t('schedule.deleteConfirm'), '', [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.delete'), style: 'destructive', onPress: () => void handleRemove(w.id) },
                  ])
                }
              >
                <MaterialCommunityIcons name="delete-outline" size={22} color="#D7263D" />
              </TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: theme.primary }]}
          onPress={() => setModalVisible(true)}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          <Text style={s.addBtnText}>{t('schedule.addWindow')}</Text>
        </TouchableOpacity>

        <QrLinkCard
          title={t('schedule.publicUrl')}
          url={publicUrl}
          hint={t('schedule.publicUrlHint')}
          theme={theme}
          copyLabel={t('common.copyUrl')}
          copiedLabel={t('common.copied')}
        />

        {/* ── 席種管理セクション（§29） ── */}
        <Text style={[s.sectionTitle, { color: theme.text, marginTop: 24 }]}>
          {t('seatType.sectionTitle')}
        </Text>

        {seatTypes.length > 0 && (
          <Text style={[s.windowMetaText, { color: theme.subtext, marginBottom: 8 }]}>
            {t('seatType.totalCapacity', { count: String(seatTypes.filter((st) => st.isActive).reduce((sum, st) => sum + st.capacity, 0)) })}
          </Text>
        )}

        {seatTypes.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="sofa-outline" size={28} color={theme.subtext} />
            <Text style={[s.emptyText, { color: theme.subtext }]}>{t('seatType.empty')}</Text>
          </View>
        ) : (
          seatTypes.map((st) => (
            <View key={st.id} style={[s.windowCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={s.windowMain}>
                <MaterialCommunityIcons name="sofa-outline" size={20} color={st.isActive ? theme.primary : theme.subtext} />
                <Text style={[s.windowTime, { color: st.isActive ? theme.text : theme.subtext }]}>
                  {st.name}
                </Text>
                <Text style={[s.windowMetaText, { color: theme.subtext, marginLeft: 8 }]}>
                  {st.capacity}{t('schedule.seats')}
                </Text>
                {st.seatFee > 0 && (
                  <Text style={[s.windowMetaText, { color: theme.subtext, marginLeft: 4 }]}>
                    ¥{st.seatFee.toLocaleString()}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity onPress={() => void handleSeatTypeToggle(st)}>
                  <Text style={{ color: st.isActive ? '#22C55E' : theme.subtext, fontSize: 12, fontWeight: '600' }}>
                    {st.isActive ? t('seatType.active') : t('seatType.inactive')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setEditingSeatType(st); setSeatTypeModalVisible(true); }}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.subtext} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(t('seatType.deleteConfirm'), '', [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('common.delete'), style: 'destructive', onPress: () => void handleSeatTypeDelete(st.id) },
                    ])
                  }
                >
                  <MaterialCommunityIcons name="delete-outline" size={20} color="#D7263D" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: theme.primary }]}
          onPress={() => { setEditingSeatType(null); setSeatTypeModalVisible(true); }}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          <Text style={s.addBtnText}>{t('seatType.add')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <AddWindowModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={handleAdd}
        theme={theme}
        t={t}
      />

      <SeatTypeModal
        visible={seatTypeModalVisible}
        seatType={editingSeatType}
        onClose={() => { setSeatTypeModalVisible(false); setEditingSeatType(null); }}
        onSave={handleSeatTypeSave}
        theme={theme}
        t={t}
      />
    </View>
  );
}

type TFunc = (key: TKey, params?: Record<string, string | number>) => string;

type ModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (openFrom: string, closeAt: string | null, setMinutes: number) => Promise<void>;
  theme: ThemeColor;
  t: TFunc;
};

function AddWindowModal({ visible, onClose, onAdd, theme, t }: ModalProps) {
  const [startH, setStartH] = useState(18);
  const [startM, setStartM] = useState(0);
  const [endH, setEndH] = useState(22);
  const [endM, setEndM] = useState(0);
  const [setMin, setSetMin] = useState(60);
  const [useCloseAt, setUseCloseAt] = useState(false);
  const [saving, setSaving] = useState(false);

  const openFrom = `${pad2(startH)}:${pad2(startM)}`;
  const closeAt = useCloseAt ? `${pad2(endH)}:${pad2(endM)}` : null;

  const handleSubmit = async () => {
    setSaving(true);
    await onAdd(openFrom, closeAt, setMin);
    setSaving(false);
  };

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <ScrollView contentContainerStyle={ms.content}>
        <Text style={[ms.title, { color: theme.text }]}>{t('schedule.addWindow')}</Text>

        <Text style={[ms.label, { color: theme.subtext }]}>{t('schedule.startTime')}</Text>
        <View style={ms.timeRow}>
          <Stepper value={startH} min={0} max={28} onChange={setStartH} theme={theme} />
          <Text style={[ms.colon, { color: theme.text }]}>:</Text>
          <Stepper value={startM} min={0} max={50} step={10} onChange={setStartM} theme={theme} />
        </View>

        <TouchableOpacity style={ms.toggleRow} onPress={() => setUseCloseAt(!useCloseAt)}>
          <MaterialCommunityIcons
            name={useCloseAt ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={24}
            color={theme.primary}
          />
          <Text style={[ms.toggleLabel, { color: theme.text }]}>{t('schedule.autoClose')}</Text>
        </TouchableOpacity>

        {useCloseAt && (
          <>
            <Text style={[ms.label, { color: theme.subtext }]}>{t('schedule.endTime')}</Text>
            <View style={ms.timeRow}>
              <Stepper value={endH} min={0} max={28} onChange={setEndH} theme={theme} />
              <Text style={[ms.colon, { color: theme.text }]}>:</Text>
              <Stepper value={endM} min={0} max={50} step={10} onChange={setEndM} theme={theme} />
            </View>
          </>
        )}

        <Text style={[ms.label, { color: theme.subtext }]}>{t('schedule.setDuration')}</Text>
        <Stepper value={setMin} min={10} max={180} step={10} onChange={setSetMin} theme={theme} suffix={t('schedule.minutes')} />

        <View style={ms.btnRow}>
          <TouchableOpacity style={[ms.btn, { backgroundColor: theme.border }]} onPress={onClose}>
            <Text style={[ms.btnText, { color: theme.text }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ms.btn, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]}
            onPress={() => void handleSubmit()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[ms.btnText, { color: '#fff' }]}>{t('schedule.add')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </FormModalShell>
  );
}

type StepperProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  theme: ThemeColor;
  suffix?: string;
};

function Stepper({ value, min, max, step = 1, onChange, theme, suffix }: StepperProps) {
  return (
    <View style={ms.stepper}>
      <TouchableOpacity
        style={[ms.stepBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
      >
        <Text style={[ms.stepBtnText, { color: value <= min ? theme.border : theme.text }]}>{'−'}</Text>
      </TouchableOpacity>
      <Text style={[ms.stepValue, { color: theme.text }]}>
        {value}{suffix ?? ''}
      </Text>
      <TouchableOpacity
        style={[ms.stepBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
      >
        <Text style={[ms.stepBtnText, { color: value >= max ? theme.border : theme.text }]}>{'＋'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  dateStrip: { maxHeight: 52, borderBottomWidth: 1 },
  dateStripContent: { paddingHorizontal: 8, alignItems: 'center' },
  dateChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginHorizontal: 4, borderWidth: 1 },
  dateChipText: { fontSize: 13, fontWeight: '600' },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  spinner: { marginTop: 20 },
  emptyCard: { borderWidth: 1, borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, marginTop: 8 },
  windowCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  windowMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  windowTime: { fontSize: 16, fontWeight: '700', marginLeft: 8 },
  windowMeta: { marginRight: 10 },
  windowMetaText: { fontSize: 12 },
  deleteBtn: { padding: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 14, marginTop: 12, marginBottom: 24 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, marginLeft: 6 },
});

type SeatTypeModalProps = {
  visible: boolean;
  seatType: SeatType | null;
  onClose: () => void;
  onSave: (name: string, seatFee: number, capacity: number, id?: string) => Promise<void>;
  theme: ThemeColor;
  t: TFunc;
};

function SeatTypeModal({ visible, seatType, onClose, onSave, theme, t }: SeatTypeModalProps) {
  const [name, setName] = useState('');
  const [feeText, setFeeText] = useState('0');
  const [capacityText, setCapacityText] = useState('1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(seatType?.name ?? '');
      setFeeText(String(seatType?.seatFee ?? 0));
      setCapacityText(String(seatType?.capacity ?? 1));
    }
  }, [visible, seatType]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('seatType.nameRequired'));
      return;
    }
    const fee = parseInt(feeText, 10);
    if (isNaN(fee) || fee < 0) {
      Alert.alert(t('common.error'), t('seatType.feeInvalid'));
      return;
    }
    const cap = parseInt(capacityText, 10);
    if (isNaN(cap) || cap < 1) {
      Alert.alert(t('common.error'), t('seatType.capacityInvalid'));
      return;
    }
    setSaving(true);
    await onSave(name.trim(), fee, cap, seatType?.id);
    setSaving(false);
  };

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <ScrollView contentContainerStyle={ms.content} keyboardShouldPersistTaps="handled">
        <Text style={[ms.title, { color: theme.text }]}>
          {seatType ? t('seatType.edit') : t('seatType.add')}
        </Text>

        <Text style={[ms.label, { color: theme.subtext }]}>{t('seatType.name')}</Text>
        <TextInput
          style={[stms.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
          value={name}
          onChangeText={setName}
          placeholder={t('seatType.namePlaceholder')}
          placeholderTextColor={theme.subtext}
        />

        <Text style={[ms.label, { color: theme.subtext }]}>{t('seatType.fee')}</Text>
        <TextInput
          style={[stms.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
          value={feeText}
          onChangeText={setFeeText}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={theme.subtext}
        />

        <Text style={[ms.label, { color: theme.subtext }]}>{t('seatType.capacity')}</Text>
        <TextInput
          style={[stms.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
          value={capacityText}
          onChangeText={setCapacityText}
          keyboardType="number-pad"
          placeholder="1"
          placeholderTextColor={theme.subtext}
        />

        <View style={ms.btnRow}>
          <TouchableOpacity style={[ms.btn, { backgroundColor: theme.border }]} onPress={onClose}>
            <Text style={[ms.btnText, { color: theme.text }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ms.btn, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]}
            onPress={() => void handleSubmit()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[ms.btnText, { color: '#fff' }]}>{t('common.save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </FormModalShell>
  );
}

const ms = StyleSheet.create({
  content: { padding: 20 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  colon: { fontSize: 20, fontWeight: '700', marginHorizontal: 6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  toggleLabel: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, fontWeight: '600' },
  stepValue: { fontSize: 18, fontWeight: '700', minWidth: 50, textAlign: 'center' },
  btnRow: { flexDirection: 'row', marginTop: 28, gap: 12 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { fontWeight: '800', fontSize: 15 },
});

const stms = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
});
