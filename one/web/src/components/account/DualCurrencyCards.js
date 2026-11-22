'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, Check, Crown, Gift, Gem, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function AssetCard({ tone, iconBg, iconColor, icon: Icon, label, badge, description, value, unit, action, onAction, children }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line-subtle bg-surface p-5 shadow-elevation-1 transition-all hover:border-line">
      <div className="flex flex-row items-start justify-between gap-3 pb-3.5">
        <div className="flex items-start gap-3">
          <span className={`flex size-10 items-center justify-center rounded-lg border ${iconBg} ${iconColor}`}>
            <Icon className="size-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-body-sm font-semibold text-ink">
              {label}
              <Badge variant="outline" className={`px-1.5 py-0 text-[10px] ${iconColor} border-current/30 bg-current/10`}>
                {badge}
              </Badge>
            </div>
            <p className="mt-1 text-caption text-ink-muted">{description}</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 cursor-pointer"
          onClick={onAction}
        >
          <span>{action}</span>
          <ArrowUpRight className="size-3.5" />
        </Button>
      </div>
      <div className="pt-1">
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</span>
          <span className="text-caption font-medium text-ink-muted">{unit}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function DualCurrencyCards({
  credits = 0,
  points = 0,
  planName = '基础体验版',
  planId = 'free',
  isPaidSubscription = false,
  currentPeriodEnd = null,
  onOpenRecharge,
  onOpenCheckIn,
  checkedInToday = false,
  className = '',
}) {
  const [signedIn, setSignedIn] = useState(checkedInToday);
  const [pointsBonusAnim, setPointsBonusAnim] = useState(false);

  useEffect(() => {
    setSignedIn(checkedInToday);
  }, [checkedInToday]);

  const signIn = () => {
    if (signedIn) {
      onOpenCheckIn?.();
      return;
    }
    setSignedIn(true);
    setPointsBonusAnim(true);
    window.setTimeout(() => setPointsBonusAnim(false), 1800);
    onOpenCheckIn?.();
  };

  const isPaid = Boolean(isPaidSubscription || (planId && planId !== 'free'));
  const periodEndFormatted = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : null;
  const packageBadge = isPaid
    ? (planName ? `${planName.split(' ')[0]} 专属` : '套餐专属')
    : '套餐专属';

  return (
    <section className={`flex flex-col gap-4 ${className}`}>
      <div className="grid gap-4 md:grid-cols-2">
        <AssetCard
          tone="text-amber-400"
          iconBg="bg-amber-500/10 border-amber-500/25"
          iconColor="text-amber-400"
          icon={Zap}
          label="套餐专属积分"
          badge={packageBadge}
          description="会员套餐专属算力，用于高质量生图、视频与模型推理"
          value={Number(credits).toLocaleString()}
          unit="积分"
          action={isPaid ? '管理套餐' : '升级套餐'}
          onAction={onOpenRecharge}
        >
          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-line-subtle pt-2.5 text-micro text-ink-subtle">
            <span>{isPaid ? `关联套餐：${planName}` : '当前为免费体验版'}</span>
            <span>·</span>
            <span>{isPaid && periodEndFormatted ? `有效期至 ${periodEndFormatted}` : '专属高速 GPU 队列'}</span>
            <span>·</span>
            <span>优先多模型推理</span>
          </div>
        </AssetCard>

        <AssetCard
          tone="text-brand"
          iconBg="bg-brand-soft border-brand-line"
          iconColor="text-brand"
          icon={Gift}
          label="活动与签到积分"
          badge="签到/活动赠送"
          description="每日签到、分享创作与官方活动赠送，可抵扣基础调用"
          value={(Number(points) + (signedIn && !checkedInToday ? 10 : 0)).toLocaleString()}
          unit="积分"
          action={signedIn ? '今日已签到' : '每日签到 +10'}
          onAction={signIn}
        >
          <div className="relative mt-3.5 flex items-center justify-between gap-2 border-t border-line-subtle pt-2.5 text-micro text-ink-subtle">
            <span>每日签到免费领 10 积分 · 当日有效，优先抵扣日常任务</span>
            {pointsBonusAnim && (
              <span className="absolute -top-3 right-1 text-caption font-semibold text-brand animate-fade-in-up">
                +10 积分
              </span>
            )}
          </div>
        </AssetCard>
      </div>

      <div className="rounded-xl border border-line-subtle bg-surface p-4 sm:p-5 shadow-elevation-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg border border-brand-line bg-brand-soft text-brand">
              <Crown className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-body-sm font-semibold text-ink">{planName}</p>
                <Badge variant={isPaid ? 'accent' : 'outline'} className="text-micro">
                  {isPaid ? '订阅生效中' : '免费权益'}
                </Badge>
              </div>
              <p className="mt-1 text-caption text-ink-muted">
                {isPaid
                  ? `当前套餐正在生效中${periodEndFormatted ? `（有效期至 ${periodEndFormatted}）` : ''}，尊享专属极速 GPU 队列与 4K / 8K 超清输出。`
                  : '升级 Pro 会员套餐，解锁专属极速 GPU 队列、每月大额专属积分与 4K / 8K 超清输出。'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="self-start sm:self-auto cursor-pointer"
            onClick={onOpenRecharge}
          >
            {isPaid ? '管理订阅' : '升级会员套餐'}
          </Button>
        </div>
      </div>
    </section>
  );
}

