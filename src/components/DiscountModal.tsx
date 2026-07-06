// src/components/DiscountModal.tsx — 会計時の割引追加（§25-7・金額/％/定型）

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { FormModalShell } from './common/FormModalShell';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import type { MenuItem, ThemeColor } from '../types';
import type { TKey } from '../i18n';

type DiscountType = 'amount' | 'percent' | 'preset';

const TABS: { key: DiscountType; label: TKey }[] = [
  { key: 'amount', label: 'discount.type.amount' },
  { key: 'percent', label: 'discount.type.percent' },
  { key: 'preset', label: 'discount.type.preset' },
];

export function DiscountModal({ visible, onClose, grossSubtotal, presets, onAdd }: {
  visible: boolean;
  onClose: () => void;
  grossSubtotal: number;
  presets: MenuItem[];
  onAdd: (name: string, negativePrice: number) => void;
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const s = makeStyles(theme);

  const [tab, setTab] = useState<DiscountType>('amount');
  const [amountStr, setAmountStr] = useState('');
  const [percentStr, setPercentStr] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (visible) { setAmountStr(''); setPercentStr(''); setName(''); setTab('amount'); }
  }, [visible]);

  const handleAdd = () => {
    let discountAmt = 0;
    let discountName = name.trim() || t('discount.title');

    if (tab === 'amount') {
      discountAmt = parseInt(amountStr, 10) || 0;
      if (discountAmt <= 0) return;
    } else if (tab === 'percent') {
      const pct = parseInt(percentStr, 10) || 0;
      if (pct <= 0 || pct > 100) return;
      discountAmt = Math.floor(grossSubtotal * pct / 100);
      discountName = name.trim() || `${pct}%${t('discount.title')}`;
    }

    if (discountAmt > grossSubtotal) {
      Alert.alert(t('discount.guardOver'));
      return;
    }

    onAdd(discountName, -discountAmt);
    onClose();
  };

  const handlePreset = (item: MenuItem) => {
    if (Math.abs(item.price) > grossSubtotal) {
      Alert.alert(t('discount.guardOver'));
      return;
    }
    onAdd(item.name, item.price);
    onClose();
  };

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: theme.subtext, fontSize: 15 }}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('discount.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={[s.tabRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
        {TABS.map((tb) => {
          const sel = tab === tb.key;
          return (
            <TouchableOpacity
              key={tb.key}
              style={[s.tabBtn, sel && { backgroundColor: theme.primary }]}
              onPress={() => setTab(tb.key)}
            >
              <Text style={[s.tabText, { color: sel ? '#fff' : theme.text }]}>{t(tb.label)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {tab === 'amount' && (
          <>
            <Text style={[s.label, { color: theme.subtext }]}>{t('discount.amount')}</Text>
            <TextInput
              style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
              value={amountStr}
              onChangeText={(v) => setAmountStr(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={theme.subtext}
            />
            <Text style={[s.label, { color: theme.subtext }]}>{t('discount.name')}</Text>
            <TextInput
              style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
              value={name}
              onChangeText={setName}
              placeholder={t('discount.namePlaceholder')}
              placeholderTextColor={theme.subtext}
            />
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: (parseInt(amountStr, 10) || 0) > 0 ? theme.primary : theme.border }]}
              onPress={handleAdd}
              disabled={(parseInt(amountStr, 10) || 0) <= 0}
            >
              <Text style={s.addBtnText}>{t('discount.add')}</Text>
            </TouchableOpacity>
          </>
        )}

        {tab === 'percent' && (
          <>
            <Text style={[s.label, { color: theme.subtext }]}>{t('discount.percent')}</Text>
            <TextInput
              style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
              value={percentStr}
              onChangeText={(v) => setPercentStr(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="10"
              placeholderTextColor={theme.subtext}
            />
            <Text style={[s.label, { color: theme.subtext }]}>{t('discount.name')}</Text>
            <TextInput
              style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
              value={name}
              onChangeText={setName}
              placeholder={t('discount.namePlaceholder')}
              placeholderTextColor={theme.subtext}
            />
            {(parseInt(percentStr, 10) || 0) > 0 && (
              <Text style={[s.preview, { color: theme.primary }]}>
                ¥{Math.floor(grossSubtotal * (parseInt(percentStr, 10) || 0) / 100).toLocaleString()}
              </Text>
            )}
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: (parseInt(percentStr, 10) || 0) > 0 ? theme.primary : theme.border }]}
              onPress={handleAdd}
              disabled={(parseInt(percentStr, 10) || 0) <= 0}
            >
              <Text style={s.addBtnText}>{t('discount.add')}</Text>
            </TouchableOpacity>
          </>
        )}

        {tab === 'preset' && (
          <>
            {presets.length === 0 ? (
              <Text style={[s.emptyText, { color: theme.subtext }]}>{t('discount.noPresets')}</Text>
            ) : (
              presets.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.presetRow, { borderColor: theme.border, backgroundColor: theme.card }]}
                  onPress={() => handlePreset(p)}
                >
                  <Text style={[s.presetName, { color: theme.text }]}>{p.name}</Text>
                  <Text style={[s.presetPrice, { color: '#EF4444' }]}>¥{p.price.toLocaleString()}</Text>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>
    </FormModalShell>
  );
}

function makeStyles(theme: ThemeColor) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    tabRow: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, padding: 3, margin: 16, gap: 4 },
    tabBtn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    tabText: { fontSize: 14, fontWeight: '700' },
    body: { padding: 16, paddingTop: 0 },
    label: { fontSize: 12, marginBottom: 6, marginTop: 12 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '700' },
    preview: { fontSize: 20, fontWeight: '800', marginTop: 8, textAlign: 'center' },
    addBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
    addBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    emptyText: { fontSize: 14, textAlign: 'center', marginTop: 24 },
    presetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
    presetName: { fontSize: 15, fontWeight: '600', flex: 1 },
    presetPrice: { fontSize: 16, fontWeight: '700' },
  });
}
