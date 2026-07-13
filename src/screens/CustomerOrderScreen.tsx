import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../config/supabase';

type MenuItem = {
  id: string;
  category: string;
  name: string;
  price: number;
  needs_cast: boolean;
  is_active: boolean;
};

const CATEGORY_ORDER: { key: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { key: 'nomination', icon: 'star' },
  { key: 'cast_drink', icon: 'glass-cocktail' },
  { key: 'drink', icon: 'cup' },
  { key: 'food', icon: 'food' },
  { key: 'cheki', icon: 'camera' },
  { key: 'other', icon: 'dots-horizontal' },
];

type Props = {
  tenantId: string;
  initialToken?: string;
  onBack: () => void;
};

export function CustomerOrderScreen({ tenantId, initialToken, onBack }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [token, setToken] = useState(initialToken ?? '');
  const [tokenConfirmed, setTokenConfirmed] = useState(!!initialToken);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenantId || !tokenConfirmed) return;
    setLoading(true);
    supabase
      .from('ky_menu_items')
      .select('id, category, name, price, needs_cast, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setMenuItems((data as MenuItem[] | null) ?? []);
        setLoading(false);
      });
  }, [tenantId, tokenConfirmed]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menuItems) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c.key)).map((c) => ({
      ...c,
      items: map.get(c.key)!,
    }));
  }, [menuItems]);

  const cartItems = useMemo(
    () => menuItems.filter((m) => (qty[m.id] ?? 0) > 0),
    [menuItems, qty],
  );
  const cartTotal = useMemo(
    () => cartItems.reduce((sum, m) => sum + m.price * (qty[m.id] ?? 0), 0),
    [cartItems, qty],
  );

  const updateQty = useCallback((id: string, delta: number) => {
    setQty((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      return { ...prev, [id]: next };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    const items = cartItems.map((m) => ({
      menu_item_id: m.id,
      qty: qty[m.id] ?? 1,
      cast_id: null,
    }));
    const { data, error } = await supabase.rpc('ky_submit_mobile_order', {
      p_token: token,
      p_items: items,
    });
    setSubmitting(false);
    const res = data as { ok?: boolean; error?: string; inserted?: number } | null;
    if (error || !res?.ok) {
      const msg = res?.error === 'order_not_found' ? t('customer.orderTokenInvalid')
        : res?.error === 'order_closed' ? t('customer.orderClosed')
        : res?.error === 'rate_limit' ? t('customer.orderRateLimit')
        : t('customer.orderError');
      Alert.alert(t('common.error'), msg);
      return;
    }
    Alert.alert(t('customer.orderSuccessTitle'), t('customer.orderSuccessBody'), [
      { text: 'OK', onPress: () => setQty({}) },
    ]);
  }, [cartItems, qty, token, t]);

  const categoryLabel = (key: string) => {
    const map: Record<string, string> = {
      nomination: t('customer.orderCatNomination'),
      cast_drink: t('customer.orderCatCastDrink'),
      drink: t('customer.orderCatDrink'),
      food: t('customer.orderCatFood'),
      cheki: t('customer.orderCatCheki'),
      other: t('customer.orderCatOther'),
    };
    return map[key] ?? key;
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('customer.orderTitle')}</Text>
      </View>

      {!tokenConfirmed ? (
        <View style={s.tokenSection}>
          <MaterialCommunityIcons name="qrcode-scan" size={48} color={theme.border} />
          <Text style={[s.tokenHint, { color: theme.subtext }]}>{t('customer.orderTokenHint')}</Text>
          <TextInput
            style={[s.tokenInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            value={token}
            onChangeText={setToken}
            placeholder={t('customer.orderTokenPlaceholder')}
            placeholderTextColor={theme.subtext}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[s.tokenBtn, { backgroundColor: theme.primary }, !token.trim() && { opacity: 0.5 }]}
            onPress={() => token.trim() && setTokenConfirmed(true)}
            disabled={!token.trim()}
          >
            <Text style={s.tokenBtnText}>{t('customer.orderTokenConfirm')}</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
            {grouped.map((group) => (
              <View key={group.key}>
                <View style={[s.catHeader, { borderBottomColor: theme.border }]}>
                  <MaterialCommunityIcons name={group.icon} size={18} color={theme.primary} />
                  <Text style={[s.catTitle, { color: theme.primary }]}>{categoryLabel(group.key)}</Text>
                </View>
                {group.items.map((item) => (
                  <View key={item.id} style={[s.itemRow, { borderBottomColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.itemName, { color: theme.text }]}>{item.name}</Text>
                      <Text style={[s.itemPrice, { color: theme.subtext }]}>¥{item.price.toLocaleString()}</Text>
                    </View>
                    <View style={s.qtyControls}>
                      <TouchableOpacity
                        style={[s.qtyBtn, { borderColor: theme.border }]}
                        onPress={() => updateQty(item.id, -1)}
                        disabled={(qty[item.id] ?? 0) <= 0}
                      >
                        <Text style={[s.qtyBtnText, { color: (qty[item.id] ?? 0) > 0 ? theme.text : theme.border }]}>−</Text>
                      </TouchableOpacity>
                      <Text style={[s.qtyValue, { color: theme.text }]}>{qty[item.id] ?? 0}</Text>
                      <TouchableOpacity
                        style={[s.qtyBtn, { borderColor: theme.primary }]}
                        onPress={() => updateQty(item.id, 1)}
                      >
                        <Text style={[s.qtyBtnText, { color: theme.primary }]}>＋</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          {cartItems.length > 0 && (
            <View style={[s.cartBar, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.cartCount, { color: theme.subtext }]}>
                  {cartItems.reduce((sum, m) => sum + (qty[m.id] ?? 0), 0)}{t('customer.orderItemCount')}
                </Text>
                <Text style={[s.cartTotal, { color: theme.text }]}>¥{cartTotal.toLocaleString()}</Text>
              </View>
              <TouchableOpacity
                style={[s.cartBtn, { backgroundColor: theme.primary }, submitting && { opacity: 0.5 }]}
                onPress={() => void handleSubmit()}
                disabled={submitting}
              >
                <Text style={s.cartBtnText}>
                  {submitting ? t('common.loading') : t('customer.orderSubmit')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tokenSection: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  tokenHint: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  tokenInput: { width: '100%', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, textAlign: 'center' },
  tokenBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
  tokenBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  catTitle: { fontSize: 14, fontWeight: '700' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemName: { fontSize: 15, fontWeight: '500' },
  itemPrice: { fontSize: 13, marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, fontWeight: '600', lineHeight: 22 },
  qtyValue: { fontSize: 16, fontWeight: '700', width: 24, textAlign: 'center' },
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cartCount: { fontSize: 12 },
  cartTotal: { fontSize: 18, fontWeight: '800' },
  cartBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  cartBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
