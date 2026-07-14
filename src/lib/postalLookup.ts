export interface PostalResult {
  prefecture: string;
  city: string;
  town: string;
}

export async function lookupPostalCode(raw: string): Promise<PostalResult | null> {
  const zipcode = raw.replace(/[-‐‑‒–—―ー－]/g, '');
  if (!/^\d{7}$/.test(zipcode)) return null;

  const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`);
  if (!res.ok) throw new Error(`postal_lookup_http_${res.status}`);

  const json = (await res.json()) as {
    status: number;
    results: { address1: string; address2: string; address3: string }[] | null;
  };
  if (!json.results || json.results.length === 0) return null;

  const r = json.results[0]!;
  return { prefecture: r.address1, city: r.address2, town: r.address3 };
}
