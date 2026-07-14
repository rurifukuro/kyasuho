// web/src/shiftTemplates/gridDetect.ts — §22-5 モードB: 空テンプレートの決定論グリッド検出
//
// Canvas 2D APIのみ＝依存追加なし・Edge Function往復なし・APIコスト0。
// mapkit（map-analysisスキル）の色較正マスク方式を移植した2段構成:
//   ①背景パレット較正マスク（主経路）: 面積比の大きい色クラスタ＝背景パレットを較正し、
//     どのパレット色からも色距離が遠い画素をインクとする。グローバル閾値（Otsu）では
//     背景と同側に分類される淡い罫線（例 #E0A0A0 on #FFF5F5）も拾える。
//   ②Otsu二値化（フォールバック）: 写真・グラデーション背景などパレット較正が
//     成立しない画像用（Rev72方式を維持）。
// 共通後段: インク密度の水平/垂直投影 → セグメント検出 → 帯除外 → 近接統合
//   → 間隔外れ値除去 → 直交罫線クロス照合（S-10-7の2本立て＝タイトル枠エッジ除去）
//   → 等間隔最長ラン抽出 → ShiftPlacement を返す。

import type { ShiftPlacement } from './definitions';

// 罫線セグメント判定パラメータ（1200px級の画像で較正済み）
const PEAK_RATIO = 0.5; // 最大密度に対する罫線判定比（文字行・装飾を除外）
const MIN_ABS_DENSITY = 0.12; // 罫線として認める最低インク密度
const MAX_LINE_WIDTH_RATIO = 0.015; // これより太いセグメントは帯（リボン等）として除外
const MERGE_DIST_RATIO = 0.02; // これより近い2線は同一境界の二重線として統合
const MIN_GAP_RATIO = 0.35; // 中央値間隔のこれ未満の間隔を作る弱い線は除去
const BG_BIN_MIN_RATIO = 0.02; // 面積比これ以上の量子化ビンを背景パレットに採用
const COLOR_TOL = 24; // 全パレット色からこの距離（maxチャネル差）超でインク
const MAX_INK_RATE = 0.4; // 色較正マスクのインク率がこれ超なら較正失敗→Otsuへ
const CROSS_NEED_RATIO = 0.6; // 直交罫線との交差がこの割合未満の線は罫線でない
const RUN_GAP_LO = 0.6; // 等間隔ラン: 中央値間隔に対する下限比
const RUN_GAP_HI = 1.6; // 等間隔ラン: 中央値間隔に対する上限比

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = url;
  });
}

function toGrayscale(data: Uint8ClampedArray, len: number): Uint8Array {
  const gray = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const off = i * 4;
    gray[i] = Math.round(data[off]! * 0.299 + data[off + 1]! * 0.587 + data[off + 2]! * 0.114);
  }
  return gray;
}

// Otsu法: クラス間分散を最大化する閾値を求める（決定論・照明やテンプレ配色に自動適応）
function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]!]!++;

  const total = gray.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t]!;

  let sumBg = 0;
  let weightBg = 0;
  let bestVar = -1;
  let best = 128;
  for (let t = 0; t < 256; t++) {
    weightBg += hist[t]!;
    if (weightBg === 0) continue;
    const weightFg = total - weightBg;
    if (weightFg === 0) break;
    sumBg += t * hist[t]!;
    const meanBg = sumBg / weightBg;
    const meanFg = (sumAll - sumBg) / weightFg;
    const between = weightBg * weightFg * (meanBg - meanFg) * (meanBg - meanFg);
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
}

// 二値化: 「インク＝罫線・文字側（少数派クラス）」が true になるマスクを作る。
// ダーク背景×明色罫線のテンプレ（40種中13種）は極性を反転して扱う。
function toInkMask(gray: Uint8Array): Uint8Array {
  const t = otsuThreshold(gray);
  let darkCount = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i]! <= t) darkCount++;
  }
  const backgroundIsDark = darkCount > gray.length / 2;
  const ink = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const isDark = gray[i]! <= t;
    ink[i] = (backgroundIsDark ? !isDark : isDark) ? 1 : 0;
  }
  return ink;
}

// 背景パレット較正マスク（mapkit build_mask の逆適用）:
// RGBを16レベル/chに量子化し、面積比 BG_BIN_MIN_RATIO 以上のビンの実平均色を背景パレットとする。
// 全パレット色から COLOR_TOL 超離れた画素＝インク。罫線は細く大面積にならないためパレットに入らず、
// タイトル帯・ヘッダー塗り等の大面積装飾は背景側に吸収される（帯除外の負担も減る）。
// パレット不成立（写真等）やインク率過大なら null を返し、呼び出し側がOtsuへフォールバックする。
function toColorCalibratedInkMask(
  data: Uint8ClampedArray,
  pixelCount: number,
): Uint8Array | null {
  const counts = new Uint32Array(4096);
  const sumR = new Float64Array(4096);
  const sumG = new Float64Array(4096);
  const sumB = new Float64Array(4096);
  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    const r = data[off]!;
    const g = data[off + 1]!;
    const b = data[off + 2]!;
    const bin = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    counts[bin]!++;
    sumR[bin]! += r;
    sumG[bin]! += g;
    sumB[bin]! += b;
  }

  const minCount = pixelCount * BG_BIN_MIN_RATIO;
  const palette: Array<{ r: number; g: number; b: number }> = [];
  for (let bin = 0; bin < 4096; bin++) {
    const c = counts[bin]!;
    if (c >= minCount) {
      palette.push({ r: sumR[bin]! / c, g: sumG[bin]! / c, b: sumB[bin]! / c });
    }
  }
  if (palette.length === 0) return null;

  const ink = new Uint8Array(pixelCount);
  let inkCount = 0;
  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    const r = data[off]!;
    const g = data[off + 1]!;
    const b = data[off + 2]!;
    let isInk = 1;
    for (const p of palette) {
      const dr = Math.abs(r - p.r);
      const dg = Math.abs(g - p.g);
      const db = Math.abs(b - p.b);
      const d = dr > dg ? (dr > db ? dr : db) : dg > db ? dg : db;
      if (d <= COLOR_TOL) {
        isInk = 0;
        break;
      }
    }
    ink[i] = isInk;
    inkCount += isInk;
  }
  // インク率過大＝背景較正が成立していない（写真・複雑背景）
  if (inkCount > pixelCount * MAX_INK_RATE) return null;
  return ink;
}

function horizontalProjection(ink: Uint8Array, w: number, h: number): Float64Array {
  const proj = new Float64Array(h);
  for (let y = 0; y < h; y++) {
    let count = 0;
    const base = y * w;
    for (let x = 0; x < w; x++) count += ink[base + x]!;
    proj[y] = count / w;
  }
  return proj;
}

function verticalProjection(ink: Uint8Array, w: number, h: number): Float64Array {
  const proj = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = 0; y < h; y++) count += ink[y * w + x]!;
    proj[x] = count / h;
  }
  return proj;
}

interface LineSeg {
  pos: number; // セグメント中心（start/end の中点＝プラトーでも偏らない）
  width: number;
  strength: number;
}

// 投影プロファイルから罫線セグメントを抽出
function findLineSegments(proj: Float64Array, size: number): LineSeg[] {
  let max = 0;
  for (let i = 0; i < size; i++) {
    if (proj[i]! > max) max = proj[i]!;
  }
  if (max < MIN_ABS_DENSITY) return [];
  const threshold = Math.max(max * PEAK_RATIO, MIN_ABS_DENSITY);

  const segs: LineSeg[] = [];
  let inPeak = false;
  let peakStart = 0;
  let peakMax = 0;

  const push = (start: number, end: number, strength: number) => {
    segs.push({ pos: (start + end) / 2, width: end - start + 1, strength });
  };

  for (let i = 0; i < size; i++) {
    const v = proj[i]!;
    if (v >= threshold) {
      if (!inPeak) {
        inPeak = true;
        peakStart = i;
        peakMax = v;
      } else if (v > peakMax) {
        peakMax = v;
      }
    } else if (inPeak) {
      inPeak = false;
      push(peakStart, i - 1, peakMax);
    }
  }
  if (inPeak) push(peakStart, size - 1, peakMax);

  return segs;
}

// 帯除外 → 近接統合 → 間隔外れ値除去 を経て最終的な罫線位置を返す
function refineLines(segs: LineSeg[], size: number): number[] {
  // ① 帯除外: 太幅セグメント（タイトルリボン・装飾帯）は罫線ではない
  const maxLineWidth = Math.max(8, size * MAX_LINE_WIDTH_RATIO);
  let lines = segs.filter((s) => s.width <= maxLineWidth);

  // ② 近接統合: 角丸セルボックス式はセル間ギャップの両側に線が立つ＝1境界2本
  //    近い2本は強度加重の中点へ統合する
  const mergeDist = size * MERGE_DIST_RATIO;
  const merged: LineSeg[] = [];
  for (const s of lines) {
    const last = merged[merged.length - 1];
    if (last && s.pos - last.pos < mergeDist) {
      const total = last.strength + s.strength;
      last.pos = (last.pos * last.strength + s.pos * s.strength) / total;
      last.width = Math.max(last.width, s.width);
      last.strength = Math.max(last.strength, s.strength);
    } else {
      merged.push({ ...s });
    }
  }
  lines = merged;

  // ③ 間隔外れ値除去: 中央値間隔より極端に狭い間隔を作る弱い線（文字由来の偽ピーク等）を落とす
  while (lines.length >= 3) {
    const gaps: number[] = [];
    for (let i = 1; i < lines.length; i++) gaps.push(lines[i]!.pos - lines[i - 1]!.pos);
    const sorted = [...gaps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const badIdx = gaps.findIndex((g) => g < median * MIN_GAP_RATIO);
    if (badIdx < 0) break;
    // 狭い間隔を構成する2線のうち弱い方を除去
    const a = lines[badIdx]!;
    const b = lines[badIdx + 1]!;
    lines.splice(a.strength <= b.strength ? badIdx : badIdx + 1, 1);
  }

  return lines.map((s) => Math.round(s.pos));
}

// インクマスクの部分窓に1画素でもインクがあるか
function inkInWindow(
  ink: Uint8Array,
  w: number,
  h: number,
  y0: number,
  y1: number,
  x0: number,
  x1: number,
): boolean {
  const ys = Math.max(0, y0);
  const ye = Math.min(h, y1);
  const xs = Math.max(0, x0);
  const xe = Math.min(w, x1);
  for (let y = ys; y < ye; y++) {
    const base = y * w;
    for (let x = xs; x < xe; x++) {
      if (ink[base + x]!) return true;
    }
  }
  return false;
}

// 直交罫線クロス照合（map-analysisスキル S-10-7 の2本立て判別）:
// 真のグリッド罫線は直交する罫線群と交差する＝線から少し離れた位置に直交インクがある。
// タイトル枠のエッジ・装飾ラインは交差しないため除去される。
function crossFilter(
  hLines: number[],
  vLines: number[],
  ink: Uint8Array,
  w: number,
  h: number,
): { hLines: number[]; vLines: number[] } {
  if (hLines.length < 2 || vLines.length < 2) return { hLines, vLines };

  // 水平線候補 y が垂直線 x と交差しているか（線の上下少し離れた窓に垂直インクがあるか）
  const crossesV = (y: number, x: number): boolean =>
    inkInWindow(ink, w, h, y - 9, y - 3, x - 2, x + 3) ||
    inkInWindow(ink, w, h, y + 4, y + 10, x - 2, x + 3);
  const crossesH = (y: number, x: number): boolean =>
    inkInWindow(ink, w, h, y - 2, y + 3, x - 9, x - 3) ||
    inkInWindow(ink, w, h, y - 2, y + 3, x + 4, x + 10);

  const needV = Math.max(2, Math.floor(vLines.length * CROSS_NEED_RATIO));
  const needH = Math.max(2, Math.floor(hLines.length * CROSS_NEED_RATIO));

  const h2 = hLines.filter((y) => {
    let hit = 0;
    for (const x of vLines) if (crossesV(y, x)) hit++;
    return hit >= needV;
  });
  const v2 = vLines.filter((x) => {
    let hit = 0;
    for (const y of hLines) if (crossesH(y, x)) hit++;
    return hit >= needH;
  });

  return { hLines: h2.length >= 2 ? h2 : hLines, vLines: v2.length >= 2 ? v2 : vLines };
}

// 等間隔の最長連続ラン抽出: グリッド本体は間隔がほぼ一定。
// 中央値間隔から外れた間隔で繋がる線（グリッド外の枠線等）をランから切り離す。
function extractUniformRun(lines: number[]): number[] {
  if (lines.length <= 2) return lines;

  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) gaps.push(lines[i]! - lines[i - 1]!);
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const lo = median * RUN_GAP_LO;
  const hi = median * RUN_GAP_HI;

  let bestStart = 0;
  let bestEnd = 0; // 線インデックスの閉区間 [bestStart, bestEnd]
  let i = 0;
  while (i < gaps.length) {
    if (gaps[i]! >= lo && gaps[i]! <= hi) {
      let j = i;
      while (j < gaps.length && gaps[j]! >= lo && gaps[j]! <= hi) j++;
      const better =
        j - i > bestEnd - bestStart ||
        (j - i === bestEnd - bestStart &&
          lines[j]! - lines[i]! > lines[bestEnd]! - lines[bestStart]!);
      if (better) {
        bestStart = i;
        bestEnd = j;
      }
      i = j;
    } else {
      i++;
    }
  }

  if (bestEnd - bestStart < 1) return lines;
  return lines.slice(bestStart, bestEnd + 1);
}

function inferGridBounds(
  lines: number[],
  size: number,
): { start: number; end: number; count: number } | null {
  if (lines.length < 2) return null;

  const start = lines[0]!;
  const end = lines[lines.length - 1]!;
  const count = lines.length - 1;

  if (count < 1 || end <= start) return null;
  if ((end - start) / size < 0.15) return null;

  return { start, end, count };
}

export async function detectGridFromImage(imageUrl: string): Promise<ShiftPlacement | null> {
  const img = await loadImage(imageUrl);

  const maxDim = 1200;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > maxDim || h > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixelCount = w * h;

  // 与えたインクマスクで投影→精錬→クロス照合→等間隔ラン→グリッド境界を推定
  const tryDetect = (
    ink: Uint8Array,
  ): {
    hBounds: NonNullable<ReturnType<typeof inferGridBounds>>;
    vBounds: NonNullable<ReturnType<typeof inferGridBounds>>;
  } | null => {
    const hProj = horizontalProjection(ink, w, h);
    const vProj = verticalProjection(ink, w, h);
    let hLines = refineLines(findLineSegments(hProj, h), h);
    let vLines = refineLines(findLineSegments(vProj, w), w);
    ({ hLines, vLines } = crossFilter(hLines, vLines, ink, w, h));
    hLines = extractUniformRun(hLines);
    vLines = extractUniformRun(vLines);
    const hBounds = inferGridBounds(hLines, h);
    const vBounds = inferGridBounds(vLines, w);
    if (!hBounds || !vBounds) return null;
    return { hBounds, vBounds };
  };

  // ①背景パレット較正マスク（淡い罫線も拾える主経路）
  const colorInk = toColorCalibratedInkMask(imageData.data, pixelCount);
  let result = colorInk ? tryDetect(colorInk) : null;

  // ②Otsu二値化フォールバック（写真・グラデーション背景等）
  if (!result) {
    const gray = toGrayscale(imageData.data, pixelCount);
    result = tryDetect(toInkMask(gray));
  }
  if (!result) return null;

  const { hBounds, vBounds } = result;

  const gridX = vBounds.start / w;
  const gridY = hBounds.start / h;
  const gridW = (vBounds.end - vBounds.start) / w;
  const gridH = (hBounds.end - hBounds.start) / h;

  const cols = Math.min(14, Math.max(1, vBounds.count));
  const rawRows = Math.min(10, Math.max(1, hBounds.count));
  const hasHeaderRow = rawRows >= 2;
  const rows = hasHeaderRow ? rawRows - 1 : rawRows;

  const titleH = Math.max(0.04, gridY * 0.6);
  const titleY = Math.max(0, gridY - titleH - 0.02);

  return {
    gridArea: { x: gridX, y: gridY, w: gridW, h: gridH },
    titleArea: { x: gridX, y: titleY, w: gridW, h: titleH },
    cols,
    rows,
    hasHeaderRow,
    cellBg: '#FFFFFF',
    cellInset: 2,
    textColor: '#333333',
    timeColor: '#666666',
    accentColor: '#E91E63',
    cellBgAlpha: 0.85,
    textOutline: false,
  };
}
