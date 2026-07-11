// src/shiftTemplates/ShiftTableRenderer.tsx — シフト表のRNレンダラー（SPEC §22・アプリ側）
//
// レイアウト計算の正準は web/src/shiftTemplates/ShiftTableRenderer.tsx（Web側）。
// 同一の寸法計算・配色ロジックを RN View で再現する。実寸（例 1080x1350）で描き、
// プレビューは呼び出し側が transform scale で縮小表示、PNG化は react-native-view-shot の
// captureRef を実寸オフスクリーンノードに対して行う（§22）。
// RN は fontFamily を継承しないため、各 Text に bodyFont/headerFont を明示する。

import React from 'react';
import { Image, Platform, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ShiftFontKey, ShiftTemplateDefinition } from './definitions';
import { MOTIF_CHARS } from './definitions';
import type { ShiftDayData, ShiftEventDay } from './shiftData';
import {
  WEEKDAY_LABELS,
  daysInMonth,
  firstDayOffset,
  weekdayOf,
  yearMonthLabel,
} from './shiftData';

/**
 * 抽象フォントキー → RN fontFamily（WebのFONT_STACKSに対応する日本語システムフォント）。
 * Android は丸ゴシック非搭載のため sans-serif で代替（フォント同梱＝FONT-JP完全対応は後フェーズ）。
 */
export const FONT_FAMILIES: Record<ShiftFontKey, string> =
  Platform.OS === 'ios'
    ? {
        'sans-jp': 'Hiragino Sans',
        'serif-jp': 'Hiragino Mincho ProN',
        'rounded-jp': 'Hiragino Maru Gothic ProN',
      }
    : {
        'sans-jp': 'sans-serif',
        'serif-jp': 'serif',
        'rounded-jp': 'sans-serif',
      };

const PADDING = 48;

type Props = {
  def: ShiftTemplateDefinition;
  days: ShiftDayData[];
  yearMonth: string; // 'YYYY-MM'
  storeName: string;
  logoUrl?: string | null;
  eventDays?: ShiftEventDay[];
  pageInfo?: { page: number; total: number };
};

export function ShiftTableRenderer({ def, days, yearMonth, storeName, logoUrl, eventDays, pageInfo }: Props) {
  const eventMap = new Map((eventDays ?? []).map((e) => [e.date, e.label]));
  const p = def.palette;
  const deco = def.decorations;
  const motif = deco.motif && deco.motif !== 'none' ? MOTIF_CHARS[deco.motif] : null;
  const headerFont = FONT_FAMILIES[def.fonts.header];
  const bodyFont = FONT_FAMILIES[def.fonts.body];

  const isRibbon = deco.headerStyle === 'ribbon';
  const isBanner = deco.headerStyle === 'banner';
  const isBand = isRibbon || isBanner; // 帯系（白文字×アクセント背景）
  const isUnderline = deco.headerStyle === 'underline';
  const titleColor = isBand ? '#FFFFFF' : p.headerText;

  return (
    <View
      style={{
        position: 'relative',
        width: def.size.w,
        height: def.size.h,
        padding: PADDING,
        backgroundColor: p.bg,
        overflow: 'hidden',
      }}
    >
      {p.bgGradient ? (
        <LinearGradient
          colors={p.bgGradient}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}

      {/* 背景モチーフ（四隅に薄く） */}
      {motif ? (
        <>
          <Text
            style={{
              position: 'absolute',
              top: -40,
              left: -20,
              fontSize: 220,
              lineHeight: 230,
              color: p.accent,
              opacity: 0.13,
            }}
          >
            {motif}
          </Text>
          <Text
            style={{
              position: 'absolute',
              bottom: -30,
              right: -10,
              fontSize: 180,
              lineHeight: 190,
              color: p.accent,
              opacity: 0.13,
            }}
          >
            {motif}
          </Text>
        </>
      ) : null}

      {/* 外周フレーム装飾（Rev76） */}
      <FrameLayer def={def} />

      {/* ヘッダー */}
      <View style={{ position: 'relative', alignItems: 'center', paddingBottom: 28 }}>
        {logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            style={{ position: 'absolute', top: 0, right: 0, width: 160, height: 80 }}
            resizeMode="contain"
          />
        ) : null}
        <Text
          style={{
            fontSize: 26,
            lineHeight: 32,
            letterSpacing: 4,
            color: p.accent,
            fontWeight: '600',
            fontFamily: bodyFont,
          }}
        >
          {storeName}
        </Text>
        <View
          style={{
            marginTop: 10,
            flexDirection: 'row',
            alignItems: 'center',
            ...(isBand
              ? {
                  backgroundColor: p.accent,
                  paddingVertical: 8,
                  paddingHorizontal: 48,
                }
              : {}),
            ...(isRibbon ? { borderRadius: deco.cornerRadius + 6 } : {}),
            ...(isUnderline
              ? {
                  borderBottomWidth: 5,
                  borderBottomColor: p.accent,
                  paddingBottom: 10,
                }
              : {}),
          }}
        >
          {isBanner ? (
            <>
              <View style={bannerTailStyle(p.accent, 'left')} />
              <View style={bannerTailStyle(p.accent, 'right')} />
            </>
          ) : null}
          {motif ? (
            <Text style={{ fontSize: 34, lineHeight: 40, marginRight: 20, color: titleColor }}>
              {motif}
            </Text>
          ) : null}
          <Text
            style={{
              fontFamily: headerFont,
              fontSize: 56,
              lineHeight: 70,
              fontWeight: '700',
              color: titleColor,
            }}
          >
            {yearMonthLabel(yearMonth)} シフト表
          </Text>
          {motif ? (
            <Text style={{ fontSize: 34, lineHeight: 40, marginLeft: 20, color: titleColor }}>
              {motif}
            </Text>
          ) : null}
        </View>
        {pageInfo && pageInfo.total > 1 ? (
          <Text style={{ marginTop: 8, fontSize: 22, lineHeight: 28, color: p.dayLabel, fontWeight: '600', fontFamily: bodyFont }}>
            {pageInfo.page}/{pageInfo.total}
          </Text>
        ) : null}
      </View>

      {/* 本体 */}
      {def.layout === 'month-grid' ? (
        <MonthGrid def={def} days={days} yearMonth={yearMonth} bodyFont={bodyFont} eventMap={eventMap} />
      ) : (
        <WeekRows def={def} days={days} bodyFont={bodyFont} eventMap={eventMap} />
      )}
    </View>
  );
}

// ── banner見出し（Rev76）: 両端に切込みテールが付く帯（Webレンダラーと同寸） ──

/** 帯の実高さ = タイトルlineHeight70 + 縦padding8×2 */
const BANNER_BAND_H = 86;

function bannerTailStyle(accent: string, side: 'left' | 'right'): ViewStyle {
  const base: ViewStyle = {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: BANNER_BAND_H / 2,
    borderBottomWidth: BANNER_BAND_H / 2,
    borderTopColor: accent,
    borderBottomColor: accent,
    opacity: 0.85,
  };
  if (side === 'left') {
    base.left = -34; // 帯と2px重ねて継ぎ目を消す（テール全幅36）
    base.borderRightWidth = 22;
    base.borderRightColor = accent;
    base.borderLeftWidth = 14;
    base.borderLeftColor = 'transparent'; // 透明側が切込みになる
  } else {
    base.right = -34;
    base.borderLeftWidth = 22;
    base.borderLeftColor = accent;
    base.borderRightWidth = 14;
    base.borderRightColor = 'transparent';
  }
  return base;
}

// ── 外周フレーム装飾（Rev76・frame: ShiftFrameStyle・Webレンダラーと同寸） ──

type CornerPos = { top?: number; bottom?: number; left?: number; right?: number };

function FrameLayer({ def }: { def: ShiftTemplateDefinition }) {
  const frame = def.decorations.frame ?? 'none';
  if (frame === 'none') return null;
  const accent = def.palette.accent;
  const radius = def.decorations.cornerRadius;

  if (frame === 'double') {
    return (
      <>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            bottom: 12,
            borderWidth: 3,
            borderColor: accent,
            borderRadius: radius + 8,
            opacity: 0.8,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            right: 20,
            bottom: 20,
            borderWidth: 1,
            borderColor: accent,
            borderRadius: radius + 4,
            opacity: 0.55,
          }}
        />
      </>
    );
  }

  if (frame === 'dashed') {
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          right: 14,
          bottom: 14,
          borderWidth: 3,
          borderStyle: 'dashed',
          borderColor: accent,
          borderRadius: radius + 6,
          opacity: 0.7,
        }}
      />
    );
  }

  if (frame === 'lace') {
    // 上下端に半円スカラップ（円の半分をルートの overflow:hidden で切ってレース風にする）
    const dots = Array.from({ length: Math.ceil(def.size.w / 44) }, (_, i) => i);
    const row = (edge: 'top' | 'bottom') => (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          ...(edge === 'top' ? { top: -16 } : { bottom: -16 }),
          left: 0,
          right: 0,
          height: 32,
          flexDirection: 'row',
          justifyContent: 'space-around',
        }}
      >
        {dots.map((i) => (
          <View
            key={i}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: accent, opacity: 0.3 }}
          />
        ))}
      </View>
    );
    return (
      <>
        {row('top')}
        {row('bottom')}
      </>
    );
  }

  // corner-motif: 四隅にモチーフ文字（motif未指定テンプレは装飾記号にフォールバック）
  const m = def.decorations.motif;
  const ch = m && m !== 'none' ? MOTIF_CHARS[m] : '❖';
  const corner = (pos: CornerPos, key: string) => (
    <Text
      key={key}
      style={{ position: 'absolute', ...pos, fontSize: 60, lineHeight: 62, color: accent, opacity: 0.55 }}
    >
      {ch}
    </Text>
  );
  return (
    <>
      {corner({ top: 14, left: 18 }, 'tl')}
      {corner({ top: 14, right: 18 }, 'tr')}
      {corner({ bottom: 14, left: 18 }, 'bl')}
      {corner({ bottom: 14, right: 18 }, 'br')}
    </>
  );
}

// ── 月間カレンダー格子 ──

function MonthGrid({
  def,
  days,
  yearMonth,
  bodyFont,
  eventMap,
}: {
  def: ShiftTemplateDefinition;
  days: ShiftDayData[];
  yearMonth: string;
  bodyFont: string;
  eventMap: Map<string, string>;
}) {
  const p = def.palette;
  const deco = def.decorations;
  const total = daysInMonth(yearMonth);
  const offset = firstDayOffset(yearMonth);
  const weeks = Math.ceil((offset + total) / 7);

  const byDate = new Map(days.map((d) => [d.date, d.casts]));

  // グリッド領域の実高さからセル1枚の高さ→表示できる人数を見積もる（Web側と同式）
  const gridH = def.size.h - PADDING * 2 - 170 - 40;
  const cellH = gridH / weeks - deco.cellGap;
  const maxPerCell = Math.max(1, Math.floor((cellH - 36) / 42));

  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length < weeks * 7) cells.push(null);
  const weekRows: (number | null)[][] = [];
  for (let w = 0; w < weeks; w++) weekRows.push(cells.slice(w * 7, w * 7 + 7));

  return (
    <View style={{ flex: 1 }}>
      {/* 曜日行 */}
      <View style={{ flexDirection: 'row', gap: deco.cellGap, paddingBottom: 8 }}>
        {WEEKDAY_LABELS.map((w, i) => (
          <Text
            key={w}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 22,
              lineHeight: 28,
              fontWeight: '700',
              color: i === 0 ? p.accent : p.dayLabel,
              fontFamily: bodyFont,
            }}
          >
            {w}
          </Text>
        ))}
      </View>

      {/* 日セル（週ごとの行×7列・各セルflex:1でWebのgrid 1frと等価） */}
      <View style={{ flex: 1, gap: deco.cellGap }}>
        {weekRows.map((row, wi) => (
          <View key={`w-${wi}`} style={{ flex: 1, flexDirection: 'row', gap: deco.cellGap }}>
            {row.map((day, i) => {
              if (day === null) {
                return <View key={`empty-${wi}-${i}`} style={{ flex: 1 }} />;
              }
              const date = `${yearMonth}-${String(day).padStart(2, '0')}`;
              const casts = byDate.get(date) ?? [];
              const eventLabel = eventMap.get(date);
              const evColor = p.eventAccent ?? p.accent;
              const shown = casts.slice(0, eventLabel ? Math.max(1, maxPerCell - 1) : maxPerCell);
              const rest = casts.length - shown.length;
              const wd = i % 7;
              return (
                <View
                  key={date}
                  style={{
                    flex: 1,
                    backgroundColor: p.cellBg,
                    borderWidth: eventLabel ? 3 : 1,
                    borderColor: eventLabel ? evColor : p.cellBorder,
                    borderRadius: deco.cornerRadius,
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    overflow: 'hidden',
                  }}
                >
                  {eventLabel ? (
                    <View style={{ backgroundColor: evColor, marginHorizontal: -8, marginTop: -6, paddingVertical: 2, paddingHorizontal: 6, marginBottom: 4 }}>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 11, lineHeight: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: bodyFont }}>{eventLabel}</Text>
                    </View>
                  ) : null}
                  <Text
                    style={{
                      fontSize: 20,
                      lineHeight: 24,
                      fontWeight: '700',
                      color: wd === 0 ? p.accent : p.dayLabel,
                      fontFamily: bodyFont,
                    }}
                  >
                    {day}
                  </Text>
                  {shown.map((c, j) => (
                    <View key={`${c.name}-${j}`} style={{ marginTop: 4 }}>
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{
                          fontSize: 19,
                          lineHeight: 22,
                          fontWeight: '700',
                          color: p.castName,
                          fontFamily: bodyFont,
                        }}
                      >
                        {c.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 14,
                          lineHeight: 16,
                          color: p.timeText,
                          fontFamily: bodyFont,
                        }}
                      >
                        {c.start}-{c.end}
                      </Text>
                    </View>
                  ))}
                  {rest > 0 ? (
                    <Text
                      style={{
                        marginTop: 4,
                        fontSize: 15,
                        lineHeight: 18,
                        fontWeight: '700',
                        color: p.accent,
                        fontFamily: bodyFont,
                      }}
                    >
                      +{rest}人
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// ── 週別行（出勤がある日のみ） ──
//
// 溢れゼロ保証: チップ幅を固定（名前は ellipsis）して折返し行数を確定計算できるようにし、
// 1カラム（ゆったり）で全日が収まるかを先に見積もる。収まらない月は
// 2カラム（コンパクト）へ自動切替し、さらに1日あたりの表示上限（+N表示）で物理的に保証する。
// 計算式は Web 側 WeekRows と同一（§22）。

type WeekRowsSizes = {
  labelW: number;
  dateFs: number;
  wdFs: number;
  nameFs: number;
  timeFs: number;
  chipW: number;
  chipPadV: number;
  chipPadH: number;
  chipGap: number;
  rowPadV: number;
  colGap: number;
};

const WR_ROOMY: WeekRowsSizes = {
  labelW: 170, dateFs: 30, wdFs: 20, nameFs: 21, timeFs: 16,
  chipW: 252, chipPadV: 6, chipPadH: 16, chipGap: 10, rowPadV: 8, colGap: 0,
};

const WR_COMPACT: WeekRowsSizes = {
  labelW: 76, dateFs: 20, wdFs: 13, nameFs: 13, timeFs: 10,
  chipW: 160, chipPadV: 3, chipPadH: 8, chipGap: 5, rowPadV: 4, colGap: 24,
};

/** チップ1行分の高さ（lineHeight を px 固定するので正確に決まる） */
function wrChipRowH(s: WeekRowsSizes): number {
  return Math.round(s.nameFs * 1.45) + s.chipPadV * 2 + 2; // +2 = 上下border
}

/** 1日行の高さ（チップ行数から） */
function wrRowH(s: WeekRowsSizes, chipRows: number): number {
  return s.rowPadV * 2 + 1 + chipRows * wrChipRowH(s) + (chipRows - 1) * s.chipGap;
}

/** 列幅から1行に並ぶチップ数 */
function wrChipsPerRow(s: WeekRowsSizes, colW: number): number {
  const chipArea = colW - s.labelW - 18; // 18 = ラベルとチップ列の間
  return Math.max(1, Math.floor((chipArea + s.chipGap) / (s.chipW + s.chipGap)));
}

function WeekRows({
  def,
  days,
  bodyFont,
  eventMap,
}: {
  def: ShiftTemplateDefinition;
  days: ShiftDayData[];
  bodyFont: string;
  eventMap: Map<string, string>;
}) {
  const p = def.palette;
  const deco = def.decorations;

  if (days.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 28, lineHeight: 36, color: p.dayLabel, fontFamily: bodyFont }}>
          この月の出勤予定はありません
        </Text>
      </View>
    );
  }

  const usableH = def.size.h - PADDING * 2 - 170; // ヘッダーを除いた本体高さ
  const usableW = def.size.w - PADDING * 2;

  // 1カラム（ゆったり）で全日入るか見積もる
  const cpr1 = wrChipsPerRow(WR_ROOMY, usableW);
  const totalRoomy = days.reduce(
    (acc, d) => acc + wrRowH(WR_ROOMY, Math.max(1, Math.ceil(d.casts.length / cpr1))),
    (days.length - 1) * deco.cellGap,
  );
  const oneCol = totalRoomy <= usableH;

  const s = oneCol ? WR_ROOMY : WR_COMPACT;
  const nCols = oneCol ? 1 : 2;
  const colW = (usableW - (nCols - 1) * s.colGap) / nCols;
  const cpr = wrChipsPerRow(s, colW);

  // 2カラム時は「累積チップ行数」が半分になる位置で分割（日付順を保ったまま高さをバランス）
  let cols: ShiftDayData[][];
  if (nCols === 1) {
    cols = [days];
  } else {
    const rowsOf = (d: ShiftDayData) => Math.max(1, Math.ceil(d.casts.length / cpr));
    const totalRows = days.reduce((a, d) => a + rowsOf(d), 0);
    let acc = 0;
    let splitIdx = days.length;
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      if (!day) continue;
      acc += rowsOf(day);
      if (acc >= totalRows / 2) {
        splitIdx = i + 1;
        break;
      }
    }
    cols = [days.slice(0, splitIdx), days.slice(splitIdx)];
  }

  // 表示上限（物理保証）: 最長列の日数で高さ予算を均等割り→入るチップ行数を確定。
  // 1カラムは見積もり済みで全チップが収まるため無制限。
  let maxChips = Number.POSITIVE_INFINITY;
  if (!oneCol) {
    const perColDays = Math.max(...cols.map((c) => c.length), 1);
    const rowBudget = (usableH - (perColDays - 1) * deco.cellGap) / perColDays;
    const maxChipRows = Math.max(
      1,
      Math.floor((rowBudget - s.rowPadV * 2 - 1 + s.chipGap) / (wrChipRowH(s) + s.chipGap)),
    );
    maxChips = maxChipRows * cpr;
  }

  const chipLineH = Math.round(s.nameFs * 1.45);

  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: s.colGap, overflow: 'hidden' }}>
      {cols.map((col, ci) => (
        <View key={`col-${ci}`} style={{ flex: 1, gap: deco.cellGap }}>
          {col.map((d) => {
            const wd = weekdayOf(d.date);
            const dayNum = Number(d.date.slice(8, 10));
            const monthNum = Number(d.date.slice(5, 7));
            const eventLabel = eventMap.get(d.date);
            const evColor = p.eventAccent ?? p.accent;
            const shown =
              d.casts.length <= maxChips
                ? d.casts
                : d.casts.slice(0, Math.max(1, maxChips - 1));
            const rest = d.casts.length - shown.length;
            return (
              <View key={d.date}>
                {eventLabel ? (
                  <View style={{ backgroundColor: evColor, paddingVertical: 2, paddingHorizontal: 10, marginBottom: 2 }}>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: s.nameFs, lineHeight: Math.round(s.nameFs * 1.3), fontWeight: '700', color: '#FFFFFF', fontFamily: bodyFont }}>{eventLabel}</Text>
                  </View>
                ) : null}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 18,
                    paddingVertical: s.rowPadV,
                    borderBottomWidth: 1,
                    borderBottomColor: p.cellBorder,
                  }}
                >
                <View
                  style={{
                    width: s.labelW,
                    flexShrink: 0,
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: s.dateFs,
                      lineHeight: Math.round(s.dateFs * 1.2),
                      fontWeight: '700',
                      color: wd === 0 ? p.accent : p.headerText,
                      fontFamily: bodyFont,
                    }}
                  >
                    {monthNum}/{dayNum}
                  </Text>
                  <Text
                    style={{
                      fontSize: s.wdFs,
                      lineHeight: Math.round(s.wdFs * 1.2),
                      color: p.dayLabel,
                      fontFamily: bodyFont,
                    }}
                  >
                    ({WEEKDAY_LABELS[wd] ?? ''})
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: s.chipGap,
                  }}
                >
                  {shown.map((c, j) => (
                    <View
                      key={`${c.name}-${j}`}
                      style={{
                        width: s.chipW,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: s.chipGap,
                        backgroundColor: p.cellBg,
                        borderWidth: 1,
                        borderColor: p.cellBorder,
                        borderRadius: deco.cornerRadius,
                        paddingVertical: s.chipPadV,
                        paddingHorizontal: s.chipPadH,
                        overflow: 'hidden',
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{
                          flexShrink: 1,
                          fontSize: s.nameFs,
                          lineHeight: chipLineH,
                          fontWeight: '700',
                          color: p.castName,
                          fontFamily: bodyFont,
                        }}
                      >
                        {c.name}
                      </Text>
                      <Text
                        style={{
                          flexShrink: 0,
                          fontSize: s.timeFs,
                          lineHeight: chipLineH,
                          color: p.timeText,
                          fontFamily: bodyFont,
                        }}
                      >
                        {c.start}-{c.end}
                      </Text>
                    </View>
                  ))}
                  {rest > 0 ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderRadius: deco.cornerRadius,
                        borderWidth: 1,
                        borderColor: p.cellBorder,
                        paddingVertical: s.chipPadV,
                        paddingHorizontal: s.chipPadH,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: s.nameFs,
                          lineHeight: chipLineH,
                          fontWeight: '700',
                          color: p.accent,
                          fontFamily: bodyFont,
                        }}
                      >
                        +{rest}人
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
