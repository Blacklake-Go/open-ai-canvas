'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Clapperboard,
  Cpu,
  Megaphone,
  Plug2,
  Wallet,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { hasPermission } from '@/lib/admin/permissions';
import { ADMIN_NAV_GROUPS, isItemActive } from '@/lib/admin/navigation';

const NAV_ICONS = {
  LayoutDashboard,
  Users,
  CreditCard,
  Clapperboard,
  Cpu,
  Megaphone,
  Plug2,
  Wallet,
  Shield,
};

export default function AdminNav({ user, onItemClick }) {
  const pathname = usePathname();
  const role = user?.role || 'user';
  const active = (item) => isItemActive(item, pathname);

  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    if (!pathname) return initial;
    for (const group of ADMIN_NAV_GROUPS) {
      if (group.items.some((item) => hasPermission(role, item.permission) && active(item))) {
        initial[group.id] = true;
      }
    }
    return initial;
  });

  useEffect(() => {
    if (!pathname) return;
    const next = {};
    for (const group of ADMIN_NAV_GROUPS) {
      if (group.items.some((item) => hasPermission(role, item.permission) && active(item))) next[group.id] = true;
    }
    if (Object.keys(next).length) setOpenGroups((prev) => ({ ...prev, ...next }));
  }, [pathname, role]);

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <nav aria-label="管理后台导航" className="space-y-1.5">
      {ADMIN_NAV_GROUPS.map((group) => {
        const IconComponent = NAV_ICONS[group.icon] || LayoutDashboard;
        const visibleItems = group.items.filter((item) => hasPermission(role, item.permission));
        if (!visibleItems.length) return null;

        const hasChildren = visibleItems.length > 1;
        const singleItem = !hasChildren ? visibleItems[0] : null;
        const hasActiveChild = visibleItems.some(active);
        const isOpen = !!openGroups[group.id];
        const defaultHref = visibleItems[0].href;

        if (singleItem) {
          return (
            <div key={group.id}>
              <Link
                href={singleItem.href}
                prefetch={false}
                onClick={onItemClick}
                className={`group relative flex h-[38px] items-center justify-between rounded-lg px-3 text-xs font-medium tracking-[-0.005em] transition-all duration-150 active:scale-[0.98] ${
                  active(singleItem)
                    ? 'bg-brand/10 text-brand font-semibold'
                    : 'text-ink-muted hover:bg-white/[0.05] hover:text-ink'
                }`}
              >
                {active(singleItem) && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand" />
                )}
                <div className="flex items-center gap-2.5 truncate">
                  <IconComponent
                    className={`size-4 transition-colors ${
                      active(singleItem) ? 'text-brand' : 'text-ink-muted group-hover:text-ink'
                    }`}
                  />
                  <span className="truncate">{group.label}</span>
                </div>
              </Link>
            </div>
          );
        }

        return (
          <div key={group.id} className="rounded-lg transition-colors">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className={`group relative flex h-[38px] w-full items-center justify-between rounded-lg pl-3 pr-2.5 text-xs font-medium tracking-[-0.005em] transition-all duration-150 cursor-pointer ${
                hasActiveChild
                  ? 'bg-white/[0.04] text-ink'
                  : 'text-ink-muted hover:bg-white/[0.05] hover:text-ink'
              }`}
            >
              <div className="flex flex-1 h-full items-center gap-2.5 truncate py-2 text-left">
                <IconComponent
                  className={`size-4 shrink-0 transition-colors ${
                    hasActiveChild ? 'text-brand' : 'text-ink-muted group-hover:text-ink'
                  }`}
                />
                <span className={`truncate ${hasActiveChild ? 'font-semibold text-ink' : ''}`}>
                  {group.label}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {hasActiveChild && !isOpen && (
                  <span className="size-1.5 rounded-full bg-brand" />
                )}
                <ChevronDown
                  className={`size-3.5 transition-transform duration-200 ease-out text-ink-subtle ${
                    isOpen ? 'rotate-180 text-brand' : 'group-hover:text-ink'
                  }`}
                />
              </div>
            </button>

            <div
              className={`grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out ${
                isOpen ? 'grid-rows-[1fr] opacity-100 visible' : 'grid-rows-[0fr] opacity-0 invisible pointer-events-none'
              }`}
            >
              <div className="overflow-hidden">
                <div className="relative mt-1 ml-4 space-y-1 pl-3 border-l border-line-subtle pb-1">
                  {visibleItems.map((item) => {
                    const itemActive = active(item);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        prefetch={false}
                        onClick={onItemClick}
                        className={`group relative flex h-8 items-center rounded-lg px-2.5 text-xs tracking-[-0.005em] transition-all duration-150 active:scale-[0.98] ${
                          itemActive
                            ? 'bg-brand/10 text-brand font-semibold'
                            : 'text-ink-muted hover:bg-white/[0.05] hover:text-ink'
                        }`}
                      >
                        {itemActive && (
                          <span className="absolute -left-[13px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand" />
                        )}
                        <span
                          className={`mr-2 size-1 rounded-full transition-all duration-150 ${
                            itemActive
                              ? 'bg-brand'
                              : 'bg-white/20 group-hover:bg-white/50'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

