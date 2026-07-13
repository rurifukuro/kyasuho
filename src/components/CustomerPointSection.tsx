import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../config/supabase';

type PointTx = { id: string; kind: string; points: number; memo: string; created_at: string };
type Reward = { id: string; name: string; description: string; points_required: number };

type Props = {
  tenantId: string;
};

export function CustomerPointSection({ tenantId }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [enabled, setEnabled] = useState(false);
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<PointTx[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      try {
      const { data: settings } = await supabase
        .from('ky_point_settings')
        .select('enabled, yen_per_point')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const isEnabled = (settings as { enabled: boolean } | null)?.enabled ?? false;
      setEnabled(isEnabled);
      if (!isEnabled) { setLoaded(true); return; }

      const [txRes, balRes, rewardRes] = await Promise.all([
        supabase
          .from('ky_point_transactions')
          .select('id, kind, points, memo, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.rpc('ky_customer_point_balance', { p_tenant_id: tenantId }),
        supabase
          .from('ky_point_rewards')
          .select('id, name, description, points_required')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('sort_order'),
      ]);
      const txs = (txRes.data as PointTx[] | null) ?? [];
      setHistory(txs);
      const serverBalance = typeof balRes.data === 'number' ? balRes.data : null;
      setBalance(serverBalance ?? txs.reduce((sum, tx) => sum + tx.points, 0));
      setRewards((rewardRes.data as Reward[] | null) ?? []);
      } finally {
        setLoaded(true);
      }
    })();
  }, [tenantId]);

  const handleRedeem = useCallback(async (reward: Reward) => {
    Alert.alert(
      t('customer.pointRedeemConfirmTitle'),
      t('customer.pointRedeemConfirmBody', { name: reward.name, pts: String(reward.points_required) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('customer.pointRedeemAction'),
          onPress: async () => {
            Alert.alert(t('customer.pointRedeemStoreOnly'), t('customer.pointRedeemStoreOnlyBody'));
          },
        },
      ],
    );
  }, [t, history]);

  if (!loaded || !enabled) return null;

  const kindLabel = (kind: string) => {
    switch (kind) {
      case 'earn': return t('customer.pointEarn');
      case 'redeem': return t('customer.pointRedeem');
      case 'adjust': return t('customer.pointAdjust');
      default: return kind;
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <View style={{ marginTop: 24 }}>
      <Text style={[s.sectionTitle, { color: theme.text }]}>{t('customer.pointTitle')}</Text>

      {/* Balance card */}
      <View style={[s.balanceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <MaterialCommunityIcons name="star-circle" size={32} color="#F59E0B" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[s.balanceLabel, { color: theme.subtext }]}>{t('customer.pointBalance')}</Text>
          <Text style={[s.balanceValue, { color: theme.text }]}>
            {balance.toLocaleString()} <Text style={s.balanceUnit}>pt</Text>
          </Text>
        </View>
      </View>

      {/* Rewards catalog */}
      {rewards.length > 0 && (
        <>
          <Text style={[s.subTitle, { color: theme.text }]}>{t('customer.pointRewards')}</Text>
          {rewards.map((rw) => (
            <TouchableOpacity
              key={rw.id}
              style={[s.rewardCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => void handleRedeem(rw)}
              activeOpacity={0.7}
              disabled={balance < rw.points_required}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.rewardName, { color: theme.text }]}>{rw.name}</Text>
                {rw.description ? <Text style={[s.rewardDesc, { color: theme.subtext }]}>{rw.description}</Text> : null}
              </View>
              <View style={[s.rewardPts, balance >= rw.points_required ? { backgroundColor: '#F59E0B' } : { backgroundColor: theme.border }]}>
                <Text style={s.rewardPtsText}>{rw.points_required}pt</Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Transaction history */}
      {history.length > 0 && (
        <>
          <TouchableOpacity
            style={s.historyToggle}
            onPress={() => setExpanded(!expanded)}
          >
            <Text style={[s.subTitle, { color: theme.text, marginBottom: 0 }]}>{t('customer.pointHistory')}</Text>
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.subtext}
            />
          </TouchableOpacity>
          {expanded && history.slice(0, 20).map((tx) => (
            <View key={tx.id} style={[s.txRow, { borderBottomColor: theme.border }]}>
              <Text style={[s.txDate, { color: theme.subtext }]}>{formatDate(tx.created_at)}</Text>
              <Text style={[s.txKind, { color: theme.subtext }]}>{kindLabel(tx.kind)}</Text>
              <Text style={[s.txMemo, { color: theme.text }]} numberOfLines={1}>{tx.memo}</Text>
              <Text style={[s.txPts, { color: tx.points > 0 ? '#3BAE5A' : '#D7263D' }]}>
                {tx.points > 0 ? '+' : ''}{tx.points}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: '700', marginHorizontal: 16, marginBottom: 8 },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  balanceLabel: { fontSize: 12 },
  balanceValue: { fontSize: 28, fontWeight: '800' },
  balanceUnit: { fontSize: 16, fontWeight: '600' },
  subTitle: { fontSize: 14, fontWeight: '600', marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  rewardName: { fontSize: 14, fontWeight: '600' },
  rewardDesc: { fontSize: 12, marginTop: 2 },
  rewardPts: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  rewardPtsText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  historyToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  txDate: { fontSize: 12, width: 40 },
  txKind: { fontSize: 12, width: 32 },
  txMemo: { flex: 1, fontSize: 13 },
  txPts: { fontSize: 14, fontWeight: '700', textAlign: 'right', minWidth: 50 },
});
