import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';
import type { Tenant, BusinessInfo, TenantSnsLink } from '../types';

type TenantContextValue = {
  tenant: Tenant | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateTenant: (updates: Partial<Pick<Tenant, 'name' | 'genre' | 'businessInfo' | 'snsLinks' | 'prefecture' | 'area' | 'rankingOptIn'>>) => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setTenant(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('ky_tenants')
      .select('*')
      .eq('owner_user_id', user.id)
      .maybeSingle();
    if (error) {
      console.warn('[kyasuho] tenant load failed:', error);
      setLoading(false);
      return;
    }
    if (data) {
      setTenant({
        id: data.id as string,
        slug: data.slug as string,
        name: data.name as string,
        genre: data.genre as string,
        ownerUserId: data.owner_user_id as string,
        businessInfo: (data.business_info ?? {}) as BusinessInfo,
        snsLinks: (data.sns_links ?? []) as TenantSnsLink[],
        prefecture: (data.prefecture ?? '') as string,
        area: (data.area ?? '') as string,
        rankingOptIn: (data.ranking_opt_in ?? false) as boolean,
        isSuspended: data.is_suspended as boolean,
        enableBottleKeep: (data.enable_bottle_keep ?? false) as boolean,
        enableVouchers: (data.enable_vouchers ?? false) as boolean,
        timerEnabled: (data.timer_enabled ?? true) as boolean,
        timerAlertMinutes: (data.timer_alert_minutes ?? 5) as number,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateTenant = useCallback(
    async (updates: Partial<Pick<Tenant, 'name' | 'genre' | 'businessInfo' | 'snsLinks' | 'prefecture' | 'area' | 'rankingOptIn'>>) => {
      if (!tenant) return;
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.genre !== undefined) payload.genre = updates.genre;
      if (updates.businessInfo !== undefined) payload.business_info = updates.businessInfo;
      if (updates.snsLinks !== undefined) payload.sns_links = updates.snsLinks;
      if (updates.prefecture !== undefined) payload.prefecture = updates.prefecture;
      if (updates.area !== undefined) payload.area = updates.area;
      if (updates.rankingOptIn !== undefined) payload.ranking_opt_in = updates.rankingOptIn;
      const { error } = await supabase.from('ky_tenants').update(payload).eq('id', tenant.id);
      if (error) throw error;
      await load();
    },
    [tenant, load],
  );

  return (
    <TenantContext.Provider value={{ tenant, loading, refresh: load, updateTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant は TenantProvider の内側で使ってください');
  return ctx;
}
