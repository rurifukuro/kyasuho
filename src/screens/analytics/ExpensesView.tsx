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
  ActionSheetIOS,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from '../../components/common/FormModalShell';
import { AnchoredDropdown } from '../../components/AnchoredDropdown';
import type { DropOption } from '../../components/AnchoredDropdown';
import * as expenseService from '../../services/expenses';
import * as receiptService from '../../services/receipts';
import { shareCsv } from '../../utils/csv';
import { printExpenses } from '../../services/print';
import { formatYen, todayStr, monthDates } from './common';
import type { AnalyticsViewProps, TFunc } from './common';
import type { TKey } from '../../i18n';
import type { Expense, ExpenseCategory, CustomExpenseCategory, ThemeColor } from '../../types';

const BUILTIN_CATEGORY_KEYS: { key: ExpenseCategory; labelKey: TKey }[] = [
  { key: 'purchase', labelKey: 'expense.cat.purchase' },
  { key: 'rent', labelKey: 'expense.cat.rent' },
  { key: 'utilities', labelKey: 'expense.cat.utilities' },
  { key: 'communication', labelKey: 'expense.cat.communication' },
  { key: 'advertising', labelKey: 'expense.cat.advertising' },
  { key: 'costume', labelKey: 'expense.cat.costume' },
  { key: 'supplies', labelKey: 'expense.cat.supplies' },
  { key: 'outsourcing', labelKey: 'expense.cat.outsourcing' },
  { key: 'misc', labelKey: 'expense.cat.misc' },
];

function mergeCategories(
  builtinCats: { key: string; label: string }[],
  custom: CustomExpenseCategory[],
): { key: string; label: string }[] {
  const merged: { key: string; label: string }[] = [...builtinCats];
  for (const c of custom) {
    if (!merged.some((m) => m.key === c.key)) {
      merged.push({ key: c.key, label: c.label });
    }
  }
  return merged;
}

export function ExpensesView({ tenant, theme, t, yearMonth }: AnalyticsViewProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [receiptBusyId, setReceiptBusyId] = useState<string | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<CustomExpenseCategory[]>([]);

  const allCategories = useMemo(() => {
    const builtinCats = BUILTIN_CATEGORY_KEYS.map((c) => ({ key: c.key, label: t(c.labelKey) }));
    return mergeCategories(builtinCats, customCategories);
  }, [customCategories, t]);

  const categoryLabel = useCallback(
    (key: string) => allCategories.find((c) => c.key === key)?.label ?? key,
    [allCategories],
  );

  const dates = useMemo(() => monthDates(yearMonth), [yearMonth]);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, cats] = await Promise.all([
        expenseService.fetchExpenses(tenant.id, startDate, endDate),
        expenseService.fetchCustomCategories(tenant.id),
      ]);
      setExpenses(data);
      setCustomCategories(cats);
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
    return allCategories.filter((c) => map.has(c.key)).map((c) => ({
      key: c.key,
      label: c.label,
      total: map.get(c.key)!,
    }));
  }, [expenses, allCategories]);

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

  const handleReceiptAction = useCallback(
    (exp: Expense) => {
      if (exp.receiptUrl) {
        setViewingReceipt(exp.receiptUrl);
        return;
      }
      const options = [t('expense.takePhoto'), t('expense.chooseFromGallery'), t('common.cancel')];
      const doAttach = async (source: 'camera' | 'gallery') => {
        setReceiptBusyId(exp.id);
        try {
          const fn = source === 'camera'
            ? receiptService.takeReceiptPhoto
            : receiptService.pickReceiptFromGallery;
          await fn(tenant.id, exp.id);
          await load();
        } catch (e: unknown) {
          Alert.alert(t('common.error'), String(e));
        } finally {
          setReceiptBusyId(null);
        }
      };
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: 2 },
          (idx) => { if (idx === 0) void doAttach('camera'); else if (idx === 1) void doAttach('gallery'); },
        );
      } else {
        Alert.alert(t('expense.attachReceipt'), '', [
          { text: options[0], onPress: () => void doAttach('camera') },
          { text: options[1], onPress: () => void doAttach('gallery') },
          { text: options[2], style: 'cancel' },
        ]);
      }
    },
    [tenant.id, load, t],
  );

  const handleDeleteReceipt = useCallback(
    (exp: Expense) => {
      Alert.alert(t('expense.deleteReceipt'), t('expense.deleteReceiptConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setReceiptBusyId(exp.id);
            try {
              await receiptService.deleteReceipt(tenant.id, exp.id);
              await load();
            } catch (e: unknown) {
              Alert.alert(t('common.error'), String(e));
            } finally {
              setReceiptBusyId(null);
            }
          },
        },
      ]);
    },
    [tenant.id, load, t],
  );

  const handleCsvExport = useCallback(async () => {
    const rows: string[][] = [
      t('csv.expense.headers').split(','),
      ...expenses.map((e) => [e.date, categoryLabel(e.category), String(e.amount), e.memo]),
    ];
    try {
      await shareCsv(`経費_${yearMonth}.csv`, rows);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    }
  }, [expenses, yearMonth, t]);

  const handlePrint = useCallback(async () => {
    if (expenses.length === 0) return;
    try {
      await printExpenses(
        { title: t('expense.printTitle'), storeName: tenant.name, yearMonth },
        expenses,
        categoryLabel,
      );
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    }
  }, [expenses, tenant.name, yearMonth, t, categoryLabel]);

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
          onPress={handlePrint}
          disabled={expenses.length === 0}
        >
          <MaterialCommunityIcons name="printer-outline" size={16} color={theme.primary} />
          <Text style={[es.actionBtnText, { color: theme.primary }]}>{t('common.print')}</Text>
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
                  onPress={() => handleReceiptAction(item)}
                  disabled={receiptBusyId === item.id}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {receiptBusyId === item.id ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <MaterialCommunityIcons
                      name={item.receiptUrl ? 'file-image' : 'camera-plus-outline'}
                      size={20}
                      color={item.receiptUrl ? theme.primary : '#999'}
                    />
                  )}
                </TouchableOpacity>
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
          categories={allCategories}
          onClose={() => setAddModalVisible(false)}
          onSaved={async () => {
            setAddModalVisible(false);
            await load();
          }}
        />
      )}

      <Modal visible={!!viewingReceipt} transparent animationType="fade" onRequestClose={() => setViewingReceipt(null)}>
        <View style={es.receiptOverlay}>
          <TouchableOpacity style={es.receiptClose} onPress={() => setViewingReceipt(null)}>
            <MaterialCommunityIcons name="close-circle" size={32} color="#fff" />
          </TouchableOpacity>
          {viewingReceipt ? (
            <Image source={{ uri: viewingReceipt }} style={es.receiptImage} resizeMode="contain" />
          ) : null}
          <View style={es.receiptActions}>
            <TouchableOpacity
              style={[es.receiptActionBtn, { backgroundColor: '#dc2626' }]}
              onPress={() => {
                const exp = expenses.find((e) => e.receiptUrl === viewingReceipt);
                if (exp) {
                  setViewingReceipt(null);
                  handleDeleteReceipt(exp);
                }
              }}
            >
              <MaterialCommunityIcons name="delete-outline" size={18} color="#fff" />
              <Text style={es.receiptActionText}>{t('expense.deleteReceipt')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AddExpenseModal({
  visible,
  tenantId,
  theme,
  t,
  categories,
  onClose,
  onSaved,
}: {
  visible: boolean;
  tenantId: string;
  theme: ThemeColor;
  t: TFunc;
  categories: { key: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [category, setCategory] = useState<ExpenseCategory>('purchase');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  const categoryOptions: DropOption[] = categories.map((c) => ({
    key: c.key,
    label: c.label,
    active: c.key === category,
    onPress: () => setCategory(c.key as ExpenseCategory),
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
          valueLabel={categories.find((c) => c.key === category)?.label ?? ''}
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
  summaryLabel: { fontSize: 12, fontWeight: '500' },
  summaryValue: { fontSize: 26, fontWeight: '700', marginTop: 2 },
  catLabel: { fontSize: 11 },
  catValue: { fontSize: 15, fontWeight: '600' },
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
  receiptOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  receiptClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  receiptImage: { width: '90%', height: '70%' },
  receiptActions: { position: 'absolute', bottom: 50, flexDirection: 'row', gap: 12 },
  receiptActionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 6 },
  receiptActionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
