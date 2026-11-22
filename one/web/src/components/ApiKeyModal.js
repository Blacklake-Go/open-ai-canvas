'use client';

import { useState, useEffect } from 'react';
import { getCommonCopy } from '@/lib/locales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ApiKeyModal({ onSave, onClose, overlay = false, title, subtitle, locale = 'en' }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const copy = getCommonCopy(locale).apiKeyModal;

  useEffect(() => {
    if (!overlay || !onClose) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [overlay, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError(copy.missingKeyError);
      return;
    }
    onSave(trimmed);
  };

  const wrapperClass = overlay
    ? 'fixed inset-0 z-overlay bg-scrim backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in'
    : 'min-h-screen bg-canvas flex items-center justify-center p-4';

  return (
    <div
      className={wrapperClass}
      onClick={(e) => {
        if (overlay && onClose && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-sm bg-overlay border border-line-strong rounded-2xl p-6 sm:p-8 shadow-elevation-4 relative animate-scale-in text-ink">
        {overlay && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="absolute top-4 right-4 size-8 rounded-full text-ink-muted hover:text-ink hover:bg-wash active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard flex items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center border border-brand/20 mb-4 text-brand">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L12 17.25l-4.5-4.5L15.5 7.5z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-ink tracking-tight mb-1.5">
            {title || copy.title}
          </h1>
          <p className="text-ink-muted text-xs leading-relaxed px-2">
            {subtitle || '系统已全面升级为服务端托管与多模型网关模式，无需手动输入自备密钥。'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-ink-muted">
              {copy.label}
            </label>
            <Input
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(''); }}
              placeholder={copy.placeholder}
              error={!!error}
              autoFocus
            />
            {error && <p className="text-red-400 text-xs font-medium pt-0.5">{error}</p>}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full font-semibold"
          >
            {copy.submit}
          </Button>

          <p className="text-center text-xs text-ink-subtle pt-1">
            {copy.needKey}{' '}
            <a href="https://muapi.ai/access-keys" target="_blank" rel="noreferrer" className="text-ink-muted hover:text-brand transition-colors font-medium">
              {copy.getOneFree}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
