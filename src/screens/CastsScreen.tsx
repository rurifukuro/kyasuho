import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
  TextInput,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { FormModalShell } from '../components/common/FormModalShell';
import { ShiftImageScreen } from './ShiftImageScreen';
import * as castService from '../services/casts';
import { guardFields } from '../utils/contentGuard';
import type { Cast, Shift, ThemeColor } from '../types';
import type { TKey } from '../i18n';

type TFunc = (key: TKey, params?: Record<string, string>) => string;

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function dateLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

function buildDateList(past: number, future: number): Date[] {
  const list: Date[] = [];
  const now = new Date();
  for (let i = -past; i <= future; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    list.push(d);
  }
  return list;
}

const DATE_LIST = buildDateList(7, 30);
const INITIAL_DATE_INDEX = 7;

// ── メイン画面 ──

export function CastsScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { tenant } = useTenant();
  const insets = useSafeAreaInsets();

  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCast, setEditingCast] = useState<Cast | null>(null);
  const [detailCast, setDetailCast] = useState<Cast | null>(null);
  const [shiftImageVisible, setShiftImageVisible] = useState(false);

  const loadCasts = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await castService.fetchCasts(tenant.id);
      setCasts(data);
    } catch (e: unknown) {
      console.warn('[kyasuho] fetchCasts:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    void loadCasts();
  }, [loadCasts]);

  const handleDelete = useCallback(
    (cast: Cast) => {
      Alert.alert(t('common.delete'), t('cast.deleteConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await castService.deleteCast(cast.id);
              if (detailCast?.id === cast.id) setDetailCast(null);
              await loadCasts();
            } catch (e: unknown) {
              Alert.alert(t('common.error'), String(e));
            }
          },
        },
      ]);
    },
    [loadCasts, t, detailCast],
  );

  const openAdd = useCallback(() => {
    setEditingCast(null);
    setEditModalVisible(true);
  }, []);

  const openEdit = useCallback((cast: Cast) => {
    setEditingCast(cast);
    setEditModalVisible(true);
  }, []);

  if (!tenant) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (shiftImageVisible) {
    return (
      <ShiftImageScreen
        tenant={tenant}
        casts={casts}
        theme={theme}
        t={t}
        insets={insets}
        onBack={() => setShiftImageVisible(false)}
      />
    );
  }

  if (detailCast) {
    return (
      <CastDetailView
        cast={detailCast}
        tenant={tenant}
        theme={theme}
        t={t}
        insets={insets}
        onBack={() => setDetailCast(null)}
        onEdit={() => openEdit(detailCast)}
        onDelete={() => handleDelete(detailCast)}
      />
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('cast.title')}</Text>
        <Text style={[s.headerCount, { color: theme.subtext }]}>
          {t('cast.count', { count: String(casts.length) })}
        </Text>
        <View style={s.headerSpacer} />
        <TouchableOpacity
          style={[s.shiftImageBtn, { backgroundColor: theme.primary + '15' }]}
          onPress={() => setShiftImageVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="calendar-export" size={16} color={theme.primary} />
          <Text style={[s.shiftImageBtnText, { color: theme.primary }]}>
            {t('cast.shiftImage')}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.primary} style={s.spinner} />
      ) : casts.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={[s.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="account-star-outline" size={40} color={theme.subtext} />
            <Text style={[s.emptyText, { color: theme.subtext }]}>{t('cast.noCasts')}</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={casts}
          keyExtractor={(c) => c.id}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <CastCard
              cast={item}
              theme={theme}
              t={t}
              onPress={() => setDetailCast(item)}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      <TouchableOpacity
        style={[s.fab, { backgroundColor: theme.primary }]}
        onPress={openAdd}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {editModalVisible && (
        <CastEditModal
          visible={editModalVisible}
          cast={editingCast}
          tenantId={tenant.id}
          theme={theme}
          t={t}
          onClose={() => setEditModalVisible(false)}
          onSaved={async () => {
            setEditModalVisible(false);
            await loadCasts();
          }}
        />
      )}
    </View>
  );
}

// ── キャストカード ──

function CastCard({
  cast,
  theme,
  t,
  onPress,
  onEdit,
  onDelete,
}: {
  cast: Cast;
  theme: ThemeColor;
  t: TFunc;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.castCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={s.castCardRow}>
        <View style={[s.avatar, { backgroundColor: theme.primaryLight + '30' }]}>
          <MaterialCommunityIcons name="account" size={28} color={theme.primary} />
        </View>
        <View style={s.castCardBody}>
          <Text style={[s.castName, { color: theme.text }]}>{cast.name}</Text>
          {cast.bio ? (
            <Text style={[s.castBio, { color: theme.subtext }]} numberOfLines={2}>
              {cast.bio}
            </Text>
          ) : null}
          <View style={s.badges}>
            <View
              style={[
                s.badge,
                { backgroundColor: cast.acceptsNomination ? theme.primary + '20' : '#e0e0e0' },
              ]}
            >
              <MaterialCommunityIcons
                name={cast.acceptsNomination ? 'star' : 'star-off'}
                size={12}
                color={cast.acceptsNomination ? theme.primary : '#999'}
              />
              <Text
                style={[
                  s.badgeText,
                  { color: cast.acceptsNomination ? theme.primary : '#999' },
                ]}
              >
                {t('cast.acceptsNomination')}
              </Text>
            </View>
          </View>
        </View>
        <View style={s.castActions}>
          <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="pencil" size={20} color={theme.subtext} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginTop: 12 }}
          >
            <MaterialCommunityIcons name="delete-outline" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── キャスト詳細（出勤スケジュール） ──

function CastDetailView({
  cast,
  tenant,
  theme,
  t,
  insets,
  onBack,
  onEdit,
  onDelete,
}: {
  cast: Cast;
  tenant: { id: string };
  theme: ThemeColor;
  t: TFunc;
  insets: { top: number };
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [addShiftVisible, setAddShiftVisible] = useState(false);

  const loadShifts = useCallback(async () => {
    setLoadingShifts(true);
    try {
      const all = await castService.fetchShifts(tenant.id, selectedDate);
      setShifts(all.filter((s) => s.castId === cast.id));
    } catch (e: unknown) {
      console.warn('[kyasuho] fetchShifts:', e);
    } finally {
      setLoadingShifts(false);
    }
  }, [tenant.id, cast.id, selectedDate]);

  useEffect(() => {
    void loadShifts();
  }, [loadShifts]);

  const handleRemoveShift = useCallback(
    (shiftId: string) => {
      Alert.alert(t('common.delete'), t('cast.shiftDeleteConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await castService.removeShift(shiftId);
              await loadShifts();
            } catch (e: unknown) {
              Alert.alert(t('common.error'), String(e));
            }
          },
        },
      ]);
    },
    [loadShifts, t],
  );

  return (
    <View style={[s.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text, flex: 1, marginLeft: 12 }]}>
          {cast.name}
        </Text>
        <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="pencil" size={20} color={theme.subtext} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginLeft: 16 }}
        >
          <MaterialCommunityIcons name="delete-outline" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      {/* プロフィールカード */}
      <View style={[s.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[s.avatarLarge, { backgroundColor: theme.primaryLight + '30' }]}>
          <MaterialCommunityIcons name="account" size={40} color={theme.primary} />
        </View>
        {cast.bio ? (
          <Text style={[s.detailBio, { color: theme.subtext }]}>{cast.bio}</Text>
        ) : null}
        <View style={s.badges}>
          <View
            style={[
              s.badge,
              { backgroundColor: cast.acceptsNomination ? theme.primary + '20' : '#e0e0e0' },
            ]}
          >
            <MaterialCommunityIcons
              name={cast.acceptsNomination ? 'star' : 'star-off'}
              size={12}
              color={cast.acceptsNomination ? theme.primary : '#999'}
            />
            <Text
              style={[s.badgeText, { color: cast.acceptsNomination ? theme.primary : '#999' }]}
            >
              {t('cast.acceptsNomination')}
            </Text>
          </View>
        </View>
        {cast.snsLinks.length > 0 && (
          <View style={s.snsLinksRow}>
            {cast.snsLinks.map((link, i) => (
              <View
                key={i}
                style={[s.snsChip, { backgroundColor: theme.primary + '15', borderColor: theme.border }]}
              >
                <MaterialCommunityIcons name="link" size={12} color={theme.primary} />
                <Text style={[s.snsChipText, { color: theme.primary }]}>{link.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 出勤スケジュール */}
      <View style={[s.sectionHeader, { borderBottomColor: theme.border }]}>
        <Text style={[s.sectionTitle, { color: theme.text }]}>{t('cast.shifts')}</Text>
      </View>

      <FlatList
        horizontal
        data={DATE_LIST}
        keyExtractor={(d) => formatDate(d)}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={INITIAL_DATE_INDEX}
        getItemLayout={(_, index) => ({ length: 72, offset: 72 * index, index })}
        style={[s.dateStrip, { borderBottomColor: theme.border }]}
        contentContainerStyle={s.dateStripContent}
        renderItem={({ item }) => {
          const key = formatDate(item);
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
        {loadingShifts ? (
          <ActivityIndicator color={theme.primary} style={s.spinner} />
        ) : shifts.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="calendar-blank" size={28} color={theme.subtext} />
            <Text style={[s.emptyText, { color: theme.subtext }]}>{t('cast.noShifts')}</Text>
          </View>
        ) : (
          shifts.map((sh) => (
            <View
              key={sh.id}
              style={[s.shiftCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <MaterialCommunityIcons name="clock-outline" size={20} color={theme.primary} />
              <Text style={[s.shiftTime, { color: theme.text }]}>
                {sh.startAt} 〜 {sh.endAt}
              </Text>
              <TouchableOpacity
                onPress={() => handleRemoveShift(sh.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close-circle" size={20} color="#ccc" />
              </TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity
          style={[s.addButton, { borderColor: theme.primary }]}
          onPress={() => setAddShiftVisible(true)}
        >
          <MaterialCommunityIcons name="plus" size={18} color={theme.primary} />
          <Text style={[s.addButtonText, { color: theme.primary }]}>{t('cast.addShift')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {addShiftVisible && (
        <AddShiftModal
          visible={addShiftVisible}
          tenantId={tenant.id}
          castId={cast.id}
          date={selectedDate}
          theme={theme}
          t={t}
          onClose={() => setAddShiftVisible(false)}
          onSaved={async () => {
            setAddShiftVisible(false);
            await loadShifts();
          }}
        />
      )}
    </View>
  );
}

// ── キャスト追加/編集モーダル ──

function CastEditModal({
  visible,
  cast,
  tenantId,
  theme,
  t,
  onClose,
  onSaved,
}: {
  visible: boolean;
  cast: Cast | null;
  tenantId: string;
  theme: ThemeColor;
  t: TFunc;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(cast?.name ?? '');
  const [bio, setBio] = useState(cast?.bio ?? '');
  const [acceptsNomination, setAcceptsNomination] = useState(cast?.acceptsNomination ?? true);
  const [snsLinks, setSnsLinks] = useState<{ label: string; url: string }[]>(
    cast?.snsLinks ?? [],
  );
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('cast.errorNameRequired'));
      return;
    }
    if (!guardFields({ name, bio }, t)) return;
    setSaving(true);
    try {
      const links = snsLinks.filter((l) => l.label.trim() || l.url.trim());
      if (cast) {
        await castService.updateCast(cast.id, {
          name: name.trim(),
          bio: bio.trim(),
          acceptsNomination,
          snsLinks: links,
        });
      } else {
        await castService.addCast(tenantId, name.trim(), bio.trim(), acceptsNomination, links);
      }
      onSaved();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setSaving(false);
    }
  }, [name, bio, acceptsNomination, snsLinks, cast, tenantId, t, onSaved]);

  const addLink = useCallback(() => {
    setSnsLinks((prev) => [...prev, { label: '', url: '' }]);
  }, []);

  const updateLink = useCallback((index: number, field: 'label' | 'url', value: string) => {
    setSnsLinks((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }, []);

  const removeLink = useCallback((index: number) => {
    setSnsLinks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <FormModalShell
      visible={visible}
      onRequestClose={onClose}
      theme={theme}
    >
      <ScrollView contentContainerStyle={s.modalContent}>
        <View style={s.modalHeader}>
          <Text style={[s.modalTitle, { color: theme.text }]}>
            {cast ? t('cast.edit') : t('cast.add')}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close" size={24} color={theme.subtext} />
          </TouchableOpacity>
        </View>
        <Text style={[s.label, { color: theme.text }]}>{t('cast.name')}</Text>
        <TextInput
          style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          value={name}
          onChangeText={setName}
          placeholder={t('cast.namePlaceholder')}
          placeholderTextColor={theme.subtext}
        />

        <Text style={[s.label, { color: theme.text }]}>{t('cast.bio')}</Text>
        <TextInput
          style={[s.inputMulti, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          value={bio}
          onChangeText={setBio}
          placeholder={t('cast.bioPlaceholder')}
          placeholderTextColor={theme.subtext}
          multiline
          numberOfLines={3}
        />

        <View style={s.switchRow}>
          <Text style={[s.label, { color: theme.text, marginBottom: 0 }]}>
            {t('cast.acceptsNomination')}
          </Text>
          <Switch
            value={acceptsNomination}
            onValueChange={setAcceptsNomination}
            trackColor={{ false: '#ccc', true: theme.primaryLight }}
            thumbColor={acceptsNomination ? theme.primary : '#f4f3f4'}
          />
        </View>

        <Text style={[s.label, { color: theme.text }]}>{t('cast.snsLinks')}</Text>
        {snsLinks.map((link, i) => (
          <View key={i} style={s.snsLinkRow}>
            <TextInput
              style={[s.snsInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
              value={link.label}
              onChangeText={(v) => updateLink(i, 'label', v)}
              placeholder={t('cast.snsLabelPlaceholder')}
              placeholderTextColor={theme.subtext}
            />
            <TextInput
              style={[s.snsInputUrl, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
              value={link.url}
              onChangeText={(v) => updateLink(i, 'url', v)}
              placeholder={t('cast.snsUrlPlaceholder')}
              placeholderTextColor={theme.subtext}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TouchableOpacity onPress={() => removeLink(i)}>
              <MaterialCommunityIcons name="close-circle" size={20} color="#ccc" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={[s.addLinkButton, { borderColor: theme.border }]}
          onPress={addLink}
        >
          <MaterialCommunityIcons name="plus" size={16} color={theme.primary} />
          <Text style={[s.addLinkText, { color: theme.primary }]}>{t('cast.addSnsLink')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>{t('cast.submit')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </FormModalShell>
  );
}

// ── 出勤枠追加モーダル ──

function AddShiftModal({
  visible,
  tenantId,
  castId,
  date,
  theme,
  t,
  onClose,
  onSaved,
}: {
  visible: boolean;
  tenantId: string;
  castId: string;
  date: string;
  theme: ThemeColor;
  t: TFunc;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [startHour, setStartHour] = useState(18);
  const [startMin, setStartMin] = useState(0);
  const [endHour, setEndHour] = useState(23);
  const [endMin, setEndMin] = useState(0);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const startAt = `${pad2(startHour)}:${pad2(startMin)}`;
    const endAt = `${pad2(endHour)}:${pad2(endMin)}`;
    setSaving(true);
    try {
      await castService.addShift(tenantId, castId, date, startAt, endAt);
      onSaved();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setSaving(false);
    }
  }, [startHour, startMin, endHour, endMin, tenantId, castId, date, t, onSaved]);

  return (
    <FormModalShell
      visible={visible}
      onRequestClose={onClose}
      theme={theme}
    >
      <View style={s.modalContent}>
        <View style={s.modalHeader}>
          <Text style={[s.modalTitle, { color: theme.text }]}>{t('cast.addShift')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close" size={24} color={theme.subtext} />
          </TouchableOpacity>
        </View>
        <Text style={[s.label, { color: theme.text }]}>{t('cast.shiftStart')}</Text>
        <TimeStepper
          hour={startHour}
          minute={startMin}
          onChangeHour={setStartHour}
          onChangeMinute={setStartMin}
          theme={theme}
        />

        <Text style={[s.label, { color: theme.text, marginTop: 16 }]}>{t('cast.shiftEnd')}</Text>
        <TimeStepper
          hour={endHour}
          minute={endMin}
          onChangeHour={setEndHour}
          onChangeMinute={setEndMin}
          theme={theme}
        />

        <TouchableOpacity
          style={[s.submitButton, { backgroundColor: theme.primary, marginTop: 24 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>{t('cast.submit')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </FormModalShell>
  );
}

// ── 時刻 Stepper ──

function TimeStepper({
  hour,
  minute,
  onChangeHour,
  onChangeMinute,
  theme,
}: {
  hour: number;
  minute: number;
  onChangeHour: (h: number) => void;
  onChangeMinute: (m: number) => void;
  theme: ThemeColor;
}) {
  return (
    <View style={s.stepperRow}>
      <StepperControl
        value={hour}
        min={0}
        max={29}
        format={(v) => pad2(v)}
        onUp={() => onChangeHour(Math.min(29, hour + 1))}
        onDown={() => onChangeHour(Math.max(0, hour - 1))}
        theme={theme}
      />
      <Text style={[s.stepperColon, { color: theme.text }]}>:</Text>
      <StepperControl
        value={minute}
        min={0}
        max={59}
        step={15}
        format={(v) => pad2(v)}
        onUp={() => onChangeMinute(minute + 15 > 59 ? 0 : minute + 15)}
        onDown={() => onChangeMinute(minute - 15 < 0 ? 45 : minute - 15)}
        theme={theme}
      />
    </View>
  );
}

function StepperControl({
  value,
  format,
  onUp,
  onDown,
  theme,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  onUp: () => void;
  onDown: () => void;
  theme: ThemeColor;
}) {
  return (
    <View style={s.stepperBox}>
      <TouchableOpacity onPress={onUp} style={s.stepperBtn}>
        <MaterialCommunityIcons name="chevron-up" size={22} color={theme.primary} />
      </TouchableOpacity>
      <Text style={[s.stepperValue, { color: theme.text }]}>{format(value)}</Text>
      <TouchableOpacity onPress={onDown} style={s.stepperBtn}>
        <MaterialCommunityIcons name="chevron-down" size={22} color={theme.primary} />
      </TouchableOpacity>
    </View>
  );
}

// ── スタイル ──

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerCount: { fontSize: 13, marginLeft: 8 },
  headerSpacer: { flex: 1 },
  shiftImageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  shiftImageBtnText: { fontSize: 12, fontWeight: '600' },
  spinner: { marginTop: 32 },
  emptyWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  emptyCard: { borderRadius: 12, borderWidth: 1, padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80 },
  castCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  castCardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarLarge: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 8 },
  castCardBody: { flex: 1, marginLeft: 12 },
  castName: { fontSize: 16, fontWeight: '600' },
  castBio: { fontSize: 13, marginTop: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 4 },
  badgeText: { fontSize: 11, fontWeight: '500' },
  castActions: { marginLeft: 8, alignItems: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 28, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  profileCard: { borderRadius: 12, borderWidth: 1, marginHorizontal: 16, marginTop: 12, padding: 16, alignItems: 'center' },
  detailBio: { fontSize: 14, textAlign: 'center', marginTop: 4 },
  snsLinksRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 6 },
  snsChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, gap: 4 },
  snsChipText: { fontSize: 12, fontWeight: '500' },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  dateStrip: { maxHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth },
  dateStripContent: { paddingHorizontal: 12, alignItems: 'center' },
  dateChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, marginRight: 6, minWidth: 66, alignItems: 'center' },
  dateChipText: { fontSize: 12, fontWeight: '500' },
  body: { flex: 1 },
  bodyContent: { padding: 16 },
  shiftCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8, gap: 10 },
  shiftTime: { flex: 1, fontSize: 15, fontWeight: '500' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', marginTop: 8, gap: 6 },
  addButtonText: { fontSize: 14, fontWeight: '500' },
  modalContent: { padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  inputMulti: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 4 },
  snsLinkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  snsInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  snsInputUrl: { flex: 2, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  addLinkButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', gap: 4 },
  addLinkText: { fontSize: 13 },
  submitButton: { marginTop: 20, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  stepperColon: { fontSize: 24, fontWeight: '700', marginHorizontal: 4 },
  stepperBox: { alignItems: 'center' },
  stepperBtn: { padding: 4 },
  stepperValue: { fontSize: 22, fontWeight: '600', minWidth: 36, textAlign: 'center' },
});
