'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Coins,
  Gift,
  Loader2,
  X,
} from 'lucide-react';
import { useBranding } from '@/lib/hooks/useBranding';
import BrandLogo from '@/components/site/BrandLogo';

const CHECKIN_REWARD = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function getJoinedDays(createdAt) {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const start = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const today = new Date();
  const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(1, Math.floor((currentDay.getTime() - start.getTime()) / DAY_MS) + 1);
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getCreditExpiry(entitlements, wallet) {
  const buckets = entitlements?.creditBuckets || wallet || {};
  const now = Date.now();
  const candidates = [
    { value: buckets.dailyExpiresAt, amount: Number(buckets.dailyFree || 0) },
    { value: buckets.subscriptionExpiresAt, amount: Number(buckets.subscriptionCredits || 0) },
    { value: entitlements?.currentPeriodEnd, amount: entitlements?.isPaidSubscription ? 1 : 0 },
  ]
    .filter(({ value, amount }) => value && amount > 0)
    .map(({ value }) => ({ value, timestamp: new Date(value).getTime() }))
    .filter(({ timestamp }) => Number.isFinite(timestamp) && timestamp > now)
    .sort((a, b) => a.timestamp - b.timestamp);
  return formatDate(candidates[0]?.value) || '永久有效';
}

export default function LoginSuccessOverlay({ user, onComplete }) {
  const { brand } = useBranding();
  const [snapshot, setSnapshot] = useState({ user, entitlements: null, wallet: null });
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [authResponse, walletResponse] = await Promise.all([
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/financial/credits/wallet', { cache: 'no-store' }),
      ]);
      const authData = authResponse.ok ? await authResponse.json() : null;
      const walletData = walletResponse.ok ? await walletResponse.json() : null;
      setSnapshot({
        user: authData?.user || user,
        entitlements: authData?.entitlements || null,
        wallet: walletData?.wallet || authData?.user?.creditBuckets || null,
      });
    } catch {
      setSnapshot((current) => ({ ...current, user: current.user || user }));
      setError('账户数据暂时未同步，进入创作后可在个人中心查看。');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const currentUser = snapshot.user || user || {};
  const displayName = currentUser.displayName || currentUser.display_name || currentUser.name || '创作者';
  const joinedDays = getJoinedDays(currentUser.createdAt || currentUser.created_at);
  const credits = snapshot.entitlements?.credits ?? snapshot.wallet?.totalAvailable ?? currentUser.credits;
  const isCheckedIn = Boolean(snapshot.wallet?.isCheckedInToday);
  const expiryDate = useMemo(
    () => getCreditExpiry(snapshot.entitlements, snapshot.wallet),
    [snapshot.entitlements, snapshot.wallet],
  );
  const brandName = brand?.brandName || 'supdance';

  const handleCheckIn = async () => {
    if (checkingIn || isCheckedIn) return;
    setCheckingIn(true);
    setFeedback('');
    setError('');
    try {
      const response = await fetch('/api/financial/credits/checkin', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '签到失败，请稍后重试');
      setFeedback(data.message || `签到成功，已领取 ${data.rewardCredits || CHECKIN_REWARD} 积分`);
      await loadSnapshot();
    } catch (checkinError) {
      setError(checkinError.message || '签到失败，请稍后重试');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleContinue = () => onComplete?.(snapshot);

  return (
    <div className="fixed inset-0 z-toast flex items-center justify-center bg-scrim px-4 py-6 backdrop-blur-xl transition-opacity duration-base ease-enter animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="login-welcome-title">
      <div className="relative w-full max-w-[480px] overflow-hidden rounded-2xl border border-line-strong bg-overlay p-6 sm:p-8 shadow-elevation-4 animate-scale-in text-ink">
        <button type="button" onClick={handleContinue} aria-label="关闭欢迎面板" className="absolute right-5 top-5 flex size-8 items-center justify-center rounded-full text-ink-muted transition-[background-color,color,transform] duration-fast ease-standard hover:bg-wash hover:text-ink active:scale-95 active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring">
          <X className="size-4" />
        </button>

        <div className="pr-8">
          <div className="mb-5 flex items-center">
            <BrandLogo brand={brand} className="inline-flex items-center gap-2.5" />
          </div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-400">
            <CheckCircle2 className="size-4" />
            <span>登录成功</span>
          </div>
          <p className="mb-2 text-sm font-medium text-brand">欢迎回来，{displayName}</p>
          <h2 id="login-welcome-title" className="text-[28px] font-semibold tracking-tight text-ink sm:text-[32px]">今天也来创作点什么吧</h2>
          <p className="mt-3 max-w-[38ch] text-sm leading-6 text-ink-muted">{joinedDays ? `这是你加入 ${brandName} 创作的第 ${joinedDays} 天。` : `欢迎继续你的 ${brandName} 创作。`}</p>
        </div>

        <div className="mt-7 overflow-hidden rounded-xl border border-line bg-well">
          <div className="flex items-center justify-between gap-4 border-b border-line-subtle px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><Coins className="size-[18px]" /></div>
              <div className="min-w-0"><p className="text-sm text-ink">当前剩余积分</p><p className="mt-1 text-xs text-ink-subtle">可用于图像、视频与其他创作任务</p></div>
            </div>
            <span className="shrink-0 text-xl font-semibold tabular-nums text-ink">{loading ? <Loader2 className="size-5 animate-spin text-ink-muted" /> : credits == null ? '—' : Number(credits).toLocaleString('zh-CN')}</span>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-wash text-ink"><CalendarDays className="size-[18px]" /></div>
              <div className="min-w-0"><p className="text-sm text-ink">积分到期时间</p><p className="mt-1 text-xs text-ink-subtle">到期后未使用的周期积分将不再保留</p></div>
            </div>
            <span className="shrink-0 text-sm font-medium text-ink">{loading ? '同步中…' : expiryDate}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-10 text-xs leading-5">
            {feedback ? <span className="inline-flex items-center gap-1.5 text-emerald-400"><Check className="size-3.5" />{feedback}</span> : error ? <span className="text-amber-400">{error}</span> : <span className="text-ink-subtle">每日签到可领取 {CHECKIN_REWARD} 积分</span>}
          </div>
          <button type="button" onClick={handleCheckIn} disabled={loading || checkingIn || isCheckedIn} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-line bg-brand-soft px-5 text-sm font-semibold text-brand transition-[background-color,border-color,transform] duration-fast ease-standard hover:bg-brand-pressed active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring disabled:cursor-not-allowed disabled:border-line disabled:bg-wash disabled:text-ink-disabled">
            {checkingIn ? <Loader2 className="size-4 animate-spin" /> : isCheckedIn ? <Check className="size-4" /> : <Gift className="size-4" />}{isCheckedIn ? '今日已签到' : `签到领取 +${CHECKIN_REWARD}`}
          </button>
        </div>

        <button type="button" onClick={handleContinue} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-ink-on-accent transition-[background-color,transform] duration-fast ease-standard hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"><span>进入创作</span><ArrowRight className="size-4" /></button>
      </div>
    </div>
  );
}
