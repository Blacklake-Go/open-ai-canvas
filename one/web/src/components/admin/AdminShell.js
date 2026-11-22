'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import AdminNav from './AdminNav';
import { roleLabel } from '@/lib/admin/permissions';
import { Badge } from '@/components/ui/badge';
import { BrandMark } from '@/components/site/StudioHeader';
import { AdminPermissionsProvider } from './AdminPermissions';

export default function AdminShell({ user, permissions = [], children }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <AdminPermissionsProvider permissions={permissions}>
    <div className="min-h-screen bg-canvas text-white">
      {/* 56px 全局固定顶栏 */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.06] bg-canvas/85 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* 移动端汉堡按钮 */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-subtle bg-white/5 text-ink-muted hover:bg-white/10 lg:hidden focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label="切换侧栏导航"
          >
            {mobileNavOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>

          <BrandMark compact />

          <span className="rounded-full border border-line-subtle bg-white/[0.04] px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
            运营管理端
          </span>
        </div>

        <div className="flex items-center gap-2.5 text-xs">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-emerald-400 sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            系统在线
          </span>

          <Badge variant="accent" className="text-[11px] font-medium">
            {roleLabel(user?.role)}
          </Badge>

          <span className="hidden rounded-lg border border-line-subtle bg-white/[0.03] px-2.5 py-1 text-ink-muted md:inline font-mono text-[11px]">
            {user?.email}
          </span>

          <Link
            href="/"
            prefetch={false}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-line-subtle bg-white/[0.03] px-3 text-xs font-medium text-ink-muted transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            返回主页
          </Link>

          <Link
            href="/account"
            prefetch={false}
            className="inline-flex h-8 items-center justify-center rounded-md border border-line-subtle bg-white/[0.03] px-3 text-xs font-medium text-ink-muted transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            账户
          </Link>
        </div>
      </header>

      {/* 桌面端 220px 展开侧栏 */}
      <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-[220px] overflow-y-auto border-r border-white/[0.06] bg-base px-2.5 py-4 admin-sidebar-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] lg:block">
        <AdminNav user={user} />
      </aside>

      {/* 移动端侧栏抽屉 */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="fixed bottom-0 left-0 top-14 w-[240px] overflow-y-auto border-r border-white/[0.08] bg-base px-3 py-5 shadow-2xl admin-sidebar-scrollbar scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <AdminNav user={user} onItemClick={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      {/* 主画布区域 */}
      <main className="min-h-screen pt-14 lg:pl-[220px]">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
    </AdminPermissionsProvider>
  );
}
