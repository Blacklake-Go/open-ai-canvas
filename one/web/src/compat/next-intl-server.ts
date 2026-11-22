import { DEFAULT_LOCALE, getCommonCopy, normalizeLocale } from '@/lib/locales';

export async function getLocale(): Promise<string> {
  if (typeof document !== 'undefined') {
    const htmlLang = document.documentElement.lang;
    if (htmlLang) return normalizeLocale(htmlLang);
  }
  return DEFAULT_LOCALE;
}

export async function getMessages(opts?: { locale?: string }) {
  const locale = normalizeLocale(opts?.locale || (await getLocale()));
  return getCommonCopy(locale);
}

export async function getTranslations(namespaceOrOpts?: string | { locale?: string; namespace?: string }) {
  const namespace =
    typeof namespaceOrOpts === 'string' ? namespaceOrOpts : namespaceOrOpts?.namespace;
  const locale =
    typeof namespaceOrOpts === 'object' && namespaceOrOpts?.locale
      ? normalizeLocale(namespaceOrOpts.locale)
      : await getLocale();
  const messages = getCommonCopy(locale);
  const resolve = (obj: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  const base = namespace ? resolve(messages, namespace) : messages;
  return (key: string, values?: Record<string, string | number>) => {
    const raw = resolve(base, key);
    if (typeof raw !== 'string') return namespace ? `${namespace}.${key}` : key;
    if (!values) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, k) =>
      k in values ? String(values[k]) : `{${k}}`,
    );
  };
}

export function getRequestConfig<T>(factory: (params?: { requestLocale?: Promise<string | undefined> }) => T | Promise<T>) {
  return factory;
}
