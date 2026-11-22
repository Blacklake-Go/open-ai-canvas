import { useMemo } from 'react';
import {
  useLocation,
  useNavigate,
  useParams as useRRParams,
  useSearchParams as useRRSearchParams,
} from 'react-router';

export class RedirectError extends Error {
  url: string;
  constructor(url: string) {
    super(`NEXT_REDIRECT:${url}`);
    this.name = 'RedirectError';
    this.url = url;
  }
}

export class NotFoundError extends Error {
  constructor() {
    super('NEXT_NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

function useSafeLocation() {
  try {
    return useLocation();
  } catch {
    if (typeof window !== 'undefined') {
      return {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        state: null,
        key: 'default',
      };
    }
    return { pathname: '/', search: '', hash: '', state: null, key: 'default' };
  }
}

export function usePathname(): string {
  return useSafeLocation().pathname;
}

export function useSearchParams(): URLSearchParams {
  try {
    const [params] = useRRSearchParams();
    return params;
  } catch {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  }
}

export function useParams<T extends Record<string, string | string[] | undefined> = Record<string, string | string[] | undefined>>(): T {
  let raw: Record<string, string | undefined> = {};
  try {
    raw = useRRParams();
  } catch {
    raw = {};
  }

  return useMemo(() => {
    const out: Record<string, string | string[] | undefined> = { ...raw };
    if (typeof raw['*'] === 'string' && out.slug === undefined) {
      out.slug = raw['*'].split('/').filter(Boolean);
    }
    return out as T;
  }, [raw]);
}

export function useRouter() {
  let navigateFn: ReturnType<typeof useNavigate> | null = null;
  try {
    navigateFn = useNavigate();
  } catch {
    navigateFn = null;
  }

  return useMemo(
    () => ({
      push(href: string, _options?: { scroll?: boolean }) {
        if (/^(?:https?:\/\/|mailto:|tel:|\/\/)/i.test(href)) {
          if (typeof window !== 'undefined') window.location.href = href;
          return;
        }
        if (navigateFn) {
          navigateFn(href);
        } else if (typeof window !== 'undefined') {
          window.history.pushState({}, '', href);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      },
      replace(href: string, _options?: { scroll?: boolean }) {
        if (/^(?:https?:\/\/|mailto:|tel:|\/\/)/i.test(href)) {
          if (typeof window !== 'undefined') window.location.replace(href);
          return;
        }
        if (navigateFn) {
          navigateFn(href, { replace: true });
        } else if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', href);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      },
      back() {
        if (navigateFn) navigateFn(-1);
        else if (typeof window !== 'undefined') window.history.back();
      },
      forward() {
        if (navigateFn) navigateFn(1);
        else if (typeof window !== 'undefined') window.history.forward();
      },
      refresh() {
        if (typeof window !== 'undefined') {
          const ev = new CustomEvent('supdance:router-refresh', { cancelable: true });
          window.dispatchEvent(ev);
          if (!ev.defaultPrevented) {
            if (navigateFn) navigateFn(0);
            else window.location.reload();
          }
        }
      },
      prefetch(_href: string) {
        return Promise.resolve();
      },
    }),
    [navigateFn],
  );
}

export function redirect(url: string): never {
  if (typeof window !== 'undefined') {
    window.location.replace(url);
  }
  throw new RedirectError(url);
}

export function permanentRedirect(url: string): never {
  return redirect(url);
}

export function notFound(): never {
  throw new NotFoundError();
}
