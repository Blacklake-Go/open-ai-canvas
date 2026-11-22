'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getAdminBreadcrumbs } from '@/lib/admin/navigation';

const FALLBACK_LABELS = {
  '/admin/forbidden': '无权限访问',
};

export default function AdminBreadcrumbs({ pathname }) {
  const crumbs = getAdminBreadcrumbs(pathname);

  if (!crumbs) {
    const label =
      FALLBACK_LABELS[pathname] ||
      (pathname || '').split('/').filter(Boolean).slice(1).pop() ||
      '未知页面';
    return (
      <nav aria-label="面包屑" className="mb-4 flex items-center gap-1.5 text-xs text-ink-muted">
        <Link href="/admin" className="transition-colors hover:text-brand">
          运营概览
        </Link>
        <ChevronRight className="size-3 text-ink-subtle" aria-hidden />
        <span className="truncate font-medium text-ink">{label}</span>
      </nav>
    );
  }

  return (
    <nav aria-label="面包屑" className="mb-4 flex items-center gap-1.5 text-xs">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        if (isLast || !crumb.href) {
          return (
            <span key={`${crumb.label}-${index}`} className="truncate font-medium text-ink" aria-current={isLast ? 'page' : undefined}>
              {crumb.label}
            </span>
          );
        }
        return (
          <span key={`${crumb.href}-${index}`} className="flex items-center gap-1.5">
            <Link href={crumb.href} className="text-ink-muted transition-colors hover:text-brand">
              {crumb.label}
            </Link>
            <ChevronRight className="size-3 text-ink-subtle" aria-hidden />
          </span>
        );
      })}
    </nav>
  );
}
