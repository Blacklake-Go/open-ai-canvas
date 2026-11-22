import React from 'react';
import { Link as RouterLink } from 'react-router';

export interface UrlObject {
  pathname?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  hash?: string;
}

export interface NextLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string | UrlObject;
  as?: string | UrlObject;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  prefetch?: boolean | null;
  locale?: string | false;
  legacyBehavior?: boolean;
}

export function formatHref(href: string | UrlObject | null | undefined): string {
  if (!href) return '#';
  if (typeof href === 'string') return href;
  const pathname = href.pathname || '';
  const searchParams = new URLSearchParams();
  if (href.query) {
    for (const [k, v] of Object.entries(href.query)) {
      if (v !== undefined && v !== null) {
        searchParams.set(k, String(v));
      }
    }
  }
  const qs = searchParams.toString();
  const hash = href.hash ? (href.hash.startsWith('#') ? href.hash : `#${href.hash}`) : '';
  return `${pathname}${qs ? `?${qs}` : ''}${hash}`;
}

function isExternalHref(href: string): boolean {
  return /^(?:https?:\/\/|mailto:|tel:|\/\/|blob:|data:)/i.test(href);
}

const NextLink = React.forwardRef<HTMLAnchorElement, NextLinkProps>(function NextLink(
  {
    href,
    as: _as,
    replace,
    scroll: _scroll,
    shallow: _shallow,
    passHref: _passHref,
    prefetch: _prefetch,
    locale: _locale,
    legacyBehavior: _legacyBehavior,
    target,
    download,
    children,
    ...rest
  },
  ref,
) {
  const resolved = formatHref(href);

  if (isExternalHref(resolved) || target === '_blank' || download !== undefined) {
    return (
      <a ref={ref} href={resolved} target={target} download={download} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink ref={ref} to={resolved} replace={replace} target={target} {...rest}>
      {children}
    </RouterLink>
  );
});

export default NextLink;
