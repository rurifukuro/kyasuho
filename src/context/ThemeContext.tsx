import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeColor } from '../types';
import { THEMES } from '../types';

// とれはんっ！ ThemeContext を流用。AsyncStorage キーは ky_ プレフィックスで名前空間分離。
const STORAGE_KEY = 'ky_themeKey';
const DEFAULT_THEME = 'pink'; // コンカフェらしい既定テーマ

type ThemeContextType = {
  theme: ThemeColor;
  themeKey: string;
  setThemeKey: (key: string) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES[DEFAULT_THEME],
  themeKey: DEFAULT_THEME,
  setThemeKey: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKeyState] = useState(DEFAULT_THEME);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && THEMES[saved]) setThemeKeyState(saved);
    });
  }, []);

  const setThemeKey = (key: string) => {
    if (!THEMES[key]) return;
    setThemeKeyState(key);
    AsyncStorage.setItem(STORAGE_KEY, key);
  };

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeKey], themeKey, setThemeKey }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
