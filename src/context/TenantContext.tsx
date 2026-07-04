import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';
import type { Tenant, BusinessInfo } from '../types';

type TenantContextValue = {
  tenant: Tenant | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateTenant: (updates: Partial<Pick<Tenant, 'name' | 'genre' | 'businessInfo'>>) => Promise<void>;
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
        isSuspended: data.is_suspended as boolean,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateTenant = useCallback(
    async (updates: Partial<Pick<Tenant, 'name' | 'genre' | 'businessInfo'>>) => {
      if (!tenant) return;
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.genre !== undefined) payload.genre = updates.genre;
      if (updates.businessInfo !== undefined) payload.business_info = updates.businessInfo;
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
