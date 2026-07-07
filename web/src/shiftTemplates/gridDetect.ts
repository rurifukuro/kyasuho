// web/src/shiftTemplates/gridDetect.ts — §22-5 モードB: 空テンプレートの決定論グリッド検出
//
// Canvas 2D APIのみ＝依存追加なし・Edge Function往復なし・APIコスト0。
// 投影プロファイル方式: グレースケール→適応二値化→水平/垂直の暗ピクセル密度ヒストグラム
// →ピーク検出で罫線位置を抽出→ShiftPlacement を返す。

import type { ShiftPlacement } from './definitions';

const DARK_THRESHOLD = 128;
const PEAK_RATIO = 0.25;

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

function horizontalProjection(gray: Uint8Array, w: number, h: number): Float64Array {
  const proj = new Float64Array(h);
  for (let y = 0; y < h; y++) {
    let count = 0;
    const base = y * w;
    for (let x = 0; x < w; x++) {
      if (gray[base + x]! < DARK_THRESHOLD) count++;
    }
    proj[y] = count / w;
  }
  return proj;
}

function verticalProjection(gray: Uint8Array, w: number, h: number): Float64Array {
  const proj = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = 0; y < h; y++) {
      if (gray[y * w + x]! < DARK_THRESHOLD) count++;
    }
    proj[x] = count / h;
  }
  return proj;
}

function findLinePositions(proj: Float64Array, size: number): number[] {
  const max = Math.max(...proj);
  if (max < 0.02) return [];
  const threshold = max * PEAK_RATIO;

  const lines: number[] = [];
  let inPeak = false;
  let peakStart = 0;
  let peakMax = 0;
  let peakMaxPos = 0;

  for (let i = 0; i < size; i++) {
    const v = proj[i]!;
    if (v >= threshold) {
      if (!inPeak) {
        inPeak = true;
        peakStart = i;
        peakMax = v;
        peakMaxPos = i;
      } else if (v > peakMax) {
        peakMax = v;
        peakMaxPos = i;
      }
    } else if (inPeak) {
      inPeak = false;
      const peakCenter = Math.round((peakStart + peakMaxPos) / 2);
      lines.push(peakCenter);
    }
  }
  if (inPeak) {
    lines.push(Math.round((peakStart + peakMaxPos) / 2));
  }

  return lines;
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

  const hProj = horizontalProjection(gray, w, h);
  const vProj = verticalProjection(gray, w, h);

  const hBounds = inferGridBounds(findLinePositions(hProj, h), h);
  const vBounds = inferGridBounds(findLinePositions(vProj, w), w);

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
