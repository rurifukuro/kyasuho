import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from './common/FormModalShell';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import {
  fetchCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  fetchStampSettings,
  saveStampSettings,
} from '../services/customers';
import CustomerEditModal from './CustomerEditModal';
import type { Customer, StampSettings } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function CustomerListModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { tenant } = useTenant();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<Customer | null | 'new'>(null);

  const [stamp, setStamp] = useState<StampSettings | null>(null);
  const [showStampSettings, setShowStampSettings] = useState(false);
  const [stampActive, setStampActive] = useState(false);
  const [stampPerVisit, setStampPerVisit] = useState('1');
  const [stampThreshold, setStampThreshold] = useState('10');
  const [stampReward, setStampReward] = useState('');

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [custs, ss] = await Promise.all([
        fetchCustomers(tenant.id),
        fetchStampSettings(tenant.id),
      ]);
      setCustomers(custs);
      setStamp(ss);
      if (ss) {
        setStampActive(ss.isActive);
        setStampPerVisit(String(ss.stampsPerVisit));
        setStampThreshold(String(ss.rewardThreshold));
        setStampReward(ss.rewardDescription);
      }
    } catch (e) {
      console.warn('[kyasuho] customer load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.trim().toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nameKana.toLowerCase().includes(q) ||
        c.contact.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const handleSaveCustomer = useCallback(
    async (fields: {
      name: string;
      nameKana: string;
      contact: string;
      personaNotes: string;
      internalNotes: string;
      isBanned: boolean;
      banReason: string;
    }) => {
      if (!tenant) return;
      if (editTarget === 'new') {
        await addCustomer(tenant.id, fields);
      } else if (editTarget) {
        await updateCustomer(editTarget.id, fields);
      }
      await load();
    },
    [tenant, editTarget, load],
  );

  const handleDeleteCustomer = useCallback(async () => {
    if (!editTarget || editTarget === 'new') return;
    try {
      await deleteCustomer(editTarget.id);
      setEditTarget(null);
      await load();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    }
  }, [editTarget, load, t]);

  const handleSaveStamp = useCallback(async () => {
    if (!tenant) return;
    const perVisit = Math.max(1, parseInt(stampPerVisit, 10) || 1);
    const threshold = Math.max(1, parseInt(stampThreshold, 10) || 10);
    try {
      await saveStampSettings(tenant.id, {
        stampsPerVisit: perVisit,
        rewardThreshold: threshold,
        rewardDescription: stampReward.trim(),
        isActive: stampActive,
      });
      setStamp({
        id: stamp?.id ?? '',
        tenantId: tenant.id,
        stampsPerVisit: perVisit,
        rewardThreshold: threshold,
        rewardDescription: stampReward.trim(),
        isActive: stampActive,
      });
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    }
  }, [tenant, stamp, stampActive, stampPerVisit, stampThreshold, stampReward, t]);

  const renderItem = useCallback(
    ({ item }: { item: Customer }) => (
      <TouchableOpacity
        style={[s.customerRow, { borderBottomColor: theme.border }]}
        onPress={() => setEditTarget(item)}
      >
        <View style={s.customerMain}>
          <View style={s.customerNameRow}>
            {item.isBanned && (
              <View style={s.banBadge}>
                <Text style={s.banBadgeText}>{t('customer.banned')}</Text>
              </View>
            )}
            <Text style={[s.customerName, { color: item.isBanned ? '#DC2626' : theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <Text style={[s.customerSub, { color: theme.subtext }]} numberOfLines={1}>
            {item.contact || item.nameKana || '—'}
          </Text>
        </View>
        <View style={s.customerRight}>
          {stampActive && (
            <View style={s.stampBadge}>
              <MaterialCommunityIcons name="stamper" size={14} color={theme.primary} />
              <Text style={[s.stampText, { color: theme.primary }]}>{item.stampCount}</Text>
            </View>
          )}
          {item.lastVisitDate && (
            <Text style={[s.visitDate, { color: theme.subtext }]}>
              {item.lastVisitDate.slice(5)}
            </Text>
          )}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={theme.subtext} />
      </TouchableOpacity>
    ),
    [theme, t, stampActive],
  );

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[s.headerBtn, { color: theme.subtext }]}>{t('common.close')}</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('customer.title')}</Text>
        <TouchableOpacity onPress={() => setEditTarget('new')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="plus" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* 検索 */}
      <View style={s.searchWrap}>
        <TextInput
          style={[s.searchInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          value={search}
          onChangeText={setSearch}
          placeholder={t('customer.searchPlaceholder')}
          placeholderTextColor={theme.subtext}
        />
      </View>

      {/* スタンプ設定 */}
      <TouchableOpacity
        style={[s.stampHeader, { borderBottomColor: theme.border }]}
        onPress={() => setShowStampSettings(!showStampSettings)}
      >
        <MaterialCommunityIcons name="stamper" size={18} color={theme.primary} />
        <Text style={[s.stampHeaderText, { color: theme.text }]}>{t('customer.stampSettings')}</Text>
        <MaterialCommunityIcons
          name={showStampSettings ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.subtext}
        />
      </TouchableOpacity>
      {showStampSettings && (
        <View style={[s.stampBody, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <View style={s.stampRow}>
            <Text style={[s.stampLabel, { color: theme.text }]}>{t('customer.stampActive')}</Text>
            <Switch
              value={stampActive}
              onValueChange={setStampActive}
              trackColor={{ false: theme.border, true: theme.primaryLight ?? theme.primary }}
              thumbColor="#fff"
            />
          </View>
          {stampActive && (
            <>
              <View style={s.stampRow}>
                <Text style={[s.stampLabel, { color: theme.text }]}>{t('customer.stampsPerVisit')}</Text>
                <TextInput
                  style={[s.stampInput, { color: theme.text, borderColor: theme.border }]}
                  value={stampPerVisit}
                  onChangeText={setStampPerVisit}
                  keyboardType="number-pad"
                />
              </View>
              <View style={s.stampRow}>
                <Text style={[s.stampLabel, { color: theme.text }]}>{t('customer.rewardThreshold')}</Text>
                <TextInput
                  style={[s.stampInput, { color: theme.text, borderColor: theme.border }]}
                  value={stampThreshold}
                  onChangeText={setStampThreshold}
                  keyboardType="number-pad"
                />
              </View>
              <View style={s.field}>
                <Text style={[s.stampLabel, { color: theme.text, marginBottom: 6 }]}>{t('customer.rewardDescription')}</Text>
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                  value={stampReward}
                  onChangeText={setStampReward}
                  placeholder={t('customer.rewardDescriptionPlaceholder')}
                  placeholderTextColor={theme.subtext}
                />
              </View>
            </>
          )}
          <TouchableOpacity style={[s.stampSaveBtn, { backgroundColor: theme.primary }]} onPress={handleSaveStamp}>
            <Text style={s.stampSaveBtnText}>{t('common.save')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 顧客一覧 */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={[s.empty, { color: theme.subtext }]}>{t('customer.empty')}</Text>
          }
          ListHeaderComponent={
            <Text style={[s.countLabel, { color: theme.subtext }]}>
              {t('customer.count', { count: String(filtered.length) })}
            </Text>
          }
        />
      )}

      <CustomerEditModal
        visible={editTarget !== null}
        onClose={() => setEditTarget(null)}
        customer={editTarget === 'new' ? null : editTarget}
        onSave={handleSaveCustomer}
        onDelete={editTarget && editTarget !== 'new' ? handleDeleteCustomer : undefined}
      />
    </FormModalShell>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerBtn: { fontSize: 15, fontWeight: '600' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  stampHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, gap: 8 },
  stampHeaderText: { flex: 1, fontSize: 14, fontWeight: '600' },
  stampBody: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  stampRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  stampLabel: { fontSize: 14 },
  stampInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, width: 60, textAlign: 'center' },
  stampSaveBtn: { borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  stampSaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  field: { marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  countLabel: { fontSize: 12, fontWeight: '600', paddingHorizontal: 16, paddingVertical: 8 },
  customerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, gap: 8 },
  customerMain: { flex: 1 },
  customerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerName: { fontSize: 15, fontWeight: '600' },
  customerSub: { fontSize: 12, marginTop: 2 },
  customerRight: { alignItems: 'flex-end', gap: 2 },
  stampBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  stampText: { fontSize: 13, fontWeight: '700' },
  visitDate: { fontSize: 11 },
  banBadge: { backgroundColor: '#FEE2E2', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  banBadgeText: { fontSize: 10, fontWeight: '700', color: '#DC2626' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
