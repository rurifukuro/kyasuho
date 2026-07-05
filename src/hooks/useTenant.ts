import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { KyTenant } from '../lib/types';

export function useTenant(slug: string | undefined) {
  const [tenant, setTenant] = useState<KyTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError('店舗が指定されていません');
      return;
    }
    setLoading(true);
    setError(null);

    supabase
      .from('ky_tenants')
      .select('id, slug, name, genre, business_info, is_suspended')
      .eq('slug', slug)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('店舗が見つかりません');
          setTenant(null);
        } else {
          setTenant(data as KyTenant);
        }
        setLoading(false);
      });
  }, [slug]);

  return { tenant, loading, error };
}
