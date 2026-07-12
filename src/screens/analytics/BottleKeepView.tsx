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
import * as bkService from '../../services/bottleKeep';
import { todayStr } from './common';
import type { TFunc } from './common';
import type { BottleKeep, Tenant, ThemeColor } from '../../types';

type Props = { tenant: Tenant; theme: ThemeColor; t: TFunc };

function fmtDate(d: string): string {
  const [, m, dd] = d.split('-');
  return `${Number(m)}/${Number(dd)}`;
}

export function BottleKeepView({ tenant, theme, t }: Props) {
  const [items, setItems] = useState<BottleKeep[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<BottleKeep | null>(null);

  const [fCustomer, setFCustomer] = useState('');
  const [fItem, setFItem] = useState('');
  const [fRemaining, setFRemaining] = useState('');
  const [fStart, setFStart] = useState(todayStr);
  const [fExpiry, setFExpiry] = useState('');
  const [fNote, setFNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await bkService.fetchBottleKeeps(tenant.id));
    } catch (e) {
      console.warn('[kyasuho] fetchBottleKeeps:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setEditItem(null);
    setFCustomer('');
    setFItem('');
    setFRemaining('');
    setFStart(todayStr());
    setFExpiry('');
    setFNote('');
    setModalVisible(true);
  };

  const openEdit = (b: BottleKeep) => {
    setEditItem(b);
    setFCustomer(b.customerName);
    setFItem(b.itemName);
    setFRemaining(b.remaining);
    setFStart(b.startDate);
    setFExpiry(b.expiryDate ?? '');
    setFNote(b.note);
    setModalVisible(true);
  };

  const handleSave = async () => {
    const customerName = fCustomer.trim();
    const itemName = fItem.trim();
    if (!customerName || !itemName) {
      Alert.alert(t('bottle.required'));
      return;
    }
    try {
      if (editItem) {
        await bkService.updateBottleKeep(editItem.id, {
          customerName,
          itemName,
          remaining: fRemaining,
          startDate: fStart,
          expiryDate: fExpiry || null,
          note: fNote,
        });
      } else {
        await bkService.addBottleKeep(tenant.id, {
          customerName,
          itemName,
          startDate: fStart,
          expiryDate: fExpiry || null,
          remaining: fRemaining,
          note: fNote,
        });
      }
      setModalVisible(false);
      await load();
    } catch {
      Alert.alert(t('common.saveFailed'));
    }
  };

  const toggleActive = (b: BottleKeep) => {
    const msg = b.isActive ? t('bottle.returnConfirm') : t('bottle.reactivateConfirm');
    Alert.alert('', msg, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.ok'),
        onPress: async () => {
          await bkService.updateBottleKeep(b.id, { isActive: !b.isActive });
          await load();
        },
      },
    ]);
  };

  const handleDelete = (b: BottleKeep) => {
    Alert.alert('', t('bottle.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await bkService.deleteBottleKeep(b.id);
          await load();
        },
      },
    ]);
  };

  const today = todayStr();

  const renderItem = ({ item: b }: { item: BottleKeep }) => {
    const expired = !!b.expiryDate && b.expiryDate < today;
    const statusLabel = !b.isActive
      ? t('bottle.returned')
      : expired
        ? t('bottle.expired')
        : t('bottle.active');
    const dim = !b.isActive || expired;

    return (
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border, opacity: dim ? 0.5 : 1 }]}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardName, { color: theme.text }]}>{b.customerName}</Text>
            <Text style={[s.cardItem, { color: theme.subtext }]}>{b.itemName}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: b.isActive && !expired ? theme.primary : theme.border }]}>
            <Text style={[s.badgeText, { color: b.isActive && !expired ? '#fff' : theme.subtext }]}>
              {statusLabel}
            </Text>
          </View>
        </View>
        <View style={s.cardMeta}>
          {b.remaining ? (
            <Text style={[s.metaText, { color: theme.subtext }]}>
              {t('bottle.remainingLabel', { remaining: b.remaining })}
            </Text>
          ) : null}
          <Text style={[s.metaText, { color: theme.subtext }]}>
            {t('bottle.depositLabel', { date: fmtDate(b.startDate) })}
            {b.expiryDate ? ` → ${fmtDate(b.expiryDate)}` : ''}
          </Text>
        </View>
        {b.note ? (
          <Text style={[s.noteText, { color: theme.subtext }]} numberOfLines={1}>
            {b.note}
          </Text>
        ) : null}
        <View style={s.cardActions}>
          <TouchableOpacity onPress={() => openEdit(b)} style={s.actionBtn}>
            <MaterialCommunityIcons name="pencil" size={18} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => toggleActive(b)} style={s.actionBtn}>
            <MaterialCommunityIcons
              name={b.isActive ? 'archive-arrow-down' : 'archive-arrow-up'}
              size={18}
              color={theme.subtext}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(b)} style={s.actionBtn}>
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
          {t('bottle.activeCount', { count: String(items.filter((b) => b.isActive).length) })}
        </Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: theme.primary }]}
          onPress={openAdd}
        >
          <MaterialCommunityIcons name="plus" size={18} color="#fff" />
          <Text style={s.addBtnText}>{t('bottle.add')}</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={s.center}>
          <Text style={{ color: theme.subtext }}>{t('bottle.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
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
              {editItem ? t('bottle.edit') : t('bottle.add')}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close" size={24} color={theme.subtext} />
            </TouchableOpacity>
          </View>
          <View>
            <Text style={[s.label, { color: theme.text }]}>{t('bottle.customer')}</Text>
            <TextInput
              style={[s.input, { borderColor: theme.border, color: theme.text }]}
              value={fCustomer}
              onChangeText={setFCustomer}
            />
          </View>
          <View>
            <Text style={[s.label, { color: theme.text }]}>{t('bottle.item')}</Text>
            <TextInput
              style={[s.input, { borderColor: theme.border, color: theme.text }]}
              value={fItem}
              onChangeText={setFItem}
            />
          </View>
          <View>
            <Text style={[s.label, { color: theme.text }]}>{t('bottle.remaining')}</Text>
            <TextInput
              style={[s.input, { borderColor: theme.border, color: theme.text }]}
              value={fRemaining}
              onChangeText={setFRemaining}
              placeholder={t('bottle.remainingPlaceholder')}
              placeholderTextColor={theme.subtext}
            />
          </View>
          <View>
            <Text style={[s.label, { color: theme.text }]}>{t('bottle.note')}</Text>
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
            <Text style={s.saveBtnText}>{t('bottle.save')}</Text>
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
  cardName: { fontSize: 15, fontWeight: '700' },
  cardItem: { fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', gap: 12, marginTop: 6 },
  metaText: { fontSize: 12 },
  noteText: { fontSize: 12, marginTop: 4 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
  actionBtn: { padding: 4 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  saveBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
