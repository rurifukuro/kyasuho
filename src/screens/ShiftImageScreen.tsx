// src/screens/ShiftImageScreen.tsx — シフト表画像生成画面（SPEC §9-1・§22）
//
// テンプレートを選び、月の出勤データからシフト表画像（PNG）を生成して保存/共有する。
// プレビューは実寸レンダラーを transform scale で縮小表示（RNのscaleは中心基準のため
// translate 補正で左上合わせ）。PNG化は画面外の実寸ノードに captureRef を当てる（§22）。

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SHIFT_TEMPLATES, CATEGORY_LABELS } from '../shiftTemplates/definitions';
import type { ShiftTemplateDefinition } from '../shiftTemplates/definitions';
import { buildShiftDays, yearMonthLabel } from '../shiftTemplates/shiftData';
import type { ShiftFlatRow } from '../shiftTemplates/shiftData';
import { ShiftTableRenderer } from '../shiftTemplates/ShiftTableRenderer';
import * as castService from '../services/casts';
import type { Cast, Shift, Tenant, ThemeColor } from '../types';
import type { TKey } from '../i18n';

type TFunc = (key: TKey, params?: Record<string, string>) => string;

const HIT = { top: 8, bottom: 8, left: 8, right: 8 };
const SIZE_916 = { w: 1080, h: 1920 };

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(ym: string, delta: number): string {
  const [y = 2026, m = 1] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function ShiftImageScreen({
  tenant,
  casts,
  theme,
  t,
  insets,
  onBack,
}: {
  tenant: Tenant;
  casts: Cast[];
  theme: ThemeColor;
  t: TFunc;
  insets: { top: number };
  onBack: () => void;
}) {
  const { width: winW } = useWindowDimensions();
  const shotRef = useRef<View>(null);

  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [templateId, setTemplateId] = useState(SHIFT_TEMPLATES[0].id);
  const [tall, setTall] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await castService.fetchShiftsByMonth(tenant.id, yearMonth);
      setShifts(data);
    } catch (e: unknown) {
      console.warn('[kyasuho] fetchShiftsByMonth:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant.id, yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const castNameById = useMemo(() => new Map(casts.map((c) => [c.id, c.name])), [casts]);

  const days = useMemo(() => {
    const rows: ShiftFlatRow[] = shifts.map((sh) => ({
      date: sh.date,
      castName: castNameById.get(sh.castId) ?? t('payroll.unknownCast'),
      start: sh.startAt.slice(0, 5),
      end: sh.endAt.slice(0, 5),
    }));
    return buildShiftDays(rows, yearMonth);
  }, [shifts, castNameById, yearMonth, t]);

  const def: ShiftTemplateDefinition = useMemo(() => {
    const base = SHIFT_TEMPLATES.find((tp) => tp.id === templateId) ?? SHIFT_TEMPLATES[0];
    return tall ? { ...base, size: SIZE_916 } : base;
  }, [templateId, tall]);

  // プレビュー縮小率（RNのscaleは中心基準→translateで左上合わせ）
  const previewW = winW - 32;
  const scale = previewW / def.size.w;
  const previewH = def.size.h * scale;

  const doCapture = useCallback(async (): Promise<string> => {
    return await captureRef(shotRef, {
      format: 'png',
      quality: 1,
      width: def.size.w,
      height: def.size.h,
    });
  }, [def.size.w, def.size.h]);

  const handleSave = useCallback(async () => {
    if (busy) return;
    setBusy('save');
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true); // writeOnly
      if (!perm.granted) {
        Alert.alert(t('common.error'), t('shiftImage.permissionDenied'));
        return;
      }
      const uri = await doCapture();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(t('shiftImage.title'), t('shiftImage.saved'));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setBusy(null);
    }
  }, [busy, doCapture, t]);

  const handleShare = useCallback(async () => {
    if (busy) return;
    setBusy('share');
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(t('common.error'), t('csv.notAvailable'));
        return;
      }
      const uri = await doCapture();
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch (e: unknown) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setBusy(null);
    }
  }, [busy, doCapture, t]);

  return (
    <View style={[s.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={HIT}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text, flex: 1, marginLeft: 12 }]}>
          {t('shiftImage.title')}
        </Text>
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
        {/* 月ナビ */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={() => setYearMonth((ym) => shiftMonth(ym, -1))} hitSlop={HIT}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[s.monthLabel, { color: theme.text }]}>{yearMonthLabel(yearMonth)}</Text>
          <TouchableOpacity onPress={() => setYearMonth((ym) => shiftMonth(ym, 1))} hitSlop={HIT}>
            <MaterialCommunityIcons name="chevron-right" size={28} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* 比率切替 */}
        <View style={[s.segment, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <TouchableOpacity
            style={[s.segmentBtn, !tall && { backgroundColor: theme.primary }]}
            onPress={() => setTall(false)}
          >
            <Text style={[s.segmentText, { color: !tall ? '#fff' : theme.subtext }]}>
              {t('shiftImage.ratio45')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.segmentBtn, tall && { backgroundColor: theme.primary }]}
            onPress={() => setTall(true)}
          >
            <Text style={[s.segmentText, { color: tall ? '#fff' : theme.subtext }]}>
              {t('shiftImage.ratio916')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* テンプレートギャラリー */}
        <Text style={[s.sectionLabel, { color: theme.text }]}>{t('shiftImage.template')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tplRow}
        >
          {SHIFT_TEMPLATES.map((tpl) => {
            const active = tpl.id === templateId;
            return (
              <TouchableOpacity
                key={tpl.id}
                style={[
                  s.tplCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: active ? theme.primary : theme.border,
                    borderWidth: active ? 2 : 1,
                  },
                ]}
                onPress={() => setTemplateId(tpl.id)}
                activeOpacity={0.7}
              >
                <View style={s.swatchRow}>
                  <View
                    style={[
                      s.swatch,
                      {
                        backgroundColor: tpl.palette.bg,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: '#ccc',
                      },
                    ]}
                  />
                  <View style={[s.swatch, { backgroundColor: tpl.palette.accent }]} />
                  <View style={[s.swatch, { backgroundColor: tpl.palette.headerText }]} />
                </View>
                <Text style={[s.tplName, { color: theme.text }]} numberOfLines={1}>
                  {tpl.name}
                </Text>
                <Text style={[s.tplCat, { color: theme.subtext }]}>
                  {CATEGORY_LABELS[tpl.category]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* プレビュー */}
        {loading ? (
          <ActivityIndicator color={theme.primary} style={s.spinner} />
        ) : (
          <View
            style={[
              s.previewFrame,
              { width: previewW, height: previewH, borderColor: theme.border },
            ]}
          >
            <View
              style={{
                width: def.size.w,
                height: def.size.h,
                transform: [
                  { translateX: (-def.size.w * (1 - scale)) / 2 },
                  { translateY: (-def.size.h * (1 - scale)) / 2 },
                  { scale },
                ],
              }}
            >
              <ShiftTableRenderer
                def={def}
                days={days}
                yearMonth={yearMonth}
                storeName={tenant.name}
              />
            </View>
          </View>
        )}
        {!loading && shifts.length === 0 ? (
          <Text style={[s.emptyHint, { color: theme.subtext }]}>{t('shiftImage.empty')}</Text>
        ) : null}

        {/* 保存・共有 */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: theme.primary }]}
            onPress={handleSave}
            disabled={busy !== null}
          >
            {busy === 'save' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="download" size={18} color="#fff" />
                <Text style={s.actionText}>{t('shiftImage.save')}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: theme.primary }]}
            onPress={handleShare}
            disabled={busy !== null}
          >
            {busy === 'share' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="share-variant" size={18} color="#fff" />
                <Text style={s.actionText}>{t('shiftImage.share')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* キャプチャ用の実寸ノード（画面外・collapsable無効でネイティブビューを保持） */}
      <View
        ref={shotRef}
        collapsable={false}
        style={{ position: 'absolute', left: -20000, top: 0, width: def.size.w, height: def.size.h }}
      >
        <ShiftTableRenderer def={def} days={days} yearMonth={yearMonth} storeName={tenant.name} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 12 },
  monthLabel: { fontSize: 18, fontWeight: '700', minWidth: 120, textAlign: 'center' },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginBottom: 16 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 13, fontWeight: '600' },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  tplRow: { gap: 8, paddingBottom: 4 },
  tplCard: { width: 128, borderRadius: 10, padding: 10, marginBottom: 12 },
  swatchRow: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  swatch: { width: 18, height: 18, borderRadius: 9 },
  tplName: { fontSize: 12, fontWeight: '600' },
  tplCat: { fontSize: 10, marginTop: 2 },
  spinner: { marginVertical: 40 },
  previewFrame: { overflow: 'hidden', borderRadius: 8, borderWidth: 1, alignSelf: 'center', marginTop: 4 },
  emptyHint: { fontSize: 12, textAlign: 'center', marginTop: 10 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 10 },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
