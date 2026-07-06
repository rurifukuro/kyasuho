// src/screens/RegisterScreen.tsx — レジ画面（§25-3・伝票レーン＋メニュー管理＋会計）
//
// 3モード切替: lane（open伝票一覧）/ detail（伝票明細＋メニュー追加）/ menu（メニュー管理CRUD）。
// 会計は CheckoutModal → ChangeResultModal。割引は DiscountModal（CheckoutModal内）。

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { KeyboardDoneBar } from '../components/KeyboardDoneBar';
import { CheckoutModal } from '../components/CheckoutModal';
import { ChangeResultModal } from '../components/ChangeResultModal';
import { MenuEditModal } from '../components/MenuEditModal';
import * as ordersService from '../services/orders';
import * as menuItemsService from '../services/menuItems';
import { fetchCasts } from '../services/casts';
import { todayStr, formatYen } from './analytics/common';
import type { Order, OrderItem, MenuItem, MenuCategory, Cast, PaymentMethod, ThemeColor } from '../types';
import type { TKey } from '../i18n';

// ── カテゴリ表示順・ラベル ──

const CATEGORY_ORDER: MenuCategory[] = [
  'set', 'extension', 'nomination', 'cast_drink', 'drink', 'food', 'cheki', 'other', 'discount',
];

const CAT_LABELS: Record<MenuCategory, TKey> = {
  set: 'menu.cat.set',
  extension: 'menu.cat.extension',
  nomination: 'menu.cat.nomination',
  cast_drink: 'menu.cat.cast_drink',
  drink: 'menu.cat.drink',
  food: 'menu.cat.food',
  cheki: 'menu.cat.cheki',
  other: 'menu.cat.other',
  discount: 'menu.cat.discount',
};

type ViewMode = 'lane' | 'detail' | 'menu';

export function RegisterScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { tenant } = useTenant();
  const insets = useSafeAreaInsets();
  const s = makeStyles(theme);

  const [view, setView] = useState<ViewMode>('lane');
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerLabel, setCustomerLabel] = useState('');

  const [showCheckout, setShowCheckout] = useState(false);
  const [changeResult, setChangeResult] = useState<{ subtotal: number; deposit: number; change: number } | null>(null);
  const [showMenuEdit, setShowMenuEdit] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);

  const tenantId = tenant?.id ?? '';

  // ── データ読込 ──

  const loadOrders = useCallback(async () => {
    if (!tenantId) return;
    try {
      const data = await ordersService.fetchOpenOrders(tenantId);
      setOrders(data);
    } catch (e) { console.warn('[kyasuho] loadOrders:', e); }
  }, [tenantId]);

  const loadMenuItems = useCallback(async () => {
    if (!tenantId) return;
    try {
      const data = await menuItemsService.fetchMenuItems(tenantId);
      setMenuItems(data);
    } catch (e) { console.warn('[kyasuho] loadMenuItems:', e); }
  }, [tenantId]);

  const loadCasts = useCallback(async () => {
    if (!tenantId) return;
    try {
      const data = await fetchCasts(tenantId);
      setCasts(data);
    } catch (e) { console.warn('[kyasuho] loadCasts:', e); }
  }, [tenantId]);

  const loadOrderItems = useCallback(async (orderId: string) => {
    try {
      const data = await ordersService.fetchOrderItems(orderId);
      setOrderItems(data);
    } catch (e) { console.warn('[kyasuho] loadOrderItems:', e); }
  }, []);

  useEffect(() => {
    if (tenantId) {
      void loadOrders();
      void loadMenuItems();
      void loadCasts();
    }
  }, [tenantId, loadOrders, loadMenuItems, loadCasts]);

  // ── 伝票操作 ──

  const openNewOrder = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const order = await ordersService.openOrder(tenantId, { bizDate: todayStr() });
      setActiveOrderId(order.id);
      setCustomerLabel('');
      setOrderItems([]);
      setView('detail');
      await loadOrders();
    } catch (e) { console.warn('[kyasuho] openOrder:', e); }
    finally { setLoading(false); }
  };

  const openExistingOrder = (order: Order) => {
    setActiveOrderId(order.id);
    setCustomerLabel(order.customerLabel);
    void loadOrderItems(order.id);
    setView('detail');
  };

  const saveLabel = async () => {
    if (!activeOrderId) return;
    try {
      await ordersService.updateOrderLabel(activeOrderId, customerLabel.trim());
    } catch (e) { console.warn('[kyasuho] saveLabel:', e); }
  };

  const handleTempSave = async () => {
    await saveLabel();
    await loadOrders();
    setView('lane');
    Alert.alert(t('register.tempSaved'));
  };

  const handleVoid = () => {
    Alert.alert(t('register.voidConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('register.voidOrder'), style: 'destructive', onPress: async () => {
          if (!activeOrderId) return;
          await ordersService.voidOrder(activeOrderId);
          await loadOrders();
          setView('lane');
        },
      },
    ]);
  };

  // ── 明細操作 ──

  const addItem = async (item: MenuItem, castId: string | null) => {
    if (!activeOrderId || !tenantId) return;
    await ordersService.addOrderItem(activeOrderId, {
      tenantId,
      menuItemId: item.id,
      category: item.category,
      name: item.name,
      price: item.price,
      qty: 1,
      castId,
    });
    await loadOrderItems(activeOrderId);
  };

  const handleMenuItemTap = (item: MenuItem) => {
    if (item.needsCast && casts.length > 0) {
      Alert.alert(
        t('register.selectCast'),
        undefined,
        [
          ...casts.map((c) => ({
            text: c.name,
            onPress: () => addItem(item, c.id),
          })),
          { text: t('common.cancel'), style: 'cancel' as const },
        ],
      );
    } else {
      void addItem(item, null);
    }
  };

  const changeQty = async (oi: OrderItem, delta: number) => {
    const newQty = oi.qty + delta;
    if (newQty <= 0) {
      await ordersService.deleteOrderItem(oi.id);
    } else {
      await ordersService.updateOrderItemQty(oi.id, newQty);
    }
    if (activeOrderId) await loadOrderItems(activeOrderId);
  };

  // ── 会計 ──

  const handleAddDiscount = async (name: string, price: number) => {
    if (!activeOrderId || !tenantId) return;
    await ordersService.addOrderItem(activeOrderId, {
      tenantId,
      menuItemId: null,
      category: 'discount',
      name,
      price,
      qty: 1,
      castId: null,
    });
    if (activeOrderId) await loadOrderItems(activeOrderId);
  };

  const handleCheckoutConfirm = async (
    subtotal: number, deposit: number, change: number,
    paymentMethod: PaymentMethod, note: string,
  ) => {
    if (!activeOrderId || !tenantId) return;
    await ordersService.closeOrder(activeOrderId, tenantId, {
      subtotal, deposit, change, paymentMethod, note,
    }, orderItems);
    setShowCheckout(false);
    setChangeResult({ subtotal, deposit, change });
  };

  const handleChangeResultClose = async () => {
    setChangeResult(null);
    await loadOrders();
    setView('lane');
  };

  // ── メニュー管理 ──

  const handleMenuSave = async (data: {
    category: MenuCategory; name: string; price: number;
    needsCast: boolean; sortOrder: number; isActive: boolean;
  }) => {
    if (!tenantId) return;
    if (editingMenuItem) {
      await menuItemsService.updateMenuItem(editingMenuItem.id, data);
    } else {
      await menuItemsService.createMenuItem(tenantId, data);
    }
    await loadMenuItems();
  };

  const handleMenuDelete = async () => {
    if (!editingMenuItem) return;
    await menuItemsService.deleteMenuItem(editingMenuItem.id);
    await loadMenuItems();
  };

  // ── 算出値 ──

  const subtotal = useMemo(() => orderItems.reduce((s, i) => s + i.price * i.qty, 0), [orderItems]);

  const activeMenuItems = useMemo(() => menuItems.filter((m) => m.isActive), [menuItems]);

  const discountPresets = useMemo(
    () => activeMenuItems.filter((m) => m.category === 'discount'),
    [activeMenuItems],
  );

  const menuByCategory = useMemo(() => {
    const groups: { category: MenuCategory; items: MenuItem[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = activeMenuItems.filter((m) => m.category === cat);
      if (items.length > 0) groups.push({ category: cat, items });
    }
    return groups;
  }, [activeMenuItems]);

  const allMenuByCategory = useMemo(() => {
    const groups: { category: MenuCategory; items: MenuItem[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = menuItems.filter((m) => m.category === cat);
      if (items.length > 0) groups.push({ category: cat, items });
    }
    return groups;
  }, [menuItems]);

  // ── ガード ──

  if (!tenant) {
    return (
      <View style={[s.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LANE VIEW — open伝票一覧
  // ════════════════════════════════════════════════════════════════════════════

  if (view === 'lane') {
    return (
      <View style={[s.root, { paddingTop: Platform.OS === 'android' ? insets.top : insets.top }]}>
        <View style={[s.headerBar, { borderBottomColor: theme.border }]}>
          <Text style={[s.headerTitle, { color: theme.text }]}>{t('register.title')}</Text>
          <TouchableOpacity onPress={() => setView('menu')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="food-variant" size={22} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {orders.length === 0 ? (
          <View style={s.emptyContainer}>
            <MaterialCommunityIcons name="receipt" size={48} color={theme.border} />
            <Text style={[s.emptyText, { color: theme.subtext }]}>{t('register.emptyLane')}</Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(o) => o.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            renderItem={({ item: order }) => {
              const timeStr = order.openedAt
                ? new Date(order.openedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                : '';
              return (
                <TouchableOpacity
                  style={[s.laneCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => openExistingOrder(order)}
                  activeOpacity={0.7}
                >
                  <View style={s.laneCardTop}>
                    <Text style={[s.laneLabel, { color: theme.text }]}>
                      {order.customerLabel || t('register.customerLabel')}
                    </Text>
                    {order.seatNo != null && (
                      <Text style={[s.laneSeat, { color: theme.subtext }]}>
                        {t('register.openSince', { time: timeStr })}
                      </Text>
                    )}
                  </View>
                  <Text style={[s.laneTime, { color: theme.subtext }]}>
                    {t('register.openSince', { time: timeStr })}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        )}

        <TouchableOpacity
          style={[s.newOrderBtn, { backgroundColor: theme.primary, bottom: insets.bottom + 16 }]}
          onPress={openNewOrder}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="plus" size={20} color="#fff" />
              <Text style={s.newOrderText}>{t('register.newOrder')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW — 伝票明細＋メニュー追加
  // ════════════════════════════════════════════════════════════════════════════

  if (view === 'detail') {
    return (
      <View style={[s.root, { paddingTop: Platform.OS === 'android' ? insets.top : insets.top }]}>
        <View style={[s.headerBar, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={handleTempSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: theme.text, flex: 1, textAlign: 'center' }]}>
            {customerLabel || t('register.customerLabel')}
          </Text>
          <TouchableOpacity onPress={handleVoid} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>{t('register.voidOrder')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          {/* お客様名 */}
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: theme.subtext }]}>{t('register.customerLabel')}</Text>
            <TextInput
              style={[s.nameInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
              value={customerLabel}
              onChangeText={setCustomerLabel}
              onBlur={saveLabel}
              placeholder={t('register.customerLabelPlaceholder')}
              placeholderTextColor={theme.subtext}
            />
          </View>

          {/* 注文内容 */}
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: theme.subtext }]}>{t('register.orderItems')}</Text>
            {orderItems.length === 0 ? (
              <Text style={[s.emptyHint, { color: theme.subtext }]}>{t('register.addFromMenu')}</Text>
            ) : (
              orderItems.map((oi) => (
                <View key={oi.id} style={[s.itemRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.itemName, { color: oi.price < 0 ? '#EF4444' : theme.text }]}>{oi.name}</Text>
                    {oi.castId && (
                      <Text style={[s.itemCast, { color: theme.subtext }]}>
                        {casts.find((c) => c.id === oi.castId)?.name ?? ''}
                      </Text>
                    )}
                  </View>
                  <View style={s.qtyRow}>
                    <TouchableOpacity style={[s.qtyBtn, { borderColor: theme.border }]} onPress={() => changeQty(oi, -1)}>
                      <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>−</Text>
                    </TouchableOpacity>
                    <Text style={[s.qtyText, { color: theme.text }]}>{oi.qty}</Text>
                    <TouchableOpacity style={[s.qtyBtn, { borderColor: theme.border }]} onPress={() => changeQty(oi, 1)}>
                      <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>＋</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[s.itemPrice, { color: oi.price < 0 ? '#EF4444' : theme.text }]}>
                    {formatYen(oi.price * oi.qty)}
                  </Text>
                </View>
              ))
            )}
            {orderItems.length > 0 && (
              <View style={s.subtotalRow}>
                <Text style={[s.subtotalLabel, { color: theme.subtext }]}>{t('register.subtotal')}</Text>
                <Text style={[s.subtotalAmt, { color: theme.text }]}>{formatYen(subtotal)}</Text>
              </View>
            )}
          </View>

          {/* メニューカタログ */}
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: theme.subtext }]}>{t('register.menuCatalog')}</Text>
            {menuByCategory.length === 0 ? (
              <Text style={[s.emptyHint, { color: theme.subtext }]}>{t('menu.noItems')}</Text>
            ) : (
              menuByCategory.map(({ category, items }) => (
                <View key={category}>
                  <Text style={[s.catHeader, { color: theme.primary }]}>{t(CAT_LABELS[category])}</Text>
                  {items.map((mi) => (
                    <TouchableOpacity
                      key={mi.id}
                      style={[s.menuRow, { borderColor: theme.border, backgroundColor: theme.card }]}
                      onPress={() => handleMenuItemTap(mi)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.menuName, { color: mi.price < 0 ? '#EF4444' : theme.text }]}>{mi.name}</Text>
                      <Text style={[s.menuPrice, { color: mi.price < 0 ? '#EF4444' : theme.primary }]}>
                        {formatYen(mi.price)}
                      </Text>
                      <MaterialCommunityIcons name="plus-circle" size={24} color={theme.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* 下部アクションバー */}
        <View style={[s.actionBar, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={[s.tempSaveBtn, { borderColor: theme.border }]} onPress={handleTempSave}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>{t('register.tempSave')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.checkoutBtn, { backgroundColor: orderItems.length > 0 ? theme.primary : theme.border }]}
            onPress={() => setShowCheckout(true)}
            disabled={orderItems.length === 0}
          >
            <Text style={s.checkoutText}>
              {t('register.checkout')} {orderItems.length > 0 ? formatYen(subtotal) : ''}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardDoneBar />

        <CheckoutModal
          visible={showCheckout}
          onClose={() => setShowCheckout(false)}
          items={orderItems}
          discountPresets={discountPresets}
          onAddDiscount={handleAddDiscount}
          onConfirm={handleCheckoutConfirm}
        />

        {changeResult && (
          <ChangeResultModal
            visible={true}
            subtotal={changeResult.subtotal}
            deposit={changeResult.deposit}
            change={changeResult.change}
            onClose={handleChangeResultClose}
          />
        )}
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MENU MANAGE VIEW — メニューCRUD
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <View style={[s.root, { paddingTop: Platform.OS === 'android' ? insets.top : insets.top }]}>
      <View style={[s.headerBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => setView('lane')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text, flex: 1, textAlign: 'center' }]}>{t('menu.title')}</Text>
        <TouchableOpacity
          onPress={() => { setEditingMenuItem(null); setShowMenuEdit(true); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="plus" size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {allMenuByCategory.length === 0 ? (
        <View style={s.emptyContainer}>
          <MaterialCommunityIcons name="food-variant-off" size={48} color={theme.border} />
          <Text style={[s.emptyText, { color: theme.subtext }]}>{t('menu.noItems')}</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {allMenuByCategory.map(({ category, items }) => (
            <View key={category}>
              <Text style={[s.catHeader, { color: theme.primary }]}>{t(CAT_LABELS[category])}</Text>
              {items.map((mi) => (
                <TouchableOpacity
                  key={mi.id}
                  style={[s.menuManageRow, { borderColor: theme.border, backgroundColor: theme.card, opacity: mi.isActive ? 1 : 0.5 }]}
                  onPress={() => { setEditingMenuItem(mi); setShowMenuEdit(true); }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.menuName, { color: mi.price < 0 ? '#EF4444' : theme.text }]}>{mi.name}</Text>
                    {mi.needsCast && (
                      <Text style={[s.itemCast, { color: theme.subtext }]}>{t('menu.needsCast')}</Text>
                    )}
                  </View>
                  <Text style={[s.menuPrice, { color: mi.price < 0 ? '#EF4444' : theme.primary }]}>
                    {formatYen(mi.price)}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.subtext} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <MenuEditModal
        visible={showMenuEdit}
        onClose={() => setShowMenuEdit(false)}
        editing={editingMenuItem}
        onSave={handleMenuSave}
        onDelete={editingMenuItem ? handleMenuDelete : undefined}
      />
    </View>
  );
}

// ── スタイル ──

function makeStyles(theme: ThemeColor) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    headerBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 18, fontWeight: '800' },

    // Lane
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyText: { fontSize: 15 },
    laneCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 10 },
    laneCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    laneLabel: { fontSize: 16, fontWeight: '700' },
    laneSeat: { fontSize: 13 },
    laneTime: { fontSize: 12, marginTop: 4 },
    newOrderBtn: {
      position: 'absolute', left: 24, right: 24,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderRadius: 16, paddingVertical: 16,
    },
    newOrderText: { color: '#fff', fontSize: 16, fontWeight: '800' },

    // Detail
    section: { padding: 16, paddingBottom: 0 },
    sectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
    nameInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
    emptyHint: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
    itemRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 6, gap: 8 },
    itemName: { fontSize: 15, fontWeight: '600' },
    itemCast: { fontSize: 12, marginTop: 2 },
    itemPrice: { fontSize: 15, fontWeight: '700', width: 70, textAlign: 'right' },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    qtyBtn: { width: 30, height: 30, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    qtyText: { fontSize: 16, fontWeight: '700', width: 24, textAlign: 'center' },
    subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4 },
    subtotalLabel: { fontSize: 15 },
    subtotalAmt: { fontSize: 20, fontWeight: '800' },
    catHeader: { fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 6 },
    menuRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 6, gap: 10 },
    menuName: { flex: 1, fontSize: 15, fontWeight: '600' },
    menuPrice: { fontSize: 15, fontWeight: '700' },

    // Action bar
    actionBar: { flexDirection: 'row', borderTopWidth: 1, padding: 12, gap: 10 },
    tempSaveBtn: { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    checkoutBtn: { flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    checkoutText: { color: '#fff', fontSize: 16, fontWeight: '800' },

    // Menu manage
    menuManageRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 6, gap: 10 },
  });
}
