import React, { Component, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { localizedHref } from '@/lib/client/localeSwitch';

function ErrorFallbackUI({ error, reset }: { error: any; reset: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    console.error('[Page Error Caught]:', error);

    if (typeof window !== 'undefined') {
      const lastAttempt = sessionStorage.getItem('supdance_page_error_retry');
      const now = Date.now();
      if (!lastAttempt || now - Number(lastAttempt) > 10000) {
        sessionStorage.setItem('supdance_page_error_retry', String(now));
        try {
          reset();
        } catch {
          window.location.reload();
        }
      }
    }
  }, [error, reset]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121215]/90 p-8 shadow-2xl backdrop-blur-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 mb-4">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h2 className="text-lg font-bold tracking-tight text-white">页面遇到临时运行波动</h2>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          正在为您快速自愈并保持会话。若未自动恢复，请点击下方按钮重新加载。
        </p>

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
            className="rounded-xl bg-cyan-400 px-5 py-2 text-xs font-semibold text-black hover:bg-cyan-300 transition-colors shadow-sm active:scale-95"
          >
            重新加载页面
          </button>
          <a
            href={localizedHref('/studio', { pathname })}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            返回工作室
          </a>
        </div>
      </div>
    </div>
  );
}

export class RootErrorBoundary extends Component<
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
        <ErrorFallbackUI
          error={this.state.error}
          reset={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

export default RootErrorBoundary;
