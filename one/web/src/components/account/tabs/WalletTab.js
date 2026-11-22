'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, Gift, Plus, Sparkles, Zap } from 'lucide-react';
import DualCurrencyCards from '../DualCurrencyCards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WalletTab({
  credits = 0,
  points = 0,
  planName = '基础体验版',
  planId = 'free',
  isPaidSubscription = false,
  currentPeriodEnd = null,
  onOpenRecharge,
  onOpenCheckIn,
}) {
  const [filter, setFilter] = useState('all');
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadLedger() {
      try {
        const res = await fetch('/api/financial/credits/ledger');
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.ledger) {
            setLedger(data.ledger);
          }
        }
      } catch (err) {
        console.error('加载积分账本失败:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadLedger();
    return () => { mounted = false; };
  }, []);

  // 判断用户今日是否已有签到流水
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const checkedInToday = ledger.some(
    (item) => (item.title?.includes('签到') || item.type === 'checkin') &&
              (item.time?.includes(todayStr) || item.time?.includes(new Date().toLocaleDateString()))
  );

  const filtered = ledger.filter(
    (item) => filter === 'all' || (filter === 'recharge' ? item.type !== 'task' : item.type === 'task')
  );

  return (
    <div className="flex flex-col gap-6 w-full text-ink">
      <div>
        <h1 className="text-page-title font-bold tracking-tight text-ink">你的创作额度</h1>
        <p className="mt-1 text-xs text-ink-muted">统一管理套餐专属积分、签到活动赠送与会员权益，保障高并发创作无阻。</p>
      </div>

      <DualCurrencyCards
        credits={credits}
        points={points}
        planName={planName}
        planId={planId}
        isPaidSubscription={isPaidSubscription}
        currentPeriodEnd={currentPeriodEnd}
        onOpenRecharge={onOpenRecharge}
        onOpenCheckIn={onOpenCheckIn}
        checkedInToday={checkedInToday}
      />

      <Card className="rounded-xl border border-line-subtle bg-surface shadow-elevation-1 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-line-subtle p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-card-title font-semibold text-ink">资产变动明细</h3>
            <p className="mt-0.5 text-xs text-ink-muted">充值、任务消耗与系统奖励均实时透明记录。</p>
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="h-7 text-caption">全部</TabsTrigger>
              <TabsTrigger value="recharge" className="h-7 text-caption">收入与到账</TabsTrigger>
              <TabsTrigger value="consume" className="h-7 text-caption">任务消耗</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-caption text-ink-muted">正在同步账本明细…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center justify-center">
              <p className="text-body-sm font-medium text-ink">暂无资产变动记录</p>
              <p className="text-caption text-ink-muted mt-1">您完成每日签到、模型生成或算力充值后，变动流水将实时展示于此处。</p>
            </div>
          ) : (
            <div className="divide-y divide-line-subtle">
              {filtered.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-wash transition-colors">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg border text-caption font-semibold ${
                        item.type === 'task'
                          ? 'border-line-subtle bg-well text-ink-muted'
                          : 'border-brand-line bg-brand-soft text-brand'
                      }`}
                    >
                      {item.type === 'task' ? '扣' : '增'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-medium text-ink">{item.title}</p>
                      <p className="mt-0.5 truncate text-caption text-ink-muted">{item.time}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-body-sm font-semibold tabular-nums ${
                        item.delta.startsWith('+') ? 'text-brand' : 'text-ink'
                      }`}
                    >
                      {item.delta}
                    </p>
                    <p className="text-micro text-ink-subtle font-mono mt-0.5">余额: {item.balanceAfter}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

