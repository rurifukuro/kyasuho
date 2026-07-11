export type SnsPostTemplate = {
  header: string;
  group_heading: string;
  line: string;
  footer: string;
};

export type PostCastEntry = {
  name: string;
  nameKana: string;
  start: string;
  xHandle: string | null;
};

export const DEFAULT_DAILY_TEMPLATE: SnsPostTemplate = {
  header: '{{store_name}} 本日の出勤キャスト✨',
  group_heading: '【{{time}}〜】',
  line: '{{name}}（{{account}}）',
  footer: 'ご予約はこちら💁\n{{reservation_url}}',
};

export const DEFAULT_MONTHLY_TEMPLATE: SnsPostTemplate = {
  header: '{{store_name}} {{month}}月のシフト表です🗓',
  group_heading: '',
  line: '',
  footer: 'ご予約はこちら💁\n{{reservation_url}}',
};

function shortTime(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  if (!h) return hhmm;
  const hr = Number(h);
  const mins = Number(m ?? 0);
  if (mins === 0) return `${hr}:00`;
  return `${hr}:${String(mins).padStart(2, '0')}`;
}

export function extractXHandle(snsLinks: { label?: string; url?: string; platform?: string }[]): string | null {
  for (const link of snsLinks) {
    const url = link.url ?? '';
    const m = url.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)/);
    if (m?.[1]) return `@${m[1]}`;
  }
  return null;
}

function replaceVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

export function buildDailyPostText(
  tmpl: SnsPostTemplate,
  storeName: string,
  date: string,
  casts: PostCastEntry[],
  reservationUrl: string,
): string {
  const [, , d] = date.split('-');
  const vars: Record<string, string> = {
    store_name: storeName,
    date: `${Number(date.split('-')[1])}/${Number(d)}`,
    reservation_url: reservationUrl,
  };

  const groups = new Map<string, PostCastEntry[]>();
  for (const c of [...casts].sort((a, b) => a.start === b.start ? a.nameKana.localeCompare(b.nameKana, 'ja') : a.start < b.start ? -1 : 1)) {
    const key = shortTime(c.start);
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const lines: string[] = [];
  lines.push(replaceVars(tmpl.header, vars));
  lines.push('');

  for (const [time, members] of groups) {
    if (tmpl.group_heading) {
      lines.push(replaceVars(tmpl.group_heading, { ...vars, time }));
    }
    for (const c of members) {
      if (c.xHandle) {
        lines.push(replaceVars(tmpl.line, { ...vars, name: c.name, account: c.xHandle }));
      } else {
        lines.push(c.name);
      }
    }
    lines.push('');
  }

  if (tmpl.footer) {
    lines.push(replaceVars(tmpl.footer, vars));
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function buildMonthlyPostText(
  tmpl: SnsPostTemplate,
  storeName: string,
  yearMonth: string,
  reservationUrl: string,
): string {
  const month = String(Number(yearMonth.split('-')[1]));
  const vars: Record<string, string> = {
    store_name: storeName,
    month,
    reservation_url: reservationUrl,
  };
  const lines: string[] = [];
  lines.push(replaceVars(tmpl.header, vars));
  if (tmpl.footer) {
    lines.push('');
    lines.push(replaceVars(tmpl.footer, vars));
  }
  return lines.join('\n').trim();
}

export function estimateXLength(text: string): number {
  let count = 0;
  const urlPattern = /https?:\/\/\S+/g;
  let remaining = text.replace(urlPattern, () => {
    count += 23;
    return '';
  });
  for (const ch of remaining) {
    count += ch.charCodeAt(0) > 0x7F ? 2 : 1;
  }
  return count;
}
