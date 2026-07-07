// src/components/CheckoutModal.tsx — 会計（預かり→おつり→確定）モーダル（§25-3・レジさぽっ！流用）

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from './common/FormModalShell';
import { DiscountModal } from './DiscountModal';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import type { OrderItem, MenuItem, Customer, StampSettings, PaymentMethod, ThemeColor } from '../types';
import type { TKey } from '../i18n';

const QUICK_AMOUNTS = [100, 500, 1000, 5000, 10000];

const PAY_METHODS: { key: PaymentMethod; label: TKey }[] = [
  { key: 'cash', label: 'checkout.pay.cash' },
  { key: 'card', label: 'checkout.pay.card' },
  { key: 'qr', label: 'checkout.pay.qr' },
  { key: 'other', label: 'checkout.pay.other' },
];

export function CheckoutModal({ visible, onClose, items, discountPresets, onAddDiscount, onConfirm, customer, stampSettings }: {
  visible: boolean;
  onClose: () => void;
  items: OrderItem[];
  discountPresets: MenuItem[];
  onAddDiscount: (name: string, price: number) => Promise<void>;
  onConfirm: (subtotal: number, deposit: number, change: number, paymentMethod: PaymentMethod, note: string) => Promise<void>;
  customer?: Customer | null;
  stampSettings?: StampSettings | null;
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const s = makeStyles(theme);

  const [deposit, setDeposit] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);

  useEffect(() => {
    if (visible) { setDeposit(''); setPaymentMethod('cash'); setNote(''); setSubmitting(false); }
  }, [visible]);

  const grossSubtotal = items.filter((i) => i.price > 0).reduce((s, i) => s + i.price * i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const depositNum = parseInt(deposit, 10) || 0;
  const effectiveDeposit = depositNum > 0 ? depositNum : subtotal;
  const change = effectiveDeposit - subtotal;
  const insufficient = depositNum > 0 && depositNum < subtotal;
  const negativeTotal = subtotal < 0;

  const confirm = async () => {
    if (submitting || insufficient || negativeTotal || items.length === 0) return;
    setSubmitting(true);
    try { await onConfirm(subtotal, effectiveDeposit, change, paymentMethod, note.trim()); }
    finally { setSubmitting(false); }
  };

  const handleDiscountAdd = async (name: string, price: number) => {
    await onAddDiscount(name, price);
  };

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: theme.subtext, fontSize: 15 }}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('checkout.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {items.map((item) => (
            <View key={item.id} style={s.lineRow}>
              <Text style={[s.lineName, { color: item.price < 0 ? '#EF4444' : theme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[s.lineQty, { color: theme.subtext }]}>×{item.qty}</Text>
              <Text style={[s.lineAmt, { color: item.price < 0 ? '#EF4444' : theme.text }]}>
                ¥{(item.price * item.qty).toLocaleString()}
              </Text>
            </View>
          ))}
          <View style={[s.totalRow, { borderTopColor: theme.border }]}>
            <Text style={[s.totalLabel, { color: theme.subtext }]}>{t('checkout.subtotal')}</Text>
            <Text style={[s.totalAmt, { color: theme.text }]}>¥{subtotal.toLocaleString()}</Text>
          </View>
        </View>

        {customer && (
          <View style={[s.customerInfo, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="account" size={16} color={theme.primary} />
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>{customer.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <MaterialCommunityIcons name="stamper" size={13} color={theme.primary} />
                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>{customer.stampCount}</Text>
                {stampSettings?.isActive && (
                  <Text style={{ color: theme.subtext, fontSize: 12 }}>
                    /{stampSettings.rewardThreshold}
                  </Text>
                )}
              </View>
              {stampSettings?.isActive && stampSettings.rewardThreshold > 0 &&
                customer.stampCount >= stampSettings.rewardThreshold && (
                <View style={{ backgroundColor: '#FEF3C7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#D97706' }}>{t('checkout.rewardReady')}</Text>
                </View>
              )}
              {stampSettings?.isActive && stampSettings.rewardThreshold > 0 &&
                customer.stampCount < stampSettings.rewardThreshold && (
                <Text style={{ color: theme.subtext, fontSize: 12 }}>
                  {t('checkout.stampRemaining', {
                    count: String(stampSettings.rewardThreshold - customer.stampCount),
                  })}
                </Text>
              )}
            </View>
          </View>
        )}

        {negativeTotal && (
          <Text style={[s.warnText, { color: '#EF4444' }]}>{t('checkout.negativeGuard')}</Text>
        )}

        <TouchableOpacity
          style={[s.discountBtn, { borderColor: '#EF4444' }]}
          onPress={() => setShowDiscount(true)}
        >
          <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '700' }}>{t('checkout.addDiscount')}</Text>
        </TouchableOpacity>

        <Text style={[s.sectionLabel, { color: theme.subtext }]}>{t('checkout.paymentMethod')}</Text>
        <View style={[s.segmentRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
          {PAY_METHODS.map((m) => {
            const sel = paymentMethod === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[s.segment, sel && { backgroundColor: theme.primary }]}
                onPress={() => setPaymentMethod(m.key)}
                activeOpacity={0.8}
              >
                <Text style={[s.segmentText, { color: sel ? '#fff' : theme.text }]}>{t(m.label)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[s.sectionLabel, { color: theme.subtext }]}>{t('checkout.deposit')}</Text>
        <TextInput
          style={[s.depositInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
          value={deposit}
          onChangeText={(v) => setDeposit(v.replace(/[^0-9]/g, ''))}
          placeholder={t('checkout.depositPlaceholder')}
          placeholderTextColor={theme.subtext}
          keyboardType="number-pad"
        />
        <View style={s.quickRow}>
          {QUICK_AMOUNTS.map((amt) => (
            <TouchableOpacity key={amt} style={[s.quickBtn, { borderColor: theme.border }]} onPress={() => setDeposit(String((parseInt(deposit, 10) || 0) + amt))}>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>＋{amt.toLocaleString()}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[s.quickBtn, { borderColor: theme.primary }]} onPress={() => setDeposit(String(subtotal))}>
            <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>{t('checkout.exact')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.quickBtn, { borderColor: theme.border }]} onPress={() => setDeposit('')}>
            <Text style={{ color: theme.subtext, fontSize: 13 }}>{t('common.clear')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[s.sectionLabel, { color: theme.subtext }]}>{t('checkout.note')}</Text>
        <TextInput
          style={[s.noteInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
          value={note}
          onChangeText={setNote}
          placeholder={t('checkout.notePlaceholder')}
          placeholderTextColor={theme.subtext}
          multiline
        />

        <View style={[s.changeBox, { backgroundColor: theme.card, borderColor: insufficient ? '#EF4444' : theme.border }]}>
          <Text style={[s.changeLabel, { color: theme.subtext }]}>{t('checkout.change')}</Text>
          {insufficient ? (
            <Text style={[s.changeAmt, { color: '#EF4444' }]}>
              {t('checkout.shortage', { amount: (subtotal - depositNum).toLocaleString() })}
            </Text>
          ) : (
            <Text style={[s.changeAmt, { color: theme.text }]}>¥{change.toLocaleString()}</Text>
          )}
        </View>

        <TouchableOpacity
          style={[s.confirmBtn, { backgroundColor: insufficient || negativeTotal || items.length === 0 ? theme.border : theme.primary }]}
          onPress={confirm}
          disabled={submitting || insufficient || negativeTotal || items.length === 0}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.confirmText}>{t('checkout.confirm', { amount: subtotal.toLocaleString() })}</Text>}
        </TouchableOpacity>
        <View style={{ height: 24 }} />
      </ScrollView>

      <DiscountModal
        visible={showDiscount}
        onClose={() => setShowDiscount(false)}
        grossSubtotal={grossSubtotal}
        presets={discountPresets}
        onAdd={handleDiscountAdd}
      />
    </FormModalShell>
  );
}

function makeStyles(theme: ThemeColor) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    body: { padding: 16 },
    card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
    customerInfo: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
    lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
    lineName: { flex: 1, fontSize: 14 },
    lineQty: { fontSize: 13, width: 36, textAlign: 'right' },
    lineAmt: { fontSize: 14, fontWeight: '600', width: 84, textAlign: 'right' },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 8, paddingTop: 8 },
    totalLabel: { fontSize: 14 },
    totalAmt: { fontSize: 20, fontWeight: '800' },
    warnText: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
    discountBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start', marginBottom: 16 },
    sectionLabel: { fontSize: 12, marginBottom: 6 },
    segmentRow: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, padding: 3, marginBottom: 16, gap: 2 },
    segment: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    segmentText: { fontSize: 13, fontWeight: '700' },
    depositInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 20, fontWeight: '700', marginBottom: 10 },
    noteInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, minHeight: 50, textAlignVertical: 'top', marginBottom: 16 },
    quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    quickBtn: { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
    changeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20 },
    changeLabel: { fontSize: 15 },
    changeAmt: { fontSize: 24, fontWeight: '800' },
    confirmBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    confirmText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  });
}
