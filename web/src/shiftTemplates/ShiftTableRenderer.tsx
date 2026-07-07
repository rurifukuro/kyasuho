// web/src/shiftTemplates/ShiftTableRenderer.tsx — シフト表の共通DOMレンダラー（SPEC §22・Web正準）
//
// ShiftTemplateDefinition（純データ）を受け取り、実寸px（例 1080x1350）のDOMを描く。
// - プレビューは呼び出し側が CSS transform: scale() で縮小表示する
// - PNG化は html-to-image の toPng() を「等倍のオフスクリーンノード」に対して行う
// - アプリ側は同じ定義を RN View で描画（src/shiftTemplates/ 配下・定義はここからコピー同期）

import type { CSSProperties } from 'react';
import type { ShiftFontKey, ShiftPlacement, ShiftTemplateDefinition } from './definitions';
import { MOTIF_CHARS } from './definitions';
import type { ShiftDayData } from './shiftData';
import {
  WEEKDAY_LABELS,
  daysInMonth,
  firstDayOffset,
  weekdayOf,
  yearMonthLabel,
} from './shiftData';

/** 抽象フォントキー → CSSフォントスタック（日本語システムフォント） */
export const FONT_STACKS: Record<ShiftFontKey, string> = {
  'sans-jp':
    "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic UI', 'Yu Gothic', 'Meiryo', sans-serif",
  'serif-jp':
    "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', 'MS PMincho', serif",
  'rounded-jp':
    "'Hiragino Maru Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', 'Meiryo', sans-serif",
};

const PADDING = 48;

/** 'HH:MM' → シンプル時間表記（参考シフト表準拠: 18:00→18, 18:30→18.5, 25:00→25） */
function shortTime(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  if (!h) return hhmm;
  const hr = Number(h);
  const mins = Number(m ?? 0);
  if (mins === 30) return `${hr}.5`;
  if (mins === 0) return `${hr}`;
  return `${hr}:${m}`;
}

/** 開始-終了をシンプル表記（終了<開始なら+24=深夜帯: 00:00→24, 01:00→25） */
function shortRange(start: string, end: string): string {
  const s = shortTime(start);
  let e = shortTime(end);
  const sn = parseFloat(s);
  const en = parseFloat(e);
  if (!isNaN(sn) && !isNaN(en) && en <= sn) {
    e = shortTime(`${Number(end.split(':')[0]) + 24}:${end.split(':')[1] ?? '00'}`);
  }
  return `${s}-${e}`;
}

type Props = {
  def: ShiftTemplateDefinition;
  days: ShiftDayData[];
  yearMonth: string; // 'YYYY-MM'
  storeName: string;
  logoUrl?: string | null;
  dailyDate?: string; // 'YYYY-MM-DD'（daily-lineup用）
  bgImageUrl?: string | null; // §22-3: 店舗テンプレ背景画像
  placement?: ShiftPlacement | null; // §22-3: AI解析による配置情報
};

export function ShiftTableRenderer({ def, days, yearMonth, storeName, logoUrl, dailyDate, bgImageUrl, placement }: Props) {
  const p = def.palette;
  const deco = def.decorations;
  const motif = deco.motif && deco.motif !== 'none' ? MOTIF_CHARS[deco.motif] : null;
  const headerFont = FONT_STACKS[def.fonts.header];
  const bodyFont = FONT_STACKS[def.fonts.body];

  const rootStyle: CSSProperties = {
    position: 'relative',
    width: def.size.w,
    height: def.size.h,
    boxSizing: 'border-box',
    padding: PADDING,
    backgroundColor: bgImageUrl ? 'transparent' : p.bg,
    backgroundImage: bgImageUrl
      ? `url(${bgImageUrl})`
      : p.bgGradient
        ? `linear-gradient(160deg, ${p.bgGradient[0]}, ${p.bgGradient[1]})`
        : undefined,
    backgroundSize: bgImageUrl ? 'cover' : undefined,
    backgroundPosition: bgImageUrl ? 'center' : undefined,
    fontFamily: bodyFont,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={rootStyle}>
      {/* 背景モチーフ（四隅に薄く） */}
      {motif ? (
        <>
          <div
            style={{
              position: 'absolute',
              top: -40,
              left: -20,
              fontSize: 220,
              lineHeight: 1,
              color: p.accent,
              opacity: 0.13,
              pointerEvents: 'none',
            }}
          >
            {motif}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: -30,
              right: -10,
              fontSize: 180,
              lineHeight: 1,
              color: p.accent,
              opacity: 0.13,
              pointerEvents: 'none',
            }}
          >
            {motif}
          </div>
        </>
      ) : null}

      {/* ヘッダー */}
      <div style={{ position: 'relative', textAlign: 'center', paddingBottom: 28 }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            style={{ position: 'absolute', top: 0, right: 0, height: 80, objectFit: 'contain' }}
          />
        ) : null}
        <div style={{ fontSize: 26, letterSpacing: 4, color: p.accent, fontWeight: 600 }}>
          {storeName}
        </div>
        <div style={{ marginTop: 10 }}>
          <span
            style={{
              display: 'inline-block',
              fontFamily: headerFont,
              fontSize: 56,
              fontWeight: 700,
              color: deco.headerStyle === 'ribbon' ? '#FFFFFF' : p.headerText,
              backgroundColor: deco.headerStyle === 'ribbon' ? p.accent : undefined,
              padding: deco.headerStyle === 'ribbon' ? '8px 48px' : undefined,
              borderRadius: deco.headerStyle === 'ribbon' ? deco.cornerRadius + 6 : undefined,
              borderBottom:
                deco.headerStyle === 'underline' ? `5px solid ${p.accent}` : undefined,
              paddingBottom: deco.headerStyle === 'underline' ? 10 : undefined,
              lineHeight: 1.25,
            }}
          >
            {motif ? (
              <span style={{ fontSize: 34, verticalAlign: 'middle', marginRight: 20 }}>
                {motif}
              </span>
            ) : null}
            {def.layout === 'daily-lineup' && dailyDate
              ? `${dailyDateLabel(dailyDate)} 出勤キャスト`
              : `${yearMonthLabel(yearMonth)} シフト表`}
            {motif ? (
              <span style={{ fontSize: 34, verticalAlign: 'middle', marginLeft: 20 }}>
                {motif}
              </span>
            ) : null}
          </span>
        </div>
      </div>

      {/* 本体 */}
      {placement && bgImageUrl ? (
        <CustomPlacement
          def={def}
          days={days}
          yearMonth={yearMonth}
          storeName={storeName}
          placement={placement}
          dailyDate={dailyDate}
        />
      ) : def.layout === 'daily-lineup' && dailyDate ? (
        <DailyLineup def={def} days={days} dailyDate={dailyDate} />
      ) : def.layout === 'month-grid' ? (
        <MonthGrid def={def} days={days} yearMonth={yearMonth} />
      ) : (
        <WeekRows def={def} days={days} />
      )}
    </div>
  );
}

// ── 月間カレンダー格子 ──

function MonthGrid({
  def,
  days,
  yearMonth,
}: {
  def: ShiftTemplateDefinition;
  days: ShiftDayData[];
  yearMonth: string;
}) {
  const p = def.palette;
  const deco = def.decorations;
  const total = daysInMonth(yearMonth);
  const offset = firstDayOffset(yearMonth);
  const weeks = Math.ceil((offset + total) / 7);

  const byDate = new Map(days.map((d) => [d.date, d.casts]));

  // 月内の最大キャスト数を算出 → フォントサイズを動的調整して全員表示
  let maxCastCount = 0;
  for (let d = 1; d <= total; d++) {
    const date = `${yearMonth}-${String(d).padStart(2, '0')}`;
    const cnt = byDate.get(date)?.length ?? 0;
    if (cnt > maxCastCount) maxCastCount = cnt;
  }

  const gridH = def.size.h - PADDING * 2 - 170 - 40;
  const cellH = gridH / weeks - deco.cellGap;
  // 日番号行(~22px) + パディング(12px) を引いた残りにキャスト行を詰める
  const availH = cellH - 34;
  // 1行あたりの高さ = 残り ÷ 最大人数（最低12px行高, 最大22px行高）
  const lineH = maxCastCount > 0 ? Math.max(12, Math.min(22, availH / maxCastCount)) : 18;
  // フォントサイズは行高の80%程度
  const castFs = Math.max(9, Math.min(18, lineH * 0.8));

  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length < weeks * 7) cells.push(null);

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* 曜日行 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: deco.cellGap,
          paddingBottom: 8,
        }}
      >
        {WEEKDAY_LABELS.map((w, i) => (
          <div
            key={w}
            style={{
              textAlign: 'center',
              fontSize: 22,
              fontWeight: 700,
              color: i === 0 ? p.accent : p.dayLabel,
            }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 日セル */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: `repeat(${weeks}, 1fr)`,
          gap: deco.cellGap,
        }}
      >
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} />;
          }
          const date = `${yearMonth}-${String(day).padStart(2, '0')}`;
          const casts = byDate.get(date) ?? [];
          const wd = i % 7;
          return (
            <div
              key={date}
              style={{
                backgroundColor: p.cellBg,
                border: `1px solid ${p.cellBorder}`,
                borderRadius: deco.cornerRadius,
                padding: '4px 5px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: wd === 0 ? p.accent : p.dayLabel,
                  lineHeight: 1.2,
                }}
              >
                {day}
              </div>
              {casts.map((c, j) => (
                <div
                  key={`${c.name}-${j}`}
                  style={{
                    fontSize: castFs,
                    lineHeight: `${lineH}px`,
                    color: p.castName,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.name}{' '}
                  <span style={{ color: p.timeText }}>
                    {shortRange(c.start, c.end)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 週別行（出勤がある日のみ） ──
//
// 溢れゼロ保証: チップ幅を固定（名前は ellipsis）して折返し行数を確定計算できるようにし、
// 1カラム（ゆったり）で全日が収まるかを先に見積もる。収まらない月は
// 2カラム（コンパクト）へ自動切替し、さらに1日あたりの表示上限（+N表示）で物理的に保証する。
// month-grid の maxPerCell と同じ「計算で収める」パターン（SPEC §22）。

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

function WeekRows({ def, days }: { def: ShiftTemplateDefinition; days: ShiftDayData[] }) {
  const p = def.palette;
  const deco = def.decorations;

  if (days.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          color: p.dayLabel,
        }}
      >
        この月の出勤予定はありません
      </div>
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
    <div
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        gap: s.colGap,
        overflow: 'hidden',
      }}
    >
      {cols.map((col, ci) => (
        <div
          key={ci}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: deco.cellGap,
          }}
        >
          {col.map((d) => {
            const wd = weekdayOf(d.date);
            const dayNum = Number(d.date.slice(8, 10));
            const monthNum = Number(d.date.slice(5, 7));
            const shown =
              d.casts.length <= maxChips
                ? d.casts
                : d.casts.slice(0, Math.max(1, maxChips - 1));
            const rest = d.casts.length - shown.length;
            return (
              <div
                key={d.date}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 18,
                  padding: `${s.rowPadV}px 0`,
                  borderBottom: `1px solid ${p.cellBorder}`,
                }}
              >
                <div style={{ width: s.labelW, flexShrink: 0, lineHeight: 1.2 }}>
                  <span
                    style={{
                      fontSize: s.dateFs,
                      fontWeight: 700,
                      color: wd === 0 ? p.accent : p.headerText,
                    }}
                  >
                    {monthNum}/{dayNum}
                  </span>
                  <span style={{ fontSize: s.wdFs, color: p.dayLabel, marginLeft: 6 }}>
                    ({WEEKDAY_LABELS[wd] ?? ''})
                  </span>
                </div>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: s.chipGap,
                  }}
                >
                  {shown.map((c, j) => (
                    <div
                      key={`${c.name}-${j}`}
                      style={{
                        boxSizing: 'border-box',
                        width: s.chipW,
                        display: 'flex',
                        alignItems: 'center',
                        gap: s.chipGap,
                        backgroundColor: p.cellBg,
                        border: `1px solid ${p.cellBorder}`,
                        borderRadius: deco.cornerRadius,
                        padding: `${s.chipPadV}px ${s.chipPadH}px`,
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          fontSize: s.nameFs,
                          lineHeight: `${chipLineH}px`,
                          fontWeight: 700,
                          color: p.castName,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flexShrink: 1,
                        }}
                      >
                        {c.name}
                      </span>
                      <span
                        style={{
                          fontSize: s.timeFs,
                          lineHeight: `${chipLineH}px`,
                          color: p.timeText,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {shortRange(c.start, c.end)}
                      </span>
                    </div>
                  ))}
                  {rest > 0 ? (
                    <div
                      style={{
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: deco.cornerRadius,
                        padding: `${s.chipPadV}px ${s.chipPadH}px`,
                        fontSize: s.nameFs,
                        lineHeight: `${chipLineH}px`,
                        fontWeight: 700,
                        color: p.accent,
                        border: `1px solid ${p.cellBorder}`,
                      }}
                    >
                      +{rest}人
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── ヘルパー（daily-lineup） ──

function dailyDateLabel(date: string): string {
  const [y = 0, m = 0, d = 0] = date.split('-').map(Number);
  const wd = WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()]!;
  return `${m}/${d}(${wd})`;
}

// ── デイリー出勤表（§22-2: 写真入りグリッド） ──

const DEFAULT_AVATAR_COLOR = '#D1D5DB';

function DailyLineup({
  def,
  days,
  dailyDate,
}: {
  def: ShiftTemplateDefinition;
  days: ShiftDayData[];
  dailyDate: string;
}) {
  const p = def.palette;
  const deco = def.decorations;
  const dayData = days.find(d => d.date === dailyDate);
  const casts = dayData?.casts ?? [];
  const count = casts.length;

  const gap = deco.cellGap + 4;
  const availW = def.size.w - PADDING * 2;
  const availH = def.size.h - PADDING * 2 - 140;

  const cols = count <= 2 ? count || 1 : count <= 4 ? 2 : count <= 9 ? 3 : count <= 16 ? 4 : 5;
  const maxVisible = cols * Math.floor((availH + gap) / (Math.floor((availW - gap * (cols - 1)) / cols) * 0.7 + gap));
  const safeMax = Math.max(cols, Math.min(count, maxVisible, 25));
  const shown = casts.slice(0, safeMax);
  const overflow = count - shown.length;

  const visibleCount = shown.length;
  const cellW = Math.floor((availW - gap * (cols - 1)) / cols);
  const rows = Math.ceil(visibleCount / cols) || 1;
  const cellH = Math.min(Math.floor((availH - gap * (rows - 1)) / rows), cellW * 1.35);
  const photoSize = Math.min(cellW - 24, cellH - 80, 200);

  if (count === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: p.dayLabel,
          fontSize: 28,
        }}
      >
        この日の出勤予定はありません
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexWrap: 'wrap',
        gap,
        alignContent: 'center',
        justifyContent: 'center',
      }}
    >
      {shown.map((c, i) => (
        <div
          key={i}
          style={{
            width: cellW,
            height: cellH,
            backgroundColor: p.cellBg,
            border: `2px solid ${p.cellBorder}`,
            borderRadius: deco.cornerRadius + 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 8,
            boxSizing: 'border-box',
          }}
        >
          {c.photoUrl ? (
            <img
              src={c.photoUrl}
              alt=""
              style={{
                width: photoSize,
                height: photoSize,
                borderRadius: photoSize / 2,
                objectFit: 'cover',
                border: `3px solid ${p.accent}`,
              }}
            />
          ) : (
            <div
              style={{
                width: photoSize,
                height: photoSize,
                borderRadius: photoSize / 2,
                backgroundColor: DEFAULT_AVATAR_COLOR,
                border: `3px solid ${p.accent}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: photoSize * 0.4,
                color: '#FFFFFF',
              }}
            >
              ♪
            </div>
          )}
          <div
            style={{
              marginTop: 8,
              fontSize: Math.min(24, cellW * 0.14),
              fontWeight: 700,
              color: p.castName,
              textAlign: 'center',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              maxWidth: cellW - 16,
            }}
          >
            {c.name}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: Math.min(16, cellW * 0.09),
              color: p.timeText,
              textAlign: 'center',
            }}
          >
            {shortRange(c.start, c.end)}
          </div>
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            width: cellW,
            height: cellH,
            backgroundColor: p.cellBg,
            border: `2px dashed ${p.accent}`,
            borderRadius: deco.cornerRadius + 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 700, color: p.accent }}>
            +{overflow}人
          </span>
        </div>
      )}
    </div>
  );
}

// ── カスタム配置レンダラー（§22-3: 店舗テンプレート画像＋AI検出配置） ──

function CustomPlacement({
  def,
  days,
  yearMonth,
  storeName,
  placement: pl,
  dailyDate,
}: {
  def: ShiftTemplateDefinition;
  days: ShiftDayData[];
  yearMonth: string;
  storeName: string;
  placement: ShiftPlacement;
  dailyDate?: string;
}) {
  const W = def.size.w;
  const H = def.size.h;
  const inset = pl.cellInset;

  const gridX = pl.gridArea.x * W;
  const gridY = pl.gridArea.y * H;
  const gridW = pl.gridArea.w * W;
  const gridH = pl.gridArea.h * H;

  const titleX = pl.titleArea.x * W;
  const titleY = pl.titleArea.y * H;
  const titleW = pl.titleArea.w * W;
  const titleH = pl.titleArea.h * H;

  const totalRows = pl.rows + (pl.hasHeaderRow ? 1 : 0);
  const cellW = gridW / pl.cols;
  const cellH = gridH / totalRows;

  const dataRowStart = pl.hasHeaderRow ? 1 : 0;

  const byDate = new Map(days.map((d) => [d.date, d.casts]));

  const total = daysInMonth(yearMonth);
  const offset = firstDayOffset(yearMonth);
  const isDaily = dailyDate != null;
  const dailyCasts = isDaily
    ? (days.find((d) => d.date === dailyDate)?.casts ?? [])
    : [];

  const maxPerCell = Math.max(1, Math.floor((cellH - inset * 2 - 24) / 28));

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }}>
      {/* タイトル領域: 元テキストを覆い、新しいタイトルを描画 */}
      <div
        style={{
          position: 'absolute',
          left: titleX + inset,
          top: titleY + inset,
          width: titleW - inset * 2,
          height: titleH - inset * 2,
          backgroundColor: pl.cellBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: Math.min(28, titleH * 0.35),
            fontWeight: 700,
            color: pl.accentColor,
            letterSpacing: 3,
          }}
        >
          {storeName}
        </div>
        <div
          style={{
            fontSize: Math.min(22, titleH * 0.28),
            fontWeight: 600,
            color: pl.textColor,
            marginTop: 4,
          }}
        >
          {isDaily && dailyDate
            ? `${dailyDateLabel(dailyDate)} 出勤キャスト`
            : `${yearMonthLabel(yearMonth)} シフト表`}
        </div>
      </div>

      {/* ヘッダー行（曜日ラベル） */}
      {pl.hasHeaderRow && !isDaily
        ? WEEKDAY_LABELS.map((w, ci) => (
            <div
              key={`hdr-${ci}`}
              style={{
                position: 'absolute',
                left: gridX + ci * cellW + inset,
                top: gridY + inset,
                width: cellW - inset * 2,
                height: cellH - inset * 2,
                backgroundColor: pl.cellBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.min(20, cellW * 0.12),
                fontWeight: 700,
                color: ci === 0 ? pl.accentColor : pl.textColor,
              }}
            >
              {w}
            </div>
          ))
        : null}

      {/* データセル */}
      {isDaily
        ? renderDailyCells(dailyCasts, pl, gridX, gridY + (pl.hasHeaderRow ? cellH : 0), cellW, cellH, inset, maxPerCell)
        : renderMonthlyCells(byDate, yearMonth, total, offset, pl, gridX, gridY + dataRowStart * cellH, cellW, cellH, inset, maxPerCell)}
    </div>
  );
}

function renderMonthlyCells(
  byDate: Map<string, ShiftDayData['casts']>,
  yearMonth: string,
  total: number,
  offset: number,
  pl: ShiftPlacement,
  startX: number,
  startY: number,
  cellW: number,
  cellH: number,
  inset: number,
  maxPerCell: number,
): React.JSX.Element[] {
  const elements: React.JSX.Element[] = [];
  for (let day = 1; day <= total; day++) {
    const idx = offset + day - 1;
    const col = idx % 7;
    const row = Math.floor(idx / 7);
    const date = `${yearMonth}-${String(day).padStart(2, '0')}`;
    const casts = byDate.get(date) ?? [];
    const shown = casts.slice(0, maxPerCell);
    const rest = casts.length - shown.length;
    const x = startX + col * cellW + inset;
    const y = startY + row * cellH + inset;
    const w = cellW - inset * 2;
    const h = cellH - inset * 2;
    const nameFs = Math.min(15, w * 0.085);
    const timeFs = Math.min(12, w * 0.065);

    elements.push(
      <div
        key={date}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
          backgroundColor: pl.cellBg,
          overflow: 'hidden',
          padding: '3px 5px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            fontSize: Math.min(18, w * 0.11),
            fontWeight: 700,
            color: col === 0 ? pl.accentColor : pl.textColor,
            lineHeight: 1.2,
          }}
        >
          {day}
        </div>
        {shown.map((c, j) => (
          <div key={`${c.name}-${j}`} style={{ lineHeight: 1.15 }}>
            <span
              style={{
                fontSize: nameFs,
                fontWeight: 700,
                color: pl.textColor,
                whiteSpace: 'nowrap',
              }}
            >
              {c.name}
            </span>
            <span
              style={{
                fontSize: timeFs,
                color: pl.timeColor,
                marginLeft: 3,
                whiteSpace: 'nowrap',
              }}
            >
              {shortRange(c.start, c.end)}
            </span>
          </div>
        ))}
        {rest > 0 ? (
          <div style={{ fontSize: timeFs, fontWeight: 700, color: pl.accentColor }}>
            +{rest}人
          </div>
        ) : null}
      </div>,
    );
  }
  return elements;
}

function renderDailyCells(
  casts: ShiftDayData['casts'],
  pl: ShiftPlacement,
  startX: number,
  startY: number,
  cellW: number,
  cellH: number,
  inset: number,
  _maxPerCell: number,
): React.JSX.Element[] {
  const elements: React.JSX.Element[] = [];
  const totalSlots = pl.cols * pl.rows;
  const shown = casts.slice(0, totalSlots);
  const photoSize = Math.min(cellW - inset * 2 - 16, cellH - inset * 2 - 60, 180);

  shown.forEach((c, i) => {
    const col = i % pl.cols;
    const row = Math.floor(i / pl.cols);
    const x = startX + col * cellW + inset;
    const y = startY + row * cellH + inset;
    const w = cellW - inset * 2;
    const h = cellH - inset * 2;

    elements.push(
      <div
        key={`cast-${i}`}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
          backgroundColor: pl.cellBg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {c.photoUrl ? (
          <img
            src={c.photoUrl}
            alt=""
            style={{
              width: photoSize,
              height: photoSize,
              borderRadius: photoSize / 2,
              objectFit: 'cover',
              border: `3px solid ${pl.accentColor}`,
            }}
          />
        ) : (
          <div
            style={{
              width: photoSize,
              height: photoSize,
              borderRadius: photoSize / 2,
              backgroundColor: DEFAULT_AVATAR_COLOR,
              border: `3px solid ${pl.accentColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: photoSize * 0.4,
              color: '#FFFFFF',
            }}
          >
            ♪
          </div>
        )}
        <div
          style={{
            marginTop: 6,
            fontSize: Math.min(18, w * 0.12),
            fontWeight: 700,
            color: pl.textColor,
            textAlign: 'center',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            maxWidth: w - 8,
          }}
        >
          {c.name}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: Math.min(14, w * 0.09),
            color: pl.timeColor,
          }}
        >
          {shortRange(c.start, c.end)}
        </div>
      </div>,
    );
  });

  return elements;
}
