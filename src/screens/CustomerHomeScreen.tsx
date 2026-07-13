import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { FormModalShell } from '../components/common/FormModalShell';
import {
  getFollowedTenants,
  followTenantBySlug,
  unfollowTenant,
  type FollowedTenant,
} from '../services/customerService';

type Props = {
  customerAccountId: string;
  onOpenShop: (tenantId: string, slug: string) => void;
};

export function CustomerHomeScreen({ customerAccountId, onOpenShop }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [shops, setShops] = useState<FollowedTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [addVisible, setAddVisible] = useState(false);
  const [slug, setSlug] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await getFollowedTenants(customerAccountId);
      setShops(list);
    } catch (e: unknown) {
      console.warn('[kyasuho] getFollowedTenants failed:', e);
    } finally {
      setLoading(false);
    }
  }, [customerAccountId]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = useCallback(async () => {
    const trimmed = slug.trim().toLowerCase();
    if (!trimmed) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const result = await followTenantBySlug(customerAccountId, trimmed);
      if (!result.ok) {
        const msg =
          result.error === 'not_found' ? t('customer.shopNotFound') :
          result.error === 'already_following' ? t('customer.alreadyFollowing') :
          result.error === 'suspended' ? t('customer.shopSuspended') :
          t('common.error');
        setAddError(msg);
      } else {
        setSlug('');
        setAddVisible(false);
        void load();
      }
    } catch {
      setAddError(t('common.error'));
    } finally {
      setAddLoading(false);
    }
  }, [slug, customerAccountId, load, t]);

  const handleUnfollow = useCallback((item: FollowedTenant) => {
    Alert.alert(
      t('customer.unfollowTitle'),
      t('customer.unfollowBody', { name: item.tenant_name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('customer.unfollow'),
          style: 'destructive',
          onPress: async () => {
            try {
              await unfollowTenant(item.id);
              void load();
            } catch {
              Alert.alert(t('common.error'));
            }
          },
        },
      ],
    );
  }, [load, t]);

  const renderItem = useCallback(({ item }: { item: FollowedTenant }) => (
    <TouchableOpacity
      style={[s.shopCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => onOpenShop(item.tenant_id, item.tenant_slug)}
      onLongPress={() => handleUnfollow(item)}
      activeOpacity={0.8}
    >
      <View style={s.shopInfo}>
        <Text style={[s.shopName, { color: theme.text }]} numberOfLines={1}>
          {item.tenant_name}
        </Text>
        {item.tenant_genre ? (
          <Text style={[s.shopGenre, { color: theme.subtext }]} numberOfLines={1}>
            {item.tenant_genre}
          </Text>
        ) : null}
        {item.open_hours ? (
          <Text style={[s.shopHours, { color: theme.subtext }]} numberOfLines={1}>
            {item.open_hours}
          </Text>
        ) : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={theme.subtext} />
    </TouchableOpacity>
  ), [theme, onOpenShop, handleUnfollow]);

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <Text style={[s.headerTitle, { color: theme.primary }]}>{t('customer.homeTitle')}</Text>
        <TouchableOpacity onPress={() => setAddVisible(true)} style={s.addBtn}>
          <MaterialCommunityIcons name="plus-circle-outline" size={28} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : shops.length === 0 ? (
        <View style={s.center}>
          <MaterialCommunityIcons name="store-search-outline" size={64} color={theme.border} />
          <Text style={[s.emptyText, { color: theme.subtext }]}>{t('customer.noShops')}</Text>
          <TouchableOpacity
            style={[s.emptyBtn, { backgroundColor: theme.primary }]}
            onPress={() => setAddVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={s.emptyBtnText}>{t('customer.addShop')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={shops}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      <FormModalShell
        visible={addVisible}
        onRequestClose={() => { setAddVisible(false); setAddError(null); setSlug(''); }}
        theme={theme}
      >
        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{t('customer.addShopTitle')}</Text>
            <TouchableOpacity onPress={() => { setAddVisible(false); setAddError(null); setSlug(''); }}>
              <MaterialCommunityIcons name="close" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>
          <Text style={[s.addDesc, { color: theme.subtext }]}>{t('customer.addShopDesc')}</Text>
          <TextInput
            style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            value={slug}
            onChangeText={setSlug}
            placeholder={t('customer.slugPlaceholder')}
            placeholderTextColor={theme.subtext}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!addLoading}
          />
          {addError ? <Text style={s.addErrorText}>{addError}</Text> : null}
          <TouchableOpacity
            style={[s.addSubmit, { backgroundColor: theme.primary, opacity: addLoading || !slug.trim() ? 0.5 : 1 }]}
            onPress={handleAdd}
            disabled={addLoading || !slug.trim()}
            activeOpacity={0.85}
          >
            {addLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.addSubmitText}>{t('customer.follow')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </FormModalShell>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  addBtn: { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, marginTop: 16, textAlign: 'center' },
  emptyBtn: { marginTop: 20, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  shopInfo: { flex: 1, marginRight: 8 },
  shopName: { fontSize: 17, fontWeight: '700' },
  shopGenre: { fontSize: 13, marginTop: 3 },
  shopHours: { fontSize: 12, marginTop: 2 },
  addDesc: { fontSize: 14, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  addErrorText: { color: '#D7263D', fontSize: 13, marginTop: 8, fontWeight: '600' },
  addSubmit: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  addSubmitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
