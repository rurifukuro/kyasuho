import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from './common/FormModalShell';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { fetchCustomers } from '../services/customers';
import type { Customer } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
};

export default function CustomerPickerModal({ visible, onClose, onSelect }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { tenant } = useTenant();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      setCustomers(await fetchCustomers(tenant.id));
    } catch (e) {
      console.warn('[kyasuho] customer picker load:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (visible) {
      setSearch('');
      void load();
    }
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

  const handleSelect = useCallback(
    (c: Customer) => {
      onSelect(c);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[s.headerBtn, { color: theme.subtext }]}>{t('common.close')}</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('customer.pick')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={s.searchWrap}>
        <TextInput
          style={[s.searchInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          value={search}
          onChangeText={setSearch}
          placeholder={t('customer.searchPlaceholder')}
          placeholderTextColor={theme.subtext}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.row, { borderBottomColor: theme.border }]}
              onPress={() => handleSelect(item)}
            >
              <View style={s.rowMain}>
                <View style={s.nameRow}>
                  {item.isBanned && (
                    <View style={s.banBadge}>
                      <Text style={s.banBadgeText}>{t('customer.banned')}</Text>
                    </View>
                  )}
                  <Text style={[s.name, { color: item.isBanned ? '#DC2626' : theme.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <Text style={[s.sub, { color: theme.subtext }]} numberOfLines={1}>
                  {item.contact || item.nameKana || '—'}
                </Text>
              </View>
              <View style={s.rightCol}>
                <View style={s.stampRow}>
                  <MaterialCommunityIcons name="stamper" size={14} color={theme.primary} />
                  <Text style={[s.stampText, { color: theme.primary }]}>{item.stampCount}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={[s.empty, { color: theme.subtext }]}>{t('customer.empty')}</Text>
          }
        />
      )}
    </FormModalShell>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerBtn: { fontSize: 15, fontWeight: '600' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, gap: 8 },
  rowMain: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
  rightCol: { alignItems: 'flex-end' },
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  stampText: { fontSize: 13, fontWeight: '700' },
  banBadge: { backgroundColor: '#FEE2E2', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  banBadgeText: { fontSize: 10, fontWeight: '700', color: '#DC2626' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
