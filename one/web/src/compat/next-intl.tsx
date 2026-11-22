import React, { createContext, useContext } from 'react';
import { DEFAULT_LOCALE, getCommonCopy, normalizeLocale } from '@/lib/locales';

interface IntlContextValue {
  locale: string;
  messages: Record<string, unknown>;
}

const IntlContext = createContext<IntlContextValue>({
  locale: DEFAULT_LOCALE,
  messages: getCommonCopy(DEFAULT_LOCALE),
});

export function NextIntlClientProvider({
  locale = DEFAULT_LOCALE,
  messages,
  children,
}: {
  locale?: string;
  messages?: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const normalized = normalizeLocale(locale);
  const resolvedMessages = messages || getCommonCopy(normalized);
  return (
    <IntlContext.Provider value={{ locale: normalized, messages: resolvedMessages }}>
      {children}
    </IntlContext.Provider>
  );
}

export function useLocale(): string {
  return useContext(IntlContext).locale;
}

export function useMessages(): Record<string, unknown> {
  return useContext(IntlContext).messages;
}

function getByPath(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

export function useTranslations(namespace?: string) {
  const { messages } = useContext(IntlContext);
  const base = namespace ? getByPath(messages, namespace) : messages;
  return (key: string, values?: Record<string, string | number>) => {
    const raw = getByPath(base, key);
    if (typeof raw !== 'string') return namespace ? `${namespace}.${key}` : key;
    if (!values) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, k) =>
      k in values ? String(values[k]) : `{${k}}`,
    );
  };
}
