import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, hasSupabaseConfig } from '../config/supabase';
import { ensureTenant } from '../services/tenants';

export type AuthResult = { needsEmailConfirm: boolean };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isReady: boolean; // 初回セッション復元が完了
  configured: boolean; // .env が設定済み
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      // 未設定なら認証を試みず、AuthScreen で案内する。
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

  // セッション確立時、テナントを保証（無ければ作成）。失敗は握りつぶさずログ（BE-2）。
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    ensureTenant(userId).catch((e: unknown) => {
      console.warn('[kyasuho] ensureTenant failed:', e);
    });
  }, [userId]);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // session が返ればメール確認OFF（即ログイン）、null ならメール確認待ち。
    return { needsEmailConfirm: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isReady,
        configured: hasSupabaseConfig,
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
