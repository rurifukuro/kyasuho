export type NominationKind = 'honshimei' | 'jounai';

export const NOMINATION_KINDS: readonly { key: NominationKind; label: string }[] = [
  { key: 'honshimei', label: '本指名' },
  { key: 'jounai', label: '場内指名' },
] as const;

export function nominationKindLabel(kind: string | null): string {
  if (!kind) return '指名';
  const found = NOMINATION_KINDS.find((k) => k.key === kind);
  return found?.label ?? '指名';
}
