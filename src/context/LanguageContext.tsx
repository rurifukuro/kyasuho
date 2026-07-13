import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, TKey, LANGUAGE_OPTIONS as I18N_LANGUAGE_OPTIONS, translate } from '../i18n';

// とれはんっ！ LanguageContext の最小版（language 状態 ＋ t() の提供）。
// 初回同意（規約/PP）・初回起動フローは §16 の法務実装フェーズで足す。
export type { Language, TKey };
export const LANGUAGE_OPTIONS = I18N_LANGUAGE_OPTIONS;

const LANG_KEY = 'ky_language';

type CtxType = {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  /** key と任意の {name} パラメータから翻訳文字列を取得（未翻訳キーは ja → キー名にフォールバック）。 */
  t: (key: TKey, params?: Record<string, string | number>) => string;
  isReady: boolean;
};

const Ctx = createContext<CtxType>({
  language: 'ja',
  setLanguage: async () => {},
  t: (k, p) => translate('ja', k, p),
  isReady: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>('ja');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(LANG_KEY);
      if (saved && ['ja', 'en', 'zh', 'ko', 'fr'].includes(saved)) setLang(saved as Language);
      setIsReady(true);
    })();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLang(lang);
    await AsyncStorage.setItem(LANG_KEY, lang);
  };

  const t = (key: TKey, params?: Record<string, string | number>): string =>
    translate(language, key, params);

  return (
    <Ctx.Provider value={{ language, setLanguage, t, isReady }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLanguage() {
  return useContext(Ctx);
}
