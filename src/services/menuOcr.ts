// src/services/menuOcr.ts — お品書き画像/PDF読取り（月20回制限・Edge Function ky-menu-ocr）

import { supabase } from '../config/supabase';

const MONTHLY_LIMIT = 20;

function jstYearMonth(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 7);
}

export async function fetchMenuOcrUsage(tenantId: string): Promise<number> {
  const ym = jstYearMonth();
  const { data } = await supabase
    .from('ky_menu_ocr_usage')
    .select('usage_count')
    .eq('tenant_id', tenantId)
    .eq('year_month', ym)
    .maybeSingle();
  return data?.usage_count ?? 0;
}

export function canUseMenuOcr(currentUsage: number): boolean {
  return currentUsage < MONTHLY_LIMIT;
}

export type OcrMenuItem = {
  name: string;
  price: number;
  remotePrice: number | null;
  category: string;
};

export async function ocrMenuImage(
  tenantId: string,
  imageBase64: string,
  mediaType: string = 'image/jpeg',
): Promise<OcrMenuItem[]> {
  const { data, error } = await supabase.functions.invoke('ky-menu-ocr', {
    body: { tenant_id: tenantId, image: imageBase64, media_type: mediaType },
  });
  if (error) throw error;
  const result = data as { items: { name: string; price: number; remote_price: number | null; category: string }[] };
  return result.items.map((r) => ({
    name: r.name,
    price: r.price,
    remotePrice: r.remote_price,
    category: r.category,
  }));
}
