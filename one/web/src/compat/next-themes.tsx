import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';

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

function normalizeTheme(value: string | null | undefined): 'dark' | 'light' {
  return value === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'dark',
  forcedTheme,
  storageKey = 'theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<string>(() => {
    if (forcedTheme) return normalizeTheme(forcedTheme);
    if (typeof window !== 'undefined') {
      try {
        return normalizeTheme(window.localStorage.getItem(storageKey) || defaultTheme);
      } catch {
        return normalizeTheme(defaultTheme);
      }
    }
    return normalizeTheme(defaultTheme);
  });

  const resolvedTheme = normalizeTheme(forcedTheme || theme);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (attribute === 'class') {
      root.classList.remove('light', 'dark');
      root.classList.add(resolvedTheme);
    } else if (attribute) {
      root.setAttribute(attribute, resolvedTheme);
    }
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'light' ? '#ffffff' : '#030303');
  }, [attribute, resolvedTheme]);

  const setTheme = useCallback(
    (next: string) => {
      if (forcedTheme) return;
      const normalized = normalizeTheme(next);
      setThemeState(normalized);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, normalized);
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
