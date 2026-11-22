'use client';

import { useCallback, useState } from 'react';
import { Check, SkipForward } from 'lucide-react';
import { BrandMark } from '@/components/site/StudioHeader';
import { Button } from '@/components/ui/button';
import { getCommonCopy, getLocaleConfig, normalizeLocale } from '@/lib/locales';
import { ONBOARDING_REWARD_CREDITS } from '@/lib/onboarding/schema';
import { cn } from '@/lib/utils';
import StepIdentity from './StepIdentity';
import StepPreference from './StepPreference';
import RewardBanner from './RewardBanner';
import RewardReceived from './RewardReceived';

const TOTAL_STEPS = 2;

// API 的 error 字段是服务端中文，页面只认 code，其余语言从这里取。
const ERROR_KEYS = {
  UNAUTHORIZED: 'errUnauthorized',
  ONBOARDING_INVALID_NICKNAME: 'errNickname',
  ONBOARDING_INVALID_ANSWERS: 'errAnswers',
  ONBOARDING_INVALID_AVATAR: 'errAvatar',
  ONBOARDING_FIELD_TOO_LONG: 'errFieldTooLong',
};

export default function OnboardingFlow({ initialStep = 1, initialUser, studioHref }) {
  const locale = normalizeLocale(initialUser?.locale || 'en');
  // 注册表规范码：选项文案只认它，组件内部不再自己猜「这是哪种中文」。
  const localeCode = getLocaleConfig(locale).code;
  const copy = getCommonCopy(locale).onboarding;
  const [step, setStep] = useState(initialStep);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rewarded, setRewarded] = useState(0);
  const [identity, setIdentity] = useState({
    displayName: initialUser?.displayName || '',
    avatarUrl: initialUser?.avatarUrl || '',
  });

  const localize = (data) => copy[ERROR_KEYS[data?.code]] || data?.error || copy.errorGeneric;

  const run = useCallback(async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      return true;
    } catch (err) {
      setError(err?.message || copy.errorGeneric);
      return false;
    } finally {
      setBusy(false);
    }
  }, [copy.errorGeneric]);

  const handleIdentityDone = (next) =>
    run(async () => {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 1, displayName: next.displayName, avatarUrl: next.avatarUrl || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(localize(data));
      setIdentity(next);
      setStep(2);
    });

  const handlePreferenceDone = (answers) =>
    run(async () => {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 2, answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(localize(data));
      setRewarded(Number(data?.data?.rewardCredits ?? ONBOARDING_REWARD_CREDITS));
    });

  const handleSkip = () =>
    run(async () => {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 2, skip: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(localize(data));
      window.location.href = studioHref;
    });

  const enterStudio = () => {
    setBusy(true);
    window.location.href = studioHref;
  };

  const done = rewarded > 0;

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 xs:px-6 sm:py-10">
        <header className="flex items-center justify-between gap-4">
          <BrandMark compact />
          <div className="flex items-center gap-3">
            {!done && (
              <Button variant="outline" size="md" disabled={busy} onClick={handleSkip}>
                <SkipForward className="size-4" />
                <span>{busy ? copy.saving : copy.skip}</span>
              </Button>
            )}
            <span className="text-caption text-ink-subtle">
              {copy.progress.replace('{current}', String(done ? TOTAL_STEPS : step)).replace('{total}', String(TOTAL_STEPS))}
            </span>
          </div>
        </header>

        <div className="mt-6 flex items-center gap-3" aria-hidden="true">
          {[1, 2].map((index) => (
            <div
              key={index}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-slow ease-standard',
                (done ? TOTAL_STEPS : step) >= index ? 'bg-brand' : 'bg-line',
              )}
            />
          ))}
        </div>

        <div className="mt-2 flex items-center gap-2">
          {[
            { index: 1, label: copy.stepIdentity },
            { index: 2, label: copy.stepPreference },
          ].map(({ index, label }) => (
            <span
              key={index}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-micro',
                (done ? TOTAL_STEPS + 1 : step) === index
                  ? 'border-brand-line bg-brand-soft text-brand'
                  : 'border-line bg-transparent text-ink-subtle',
              )}
            >
              {(done || step > index) ? <Check className="size-3" /> : <span className="font-mono">{index}</span>}
              <span>{label}</span>
            </span>
          ))}
        </div>

        <div className="mt-5 flex-1">
          {done ? (
            <RewardReceived copy={copy} credits={rewarded} onEnter={enterStudio} />
          ) : (
            <>
              <RewardBanner copy={copy} credits={ONBOARDING_REWARD_CREDITS} />
              <div className="mt-4">
                {step === 1 ? (
                  <StepIdentity
                    copy={copy}
                    localeCode={localeCode}
                    userNumber={initialUser?.userNumber}
                    initialDisplayName={identity.displayName}
                    initialAvatarUrl={identity.avatarUrl}
                    busy={busy}
                    onDone={handleIdentityDone}
                  />
                ) : (
                  <StepPreference
                    copy={copy}
                    localeCode={localeCode}
                    busy={busy}
                    credits={ONBOARDING_REWARD_CREDITS}
                    onBack={() => { setError(''); setStep(1); }}
                    onSkip={handleSkip}
                    onSubmit={handlePreferenceDone}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-danger-line bg-danger-soft px-4 py-2.5 text-body-sm text-danger">
            {error}
          </p>
        )}

        {/* 返回只在卡片里给一次：这里再放一个就会出现两个「上一步」。 */}
        {!done && (
          <footer className="mt-6 border-t border-line-subtle pt-5">
            <p className="text-caption text-ink-subtle">{copy.privacyNote}</p>
          </footer>
        )}
      </div>
    </main>
  );
}
