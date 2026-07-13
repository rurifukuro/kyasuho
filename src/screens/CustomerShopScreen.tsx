import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../config/supabase';
import { CustomerReservationModal } from './CustomerReservationModal';

type Props = {
  tenantId: string;
  slug: string;
  customerAccountId: string;
  onBack: () => void;
};

type ShopInfo = {
  name: string;
  genre: string | null;
  openHours: string | null;
};

type Cast = {
  id: string;
  name: string;
  photo_url: string | null;
  accepts_nomination: boolean;
  accepts_offschedule_nomination: boolean;
};

type Shift = { id: string; cast_id: string; date: string; start_at: string; end_at: string };
type EventItem = { id: string; title: string; description: string; event_date: string; start_time: string | null; end_time: string | null };

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

export function CustomerShopScreen({ tenantId, customerAccountId, onBack }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [qrVisible, setQrVisible] = useState(false);
  const [reserveVisible, setReserveVisible] = useState(false);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));

  const dates = useMemo(() => {
    const arr: string[] = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      arr.push(toDateStr(d));
    }
    return arr;
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const [tenantRes, castsRes, eventsRes] = await Promise.all([
        supabase.from('ky_tenants').select('name, genre, business_info').eq('id', tenantId).single(),
        supabase.from('ky_casts').select('id, name, photo_url, accepts_nomination, accepts_offschedule_nomination').eq('tenant_id', tenantId).order('sort_order'),
        supabase.from('ky_events').select('id, title, description, event_date, start_time, end_time').eq('tenant_id', tenantId).eq('is_public', true).gte('event_date', toDateStr(new Date())).order('event_date').limit(20),
      ]);
      if (tenantRes.data) {
        const bi = (tenantRes.data as Record<string, unknown>).business_info as Record<string, unknown> | null;
        setShop({
          name: (tenantRes.data as Record<string, unknown>).name as string,
          genre: ((tenantRes.data as Record<string, unknown>).genre as string) || null,
          openHours: (bi?.openHours as string) || null,
        });
      }
      setCasts((castsRes.data as Cast[] | null) ?? []);
      setEvents((eventsRes.data as EventItem[] | null) ?? []);
      setLoading(false);
    })();
  }, [tenantId]);

  const loadShifts = useCallback(async (date: string) => {
    const { data } = await supabase
      .from('ky_shifts')
      .select('id, cast_id, date, start_at, end_at')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .order('start_at');
    setShifts((data as Shift[] | null) ?? []);
  }, [tenantId]);

  useEffect(() => { void loadShifts(selectedDate); }, [selectedDate, loadShifts]);

  const shiftsForDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      const arr = map.get(s.cast_id) ?? [];
      arr.push(s);
      map.set(s.cast_id, arr);
    }
    return map;
  }, [shifts]);

  const workingCasts = useMemo(() =>
    casts.filter((c) => shiftsForDate.has(c.id)),
  [casts, shiftsForDate]);

  const offScheduleCasts = useMemo(() =>
    casts.filter((c) => !shiftsForDate.has(c.id) && c.accepts_offschedule_nomination),
  [casts, shiftsForDate]);

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: theme.background }]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  const dateObj = new Date(selectedDate + 'T00:00:00');
  const dayLabel = `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${WEEKDAYS_JA[dateObj.getDay()]})`;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.shopName, { color: theme.text }]} numberOfLines={1}>{shop?.name}</Text>
          {shop?.genre ? <Text style={[s.shopGenre, { color: theme.subtext }]}>{shop.genre}</Text> : null}
        </View>
        <TouchableOpacity onPress={() => setQrVisible(true)} style={s.qrBtn}>
          <MaterialCommunityIcons name="qrcode" size={26} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {shop?.openHours ? (
          <View style={[s.infoRow, { borderBottomColor: theme.border }]}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={theme.subtext} />
            <Text style={[s.infoText, { color: theme.subtext }]}>{shop.openHours}</Text>
          </View>
        ) : null}

        {/* Date selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateStrip}>
          {dates.map((d) => {
            const dt = new Date(d + 'T00:00:00');
            const active = d === selectedDate;
            return (
              <TouchableOpacity
                key={d}
                style={[s.dateChip, active && { backgroundColor: theme.primary }]}
                onPress={() => setSelectedDate(d)}
                activeOpacity={0.7}
              >
                <Text style={[s.dateChipDay, { color: active ? '#fff' : theme.subtext }]}>
                  {WEEKDAYS_JA[dt.getDay()]}
                </Text>
                <Text style={[s.dateChipNum, { color: active ? '#fff' : theme.text }]}>
                  {dt.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Working casts for selected date */}
        <Text style={[s.sectionTitle, { color: theme.text }]}>
          {t('customer.workingCasts', { date: dayLabel })}
        </Text>
        {workingCasts.length === 0 ? (
          <Text style={[s.emptyText, { color: theme.subtext }]}>{t('customer.noWorkingCasts')}</Text>
        ) : (
          workingCasts.map((c) => {
            const castShifts = shiftsForDate.get(c.id) ?? [];
            return (
              <View key={c.id} style={[s.castCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {c.photo_url ? (
                  <Image source={{ uri: c.photo_url }} style={s.castPhoto} />
                ) : (
                  <View style={[s.castPhotoPlaceholder, { backgroundColor: theme.border }]}>
                    <MaterialCommunityIcons name="account" size={28} color={theme.subtext} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.castName, { color: theme.text }]}>{c.name}</Text>
                  <Text style={[s.castShiftTime, { color: theme.subtext }]}>
                    {castShifts.map((sh) => `${sh.start_at}〜${sh.end_at}`).join(', ')}
                  </Text>
                  {c.accepts_nomination && (
                    <Text style={[s.castBadge, { color: theme.primary }]}>{t('customer.nominationOk')}</Text>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Off-schedule casts */}
        {offScheduleCasts.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { color: theme.text, marginTop: 24 }]}>
              {t('customer.offScheduleCasts')}
            </Text>
            <Text style={[s.offScheduleNote, { color: theme.subtext }]}>
              {t('customer.offScheduleNote')}
            </Text>
            {offScheduleCasts.map((c) => (
              <View key={c.id} style={[s.castCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {c.photo_url ? (
                  <Image source={{ uri: c.photo_url }} style={s.castPhoto} />
                ) : (
                  <View style={[s.castPhotoPlaceholder, { backgroundColor: theme.border }]}>
                    <MaterialCommunityIcons name="account" size={28} color={theme.subtext} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.castName, { color: theme.text }]}>{c.name}</Text>
                  <Text style={[s.castBadge, { color: '#F59E0B' }]}>{t('customer.offScheduleLabel')}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Events */}
        {events.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { color: theme.text, marginTop: 24 }]}>
              {t('customer.upcomingEvents')}
            </Text>
            {events.map((ev) => (
              <View key={ev.id} style={[s.eventCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.eventDate, { color: theme.primary }]}>
                  {ev.event_date.replace(/-/g, '/')}
                </Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.eventTitle, { color: theme.text }]}>{ev.title}</Text>
                  {ev.start_time && (
                    <Text style={[s.eventTime, { color: theme.subtext }]}>
                      {ev.start_time.slice(0, 5)}{ev.end_time ? `〜${ev.end_time.slice(0, 5)}` : ''}
                    </Text>
                  )}
                  {ev.description ? <Text style={[s.eventDesc, { color: theme.subtext }]}>{ev.description}</Text> : null}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Reserve button */}
        <TouchableOpacity
          style={[s.reserveBtn, { backgroundColor: theme.primary }]}
          onPress={() => setReserveVisible(true)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="calendar-plus" size={22} color="#fff" />
          <Text style={s.reserveBtnText}>{t('customer.reserveButton')}</Text>
        </TouchableOpacity>

        {/* Placeholder for future features */}
        <View style={[s.futureSection, { borderColor: theme.border }]}>
          <MaterialCommunityIcons name="clock-fast" size={24} color={theme.border} />
          <Text style={[s.futureText, { color: theme.subtext }]}>{t('customer.shopDetailFuture')}</Text>
        </View>
      </ScrollView>

      {/* Membership QR modal */}
      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <TouchableOpacity
          style={s.qrOverlay}
          activeOpacity={1}
          onPress={() => setQrVisible(false)}
        >
          <View style={[s.qrModal, { backgroundColor: theme.card }]}>
            <Text style={[s.qrTitle, { color: theme.text }]}>{t('customer.memberQrTitle')}</Text>
            <View style={s.qrWrap}>
              <QRCode value={`ky:member:${customerAccountId}`} size={200} backgroundColor="#FFFFFF" color="#111111" />
            </View>
            <Text style={[s.qrHint, { color: theme.subtext }]}>{t('customer.memberQrHint')}</Text>
            <TouchableOpacity
              style={[s.qrCloseBtn, { backgroundColor: theme.primary }]}
              onPress={() => setQrVisible(false)}
            >
              <Text style={s.qrCloseText}>{t('customer.memberQrClose')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <CustomerReservationModal
        visible={reserveVisible}
        onClose={() => setReserveVisible(false)}
        tenantId={tenantId}
        date={selectedDate}
        customerAccountId={customerAccountId}
        onReserved={() => void loadShifts(selectedDate)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: { padding: 4 },
  qrBtn: { padding: 4 },
  shopName: { fontSize: 18, fontWeight: '700' },
  shopGenre: { fontSize: 13, marginTop: 2 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  infoText: { fontSize: 13 },
  dateStrip: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  dateChip: {
    width: 48,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipDay: { fontSize: 11 },
  dateChipNum: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, marginHorizontal: 16 },
  castCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  castPhoto: { width: 48, height: 48, borderRadius: 24 },
  castPhotoPlaceholder: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  castName: { fontSize: 15, fontWeight: '600' },
  castShiftTime: { fontSize: 13, marginTop: 2 },
  castBadge: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  offScheduleNote: { fontSize: 13, marginHorizontal: 16, marginBottom: 8 },
  eventCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  eventDate: { fontSize: 13, fontWeight: '700', minWidth: 60 },
  eventTitle: { fontSize: 15, fontWeight: '600' },
  eventTime: { fontSize: 13, marginTop: 2 },
  eventDesc: { fontSize: 13, marginTop: 4 },
  reserveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  reserveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  futureSection: {
    marginHorizontal: 16,
    marginTop: 32,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  futureText: { fontSize: 13, textAlign: 'center' },
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  qrModal: { borderRadius: 20, padding: 24, alignItems: 'center', width: 300, gap: 16 },
  qrTitle: { fontSize: 18, fontWeight: '700' },
  qrWrap: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12 },
  qrHint: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  qrCloseBtn: { paddingHorizontal: 32, paddingVertical: 10, borderRadius: 8 },
  qrCloseText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
