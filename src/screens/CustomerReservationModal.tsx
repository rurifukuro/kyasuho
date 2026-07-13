import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from '../components/common/FormModalShell';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../config/supabase';
import { slotToMinutes, minutesToSlot, getAvailableSlots } from '../lib/timeUtils';

type Cast = { id: string; name: string; name_kana: string | null; accepts_nomination: boolean };
type Shift = { cast_id: string; start_at: string; end_at: string };
type Window = { open_from: string; close_at: string | null; set_minutes: number; seats: number };
type Reservation = { slot: string; set_minutes: number; seat_no: number; status: string };
type SeatType = { id: string; name: string; seat_fee: number; capacity: number; is_active: boolean };
type Slot = { slot: string; minutes: number; setMinutes: number; available: number; total: number };

type Props = {
  visible: boolean;
  onClose: () => void;
  tenantId: string;
  date: string;
  customerAccountId: string;
  onReserved: () => void;
};

export function CustomerReservationModal({
  visible, onClose, tenantId, date, customerAccountId, onReserved,
}: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [windows, setWindows] = useState<Window[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [seatTypes, setSeatTypes] = useState<SeatType[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [sets, setSets] = useState(1);
  const [name, setName] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [castId, setCastId] = useState('');
  const [seatTypeId, setSeatTypeId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !tenantId || !date) return;
    setLoading(true);
    setSelectedSlot(null);
    setSets(1);
    void (async () => {
      const [winRes, resvRes, castsRes, shiftRes, stRes] = await Promise.all([
        supabase.from('ky_unlock_windows').select('open_from, close_at, set_minutes, seats').eq('tenant_id', tenantId).eq('date', date).order('open_from'),
        supabase.from('ky_reservations').select('slot, set_minutes, seat_no, status').eq('tenant_id', tenantId).eq('date', date).in('status', ['reserved', 'checked_in']),
        supabase.from('ky_casts').select('id, name, name_kana, accepts_nomination').eq('tenant_id', tenantId),
        supabase.from('ky_shifts').select('cast_id, start_at, end_at').eq('tenant_id', tenantId).eq('date', date),
        supabase.from('ky_seat_types').select('id, name, seat_fee, capacity, is_active').eq('tenant_id', tenantId).eq('is_active', true),
      ]);
      setWindows((winRes.data as Window[] | null) ?? []);
      setReservations((resvRes.data as Reservation[] | null) ?? []);
      setCasts((castsRes.data as Cast[] | null) ?? []);
      setShifts((shiftRes.data as Shift[] | null) ?? []);
      setSeatTypes((stRes.data as SeatType[] | null) ?? []);
      setLoading(false);
    })();
  }, [visible, tenantId, date]);

  const totalSeats = useMemo(
    () => seatTypes.reduce((sum, st) => sum + (st.capacity ?? 1), 0) || 1,
    [seatTypes],
  );

  const slots = useMemo(
    () => getAvailableSlots(windows, reservations, totalSeats),
    [windows, reservations, totalSeats],
  );

  const maxSets = useMemo(() => {
    if (!selectedSlot) return 1;
    const wEnd = (() => {
      for (const w of windows) {
        const ws = slotToMinutes(w.open_from);
        const we = w.close_at ? slotToMinutes(w.close_at) : ws + 480;
        if (selectedSlot.minutes >= ws && selectedSlot.minutes < we) return we;
      }
      return selectedSlot.minutes + selectedSlot.setMinutes;
    })();
    return Math.max(1, Math.floor((wEnd - selectedSlot.minutes) / selectedSlot.setMinutes));
  }, [selectedSlot, windows]);

  const endMinutes = selectedSlot ? selectedSlot.minutes + Math.min(sets, maxSets) * selectedSlot.setMinutes : 0;

  const availableCasts = useMemo(() => {
    if (!selectedSlot) return [];
    const sm = selectedSlot.minutes;
    const em = endMinutes;
    return casts.filter(
      (c) => c.accepts_nomination && shifts.some((sh) => {
        if (sh.cast_id !== c.id) return false;
        const ss = slotToMinutes(sh.start_at);
        const se = slotToMinutes(sh.end_at);
        return sm >= ss && em <= se;
      }),
    ).sort((a, b) => (a.name_kana || '').localeCompare(b.name_kana || '', 'ja'));
  }, [selectedSlot, endMinutes, casts, shifts]);

  const selectedSeatType = seatTypes.find((st) => st.id === seatTypeId);
  const seatFee = selectedSeatType?.seat_fee ?? 0;
  const effectiveSets = Math.min(sets, maxSets);

  const handleSubmit = useCallback(async () => {
    if (!selectedSlot || !name.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc('ky_make_reservation', {
      p_tenant_id: tenantId,
      p_date: date,
      p_slot: selectedSlot.slot,
      p_customer_name: name.trim(),
      p_contact: '',
      p_party_size: partySize,
      p_cast_id: castId || null,
      p_note: note.trim(),
      p_pin: null,
      p_seat_type_id: seatTypeId || null,
      p_preorder: null,
      p_menu_undecided: true,
    });
    setSubmitting(false);

    const res = data as { id?: string; seat_no?: number; error?: string } | null;
    if (error) {
      Alert.alert(t('common.error'), t('customer.reserveError'));
      return;
    }
    if (res?.error === 'no_available_seat') {
      Alert.alert(t('common.error'), t('customer.reserveNoSeat'));
      return;
    }
    if (res?.error === 'not_unlocked') {
      Alert.alert(t('common.error'), t('customer.reserveNotOpen'));
      return;
    }
    if (res?.error === 'cast_not_available') {
      Alert.alert(t('common.error'), t('customer.reserveCastUnavailable'));
      return;
    }
    if (res?.id) {
      Alert.alert(t('customer.reserveSuccessTitle'), t('customer.reserveSuccessBody', { seat: String(res.seat_no ?? '-') }), [
        { text: 'OK', onPress: () => { onReserved(); onClose(); } },
      ]);
    }
  }, [selectedSlot, name, partySize, castId, seatTypeId, note, tenantId, date, t, onReserved, onClose]);

  const dateLabel = date.replace(/-/g, '/');

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <Text style={[st.title, { color: theme.text }]}>{t('customer.reserveTitle')}</Text>
      <Text style={[st.dateLabel, { color: theme.primary }]}>{dateLabel}</Text>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24 }} />
      ) : slots.length === 0 ? (
        <View style={st.emptyWrap}>
          <MaterialCommunityIcons name="calendar-remove" size={40} color={theme.border} />
          <Text style={[st.emptyText, { color: theme.subtext }]}>{t('customer.reserveNoSlots')}</Text>
        </View>
      ) : !selectedSlot ? (
        <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={st.slotsGrid}>
          {slots.map((sl) => (
            <TouchableOpacity
              key={sl.slot}
              style={[
                st.slotChip,
                { borderColor: sl.available > 0 ? theme.primary : theme.border },
                sl.available <= 0 && { opacity: 0.4 },
              ]}
              disabled={sl.available <= 0}
              onPress={() => setSelectedSlot(sl)}
            >
              <Text style={[st.slotTime, { color: sl.available > 0 ? theme.primary : theme.subtext }]}>
                {sl.slot}
              </Text>
              <Text style={[st.slotAvail, { color: sl.available > 0 ? theme.text : theme.subtext }]}>
                {sl.available > 0
                  ? t('customer.reserveSeatsAvail', { n: String(sl.available) })
                  : t('customer.reserveFull')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <ScrollView>
          <TouchableOpacity style={st.backToSlots} onPress={() => setSelectedSlot(null)}>
            <MaterialCommunityIcons name="arrow-left" size={18} color={theme.primary} />
            <Text style={{ color: theme.primary, fontSize: 14 }}>{t('customer.reserveBackToSlots')}</Text>
          </TouchableOpacity>

          <Text style={[st.fieldLabel, { color: theme.subtext }]}>{t('customer.reserveTime')}</Text>
          <Text style={[st.fieldValue, { color: theme.text }]}>
            {selectedSlot.slot}〜{minutesToSlot(endMinutes)}（{effectiveSets}{t('customer.reserveSetUnit')}）
          </Text>

          {maxSets > 1 && (
            <View style={st.setsRow}>
              {Array.from({ length: maxSets }, (_, i) => i + 1).map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[st.setBtn, n === effectiveSets && { backgroundColor: theme.primary }]}
                  onPress={() => setSets(n)}
                >
                  <Text style={{ color: n === effectiveSets ? '#fff' : theme.text, fontSize: 14, fontWeight: '600' }}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[st.fieldLabel, { color: theme.subtext }]}>{t('customer.reserveName')}</Text>
          <TextInput
            style={[st.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            value={name}
            onChangeText={setName}
            placeholder={t('customer.reserveNamePlaceholder')}
            placeholderTextColor={theme.subtext}
          />

          <Text style={[st.fieldLabel, { color: theme.subtext }]}>{t('customer.reservePartySize')}</Text>
          <View style={st.setsRow}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <TouchableOpacity
                key={n}
                style={[st.setBtn, n === partySize && { backgroundColor: theme.primary }]}
                onPress={() => setPartySize(n)}
              >
                <Text style={{ color: n === partySize ? '#fff' : theme.text, fontSize: 14, fontWeight: '600' }}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {availableCasts.length > 0 && (
            <>
              <Text style={[st.fieldLabel, { color: theme.subtext }]}>{t('customer.reserveCast')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.castStrip}>
                <TouchableOpacity
                  style={[st.castChip, !castId && { backgroundColor: theme.primary }]}
                  onPress={() => setCastId('')}
                >
                  <Text style={{ color: !castId ? '#fff' : theme.text, fontSize: 13 }}>{t('customer.reserveNoCast')}</Text>
                </TouchableOpacity>
                {availableCasts.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[st.castChip, castId === c.id && { backgroundColor: theme.primary }]}
                    onPress={() => setCastId(c.id)}
                  >
                    <Text style={{ color: castId === c.id ? '#fff' : theme.text, fontSize: 13 }}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {seatTypes.length > 1 && (
            <>
              <Text style={[st.fieldLabel, { color: theme.subtext }]}>{t('customer.reserveSeatType')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.castStrip}>
                <TouchableOpacity
                  style={[st.castChip, !seatTypeId && { backgroundColor: theme.primary }]}
                  onPress={() => setSeatTypeId('')}
                >
                  <Text style={{ color: !seatTypeId ? '#fff' : theme.text, fontSize: 13 }}>{t('customer.reserveNoSeatType')}</Text>
                </TouchableOpacity>
                {seatTypes.map((stt) => (
                  <TouchableOpacity
                    key={stt.id}
                    style={[st.castChip, seatTypeId === stt.id && { backgroundColor: theme.primary }]}
                    onPress={() => setSeatTypeId(stt.id)}
                  >
                    <Text style={{ color: seatTypeId === stt.id ? '#fff' : theme.text, fontSize: 13 }}>
                      {stt.seat_fee > 0 ? `${stt.name}（¥${stt.seat_fee.toLocaleString()}）` : stt.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {seatFee > 0 && (
            <View style={[st.feeBox, { borderColor: theme.border }]}>
              <Text style={[st.feeLabel, { color: theme.subtext }]}>{t('customer.reserveSeatFee')}</Text>
              <Text style={[st.feeValue, { color: theme.text }]}>¥{(seatFee * effectiveSets).toLocaleString()}</Text>
            </View>
          )}

          <Text style={[st.fieldLabel, { color: theme.subtext }]}>{t('customer.reserveNote')}</Text>
          <TextInput
            style={[st.input, st.inputMulti, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            value={note}
            onChangeText={setNote}
            placeholder={t('customer.reserveNotePlaceholder')}
            placeholderTextColor={theme.subtext}
            multiline
          />

          <TouchableOpacity
            style={[st.submitBtn, { backgroundColor: theme.primary }, (submitting || !name.trim()) && { opacity: 0.5 }]}
            onPress={() => void handleSubmit()}
            disabled={submitting || !name.trim()}
          >
            <Text style={st.submitText}>
              {submitting ? t('common.loading') : t('customer.reserveSubmit')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </FormModalShell>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  dateLabel: { fontSize: 15, fontWeight: '600', marginBottom: 16 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, minWidth: 90, alignItems: 'center' },
  slotTime: { fontSize: 16, fontWeight: '700' },
  slotAvail: { fontSize: 11, marginTop: 2 },
  backToSlots: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  fieldValue: { fontSize: 16, fontWeight: '700' },
  setsRow: { flexDirection: 'row', gap: 8 },
  setBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ccc' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  inputMulti: { height: 70, textAlignVertical: 'top' },
  castStrip: { gap: 8 },
  castChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ccc' },
  feeBox: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 12 },
  feeLabel: { fontSize: 13 },
  feeValue: { fontSize: 15, fontWeight: '700' },
  submitBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 20, marginBottom: 12 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
