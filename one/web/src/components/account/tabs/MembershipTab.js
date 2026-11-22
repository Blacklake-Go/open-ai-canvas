'use client';

import React, { useState, useEffect } from 'react';
import {
  Crown,
  ArrowRight,
  Loader2,
  RefreshCw,
  Copy,
  CheckCircle2,
  Plus,
  Receipt,
  BarChart2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SubscriptionModal from '@/components/subscription/SubscriptionModal';
import RechargeModal from '@/components/account/RechargeModal';

export default function MembershipTab({
  onOpenRecharge,
  onRefreshUser,
  user = null,
  onOpenAuth = null,
  onNavigateTab = null,
}) {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [entitlements, setEntitlements] = useState(null);
  const [orders, setOrders] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  // 弹窗状态
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);

  // 加载订阅与订单记录
  const loadData = async () => {
    try {
      setLoading(true);
      const [subRes, ordersRes] = await Promise.all([
        fetch('/api/billing/subscription', { cache: 'no-store' }).catch(() => ({ ok: false })),
        fetch('/api/billing/orders/my', { cache: 'no-store' }).catch(() => ({ ok: false })),
      ]);

      if (subRes.ok) {
        const sData = await subRes.json();
        setSubscription(sData.subscription || null);
        setEntitlements(sData.entitlements || null);
      }

      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setOrders(Array.isArray(oData.orders) ? oData.orders : []);
      }
    } catch (err) {
      console.error('加载订阅与账单数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (id) => {
    if (!id) return;
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1. 订阅基础信息计算
  const currentPlanId =
    entitlements?.planId ||
    (subscription && ['active', 'trialing'].includes(subscription.status) ? subscription.plan_id : 'free');
  const isPaid = currentPlanId && currentPlanId !== 'free';
  const planName = entitlements?.planName || (isPaid ? 'Starter (入门探索版)' : '基础体验版 (FREE)');

  const cycle =
    subscription?.billing_cycle ||
    (subscription?.plan_id?.includes('year')
      ? 'yearly'
      : subscription?.plan_id?.includes('quarter')
      ? 'quarterly'
      : 'monthly');
  const cycleText = isPaid
    ? cycle === 'yearly'
      ? '按年结算 (超值特惠)'
      : cycle === 'quarterly'
      ? '按季结算 (优惠折扣)'
      : '按月结算'
    : '永久基础';

  let remainingDaysText = '';
  if (isPaid && subscription?.current_period_end) {
    const diffMs = new Date(subscription.current_period_end).getTime() - Date.now();
    const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    remainingDaysText = ` (剩余 ${days} 天)`;
  }

  const periodEnd = subscription?.current_period_end
    ? `${new Date(subscription.current_period_end).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })}${remainingDaysText}`
    : isPaid
    ? '有效运作中'
    : '永久有效';

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200 text-ink select-none">
      {/* 1. 顶部操作栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">
              MEMBERSHIP & BILLING
            </span>
            <Badge variant="accent" className="text-[10px] py-0 px-2">
              {isPaid ? 'VIP 会员生效中' : '基础免费版'}
            </Badge>
          </div>
          <h1 className="mt-1 text-page-title font-bold tracking-tight text-ink flex items-center gap-2.5">
            <span>订阅与账单</span>
            <button
              type="button"
              onClick={loadData}
              title="刷新数据"
              className="text-ink-subtle hover:text-ink transition-colors cursor-pointer"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </h1>
          <p className="mt-1 text-caption text-ink-muted">
            管理您的当前会员方案、并发特权与充值账单记录。
          </p>
        </div>

        {/* 快捷操作区：开通升级 / 加购算力 */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              if (onOpenRecharge) onOpenRecharge();
              else setIsRechargeModalOpen(true);
            }}
            className="gap-1.5 cursor-pointer font-medium"
          >
            <Plus className="size-4 text-brand" />
            <span>加购算力包</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setIsSubModalOpen(true)}
            className="gap-2 cursor-pointer font-bold"
          >
            <Crown className="size-4" />
            <span>{isPaid ? '升级/续订方案' : '开通会员订阅 · 低至18折'}</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="size-8 animate-spin text-brand" />
          <span className="text-caption text-ink-muted font-medium">正在读取订阅特权与账单数据…</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 2. 模块一：当前订阅概况表 */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-body-sm font-bold text-ink tracking-tight flex items-center gap-2">
                <Crown className="size-4 text-brand" />
                <span>当前订阅概况</span>
              </h2>
              <span className="text-caption text-ink-subtle">按周期自动同步结算权益</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-line-subtle bg-surface shadow-elevation-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-ink">
                  <thead className="bg-well text-ink-muted border-b border-line-subtle font-medium text-caption">
                    <tr>
                      <th className="py-3 px-4">套餐版本</th>
                      <th className="py-3 px-4">订阅状态</th>
                      <th className="py-3 px-4">计费周期</th>
                      <th className="py-3 px-4">到期时间 / 刷新日</th>
                      <th className="py-3 px-4">并发算力特权</th>
                      <th className="py-3 px-4">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    <tr className="hover:bg-wash transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-ink flex items-center gap-2">
                        <span className="size-2 rounded-full bg-brand animate-pulse" />
                        <span>{planName}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPaid
                              ? 'bg-brand-soft text-brand border border-brand-line'
                              : 'bg-wash text-ink-muted border border-line-subtle'
                          }`}
                        >
                          <CheckCircle2 className="size-3" />
                          {isPaid ? '已生效 · 尊享特权' : '基础体验 · 正常'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-ink font-medium">{cycleText}</td>
                      <td className="py-3.5 px-4 font-mono text-ink">{periodEnd}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-ink font-medium">
                            {entitlements?.concurrency
                              ? `${entitlements.concurrency} 路高速并发 · ${entitlements.storageGb || 5}GB 空间`
                              : isPaid
                              ? '5 路高速并发 · 5GB 空间'
                              : '1 路标准排队通道'}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            <span className="inline-flex items-center rounded bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-[9px] font-semibold text-brand">
                              去水印
                            </span>
                            <span className="inline-flex items-center rounded bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-[9px] font-semibold text-brand">
                              商用授权
                            </span>
                            {entitlements?.hasExport4k === true && (
                              <span className="inline-flex items-center rounded bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-[9px] font-semibold text-brand">
                                4K超采样
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => setIsSubModalOpen(true)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline cursor-pointer"
                        >
                          <span>{isPaid ? '变更方案' : '立即升级'}</span>
                          <ArrowRight className="size-3" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 3. 模块二：订阅与充值历史记录 (专注账单、发票与充值明细) */}
          <section className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-line-subtle">
              <div className="flex items-center gap-2">
                <Receipt className="size-4 text-brand" />
                <h2 className="text-body-sm font-bold text-ink tracking-tight">
                  订阅与充值历史记录
                </h2>
                <Badge variant="outline" className="text-micro font-mono border-line-subtle text-ink-muted">
                  {orders.length} 笔记录
                </Badge>
              </div>

              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('usage')}
                  className="inline-flex items-center gap-1.5 text-caption font-semibold text-brand hover:underline cursor-pointer group"
                >
                  <BarChart2 className="size-3.5 transition-transform group-hover:scale-110" />
                  <span>前往查看实时额度明细</span>
                  <ArrowRight className="size-3" />
                </button>
              )}
            </div>

            {/* 订单历史表格 */}
            <div className="overflow-hidden rounded-xl border border-line-subtle bg-surface shadow-elevation-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-ink">
                  <thead className="bg-well text-ink-muted border-b border-line-subtle font-medium text-caption">
                    <tr>
                      <th className="py-3 px-4">订单号</th>
                      <th className="py-3 px-4">订阅方案 / 充值内容</th>
                      <th className="py-3 px-4">支付金额</th>
                      <th className="py-3 px-4">支付渠道</th>
                      <th className="py-3 px-4">下单时间</th>
                      <th className="py-3 px-4">交易状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-ink-muted">
                          <Receipt className="size-6 text-ink-subtle mx-auto mb-2" />
                          <p className="text-xs">暂无订阅或充值历史记录</p>
                          <p className="mt-1 text-caption text-ink-subtle">
                            完成会员订阅或加购算力后，所有交易发票与对账单将在此列出。
                          </p>
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id} className="hover:bg-wash transition-colors">
                          <td className="py-3 px-4 font-mono text-caption text-ink-muted">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[120px]">{o.id}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(o.id)}
                                className="text-ink-subtle hover:text-ink transition-colors cursor-pointer"
                                title="复制订单号"
                              >
                                {copiedId === o.id ? (
                                  <CheckCircle2 className="size-3 text-brand" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-ink">{o.plan || '会员订阅'}</td>
                          <td className="py-3 px-4 font-mono font-semibold text-ink">{o.amount}</td>
                          <td className="py-3 px-4 text-ink-muted">微信支付 / 支付宝</td>
                          <td className="py-3 px-4 font-mono text-ink-muted">{o.date}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                o.color === 'emerald'
                                  ? 'bg-success-soft text-success border border-success-line'
                                  : o.color === 'amber'
                                  ? 'bg-warning-soft text-warning border border-warning-line'
                                  : 'bg-wash text-ink-muted border border-line-subtle'
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 独立会员订阅升级/续订弹窗 */}
      <SubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => {
          setIsSubModalOpen(false);
          loadData();
          onRefreshUser?.();
        }}
        user={user}
        onOpenAuth={onOpenAuth}
      />

      {/* 算力充值加购弹窗 */}
      <RechargeModal
        isOpen={isRechargeModalOpen}
        onClose={() => {
          setIsRechargeModalOpen(false);
          loadData();
          onRefreshUser?.();
        }}
        initialTab="points"
      />
    </div>
  );
}
