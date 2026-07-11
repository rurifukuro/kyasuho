import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from './common/FormModalShell';
import type { ThemeColor, PointSettings, PointReward } from '../types';
import type { TKey } from '../context/LanguageContext';
import {
  fetchPointSettings,
  savePointSettings,
  DEFAULT_POINT_SETTINGS,
  fetchPointRewards,
  createPointReward,
  updatePointReward,
  deletePointReward,
} from '../services/points';

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: ThemeColor;
  t: (key: TKey) => string;
  tenantId: string;
};

export function PointSettingsModal({ visible, onClose, theme, t, tenantId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [yenPerPoint, setYenPerPoint] = useState(500);
  const [rewards, setRewards] = useState<PointReward[]>([]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    Promise.all([
      fetchPointSettings(tenantId),
      fetchPointRewards(tenantId),
    ])
      .then(([s, r]) => {
        const settings = s ?? DEFAULT_POINT_SETTINGS;
        setEnabled(settings.enabled);
        setYenPerPoint(settings.yenPerPoint);
        setRewards(r);
      })
      .catch((e) => console.warn('[kyasuho] fetchPointSettings:', e))
      .finally(() => setLoading(false));
  }, [visible, tenantId]);

  const handleSave = useCallback(async () => {
    if (yenPerPoint < 1) {
      Alert.alert(t('common.error'), t('points.yenInvalid'));
      return;
    }
    setSaving(true);
    try {
      await savePointSettings(tenantId, { enabled, yenPerPoint });
      Alert.alert(t('common.saved'));
      onClose();
    } catch (e) {
      console.warn('[kyasuho] savePointSettings:', e);
      Alert.alert(t('common.error'));
    } finally {
      setSaving(false);
    }
  }, [tenantId, enabled, yenPerPoint, t, onClose]);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      <View style={[st.header, { borderColor: theme.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: theme.text }]}>
          {t('points.title')}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[st.saveBtn, { color: theme.primary, opacity: saving ? 0.5 : 1 }]}>
            {t('common.save')}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View style={[st.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={st.switchRow}>
              <Text style={[st.label, { color: theme.text }]}>{t('points.enable')}</Text>
              <Switch value={enabled} onValueChange={setEnabled} />
            </View>
            <Text style={[st.hint, { color: theme.subtext }]}>
              {t('points.enableHint')}
            </Text>
          </View>

          {enabled && (
            <>
              <View style={[st.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[st.label, { color: theme.text }]}>{t('points.yenPerPoint')}</Text>
                <View style={st.stepperRow}>
                  <TouchableOpacity
                    style={[st.stepBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setYenPerPoint((v) => Math.max(1, v - 100))}
                  >
                    <Text style={st.stepBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={[st.stepValue, { color: theme.text }]}>
                    ¥{yenPerPoint.toLocaleString()}
                  </Text>
                  <TouchableOpacity
                    style={[st.stepBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setYenPerPoint((v) => v + 100)}
                  >
                    <Text style={st.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[st.hint, { color: theme.subtext, textAlign: 'center', marginTop: 6 }]}>
                  {t('points.yenExample').replace('{amount}', (yenPerPoint * 10).toLocaleString())}
                </Text>
              </View>

              <View style={[st.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[st.label, { color: theme.text, marginBottom: 8 }]}>
                  {t('points.rewardCatalog')} ({rewards.length})
                </Text>
                {rewards.length === 0 ? (
                  <Text style={[st.hint, { color: theme.subtext }]}>
                    {t('points.noRewards')}
                  </Text>
                ) : (
                  rewards.map((r) => (
                    <View
                      key={r.id}
                      style={[st.rewardRow, { borderColor: theme.border }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[st.rewardName, { color: theme.text }]}>{r.name}</Text>
                        <Text style={[st.hint, { color: theme.subtext }]}>
                          {r.pointsRequired}pt{r.description ? ` — ${r.description}` : ''}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: r.isActive ? '#16a34a' : '#9ca3af' }}>
                        {r.isActive ? t('points.active') : t('points.inactive')}
                      </Text>
                    </View>
                  ))
                )}
                <Text style={[st.hint, { color: theme.subtext, marginTop: 8 }]}>
                  {t('points.rewardHint')}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </FormModalShell>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  saveBtn: { fontSize: 16, fontWeight: '600' },
  card: { borderRadius: 12, borderWidth: 0.5, padding: 14 },
  label: { fontSize: 15, fontWeight: '500' },
  hint: { fontSize: 12, marginTop: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  stepValue: { fontSize: 16, fontWeight: '600', minWidth: 100, textAlign: 'center' },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  rewardName: { fontSize: 14, fontWeight: '500' },
});
