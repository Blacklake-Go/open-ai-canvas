import React, { Component, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { localizedHref } from '@/lib/client/localeSwitch';

function AdminErrorFallback({ error, reset }: { error: any; reset: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    console.error('[Admin Page Error Caught]:', error);
  }, [error]);

  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center p-6 text-center text-ink">
      <div className="w-full max-w-lg rounded-2xl border border-danger-soft bg-surface/95 p-8 shadow-elevation-4 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-danger-line bg-danger-soft text-danger mb-5">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-ink">后台页面加载异常</h2>
        <p className="mt-2 text-xs text-ink-muted leading-relaxed">
          当前管理功能组件在渲染时遇到未捕获的错误。您可尝试重试，或返回运营概览控制台。
        </p>

        {error?.message && (
          <div className="mt-4 max-h-32 overflow-y-auto rounded-xl border border-line bg-scrim p-3 text-left font-mono text-[11px] text-danger">
            <span className="font-bold text-danger">错误详情:</span> {error.message}
            {error?.digest && (
              <div className="mt-1 text-micro text-ink-subtle">Digest: {error.digest}</div>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="flex items-center gap-2 rounded-xl bg-brand-active px-5 py-2.5 text-xs font-semibold text-ink-on-accent hover:bg-brand transition-all shadow-elevation-2 shadow-brand-soft active:scale-95 cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
            <span>重新加载</span>
          </button>

          <Link
            href={localizedHref('/admin', { pathname })}
            className="flex items-center gap-2 rounded-xl border border-line bg-wash px-4 py-2.5 text-xs font-medium text-ink hover:bg-wash-press hover:text-ink transition-all cursor-pointer"
          >
            <LayoutDashboard className="size-3.5" />
            <span>返回运营概览</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export class AdminErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <AdminErrorFallback
          error={this.state.error}
          reset={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

export default AdminErrorBoundary;
