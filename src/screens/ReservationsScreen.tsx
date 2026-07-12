import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { FormModalShell } from '../components/common/FormModalShell';
import { AnchoredDropdown, type DropOption } from '../components/AnchoredDropdown';
import * as reservationService from '../services/reservations';
import { fetchCasts } from '../services/casts';
import { fetchSeatTypes } from '../services/seatTypes';
import { guardFields } from '../utils/contentGuard';
import type { Cast, SeatType, Reservation, ReservationStatus, ThemeColor } from '../types';
import type { TKey } from '../i18n';
import { formatDateKey, dateLabel, pad2 } from '../utils/dateFormat';

function buildDateList(past: number, future: number): Date[] {
  const list: Date[] = [];
  const now = new Date();
  for (let i = -past; i < future; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    list.push(d);
  }
  return list;
}

const DATE_LIST = buildDateList(7, 30);

const STATUS_ICON: Record<ReservationStatus, { icon: string; color: string }> = {
  reserved: { icon: 'clock-outline', color: '#3B82F6' },
  checked_in: { icon: 'check-circle', color: '#22C55E' },
  cancelled: { icon: 'close-circle', color: '#9CA3AF' },
  no_show: { icon: 'alert-circle', color: '#EF4444' },
};

export function ReservationsScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { tenant } = useTenant();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [seatTypes, setSeatTypes] = useState<SeatType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Reservation | null>(null);
  const [noShowCounts, setNoShowCounts] = useState<Map<string, number>>(new Map());

  const loadReservations = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await reservationService.fetchReservations(tenant.id, selectedDate);
      setReservations(data);
      const contacts = [...new Set(data.map((r) => r.contact).filter(Boolean))];
      const counts = new Map<string, number>();
      await Promise.all(
        contacts.map(async (c) => {
          const n = await reservationService.countNoShowByContact(tenant.id, c);
          if (n > 0) counts.set(c, n);
        }),
      );
      setNoShowCounts(counts);
    } catch (e: unknown) {
      console.warn('[kyasuho] fetchReservations:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant, selectedDate]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    if (!tenant) return;
    void fetchCasts(tenant.id).then(setCasts).catch(() => {});
    void fetchSeatTypes(tenant.id).then((all) => setSeatTypes(all.filter((st) => st.isActive))).catch(() => {});
  }, [tenant]);

  const handleStatusChange = useCallback(
    async (id: string, status: ReservationStatus) => {
      if (!tenant) return;
      try {
        if (status === 'checked_in') {
          await reservationService.checkinReservation(id, tenant.id);
        } else if (status === 'reserved') {
          const { closedCount } = await reservationService.revertCheckin(id, tenant.id);
          if (closedCount > 0) {
            Alert.alert('', t('reservation.revertClosedWarning'));
          }
        } else {
          await reservationService.updateStatus(id, status);
        }
        await loadReservations();
      } catch (e: unknown) {
        Alert.alert(t('common.error'), String(e));
      }
    },
    [tenant, loadReservations, t],
  );

  const handleAdd = useCallback(
    async (name: string, contact: string, slot: string, partySize: number, note: string, castId: string | null, seatTypeId: string | null) => {
      if (!tenant) return;
      try {
        await reservationService.makeReservation(
          tenant.id, selectedDate, slot, name, contact, partySize, castId, note, null, seatTypeId,
        );
        setModalVisible(false);
        await loadReservations();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const key = msg === 'no_available_seat' ? t('reservation.errorNoSeat') :
                    msg === 'not_unlocked' ? t('reservation.errorNotUnlocked') :
                    msg === 'duplicate_contact' ? t('reservation.errorDuplicateContact') :
                    msg === 'cast_not_available' ? t('reservation.errorCastNotAvailable') :
                    msg;
        Alert.alert(t('common.error'), key);
      }
    },
    [tenant, selectedDate, loadReservations, t],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await reservationService.deleteReservation(id);
        await loadReservations();
      } catch (e: unknown) {
        Alert.alert(t('common.error'), String(e));
      }
    },
    [loadReservations, t],
  );

  const activeCount = reservations.filter((r) => r.status === 'reserved' || r.status === 'checked_in').length;

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
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('reservation.title')}</Text>
        <View style={[s.badge, { backgroundColor: theme.primary }]}>
          <Text style={s.badgeText}>{activeCount}</Text>
        </View>
      </View>

      <FlatList
        horizontal
        data={DATE_LIST}
        keyExtractor={(d) => formatDateKey(d)}
        showsHorizontalScrollIndicator={false}
        style={[s.dateStrip, { borderBottomColor: theme.border }]}
        contentContainerStyle={s.dateStripContent}
        initialScrollIndex={7}
        getItemLayout={(_, index) => ({ length: 76, offset: 76 * index, index })}
        renderItem={({ item }) => {
          const key = formatDateKey(item);
          const active = key === selectedDate;
          return (
            <TouchableOpacity
              style={[s.dateChip, { backgroundColor: active ? theme.primary : theme.card, borderColor: theme.border }]}
              onPress={() => setSelectedDate(key)}
            >
              <Text numberOfLines={1} style={[s.dateChipText, { color: active ? '#fff' : theme.text }]}>{dateLabel(item)}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
        {loading ? (
          <ActivityIndicator color={theme.primary} style={s.spinner} />
        ) : reservations.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="calendar-check" size={32} color={theme.subtext} />
            <Text style={[s.emptyText, { color: theme.subtext }]}>{t('reservation.noReservations')}</Text>
          </View>
        ) : (
          reservations.map((r) => {
            const si = STATUS_ICON[r.status];
            return (
              <TouchableOpacity
                key={r.id}
                style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => setDetailTarget(r)}
                activeOpacity={0.7}
              >
                <View style={s.cardRow}>
                  <MaterialCommunityIcons name={si.icon as 'clock-outline'} size={22} color={si.color} />
                  <Text style={[s.cardSlot, { color: theme.text }]}>{r.slot}</Text>
                  {r.seatNo != null && (
                    <View style={[s.seatBadge, { backgroundColor: theme.primaryLight + '30' }]}>
                      <Text style={[s.seatBadgeText, { color: theme.primary }]}>
                        {t('reservation.seatNo', { no: String(r.seatNo) })}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[s.cardName, { color: theme.text }]}>
                    {r.customerName}{r.partySize > 1 ? ` (${r.partySize}${t('reservation.people')})` : ''}
                  </Text>
                  {r.contact && (noShowCounts.get(r.contact) ?? 0) > 0 && (
                    <View style={{ backgroundColor: '#FEE2E2', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#DC2626' }}>
                        {t('reservation.noShowCount', { count: String(noShowCounts.get(r.contact)) })}
                      </Text>
                    </View>
                  )}
                </View>
                {r.contact ? <Text style={[s.cardSub, { color: theme.subtext }]}>{r.contact}</Text> : null}
                {r.note ? <Text style={[s.cardNote, { color: theme.subtext }]}>{r.note}</Text> : null}
                <Text style={[s.cardStatus, { color: si.color }]}>{t(`reservation.status.${r.status}` as TKey)}</Text>
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: theme.primary }]}
          onPress={() => setModalVisible(true)}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          <Text style={s.addBtnText}>{t('reservation.addManual')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {detailTarget && (
        <DetailModal
          reservation={detailTarget}
          onClose={() => setDetailTarget(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          noShowCount={detailTarget.contact ? (noShowCounts.get(detailTarget.contact) ?? 0) : 0}
          theme={theme}
          t={t}
        />
      )}

      <AddReservationModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={handleAdd}
        casts={casts}
        seatTypes={seatTypes}
        theme={theme}
        t={t}
      />
    </View>
  );
}

type TFunc = (key: TKey, params?: Record<string, string | number>) => string;

type DetailProps = {
  reservation: Reservation;
  onClose: () => void;
  onStatusChange: (id: string, status: ReservationStatus) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  noShowCount: number;
  theme: ThemeColor;
  t: TFunc;
};

function DetailModal({ reservation: r, onClose, onStatusChange, onDelete, noShowCount, theme, t }: DetailProps) {
  const statusActions: { status: ReservationStatus; label: TKey; icon: string; color: string }[] = [
    { status: 'checked_in', label: 'reservation.action.checkIn', icon: 'check-circle', color: '#22C55E' },
    { status: 'no_show', label: 'reservation.action.noShow', icon: 'alert-circle', color: '#EF4444' },
    { status: 'cancelled', label: 'reservation.action.cancel', icon: 'close-circle', color: '#9CA3AF' },
    { status: 'reserved', label: 'reservation.action.revert', icon: 'undo', color: '#3B82F6' },
  ];

  return (
    <FormModalShell visible={true} onRequestClose={onClose} theme={theme}>
      <ScrollView contentContainerStyle={ms.content}>
        <Text style={[ms.title, { color: theme.text }]}>{t('reservation.detail')}</Text>

        <InfoRow icon="clock-outline" label={t('reservation.slot')} value={r.slot} theme={theme} />
        <InfoRow icon="account" label={t('reservation.customerName')} value={r.customerName} theme={theme} />
        {r.contact ? <InfoRow icon="phone" label={t('reservation.contact')} value={r.contact} theme={theme} /> : null}
        {noShowCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <MaterialCommunityIcons name="alert-circle" size={18} color="#DC2626" />
            <Text style={{ color: '#DC2626', fontSize: 13, fontWeight: '600', flex: 1 }}>
              {t('reservation.noShowWarning', { count: String(noShowCount) })}
            </Text>
          </View>
        )}
        <InfoRow icon="account-group" label={t('reservation.partySize')} value={`${r.partySize}${t('reservation.people')}`} theme={theme} />
        {r.seatNo != null && <InfoRow icon="seat" label={t('reservation.seats')} value={t('reservation.seatNo', { no: String(r.seatNo) })} theme={theme} />}
        {r.note ? <InfoRow icon="note-text" label={t('reservation.note')} value={r.note} theme={theme} /> : null}

        <Text style={[ms.sectionLabel, { color: theme.subtext }]}>{t('reservation.changeStatus')}</Text>

        {statusActions.filter((a) => a.status !== r.status).map((a) => (
          <TouchableOpacity
            key={a.status}
            style={[ms.actionBtn, { borderColor: a.color }]}
            onPress={() => {
              void onStatusChange(r.id, a.status);
              onClose();
            }}
          >
            <MaterialCommunityIcons name={a.icon as 'check-circle'} size={20} color={a.color} />
            <Text style={[ms.actionLabel, { color: a.color }]}>{t(a.label)}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[ms.deleteBtn, { borderColor: '#D7263D' }]}
          onPress={() => {
            Alert.alert(t('reservation.deleteConfirm'), '', [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.delete'), style: 'destructive', onPress: () => { void onDelete(r.id); onClose(); } },
            ]);
          }}
        >
          <MaterialCommunityIcons name="delete-outline" size={20} color="#D7263D" />
          <Text style={[ms.actionLabel, { color: '#D7263D' }]}>{t('common.delete')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[ms.closeBtn, { backgroundColor: theme.border }]} onPress={onClose}>
          <Text style={[ms.closeBtnText, { color: theme.text }]}>{t('reservation.close')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </FormModalShell>
  );
}

function InfoRow({ icon, label, value, theme }: { icon: string; label: string; value: string; theme: ThemeColor }) {
  return (
    <View style={ms.infoRow}>
      <MaterialCommunityIcons name={icon as 'clock-outline'} size={18} color={theme.subtext} />
      <Text style={[ms.infoLabel, { color: theme.subtext }]}>{label}</Text>
      <Text style={[ms.infoValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

type AddProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, contact: string, slot: string, partySize: number, note: string, castId: string | null, seatTypeId: string | null) => Promise<void>;
  casts: Cast[];
  seatTypes: SeatType[];
  theme: ThemeColor;
  t: TFunc;
};

function AddReservationModal({ visible, onClose, onAdd, casts, seatTypes, theme, t }: AddProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [hour, setHour] = useState(18);
  const [minute, setMinute] = useState(0);
  const [partySize, setPartySize] = useState(1);
  const [castId, setCastId] = useState('');
  const [seatTypeId, setSeatTypeId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const slot = `${pad2(hour)}:${pad2(minute)}`;
  const nominatableCasts = casts
    .filter((c) => c.acceptsNomination)
    .sort((a, b) => (a.nameKana || '').localeCompare(b.nameKana || '', 'ja'));

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('reservation.errorNameRequired'));
      return;
    }
    if (!guardFields({ name, note }, t)) return;
    setSaving(true);
    await onAdd(name.trim(), contact.trim(), slot, partySize, note.trim(), castId || null, seatTypeId || null);
    setSaving(false);
  };

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <ScrollView contentContainerStyle={ms.content} keyboardShouldPersistTaps="handled">
        <Text style={[ms.title, { color: theme.text }]}>{t('reservation.addManual')}</Text>

        <Text style={[ms.label, { color: theme.subtext }]}>{t('reservation.customerName')}</Text>
        <TextInput
          style={[ms.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
          value={name}
          onChangeText={setName}
          placeholder={t('reservation.namePlaceholder')}
          placeholderTextColor={theme.subtext}
        />

        <Text style={[ms.label, { color: theme.subtext }]}>{t('reservation.contact')}</Text>
        <TextInput
          style={[ms.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
          value={contact}
          onChangeText={setContact}
          placeholder={t('reservation.contactPlaceholder')}
          placeholderTextColor={theme.subtext}
        />

        <Text style={[ms.label, { color: theme.subtext }]}>{t('reservation.slot')}</Text>
        <View style={ms.timeRow}>
          <Stepper value={hour} min={0} max={28} onChange={setHour} theme={theme} />
          <Text style={[ms.colon, { color: theme.text }]}>:</Text>
          <Stepper value={minute} min={0} max={50} step={10} onChange={setMinute} theme={theme} />
        </View>

        <Text style={[ms.label, { color: theme.subtext }]}>{t('reservation.partySize')}</Text>
        <Stepper value={partySize} min={1} max={20} onChange={setPartySize} theme={theme} suffix={t('reservation.people')} />

        {nominatableCasts.length > 0 && (
          <AnchoredDropdown
            label={t('reservation.nominationCast')}
            valueLabel={nominatableCasts.find((c) => c.id === castId)?.name ?? t('reservation.noNomination')}
            isPlaceholder={!castId}
            options={[
              { key: '__none__', label: t('reservation.noNomination'), active: !castId, onPress: () => setCastId('') },
              ...nominatableCasts.map((c): DropOption => ({
                key: c.id, label: c.name, active: c.id === castId, onPress: () => setCastId(c.id),
              })),
            ]}
            theme={theme}
          />
        )}

        {seatTypes.length > 0 && (
          <AnchoredDropdown
            label={t('seatType.label')}
            valueLabel={
              seatTypes.find((st) => st.id === seatTypeId)
                ? (() => {
                    const st = seatTypes.find((s) => s.id === seatTypeId)!;
                    return st.seatFee > 0 ? `${st.name}（¥${st.seatFee.toLocaleString()}）` : st.name;
                  })()
                : t('seatType.noPreference')
            }
            isPlaceholder={!seatTypeId}
            options={[
              { key: '__none__', label: t('seatType.noPreference'), active: !seatTypeId, onPress: () => setSeatTypeId('') },
              ...seatTypes.map((st): DropOption => ({
                key: st.id,
                label: st.seatFee > 0 ? `${st.name}（¥${st.seatFee.toLocaleString()}）` : st.name,
                active: st.id === seatTypeId,
                onPress: () => setSeatTypeId(st.id),
              })),
            ]}
            theme={theme}
          />
        )}

        <Text style={[ms.label, { color: theme.subtext }]}>{t('reservation.note')}</Text>
        <TextInput
          style={[ms.input, ms.multiline, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
          placeholder={t('reservation.notePlaceholder')}
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
              <Text style={[ms.btnText, { color: '#fff' }]}>{t('reservation.submit')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </FormModalShell>
  );
}

type StepperProps = {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; theme: ThemeColor; suffix?: string;
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
      <Text style={[ms.stepValue, { color: theme.text }]}>{value}{suffix ?? ''}</Text>
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
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', flex: 1 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2, marginLeft: 8 },
  badgeText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  dateStrip: { maxHeight: 52, borderBottomWidth: 1 },
  dateStripContent: { paddingHorizontal: 8, alignItems: 'center' },
  dateChip: { paddingHorizontal: 4, paddingVertical: 8, borderRadius: 20, marginHorizontal: 4, borderWidth: 1, width: 68, alignItems: 'center' },
  dateChipText: { fontSize: 13, fontWeight: '600' },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },
  spinner: { marginTop: 20 },
  emptyCard: { borderWidth: 1, borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cardSlot: { fontSize: 16, fontWeight: '700', marginLeft: 8 },
  seatBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  seatBadgeText: { fontSize: 12, fontWeight: '700' },
  cardName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  cardSub: { fontSize: 13 },
  cardNote: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  cardStatus: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 14, marginTop: 12 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, marginLeft: 6 },
});

const ms = StyleSheet.create({
  content: { padding: 20 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  colon: { fontSize: 20, fontWeight: '700', marginHorizontal: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, fontWeight: '600' },
  stepValue: { fontSize: 18, fontWeight: '700', minWidth: 50, textAlign: 'center' },
  btnRow: { flexDirection: 'row', marginTop: 28, gap: 12 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { fontWeight: '800', fontSize: 15 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  infoLabel: { fontSize: 13, width: 80, marginLeft: 8 },
  infoValue: { fontSize: 15, fontWeight: '600', flex: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 8 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, marginTop: 16 },
  actionLabel: { fontSize: 15, fontWeight: '700', marginLeft: 10 },
  closeBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  closeBtnText: { fontWeight: '800', fontSize: 15 },
});
