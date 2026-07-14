const AREA_DICT: readonly { keywords: readonly string[]; area: string }[] = [
  { keywords: ['外神田', '神田佐久間町', '神田練塀町'], area: '秋葉原' },
  { keywords: ['歌舞伎町'], area: '歌舞伎町' },
  { keywords: ['豊島区東池袋', '豊島区西池袋', '豊島区南池袋'], area: '池袋' },
  { keywords: ['中野区中野'], area: '中野' },
  { keywords: ['名古屋市中区大須'], area: '大須' },
  { keywords: ['大阪市中央区日本橋', '浪速区日本橋'], area: '日本橋（大阪）' },
  { keywords: ['福岡市中央区天神'], area: '天神' },
  { keywords: ['札幌市中央区南'], area: 'すすきの' },
  { keywords: ['仙台市青葉区国分町'], area: '国分町' },
];

export function resolveArea(city: string, town: string): string {
  const combined = city + town;
  for (const entry of AREA_DICT) {
    for (const kw of entry.keywords) {
      if (combined.includes(kw)) return entry.area;
    }
  }
  return city.replace(/[市区町村郡]$/, '');
}
