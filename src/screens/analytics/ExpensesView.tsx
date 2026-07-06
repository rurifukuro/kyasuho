import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import * as expenseService from '../../services/expenses';
import { shareCsv } from '../../utils/csv';
import { formatYen, todayStr, monthDates } from './common';
import type { AnalyticsViewProps, TFunc } from './common';
import type { Expense, ExpenseCategory, ThemeColor } from '../../types';

const EXPENSE_HEADER = ['日付', 'カテゴリ', '金額', 'メモ'];

const CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: 'purchase', label: '仕入（酒・食材）' },
  { key: 'rent', label: '家賃' },
  { key: 'utilities', label: '水道光熱費' },
  { key: 'communication', label: '通信費' },
  { key: 'advertising', label: '広告宣伝費' },
  { key: 'costume', label: '衣装・美装費' },
  { key: 'supplies', label: '消耗品・備品' },
  { key: 'outsourcing', label: '外注・システム利用料' },
  { key: 'misc', label: '雑費' },
];

function categoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function ExpensesView({ tenant, theme, t, yearMonth }: AnalyticsViewProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const dates = useMemo(() => monthDates(yearMonth), [yearMonth]);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await expenseService.fetchExpenses(tenant.id, startDate, endDate);
      setExpenses(data);
    } catch (e: unknown) {
      console.warn('[kyasuho] fetchExpenses:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant.id, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalAmount = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return CATEGORIES.filter((c) => map.has(c.key)).map((c) => ({
      key: c.key,
      label: c.label,
      total: map.get(c.key)!,
    }));
  }, [expenses]);

  const handleDelete = useCallback(
    (exp: Expense) => {
      Alert.alert(t('common.delete'), t('expense.deleteConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await expenseService.deleteExpense(exp.id);
              await load();
            } catch (e: unknown) {
              Alert.alert(t('common.error'), String(e));
            }
          },
        },
      ]);
    },
    [load, t],
  );

  const handleCsvExport = useCallback(async () => {
    const rows: string[][] = [
      EXPENSE_HEADER,
      ...expenses.map((e) => [e.date, categoryLabel(e.category), String(e.amount), e.memo]),
    ];
    try {
      await shareCsv(`経費_${yearMonth}.csv`, rows);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    }
  }, [expenses, yearMonth, t]);

  return (
    <View style={es.root}>
      <View style={[es.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={es.summaryRow}>
          <Text style={[es.summaryLabel, { color: theme.subtext }]}>{t('expense.totalExpense')}</Text>
          <Text style={[es.summaryValue, { color: theme.text }]}>{formatYen(totalAmount)}</Text>
        </View>
        {categoryTotals.map((ct) => (
          <View key={ct.key} style={es.summaryRow}>
            <Text style={[es.catLabel, { color: theme.subtext }]}>{ct.label}</Text>
            <Text style={[es.catValue, { color: theme.text }]}>{formatYen(ct.total)}</Text>
          </View>
        ))}
      </View>

      <View style={es.actionRow}>
        <TouchableOpacity
          style={[es.actionBtn, { backgroundColor: theme.primary }]}
          onPress={() => setAddModalVisible(true)}
        >
          <MaterialCommunityIcons name="plus" size={16} color="#fff" />
          <Text style={es.actionBtnText}>{t('expense.add')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[es.actionBtn, { backgroundColor: theme.primary + '20' }]}
          onPress={handleCsvExport}
          disabled={expenses.length === 0}
        >
          <MaterialCommunityIcons name="download" size={16} color={theme.primary} />
          <Text style={[es.actionBtnText, { color: theme.primary }]}>CSV</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
      ) : expenses.length === 0 ? (
        <Text style={[es.emptyText, { color: theme.subtext }]}>{t('expense.empty')}</Text>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          contentContainerStyle={es.listContent}
          renderItem={({ item }) => (
            <View style={[es.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={es.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[es.cardDate, { color: theme.subtext }]}>{item.date}</Text>
                  <Text style={[es.cardCategory, { color: theme.text }]}>
                    {categoryLabel(item.category)}
                  </Text>
                  {item.memo ? (
                    <Text style={[es.cardMemo, { color: theme.subtext }]} numberOfLines={1}>
                      {item.memo}
                    </Text>
                  ) : null}
                </View>
                <Text style={[es.cardAmount, { color: theme.text }]}>
                  {formatYen(item.amount)}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="delete-outline" size={18} color="#999" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {addModalVisible && (
        <AddExpenseModal
          visible={addModalVisible}
          tenantId={tenant.id}
          theme={theme}
          t={t}
          onClose={() => setAddModalVisible(false)}
          onSaved={async () => {
            setAddModalVisible(false);
            await load();
          }}
        />
      )}
    </View>
  );
}

function AddExpenseModal({
  visible,
  tenantId,
  theme,
  t,
  onClose,
  onSaved,
}: {
  visible: boolean;
  tenantId: string;
  theme: ThemeColor;
  t: TFunc;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [category, setCategory] = useState<ExpenseCategory>('purchase');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  const categoryOptions: DropOption[] = CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    active: c.key === category,
    onPress: () => setCategory(c.key),
  }));

  const handleSave = useCallback(async () => {
    const num = parseInt(amount, 10);
    if (isNaN(num) || num <= 0) {
      Alert.alert(t('common.error'), t('expense.amountInvalid'));
      return;
    }
    setSaving(true);
    try {
      await expenseService.addExpense(tenantId, date, category, num, memo.trim());
      onSaved();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setSaving(false);
    }
  }, [tenantId, date, category, amount, memo, t, onSaved]);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={es.modalContent}>
        <View style={es.modalHeader}>
          <Text style={[es.modalTitle, { color: theme.text }]}>{t('expense.add')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close" size={24} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        <Text style={[es.label, { color: theme.text }]}>{t('expense.date')}</Text>
        <TextInput
          style={[es.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.subtext}
        />

        <AnchoredDropdown
          label={t('expense.category')}
          valueLabel={CATEGORIES.find((c) => c.key === category)?.label ?? ''}
          options={categoryOptions}
          theme={theme}
        />

        <Text style={[es.label, { color: theme.text }]}>{t('expense.amount')}</Text>
        <TextInput
          style={[es.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={theme.subtext}
        />

        <Text style={[es.label, { color: theme.text }]}>{t('expense.memo')}</Text>
        <TextInput
          style={[es.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          value={memo}
          onChangeText={setMemo}
          placeholder={t('expense.memoPlaceholder')}
          placeholderTextColor={theme.subtext}
        />

        <TouchableOpacity
          style={[es.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={es.submitText}>{t('expense.save')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </FormModalShell>
  );
}

const es = StyleSheet.create({
  root: { flex: 1 },
  summaryCard: { marginHorizontal: 16, borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  summaryLabel: { fontSize: 14, fontWeight: '600' },
  summaryValue: { fontSize: 18, fontWeight: '700' },
  catLabel: { fontSize: 12 },
  catValue: { fontSize: 13, fontWeight: '500' },
  actionRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, gap: 5 },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 24, fontSize: 14 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardDate: { fontSize: 11 },
  cardCategory: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  cardMemo: { fontSize: 12, marginTop: 2 },
  cardAmount: { fontSize: 15, fontWeight: '700' },
  modalContent: { padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  submitButton: { marginTop: 20, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
