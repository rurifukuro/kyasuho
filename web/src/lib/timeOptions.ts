export interface TimeOption {
  value: string;
  label: string;
}

let cache: TimeOption[] | null = null;

export function getTimeOptions(): TimeOption[] {
  if (cache) return cache;
  const opts: TimeOption[] = [];
  for (let h = 0; h <= 28; h++) {
    for (const m of [0, 15, 30, 45]) {
      const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      opts.push({ value: v, label: v });
    }
  }
  cache = opts;
  return opts;
}
