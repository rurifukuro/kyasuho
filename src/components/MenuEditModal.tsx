// src/components/MenuEditModal.tsx — メニュー項目の追加・編集フォーム（§25-2）

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, StyleSheet, Alert } from 'react-native';
import { FormModalShell } from './common/FormModalShell';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import type { MenuItem, MenuCategory, ThemeColor } from '../types';
import type { TKey } from '../i18n';

const CATEGORIES: { key: MenuCategory; label: TKey }[] = [
  { key: 'set', label: 'menu.cat.set' },
  { key: 'extension', label: 'menu.cat.extension' },
  { key: 'nomination', label: 'menu.cat.nomination' },
  { key: 'cast_drink', label: 'menu.cat.cast_drink' },
  { key: 'drink', label: 'menu.cat.drink' },
  { key: 'food', label: 'menu.cat.food' },
  { key: 'cheki', label: 'menu.cat.cheki' },
  { key: 'other', label: 'menu.cat.other' },
  { key: 'discount', label: 'menu.cat.discount' },
];

export function MenuEditModal({ visible, onClose, editing, onSave, onDelete }: {
  visible: boolean;
  onClose: () => void;
  editing: MenuItem | null;
  onSave: (data: {
    category: MenuCategory;
    name: string;
    price: number;
    remotePrice: number | null;
    needsCast: boolean;
    sortOrder: number;
    isActive: boolean;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const s = makeStyles(theme);

  const [category, setCategory] = useState<MenuCategory>('set');
  const [name, setName] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [remotePriceStr, setRemotePriceStr] = useState('');
  const [needsCast, setNeedsCast] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [sortStr, setSortStr] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editing) {
        setCategory(editing.category);
        setName(editing.name);
        setPriceStr(String(editing.price));
        setRemotePriceStr(editing.remotePrice != null ? String(editing.remotePrice) : '');
        setNeedsCast(editing.needsCast);
        setIsActive(editing.isActive);
        setSortStr(String(editing.sortOrder));
      } else {
        setCategory('set');
        setName('');
        setPriceStr('');
        setRemotePriceStr('');
        setNeedsCast(false);
        setIsActive(true);
        setSortStr('0');
      }
      setSubmitting(false);
    }
  }, [visible, editing]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(t('menu.nameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const rp = remotePriceStr.trim();
      await onSave({
        category,
        name: trimmed,
        price: parseInt(priceStr, 10) || 0,
        remotePrice: rp ? parseInt(rp, 10) : null,
        needsCast,
        sortOrder: parseInt(sortStr, 10) || 0,
        isActive,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    Alert.alert(t('menu.deleteConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await onDelete(); onClose(); } },
    ]);
  };

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: theme.subtext, fontSize: 15 }}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>
          {editing ? t('menu.editItem') : t('menu.addItem')}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={submitting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: submitting ? theme.subtext : theme.primary, fontSize: 15, fontWeight: '700' }}>{t('common.save')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={[s.label, { color: theme.subtext }]}>{t('menu.name')}</Text>
        <TextInput
          style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
          value={name}
          onChangeText={setName}
          placeholder={t('menu.namePlaceholder')}
          placeholderTextColor={theme.subtext}
        />

        <Text style={[s.label, { color: theme.subtext }]}>{t('menu.price')}</Text>
        <TextInput
          style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
          value={priceStr}
          onChangeText={(v) => setPriceStr(v.replace(/[^0-9-]/g, ''))}
          placeholder={t('menu.pricePlaceholder')}
          placeholderTextColor={theme.subtext}
          keyboardType="number-pad"
        />

        <Text style={[s.label, { color: theme.subtext }]}>{t('menu.remotePrice')}</Text>
        <TextInput
          style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
          value={remotePriceStr}
          onChangeText={(v) => setRemotePriceStr(v.replace(/[^0-9-]/g, ''))}
          placeholder={t('menu.remotePricePlaceholder')}
          placeholderTextColor={theme.subtext}
          keyboardType="number-pad"
        />

        <Text style={[s.label, { color: theme.subtext }]}>{t('menu.category')}</Text>
        <View style={s.catGrid}>
          {CATEGORIES.map((c) => {
            const sel = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[s.catChip, { borderColor: sel ? theme.primary : theme.border, backgroundColor: sel ? theme.primary : theme.card }]}
                onPress={() => setCategory(c.key)}
              >
                <Text style={{ color: sel ? '#fff' : theme.text, fontSize: 13, fontWeight: '600' }}>{t(c.label)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.switchRow}>
          <Text style={{ color: theme.text, fontSize: 15 }}>{t('menu.needsCast')}</Text>
          <Switch value={needsCast} onValueChange={setNeedsCast} trackColor={{ true: theme.primary }} />
        </View>
        <View style={s.switchRow}>
          <Text style={{ color: theme.text, fontSize: 15 }}>{t('menu.isActive')}</Text>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: theme.primary }} />
        </View>

        <Text style={[s.label, { color: theme.subtext }]}>{t('menu.sortOrder')}</Text>
        <TextInput
          style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
          value={sortStr}
          onChangeText={(v) => setSortStr(v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
        />

        {editing && onDelete && (
          <TouchableOpacity style={[s.deleteBtn, { borderColor: '#EF4444' }]} onPress={handleDelete}>
            <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '700' }}>{t('common.delete')}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </FormModalShell>
  );
}

function makeStyles(theme: ThemeColor) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    body: { padding: 16 },
    label: { fontSize: 12, marginBottom: 6, marginTop: 14 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catChip: { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
    deleteBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  });
}
