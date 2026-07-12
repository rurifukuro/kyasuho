import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from '../../components/common/FormModalShell';
import { AnchoredDropdown } from '../../components/AnchoredDropdown';
import type { DropOption } from '../../components/AnchoredDropdown';
import * as vcService from '../../services/vouchers';
import { todayStr } from './common';
import type { TFunc } from './common';
import type { Voucher, VoucherType, Tenant, ThemeColor } from '../../types';

type Props = { tenant: Tenant; theme: ThemeColor; t: TFunc };

const TYPE_OPTIONS: { key: VoucherType; labelKey: 'voucher.typeTicket' | 'voucher.typeCheki' | 'voucher.typeOther' }[] = [
  { key: 'ticket', labelKey: 'voucher.typeTicket' },
  { key: 'cheki', labelKey: 'voucher.typeCheki' },
  { key: 'other', labelKey: 'voucher.typeOther' },
];

function fmtDate(d: string): string {
  const [, m, dd] = d.split('-');
  return `${Number(m)}/${Number(dd)}`;
}

export function VouchersView({ tenant, theme, t }: Props) {
  const [items, setItems] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<Voucher | null>(null);

  const [fType, setFType] = useState<VoucherType>('ticket');
  const [fName, setFName] = useState('');
  const [fCustomer, setFCustomer] = useState('');
  const [fTotal, setFTotal] = useState('5');
  const [fExpiry, setFExpiry] = useState('');
  const [fNote, setFNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await vcService.fetchVouchers(tenant.id));
    } catch (e) {
      console.warn('[kyasuho] fetchVouchers:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setEditItem(null);
    setFType('ticket');
    setFName('');
    setFCustomer('');
    setFTotal('5');
    setFExpiry('');
    setFNote('');
    setModalVisible(true);
  };

  const openEdit = (v: Voucher) => {
    setEditItem(v);
    setFType(v.voucherType);
    setFName(v.name);
    setFCustomer(v.customerName);
    setFTotal(String(v.totalCount));
    setFExpiry(v.expiryDate ?? '');
    setFNote(v.note);
    setModalVisible(true);
  };

  const handleSave = async () => {
    const name = fName.trim();
    const customerName = fCustomer.trim();
    if (!name || !customerName) {
      Alert.alert(t('voucher.required'));
      return;
    }
    const totalCount = parseInt(fTotal, 10);
    if (isNaN(totalCount) || totalCount < 1) {
      Alert.alert(t('voucher.countInvalid'));
      return;
    }
    try {
      if (editItem) {
        await vcService.updateVoucher(editItem.id, {
          voucherType: fType,
          name,
          customerName,
          totalCount,
          expiryDate: fExpiry || null,
          note: fNote,
        });
      } else {
        await vcService.addVoucher(tenant.id, {
          voucherType: fType,
          name,
          customerName,
          totalCount,
          expiryDate: fExpiry || null,
          note: fNote,
        });
      }
      setModalVisible(false);
      await load();
    } catch {
      Alert.alert('保存に失敗しました');
    }
  };

  const handleUse = (v: Voucher) => {
    const after = v.remainingCount - 1;
    Alert.alert(
      '',
      t('voucher.useConfirm', {
        remaining: String(v.remainingCount),
        after: String(after),
      }),
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: t('voucher.use'),
          onPress: async () => {
            await vcService.useVoucher(v.id);
            await load();
          },
        },
      ],
    );
  };

  const toggleActive = (v: Voucher) => {
    const msg = v.isActive ? t('voucher.deactivateConfirm') : t('voucher.reactivateConfirm');
    Alert.alert('', msg, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'OK',
        onPress: async () => {
          await vcService.updateVoucher(v.id, { isActive: !v.isActive });
          await load();
        },
      },
    ]);
  };

  const handleDelete = (v: Voucher) => {
    Alert.alert('', t('voucher.deleteConfirm'), [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await vcService.deleteVoucher(v.id);
          await load();
        },
      },
    ]);
  };

  const typeDropOptions: DropOption[] = TYPE_OPTIONS.map((o) => ({
    key: o.key,
    label: t(o.labelKey),
    active: o.key === fType,
    onPress: () => setFType(o.key),
  }));

  const typeLabelMap = new Map(TYPE_OPTIONS.map((o) => [o.key, t(o.labelKey)]));
  const today = todayStr();

  const renderItem = ({ item: v }: { item: Voucher }) => {
    const expired = !!v.expiryDate && v.expiryDate < today;
    const usedUp = v.remainingCount <= 0;
    const statusLabel = !v.isActive
      ? t('voucher.statusInactive')
      : expired
        ? t('voucher.statusExpired')
        : usedUp
          ? t('voucher.statusUsedUp')
          : t('voucher.statusActive');
    const dim = !v.isActive || expired;
    const canUse = v.isActive && v.remainingCount > 0 && !expired;

    return (
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border, opacity: dim ? 0.5 : 1 }]}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[s.typeBadge, { backgroundColor: theme.background }]}>
                <Text style={[s.typeBadgeText, { color: theme.subtext }]}>
                  {typeLabelMap.get(v.voucherType) ?? v.voucherType}
                </Text>
              </View>
              <Text style={[s.cardName, { color: theme.text }]}>{v.name}</Text>
            </View>
            <Text style={[s.cardCustomer, { color: theme.subtext }]}>{v.customerName}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: v.isActive && !expired && !usedUp ? theme.primary : theme.border }]}>
            <Text style={[s.badgeText, { color: v.isActive && !expired && !usedUp ? '#fff' : theme.subtext }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={s.countRow}>
          <Text style={[s.countText, { color: theme.text }]}>
            {v.remainingCount} / {v.totalCount}
          </Text>
          {v.expiryDate ? (
            <Text style={[s.metaText, { color: theme.subtext }]}>
              期限: {fmtDate(v.expiryDate)}
            </Text>
          ) : null}
        </View>

        {v.note ? (
          <Text style={[s.noteText, { color: theme.subtext }]} numberOfLines={1}>
            {v.note}
          </Text>
        ) : null}

        <View style={s.cardActions}>
          {canUse ? (
            <TouchableOpacity
              onPress={() => handleUse(v)}
              style={[s.useBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={s.useBtnText}>{t('voucher.use')}</Text>
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => openEdit(v)} style={s.actionBtn}>
            <MaterialCommunityIcons name="pencil" size={18} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => toggleActive(v)} style={s.actionBtn}>
            <MaterialCommunityIcons
              name={v.isActive ? 'cancel' : 'check-circle-outline'}
              size={18}
              color={theme.subtext}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(v)} style={s.actionBtn}>
            <MaterialCommunityIcons name="delete-outline" size={18} color="#d32f2f" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && items.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={s.toolbar}>
        <Text style={[s.countLabel, { color: theme.subtext }]}>
          {items.filter((v) => v.isActive).length}件 有効
        </Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: theme.primary }]}
          onPress={openAdd}
        >
          <MaterialCommunityIcons name="plus" size={18} color="#fff" />
          <Text style={s.addBtnText}>{t('voucher.add')}</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={s.center}>
          <Text style={{ color: theme.subtext }}>{t('voucher.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(v) => v.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 10 }}
        />
      )}

      <FormModalShell
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        theme={theme}
      >
        <View style={{ padding: 16, gap: 12 }}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: theme.text }]}>
              {editItem ? t('voucher.edit') : t('voucher.add')}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close" size={24} color={theme.subtext} />
            </TouchableOpacity>
          </View>
          <View>
            <AnchoredDropdown
              label={t('voucher.type')}
              valueLabel={typeLabelMap.get(fType) ?? ''}
              options={typeDropOptions}
              theme={theme}
            />
          </View>
          <View>
            <Text style={[s.label, { color: theme.text }]}>{t('voucher.name')}</Text>
            <TextInput
              style={[s.input, { borderColor: theme.border, color: theme.text }]}
              value={fName}
              onChangeText={setFName}
              placeholder={t('voucher.namePlaceholder')}
              placeholderTextColor={theme.subtext}
            />
          </View>
          <View>
            <Text style={[s.label, { color: theme.text }]}>{t('voucher.customer')}</Text>
            <TextInput
              style={[s.input, { borderColor: theme.border, color: theme.text }]}
              value={fCustomer}
              onChangeText={setFCustomer}
            />
          </View>
          <View>
            <Text style={[s.label, { color: theme.text }]}>{t('voucher.totalCount')}</Text>
            <TextInput
              style={[s.input, { borderColor: theme.border, color: theme.text }]}
              value={fTotal}
              onChangeText={setFTotal}
              keyboardType="number-pad"
            />
          </View>
          <View>
            <Text style={[s.label, { color: theme.text }]}>{t('voucher.note')}</Text>
            <TextInput
              style={[s.input, { borderColor: theme.border, color: theme.text }]}
              value={fNote}
              onChangeText={setFNote}
            />
          </View>
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: theme.primary }]}
            onPress={() => void handleSave()}
          >
            <Text style={s.saveBtnText}>{t('voucher.save')}</Text>
          </TouchableOpacity>
        </View>
      </FormModalShell>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  countLabel: { fontSize: 13 },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, gap: 4 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 10, padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 10, fontWeight: '600' },
  cardName: { fontSize: 15, fontWeight: '700' },
  cardCustomer: { fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  countText: { fontSize: 18, fontWeight: '800' },
  metaText: { fontSize: 12 },
  noteText: { fontSize: 12, marginTop: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  useBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  useBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionBtn: { padding: 4 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  saveBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
