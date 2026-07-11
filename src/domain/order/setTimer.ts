export type TimerStatus = 'green' | 'yellow' | 'red';

export function calcRemainingSeconds(
  deadlineIso: string,
  nowMs: number,
): number {
  return Math.floor((new Date(deadlineIso).getTime() - nowMs) / 1000);
}

export function timerStatus(
  remainingSeconds: number,
  alertMinutes: number,
): TimerStatus {
  if (remainingSeconds <= 0) return 'red';
  if (remainingSeconds <= alertMinutes * 60) return 'yellow';
  return 'green';
}

export function formatTimer(remainingSeconds: number): string {
  const abs = Math.abs(remainingSeconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const str = `${m}:${String(s).padStart(2, '0')}`;
  return remainingSeconds < 0 ? `+${str}` : str;
}
