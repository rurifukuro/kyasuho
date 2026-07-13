import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StyleSheet, Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from './common/FormModalShell';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import * as tierService from '../services/hourlyRateTiers';
import * as payrollService from '../services/payroll';
import type { HourlyRateTier, SlideMetric, ThemeColor } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function SlideTierSettingsModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? '';

  const [loading, setLoading] = useState(false);
  const [tiers, setTiers] = useState<HourlyRateTier[]>([]);
  const [slideEnabled, setSlideEnabled] = useState(false);
  const [newMetric, setNewMetric] = useState<SlideMetric>('monthly_sales');
  const [newThreshold, setNewThreshold] = useState('');
  const [newRate, setNewRate] = useState('');

  const load = useCallback(async () => {
    if (!tenantId || !visible) return;
    setLoading(true);
    try {
      const [tierList, settings] = await Promise.all([
        tierService.fetchHourlyRateTiers(tenantId),
        payrollService.fetchPayrollSettings(tenantId),
      ]);
      setTiers(tierList);
      setSlideEnabled(settings?.slideEnabled ?? false);
    } catch (e) {
      console.warn('[kyasuho] SlideTierSettings load:', e);
    } finally {
      setLoading(false);
    }
  }, [tenantId, visible]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const handleToggle = async (val: boolean) => {
    setSlideEnabled(val);
    try {
      const current = await payrollService.fetchPayrollSettings(tenantId);
      await payrollService.savePayrollSettings(tenantId, {
        baseHourlyRate: current?.baseHourlyRate ?? 1200,
        nominationBackRate: current?.nominationBackRate ?? 500,
        defaultBackRate: current?.defaultBackRate ?? 0,
        lateDeduction: current?.lateDeduction ?? 0,
        slideEnabled: val,
      });
    } catch (e) {
      console.warn('[kyasuho] toggle slideEnabled:', e);
    }
  };

  const handleAdd = async () => {
    const threshold = parseInt(newThreshold, 10);
    const rate = parseInt(newRate, 10);
    if (!threshold || !rate) {
      Alert.alert(t('slideTier.inputRequired'));
      return;
    }
    try {
      await tierService.createHourlyRateTier(tenantId, {
        metric: newMetric,
        threshold,
        hourlyRate: rate,
        sortOrder: tiers.length,
      });
      setNewThreshold('');
      setNewRate('');
      await load();
    } catch (e) {
      Alert.alert(t('common.error'), String(e));
    }
  };

  const handleDelete = (tier: HourlyRateTier) => {
    Alert.alert(t('slideTier.deleteConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive', onPress: async () => {
          await tierService.deleteHourlyRateTier(tier.id);
          await load();
        },
      },
    ]);
  };

  const s = makeStyles(theme);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="close" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('slideTier.title')}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={theme.primary} /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={s.switchRow}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>{t('slideTier.enabled')}</Text>
            <Switch value={slideEnabled} onValueChange={handleToggle} trackColor={{ true: theme.primary }} />
          </View>

          {slideEnabled && (
            <>
              <Text style={[s.sectionTitle, { color: theme.primary }]}>{t('slideTier.tierList')}</Text>
              {tiers.length === 0 ? (
                <Text style={{ color: theme.subtext, fontSize: 14, marginBottom: 12 }}>{t('slideTier.empty')}</Text>
              ) : (
                tiers.map((tier) => (
                  <View key={tier.id} style={[s.tierRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                        {t(`slideTier.metric.${tier.metric}`)} ≥ {tier.threshold.toLocaleString()}
                      </Text>
                      <Text style={{ color: theme.primary, fontSize: 13, marginTop: 2 }}>
                        → {tier.hourlyRate.toLocaleString()}{t('slideTier.yenPerHour')}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(tier)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <Text style={[s.sectionTitle, { color: theme.primary, marginTop: 20 }]}>{t('slideTier.addNew')}</Text>

              <Text style={[s.label, { color: theme.subtext }]}>{t('slideTier.metricLabel')}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {(['monthly_sales', 'monthly_nominations'] as const).map((m) => {
                  const sel = newMetric === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[s.chip, { borderColor: sel ? theme.primary : theme.border, backgroundColor: sel ? theme.primary : theme.card }]}
                      onPress={() => setNewMetric(m)}
                    >
                      <Text style={{ color: sel ? '#fff' : theme.text, fontSize: 13, fontWeight: '600' }}>{t(`slideTier.metric.${m}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.label, { color: theme.subtext }]}>{t('slideTier.thresholdLabel')}</Text>
              <TextInput
                style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
                value={newThreshold}
                onChangeText={(v) => setNewThreshold(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder={t('slideTier.thresholdPlaceholder')}
                placeholderTextColor={theme.subtext}
              />

              <Text style={[s.label, { color: theme.subtext }]}>{t('slideTier.rateLabel')}</Text>
              <TextInput
                style={[s.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
                value={newRate}
                onChangeText={(v) => setNewRate(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder={t('slideTier.ratePlaceholder')}
                placeholderTextColor={theme.subtext}
              />

              <TouchableOpacity style={[s.addBtn, { backgroundColor: theme.primary }]} onPress={handleAdd}>
                <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{t('slideTier.add')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </FormModalShell>
  );
}

function makeStyles(theme: ThemeColor) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
    sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 16 },
    tierRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
    label: { fontSize: 12, marginBottom: 6, marginTop: 10 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
    chip: { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 14, marginTop: 16 },
  });
}
