import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { oneApi } from '@/services/api/http';

const publicationEvent = 'supdance-subscription-faq-published';
const queryKey = (locale: string) => ['subscription-faq', locale] as const;

export function notifySubscriptionFAQPublished(locale: string) {
  window.dispatchEvent(new CustomEvent(publicationEvent, { detail: locale }));
  try {
    localStorage.setItem(publicationEvent, JSON.stringify({ locale, tick: Date.now() }));
  } catch {}
}

export function useSubscriptionFAQ(locale: string, enabled = true) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKey(locale) });
    function onPublish(event: Event) {
      if ((event as CustomEvent<string>).detail === locale) refresh();
    }
    function onStorage(event: StorageEvent) {
      if (event.key !== publicationEvent || !event.newValue) return;
      try {
        if (JSON.parse(event.newValue).locale === locale) refresh();
      } catch {}
    }
    window.addEventListener(publicationEvent, onPublish);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(publicationEvent, onPublish);
      window.removeEventListener('storage', onStorage);
    };
  }, [enabled, locale, queryClient]);
  return useQuery({
    queryKey: queryKey(locale),
    queryFn: ({ signal }) => oneApi.getSubscriptionFAQ(locale, signal),
    enabled,
  });
}
