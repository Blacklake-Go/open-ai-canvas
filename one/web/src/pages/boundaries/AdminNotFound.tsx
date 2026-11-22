import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';

export default function AdminNotFound() {
  return (
    <div className="flex min-h-96 items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-line bg-base p-8 text-center shadow-elevation-4 backdrop-blur-md">
        <div className="mx-auto flex size-14 items-center justify-center rounded-xl border border-brand-line bg-brand-soft text-brand">
          <Compass className="size-7" />
        </div>
        <p className="mt-5 text-caption font-semibold uppercase tracking-widest text-brand">
          404 · 页面不存在
        </p>
        <h1 className="mt-2 text-section-title text-ink">后台没有这个地址对应的页面</h1>
        <p className="mt-2.5 text-body-sm leading-6 text-ink-muted">
          链接可能已随业务域调整而迁移。请从左侧菜单重新进入，或返回运营概览。
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/admin"
            className="inline-flex h-control-md items-center gap-1.5 rounded-lg bg-brand px-4 text-label font-semibold text-ink-on-accent transition-colors duration-base hover:bg-brand-hover active:scale-95"
          >
            <ArrowLeft className="size-3.5" />
            返回运营概览
          </Link>
        </div>
      </div>
    </div>
  );
}
