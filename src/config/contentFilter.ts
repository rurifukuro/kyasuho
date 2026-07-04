const BANNED_WORDS: readonly string[] = [
  'きちがい', 'キチガイ', '気違い', '気狂い',
  'つんぼ', 'ツンボ',
  '土人',
  '殺すぞ', 'ころすぞ', 'ぶっ殺す', 'ぶっころす', '殺してやる', 'ぶっ殺してやる',
  'nigger', 'faggot', 'killyou',
];

function normalizeForMatch(text: string): string {
  let s = text;
  try {
    s = s.normalize('NFKC');
  } catch {
    // normalize 未対応環境では正規化なしで続行
  }
  return s.toLowerCase().replace(/\s+/g, '');
}

export function findBannedWord(text: string): string | null {
  if (!text) return null;
  const norm = normalizeForMatch(text);
  if (!norm) return null;
  for (const w of BANNED_WORDS) {
    if (norm.includes(w)) return w;
  }
  return null;
}
