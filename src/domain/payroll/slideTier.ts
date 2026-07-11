export type TierInput = {
  threshold: number;
  hourlyRate: number;
};

export function resolveTierRate(
  tiers: TierInput[],
  metricValue: number,
  fallbackRate: number,
): number {
  const sorted = [...tiers].sort((a, b) => b.threshold - a.threshold);
  for (const t of sorted) {
    if (metricValue >= t.threshold) return t.hourlyRate;
  }
  return fallbackRate;
}
