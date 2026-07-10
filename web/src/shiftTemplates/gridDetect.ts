// web/src/shiftTemplates/gridDetect.ts — §22-5 モードB: 空テンプレートの決定論グリッド検出
//
// Canvas 2D APIのみ＝依存追加なし・Edge Function往復なし・APIコスト0。
// 投影プロファイル方式（Rev72で全面改良・とれはんっ！mapkit方式の正解照合テストで検証）:
//   グレースケール → Otsu法の適応二値化＋背景極性自動判定（ダーク背景テンプレ対応）
//   → インク密度の水平/垂直投影 → セグメント検出
//   → 帯除外（ソリッドリボン等の太幅は罫線と数えない）
//   → 近接ピーク統合（角丸セルボックス式のセル間ギャップ二重線を1本に）
//   → 間隔外れ値除去 → ShiftPlacement を返す。

import type { ShiftPlacement } from './definitions';

// 罫線セグメント判定パラメータ（1200px級の画像で較正済み）
const PEAK_RATIO = 0.5; // 最大密度に対する罫線判定比（文字行・装飾を除外）
const MIN_ABS_DENSITY = 0.12; // 罫線として認める最低インク密度
const MAX_LINE_WIDTH_RATIO = 0.015; // これより太いセグメントは帯（リボン等）として除外
const MERGE_DIST_RATIO = 0.02; // これより近い2線は同一境界の二重線として統合
const MIN_GAP_RATIO = 0.35; // 中央値間隔のこれ未満の間隔を作る弱い線は除去

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
  const gray = toGrayscale(imageData.data, pixelCount);
  const ink = toInkMask(gray);

  const hProj = horizontalProjection(ink, w, h);
  const vProj = verticalProjection(ink, w, h);

  const hBounds = inferGridBounds(refineLines(findLineSegments(hProj, h), h), h);
  const vBounds = inferGridBounds(refineLines(findLineSegments(vProj, w), w), w);

  if (!hBounds || !vBounds) return null;

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
