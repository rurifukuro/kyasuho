import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, hasSupabaseConfig } from '../config/supabase';
import { ensureTenant } from '../services/tenants';
import { resolveUserRole } from '../services/roles';
import type { RoleResult } from '../services/roles';
import type { UserRole } from '../types';

export type AuthResult = { needsEmailConfirm: boolean };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isReady: boolean;
  configured: boolean;
  role: UserRole;
  roleResult: RoleResult | null;
  roleLoading: boolean;
  refreshRole: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [roleResult, setRoleResult] = useState<RoleResult | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setIsReady(true);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;

  const refreshRole = useCallback(async () => {
    if (!userId) {
      setRoleResult(null);
      return;
    }
    setRoleLoading(true);
    try {
      const result = await resolveUserRole(userId);
      setRoleResult(result);
    } catch (e: unknown) {
      console.warn('[kyasuho] resolveUserRole failed:', e);
      setRoleResult({ role: 'none' });
    } finally {
      setRoleLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setRoleResult(null);
      return;
    }
    setRoleLoading(true);
    resolveUserRole(userId)
      .then((result) => {
        setRoleResult(result);
        if (result.role === 'owner') {
          return ensureTenant(userId);
        }
      })
      .catch((e: unknown) => {
        console.warn('[kyasuho] role/tenant init failed:', e);
      })
      .finally(() => {
        setRoleLoading(false);
      });
  }, [userId]);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return { needsEmailConfirm: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setRoleResult(null);
  }, []);

  const role: UserRole = roleResult?.role ?? 'none';

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isReady,
        configured: hasSupabaseConfig,
        role,
        roleResult,
        roleLoading,
        refreshRole,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth は AuthProvider の内側で使ってください');
  return ctx;
}
