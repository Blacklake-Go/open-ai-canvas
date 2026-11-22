import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface ThemeContextValue {
  theme?: string;
  setTheme: (theme: string) => void;
  resolvedTheme?: string;
  themes: string[];
  systemTheme?: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  resolvedTheme: 'dark',
  themes: ['dark', 'light'],
  systemTheme: 'dark',
});

export interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
  forcedTheme?: string;
  enableSystem?: boolean;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'dark',
  forcedTheme,
  storageKey = 'theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<string>(() => {
    if (forcedTheme) return forcedTheme;
    if (typeof window !== 'undefined') {
      try {
        return window.localStorage.getItem(storageKey) || defaultTheme;
      } catch {
        return defaultTheme;
      }
    }
    return defaultTheme;
  });

  const resolvedTheme = forcedTheme || (theme === 'system' ? 'dark' : theme) || 'dark';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (attribute === 'class') {
      root.classList.remove('light', 'dark');
      root.classList.add(resolvedTheme);
    } else if (attribute) {
      root.setAttribute(attribute, resolvedTheme);
    }
    root.style.colorScheme = resolvedTheme === 'light' ? 'light' : 'dark';
  }, [attribute, resolvedTheme]);

  const setTheme = useCallback(
    (next: string) => {
      if (forcedTheme) return;
      setThemeState(next);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, next);
        } catch {
          // ignore storage failure
        }
      }
    },
    [forcedTheme, storageKey],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: forcedTheme || theme,
      setTheme,
      resolvedTheme,
      themes: ['dark', 'light'],
      systemTheme: 'dark',
    }),
    [forcedTheme, theme, setTheme, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
