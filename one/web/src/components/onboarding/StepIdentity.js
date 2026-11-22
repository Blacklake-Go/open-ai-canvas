'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Camera, Check, Copy, Dice5, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FOCUS_RING } from 'studio/ui/tokens';
import { randomNickname } from '@/lib/onboarding/copy';
import {
  DEFAULT_AVATAR_COUNT,
  NICKNAME_MAX,
  NICKNAME_MIN,
  defaultAvatarAt,
  defaultAvatarUrl,
} from '@/lib/onboarding/schema';
import { cn } from '@/lib/utils';

export default function StepIdentity({
  copy,
  localeCode,
  userNumber,
  initialDisplayName,
  initialAvatarUrl,
  busy,
  onDone,
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName || '');
  const [avatarUrl, setAvatarUrl] = useState(
    initialAvatarUrl || defaultAvatarUrl(userNumber),
  );
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localError, setLocalError] = useState('');
  const fileRef = useRef(null);

  const trimmed = displayName.trim();
  const nicknameOk = trimmed.length >= NICKNAME_MIN && trimmed.length <= NICKNAME_MAX;

  const handleUpload = async (file) => {
    if (!file) return;
    setLocalError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/user/avatar', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.avatarUrl) throw new Error(data.error || copy.errorGeneric);
      setAvatarUrl(data.avatarUrl);
    } catch (err) {
      setLocalError(err?.message || copy.errorGeneric);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(userNumber || ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setLocalError(copy.uidCopyFailed);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-elevation-3 sm:p-7">
      <h1 className="text-page-title">{copy.identityTitle}</h1>
      <p className="mt-1.5 text-body-sm text-ink-muted">{copy.identitySubtitle}</p>

      {/* 数字 ID：终身唯一，先让用户记住它 */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-line-subtle bg-well px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-label text-ink-muted">{copy.uidLabel}</p>
          <p className="mt-0.5 font-mono text-section-title text-brand">#{userNumber || '------'}</p>
        </div>
        <p className="w-full text-caption text-ink-subtle sm:w-auto sm:max-w-56">{copy.uidHint}</p>
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          <span>{copied ? copy.uidCopied : copy.uidCopy}</span>
        </Button>
      </div>

      {/* 头像 */}
      <div className="mt-6">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <img
              src={avatarUrl}
              alt=""
              className="size-20 rounded-full border border-line bg-canvas object-cover"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label={copy.avatarUpload}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-scrim opacity-0 transition-opacity duration-fast ease-standard hover:opacity-100 focus-visible:opacity-100"
            >
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-label">{copy.avatarLabel}</p>
            <p className="mt-0.5 text-caption text-ink-muted">{copy.avatarPickHint}</p>
            <div className="mt-2.5 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-3.5" />
                <span>{uploading ? copy.avatarUploading : copy.avatarUpload}</span>
              </Button>
              <Button variant="tertiary" size="sm" onClick={() => setAvatarUrl(defaultAvatarUrl(userNumber))}>
                <span>{copy.avatarResetDefault}</span>
              </Button>
            </div>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
          onChange={(event) => handleUpload(event.target.files?.[0])}
          className="hidden"
        />

        <div
          role="radiogroup"
          aria-label={copy.avatarLabel}
          className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-8 sm:gap-2"
        >
          {Array.from({ length: DEFAULT_AVATAR_COUNT }, (_, index) => {
            const url = defaultAvatarAt(index);
            const active = avatarUrl === url;
            return (
              <button
                key={url}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setAvatarUrl(url)}
                aria-label={`${copy.avatarLabel} ${index + 1}`}
                className={cn(
                  'relative aspect-square overflow-hidden rounded-full border transition-colors duration-fast ease-standard',
                  FOCUS_RING,
                  active
                    ? 'border-brand ring-2 ring-brand-ring'
                    : 'border-line hover:border-line-strong',
                )}
              >
                <img src={url} alt="" className="size-full object-cover" />
                {active && (
                  <span className="absolute inset-0 flex items-center justify-center bg-scrim">
                    <span className="flex size-5 items-center justify-center rounded-full bg-brand">
                      <Check className="size-3.5 text-ink-on-accent" />
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 昵称 */}
      <div className="mt-6">
        <label className="flex items-center justify-between text-label" htmlFor="onboarding-nickname">
          <span>{copy.nicknameLabel}</span>
          <span className="text-micro text-ink-subtle">
            {trimmed.length}/{NICKNAME_MAX}
          </span>
        </label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input
            id="onboarding-nickname"
            type="text"
            value={displayName}
            maxLength={NICKNAME_MAX}
            autoComplete="nickname"
            onChange={(event) => { setLocalError(''); setDisplayName(event.target.value); }}
            placeholder={copy.nicknamePlaceholder}
            className={cn(
              'h-control-md min-w-40 flex-1 rounded-lg border border-line bg-well px-3 text-body-sm text-ink',
              'placeholder:text-ink-subtle transition-colors duration-fast ease-standard hover:border-line-strong',
              'focus:border-brand',
              FOCUS_RING,
            )}
          />
          <Button
            variant="secondary"
            size="md"
            className="shrink-0 whitespace-nowrap"
            onClick={() => setDisplayName(randomNickname(localeCode))}
          >
            <Dice5 className="size-3.5" />
            <span>{copy.nicknameRandom}</span>
          </Button>
        </div>
        <p className="mt-1.5 text-caption text-ink-subtle">{copy.nicknameHint}</p>
      </div>

      {(localError || (!nicknameOk && trimmed.length > 0)) && (
        <p className="mt-4 text-body-sm text-danger">{localError || copy.nicknameTooShort}</p>
      )}

      <div className="mt-6 flex justify-end">
        <Button
          variant="primary"
          size="lg"
          disabled={busy || uploading || !nicknameOk}
          onClick={() => onDone({ displayName: trimmed, avatarUrl })}
        >
          <span>{copy.next}</span>
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}
