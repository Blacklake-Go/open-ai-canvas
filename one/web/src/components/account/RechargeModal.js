'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
  Check,
  Crown,
  CreditCard,
  X,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Ticket,
  ExternalLink,
  Sparkles,
  Zap,
  Gift,
  Flame,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import QRCodeSvg from '@/components/ui/QRCodeSvg';
import { getRechargeStrings, useRechargeLocale } from './rechargeI18n';

// 微信支付与支付宝官方 SVG 徽标
function WeChatPayIcon({ className = 'size-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M9.5 4C4.8 4 1 7.4 1 11.5c0 2.4 1.3 4.5 3.3 5.8-.2.8-.7 2.4-.8 2.7 0 0-.1.2.1.3.2.1.4 0 .4 0 .6-.4 2.3-1.6 3.1-2.2.8.3 1.6.4 2.4.4.3 0 .7 0 1-.1-.3-.7-.4-1.5-.4-2.4 0-4.4 4-8 9-8 .5 0 1 .1 1.5.2C19.4 6.3 14.8 4 9.5 4z"
        fill="#07C160"
      />
      <path
        d="M17.5 9c-4.1 0-7.5 3-7.5 6.8 0 2.1 1.1 4 2.9 5.2-.2.7-.6 2.1-.7 2.4 0 0-.1.2.1.2.2.1.3 0 .3 0 .5-.3 2-1.4 2.7-1.9.7.2 1.4.3 2.2.3 4.1 0 7.5-3 7.5-6.8S21.6 9 17.5 9z"
        fill="#07C160"
      />
      <circle cx="6.5" cy="8.5" r="1" fill="#fff" />
      <circle cx="12.5" cy="8.5" r="1" fill="#fff" />
      <circle cx="15" cy="13.5" r="1" fill="#fff" />
      <circle cx="20" cy="13.5" r="1" fill="#fff" />
    </svg>
  );
}

function AlipayIcon({ className = 'size-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#1677FF" />
      <path
        d="M18.8 15.6c-1.3-.6-3.2-1.4-5.2-2.1 1.1-1.7 1.8-3.7 2-5.7H19V6.6h-4.3V5h-1.8v1.6H8.5v1.2h4.5c-.3 1.6-.9 3.2-1.7 4.5-1.5-.6-3.1-1.2-4.1-1.2-2.2 0-3.6 1.4-3.6 3.2 0 1.9 1.6 3.3 3.8 3.3 2.3 0 4.6-1.5 6.2-3.8 2.2.8 4.7 1.9 6.2 2.6.5.2 1 .3 1.4.3 1.2 0 2.2-.9 2.2-2.1 0-.6-.3-1.1-.9-1.4l-1.8-.9zM7.2 16.2c-1.3 0-2.1-.8-2.1-1.9 0-1.1.9-1.9 2.1-1.9.9 0 2.1.4 3.4.9-1 1.9-2.2 2.9-3.4 2.9z"
        fill="#fff"
      />
    </svg>
  );
}

function PayPalIcon({ className = 'size-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.78.78 0 0 1 .77-.655h6.666c3.212 0 5.488 1.487 5.176 4.908-.344 3.766-2.585 5.626-5.836 5.626H9.278l-1.35 6.945a.78.78 0 0 1-.77.655l-.082.038z"
        fill="#003087"
      />
      <path
        d="M19.066 7.973c-.344 3.766-2.585 5.626-5.836 5.626H10.79l-1.47 7.558a.52.52 0 0 1-.512.436H6.11a.428.428 0 0 1-.422-.494l2.16-13.79c.046-.296.3-.513.6-.513h5.442c3.212 0 5.488 1.487 5.176 4.908v.269z"
        fill="#0079C1"
      />
      <path
        d="M17.848 8.242c-.314 3.44-2.36 5.14-5.33 5.14H10.08l-1.298 6.673a.475.475 0 0 1-.468.398H5.972a.39.39 0 0 1-.385-.451l1.972-12.593a.547.547 0 0 1 .548-.468h4.97c2.933 0 5.011 1.358 4.771 4.483v.318z"
        fill="#00457C"
      />
    </svg>
  );
}

export default function RechargeModal({
  isOpen,
  onClose,
  initialTab = 'sub',
  initialPlanId = null,
  initialBillingCycle = 'monthly',
  autoCheckout = false,
  onPaySuccess,
  locale = null,
}) {
  const activeLocale = useRechargeLocale(locale);
  const catalogCopy = useTranslations('adminPlans');
  const orderCopy = useTranslations('billingOrders');
  const strings = useMemo(() => getRechargeStrings(activeLocale), [activeLocale]);

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState(['exclusive', 'points'].includes(initialTab) ? 'universal' : initialTab);
  const [subscriptionPlans, setSubscriptionPlans] = useState(null);
  const [subscriptionError, setSubscriptionError] = useState(false);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [universalPacks, setUniversalPacks] = useState(null);
  const [packsError, setPacksError] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState(null);

  const [planId, setPlanId] = useState(initialPlanId);
  const [billingCycle, setBillingCycle] = useState(initialBillingCycle);
  const [availableProviders, setAvailableProviders] = useState({});
  const [pilotPackId, setPilotPackId] = useState(null);
  const [payMethod, setPayMethod] = useState('alipay');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 扫码支付交互状态
  const [checkoutData, setCheckoutData] = useState(null);
  const [pollStatus, setPollStatus] = useState('waiting'); // 'waiting' | 'paid' | 'expired' | 'error'
  const [countdown, setCountdown] = useState(900); // 15 分钟

  const pollTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const autoCheckedOutRef = useRef(false);

  // 卡密兑换状态
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponSuccess, setCouponSuccess] = useState('');
  const [couponConfirmData, setCouponConfirmData] = useState(null);
  const [couponRedeeming, setCouponRedeeming] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 监听外部传入的 initialPlanId 与 initialBillingCycle，自动识别商品类别
  useEffect(() => {
    if (initialPlanId) {
      if (initialPlanId.startsWith('credit_')) {
        setActiveTab('universal');
        setSelectedPackId(initialPlanId);
      } else if (initialPlanId.startsWith('exclusive_')) {
        setActiveTab('universal');
        setSelectedPackId(null);
      } else {
        setActiveTab('sub');
        setPlanId(initialPlanId);
      }
    }
  }, [initialPlanId]);

  useEffect(() => {
    if (initialBillingCycle) {
      setBillingCycle(initialBillingCycle);
    }
  }, [initialBillingCycle]);

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    clearTimers();
    setCheckoutData(null);
    setPollStatus('waiting');
    setError(null);
    onClose?.();
  }, [clearTimers, onClose]);

  // 监听 ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // 获取套餐列表、算力包及可用支付通道
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setError(null);
    setSubscriptionPlans(null);
    setSubscriptionError(false);
    setUniversalPacks(null);
    setPacksError(false);
    setAvailableProviders({});

    Promise.all([
      fetch('/api/billing/plans', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      fetch('/api/billing/credit-packs', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]).then(([plansPayload, packsPayload]) => {
      if (cancelled) return;
      const eligiblePilotPack = packsPayload?.pilotPackId === 'credit_490' ? 'credit_490' : null;
      setPilotPackId(eligiblePilotPack);
      if (eligiblePilotPack) {
        setSelectedPackId((current) => current || eligiblePilotPack);
      }
      const provs = plansPayload?.providers || packsPayload?.providers;
      if (provs) {
        setAvailableProviders(provs);
        setPayMethod((curr) => {
          if (provs[curr]?.enabled) return curr;
          if (eligiblePilotPack) return 'alipay';
          return Object.keys(provs).find((p) => provs[p]?.enabled) || '';
        });
      }
      if (Array.isArray(plansPayload?.plans)) {
        const filtered = plansPayload.plans.filter((item) => item.id !== 'free' && item.enabled !== false);
        setSubscriptionPlans(filtered);
        setPlanId((current) => filtered.some((item) => item.id === current) ? current : null);
      } else setSubscriptionError(true);
      const availablePacks = packsPayload?.packs || packsPayload?.universalPacks;
      if (Array.isArray(availablePacks)) {
        setUniversalPacks(availablePacks);
        setSelectedPackId(current => availablePacks.some(pack => pack.id === current) ? current : availablePacks[0]?.id || null);
      } else setPacksError(true);
    }).catch((fetchError) => {
      if (!cancelled) setError(fetchError.message || '加载商品方案失败');
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, catalogRetry]);

  // 轮询订单支付状态
  useEffect(() => {
    if (!checkoutData?.orderId || pollStatus === 'paid') return undefined;

    setCountdown(900);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearTimers();
          setPollStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/billing/orders/${checkoutData.orderId}/status`, { cache: 'no-store' });
        if (res.ok) {
          const payload = await res.json();
          const data = payload.order || payload;
          // 若后台已解析出支付宝原生二维码，无缝升级为无损矢量 SVG
          if (data.qrCode && !checkoutData?.qrUrl) {
            setCheckoutData((current) => (current ? { ...current, qrUrl: data.qrCode } : current));
          }
          if (data.status === 'paid') {
            clearTimers();
            setCheckoutData((current) => (current ? {
              ...current,
              providerOrderId: data.providerOrderId || current.providerOrderId,
              providerPaymentId: data.providerPaymentId || current.providerPaymentId,
              paidAmountMinor: data.paidAmountMinor ?? current.paidAmountMinor,
              paidAt: data.paidAt || current.paidAt,
              status: data.status,
            } : current));
            setPollStatus('paid');
            onPaySuccess?.({ coinsAdded: checkoutData.creditAmount });
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('supdance:credits-updated', { detail: { orderId: checkoutData.orderId } }));
            }
          }
        }
      } catch {
        // 静默重试
      }
    }, 1500);

    return () => clearTimers();
  }, [checkoutData, onPaySuccess, pollStatus, clearTimers]);

  const subscriptionCurrency = payMethod === 'stripe' || payMethod === 'paypal' ? 'Usd' : 'Cny';

  // 计算当前视窗选中商品的价格与名称
  const currentSelectionInfo = useMemo(() => {
    if (activeTab === 'universal') {
      const pack = universalPacks?.find(p => p.id === selectedPackId);
      return {
        id: pack?.id,
        name: pack?.name,
        priceYuan: pack?.priceCny || 0,
        credits: pack?.credits || 0,
        productType: 'credit_pack',
        billingCycle: 'one_time',
      };
    }
    const currentSub = subscriptionPlans?.find((p) => p.id === planId);
    const subPrice = currentSub?.[`${billingCycle}${subscriptionCurrency}`] || 0;
    const subQuota = currentSub?.quotaBase || 0;
    const mult = billingCycle === 'yearly' ? 12 : billingCycle === 'quarterly' ? 3 : 1;
    return {
      id: currentSub?.id,
      name: currentSub?.name || '会员方案',
      priceYuan: subPrice,
      credits: subQuota * mult,
      productType: 'subscription',
      billingCycle,
    };
  }, [activeTab, selectedPackId, planId, billingCycle, universalPacks, subscriptionPlans, subscriptionCurrency]);

  // 提交生成订单
  const handleCreateOrder = async (overridePlanId = null, overrideProvider = null, overrideCycle = null) => {
    const activePlanId = overridePlanId || currentSelectionInfo.id;
    const activeProvider = overrideProvider || payMethod;
    if (!activePlanId) {
      setError('请先选择充值方案');
      return;
    }
    const pilotAllowed = activeProvider === 'alipay' && pilotPackId === activePlanId;
    if (!availableProviders[activeProvider]?.enabled && !pilotAllowed) {
      setError('当前支付渠道暂不可用');
      return;
    }

    const isCreditPack = activePlanId.startsWith('credit_');
    if (isCreditPack && !universalPacks?.some(pack => pack.id === activePlanId)) {
      setError(orderCopy('creditPacksEmpty'));
      return;
    }
    const productType = isCreditPack ? 'credit_pack' : 'subscription';
    const activeCycle = productType === 'subscription' ? (overrideCycle || billingCycle || 'monthly') : 'one_time';
    const currencyKey = activeProvider === 'stripe' || activeProvider === 'paypal' ? 'Usd' : 'Cny';
    if (!isCreditPack && !subscriptionPlans?.find((plan) => plan.id === activePlanId)?.[`${activeCycle}${currencyKey}`]) {
      setError(catalogCopy('empty'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const idempotencyKey = `checkout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          planId: activePlanId,
          provider: activeProvider,
          billingCycle: activeCycle,
          productType,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || '获取支付通道失败，请稍后重试');
      }

      // Stripe 与 PayPal 外部收银台重定向
      if ((activeProvider === 'stripe' || activeProvider === 'paypal') && payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl);
        return;
      }

      const qr = payload.qrCode || payload.qrCodeUrl;
      if (!qr && !payload.checkoutUrl) {
        throw new Error(payload.error || '获取支付二维码失败，请稍后重试');
      }

      setCheckoutData({
        orderId: payload.orderId,
        providerOrderId: payload.providerOrderId || null,
        providerPaymentId: payload.providerPaymentId || null,
        createdAt: payload.createdAt || new Date().toISOString(),
        status: 'pending',
        qrUrl: qr,
        qrImgUrl: payload.qrImgUrl || null,
        checkoutUrl: payload.checkoutUrl || qr,
        isPagePay: Boolean(payload.isPagePay || (!qr && payload.checkoutUrl)),
        amountYuan: (Number(payload.amountMinor) / 100).toFixed(2),
        provider: activeProvider,
        planName: payload.planName || currentSelectionInfo.name,
        billingCycle: activeCycle,
        creditAmount: payload.creditAmount || currentSelectionInfo.credits,
      });
      setPollStatus('waiting');
    } catch (paymentError) {
      setError(paymentError.message || '支付通道暂未响应，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 自动预下单处理：立即拉起，绝不等待无关列表接口阻塞
  useEffect(() => {
    if (!isOpen) {
      autoCheckedOutRef.current = false;
      return;
    }
    const targetId = initialPlanId || currentSelectionInfo.id;
    const targetProvider = (payMethod && availableProviders[payMethod]?.enabled)
      ? payMethod
      : Object.keys(availableProviders).find((p) => availableProviders[p]?.enabled);

    if (autoCheckout && currentSelectionInfo.id === targetId && !autoCheckedOutRef.current && targetId && targetProvider && !checkoutData && !loading) {
      autoCheckedOutRef.current = true;
      if (targetProvider !== payMethod) {
        setPayMethod(targetProvider);
      }
      handleCreateOrder(targetId, targetProvider, billingCycle);
    }
  }, [autoCheckout, isOpen, initialPlanId, currentSelectionInfo, checkoutData, loading, payMethod, billingCycle, availableProviders]);

  // 1. 发起卡密核验并弹出确认弹窗
  const handleInitiateRedeem = async (e) => {
    e?.preventDefault?.();
    const clean = couponCode.trim().toUpperCase();
    if (!clean || couponLoading) return;
    setCouponLoading(true);
    setError(null);
    setCouponSuccess('');
    try {
      const res = await fetch('/api/coupons/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error || '兑换码无效或已被使用');
      }
      setCouponConfirmData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCouponLoading(false);
    }
  };

  // 2. 确认弹窗中确认核销到账
  const handleExecuteRedeem = async () => {
    if (!couponConfirmData?.code || couponRedeeming) return;
    setCouponRedeeming(true);
    setError(null);
    try {
      const res = await fetch('/api/coupons/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponConfirmData.code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error || '兑换处理失败，请稍后重试');
      }
      const rewardText = couponConfirmData.rewardTitle || (data.type === 'credits' ? `+${data.creditsAdded || data.value} 创作算力` : `${String(data.planId || data.value).toUpperCase()} 会员方案`);
      setCouponSuccess(`恭喜！${rewardText} 已成功兑换并到账！`);
      setCouponConfirmData(null);
      setCouponCode('');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supdance:credits-updated', { detail: {} }));
      }
      onPaySuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setCouponRedeeming(false);
    }
  };


  const formatCountdown = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center overflow-hidden bg-scrim p-3 backdrop-blur-xl transition-opacity duration-modal ease-enter animate-fade-in cursor-pointer sm:p-6 lg:p-8"
      onClick={handleClose}
    >
      <div
        className="relative flex max-h-commerce-modal w-full max-w-commerce-modal flex-col overflow-y-auto rounded-modal border border-line-strong bg-overlay text-ink shadow-elevation-4 animate-scale-in cursor-default md:min-h-commerce-modal md:flex-row md:overflow-hidden"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={strings.modalAria}
      >
        {/* 右上角关闭按钮 */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 z-raised p-2.5 rounded-full text-ink-muted hover:text-ink hover:bg-wash active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
          title={strings.closeAria}
          aria-label={strings.closeAria}
        >
          <X className="size-4" />
        </button>

        {/* 左侧侧边栏：方案选择与账单明细 */}
        <aside className="flex w-full shrink-0 select-none flex-col justify-between border-b border-line-subtle bg-well p-5 custom-scrollbar md:w-[280px] md:overflow-y-auto md:border-b-0 md:border-r lg:p-6">
          <div>
            {checkoutData ? (
              <div>
                <h2 className="text-card-title font-semibold text-ink">{strings.orderDetails}</h2>
                <div className="mt-4 rounded-xl border border-line-subtle bg-surface-raised p-4 space-y-3.5 shadow-elevation-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-body font-semibold text-ink">{checkoutData.planName}</p>
                      {checkoutData.creditAmount > 0 && (
                        <p className="mt-1 text-caption text-ink-muted">
                          {strings.includesCredits(checkoutData.creditAmount)}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full border border-line-subtle bg-wash px-2.5 py-0.5 text-micro text-ink-muted">
                      {checkoutData.billingCycle === 'yearly'
                        ? strings.cycleYearly
                        : checkoutData.billingCycle === 'quarterly'
                        ? strings.cycleQuarterly
                        : checkoutData.billingCycle === 'one_time'
                        ? strings.cycleOneTime
                        : strings.cycleMonthly}
                    </span>
                  </div>

                  <div className="border-t border-line-subtle pt-3 flex items-baseline justify-between">
                    <span className="text-body-sm text-ink-muted">{strings.amountToPay}</span>
                    <span className="text-page-title font-bold font-mono text-brand">￥{checkoutData.amountYuan}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-card-title font-semibold text-ink">{strings.centerTitle}</h2>
                <div className="mt-4 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('sub');
                      setError(null);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-body-sm transition-colors cursor-pointer ${
                      activeTab === 'sub' ? 'bg-wash-strong text-ink font-semibold' : 'text-ink-muted hover:bg-wash'
                    }`}
                  >
                    {strings.tabSub}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('universal');
                      setError(null);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-body-sm transition-colors cursor-pointer ${
                      activeTab === 'universal' ? 'bg-wash-strong text-ink font-semibold' : 'text-ink-muted hover:bg-wash'
                    }`}
                  >
                    {strings.tabUniversal}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('coupon');
                      setError(null);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-body-sm transition-colors cursor-pointer ${
                      activeTab === 'coupon' ? 'bg-wash-strong text-ink font-semibold' : 'text-ink-muted hover:bg-wash'
                    }`}
                  >
                    {strings.tabCoupon}
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* 右侧主收银与扫码区 */}
        <main className="flex min-w-0 shrink-0 flex-col bg-surface p-6 custom-scrollbar md:min-h-0 md:flex-1 md:overflow-y-auto lg:p-8">
          {checkoutData ? (
            <div className="flex flex-col items-center justify-center text-center my-auto py-4">
              {pollStatus === 'paid' ? (
                <div className="py-8 flex flex-col items-center animate-scale-in">
                  <CheckCircle2 className="size-16 text-success" />
                  <h3 className="mt-4 text-page-title font-bold text-ink">{strings.paySuccess}</h3>
                  <p className="mt-2 text-body-sm text-ink-muted">
                    {strings.paySuccessCredits(checkoutData.creditAmount)}
                  </p>
                  <Button variant="primary" className="mt-6 px-8 font-bold" onClick={handleClose}>
                    {strings.doneReturn}
                  </Button>
                </div>
              ) : pollStatus === 'expired' ? (
                <div className="py-8 flex flex-col items-center animate-scale-in">
                  <div className="size-16 rounded-full bg-warning-soft flex items-center justify-center text-warning mb-2">
                    <X className="size-8" />
                  </div>
                  <h3 className="mt-2 text-section-title font-bold text-ink">{strings.orderExpired}</h3>
                  <p className="mt-2 text-caption text-ink-muted max-w-sm">{strings.orderExpiredDesc}</p>
                  <Button
                    variant="primary"
                    className="mt-6"
                    onClick={() => {
                      clearTimers();
                      setCheckoutData(null);
                      setPollStatus('waiting');
                    }}
                  >
                    {strings.reorder}
                  </Button>
                </div>
              ) : (
                <>
                  <h3 className="text-section-title font-semibold text-ink">{strings.scanToPay}</h3>
                  <p className="mt-1 text-body-sm text-ink-muted">
                    {strings.scanWithProvider(checkoutData.provider === 'alipay' ? strings.alipay : strings.wechat)}
                  </p>

                  <div className="mt-6 rounded-xl border border-line-subtle bg-white p-3 shadow-elevation-2 flex items-center justify-center w-[214px] h-[214px] mx-auto overflow-hidden relative">
                    {checkoutData.qrUrl ? (
                      <QRCodeSvg value={checkoutData.qrUrl} size={190} />
                    ) : checkoutData.qrImgUrl ? (
                      <img
                        src={checkoutData.qrImgUrl}
                        alt={strings.scanToPay}
                        className="size-[174px] object-contain"
                      />
                    ) : checkoutData.isPagePay && checkoutData.checkoutUrl ? (
                      <iframe
                        src={checkoutData.checkoutUrl}
                        className="w-[174px] h-[178px] border-0 overflow-hidden bg-white"
                        scrolling="no"
                        title={strings.alipay}
                      />
                    ) : (
                      <div className="size-[190px] flex items-center justify-center text-ink-disabled text-caption">{strings.loadingQr}</div>
                    )}
                  </div>

                  {checkoutData.isPagePay && checkoutData.checkoutUrl && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => window.open(checkoutData.checkoutUrl, '_blank', 'noopener,noreferrer')}
                        className="inline-flex items-center gap-1.5 text-caption font-semibold text-brand hover:text-brand-hover transition-colors cursor-pointer"
                      >
                        <ExternalLink className="size-3.5" />
                        <span>{strings.openInNewTab}</span>
                      </button>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-center gap-1.5 text-caption text-ink-muted">
                    <Loader2 className="size-3.5 animate-spin text-brand" />
                    <span>{strings.waitingScan}</span>
                    <span className="font-mono text-brand font-semibold">{formatCountdown(countdown)}</span>
                  </div>

                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-caption text-ink-muted hover:text-ink cursor-pointer"
                      onClick={() => {
                        clearTimers();
                        setCheckoutData(null);
                      }}
                    >
                      <ArrowLeft className="size-3.5" />
                      <span>{strings.changeMethod}</span>
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center text-center my-auto py-12">
              <Loader2 className="size-10 animate-spin text-brand mb-4" />
              <h3 className="text-section-title font-semibold text-ink">{strings.connectingChannel}</h3>
              <p className="mt-2 text-caption text-ink-muted max-w-sm">{strings.connectingGateway}</p>
            </div>
          ) : error && autoCheckout ? (
            <div className="flex flex-col items-center justify-center text-center my-auto py-8">
              <div className="size-12 rounded-full bg-danger/10 flex items-center justify-center text-danger mb-3">
                <X className="size-6" />
              </div>
              <h3 className="text-section-title font-semibold text-ink">{strings.channelError}</h3>
              <p className="mt-2 text-caption text-danger max-w-md">{error}</p>
              <div className="mt-6 flex items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    handleCreateOrder(initialPlanId || currentSelectionInfo.id, payMethod);
                  }}
                >
                  {strings.retryPay}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-ink-muted hover:text-ink"
                  onClick={() => {
                    setError(null);
                    setPlanId(null);
                  }}
                >
                  {strings.manualChoose}
                </Button>
              </div>
            </div>
          ) : activeTab === 'sub' ? (
            <div className="flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-line-subtle">
                  <div>
                    <h3 className="text-card-title font-semibold text-ink">{strings.selectPlanTitle}</h3>
                    <p className="text-caption text-ink-muted mt-0.5">{strings.selectPlanSubtitle}</p>
                  </div>

                  {/* 周期切换按钮 */}
                  <div className="flex items-center rounded-full border border-line-subtle bg-well p-1 text-label font-semibold">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={`rounded-full px-3 py-1 transition-colors cursor-pointer ${
                        billingCycle === 'monthly' ? 'bg-surface-inverse text-ink-inverse shadow-elevation-1 font-semibold' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {strings.cycleMonthly}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle('quarterly')}
                      className={`rounded-full px-3 py-1 transition-colors flex items-center gap-1 cursor-pointer ${
                        billingCycle === 'quarterly' ? 'bg-surface-inverse text-ink-inverse shadow-elevation-1 font-semibold' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      <span>{strings.cycleQuarterly}</span>
                      <span className="rounded-full bg-brand-soft text-brand px-1 py-0.2 text-[9px] font-bold">{strings.tagQuarterly}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle('yearly')}
                      className={`rounded-full px-3 py-1 transition-colors flex items-center gap-1 cursor-pointer ${
                        billingCycle === 'yearly' ? 'bg-surface-inverse text-ink-inverse shadow-elevation-1 font-semibold' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      <span>{strings.cycleYearly}</span>
                      <span className="rounded-full bg-brand-soft text-brand px-1 py-0.2 text-[9px] font-bold">{strings.tagYearly}</span>
                    </button>
                  </div>
                </div>

                {/* 套餐网格 */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
                  {(subscriptionPlans || []).map((item) => {
                    const isSelected = planId === item.id;
                    const itemPrice = item[`${billingCycle}${subscriptionCurrency}`];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPlanId(item.id)}
                        aria-pressed={isSelected}
                        className={`relative rounded-xl border p-3.5 text-left transition-[background-color,border-color,box-shadow] cursor-pointer ${
                          isSelected
                            ? 'border-brand-line bg-brand-soft ring-2 ring-brand-ring shadow-elevation-1'
                            : 'border-line-subtle bg-well hover:border-line-strong'
                        }`}
                      >
                        <p className="text-body-sm font-semibold text-ink truncate">{item.name}</p>
                        <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-xl font-bold font-mono text-brand">{itemPrice > 0 ? `${subscriptionCurrency === 'Usd' ? '$' : '￥'}${itemPrice}` : '—'}</span>
                          <span className="text-micro text-ink-muted font-normal">
                            {billingCycle === 'yearly' ? strings.perYear : billingCycle === 'quarterly' ? strings.perQuarter : strings.perMonth}
                          </span>
                        </div>
                        <ul className="mt-2.5 flex flex-col gap-1 border-t border-line-subtle pt-2.5 text-caption text-ink-muted">
                          {item.features?.slice(0, 3).map((feat) => (
                            <li key={feat} className="flex items-center gap-1.5 truncate">
                              <Check className="size-3 text-brand shrink-0" />
                              <span className="truncate">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>
                {subscriptionError ? <div className="mt-3 flex items-center gap-2">
                  <p role="alert" className="text-danger">{catalogCopy('loadFailed')}</p>
                  <Button size="lg" onClick={() => setCatalogRetry((current) => current + 1)}>{catalogCopy('retry')}</Button>
                </div> : !subscriptionPlans?.length && <p role="status" className="mt-3 text-ink-muted">
                  {catalogCopy(subscriptionPlans ? 'empty' : 'loading')}
                </p>}

                {/* 支付方式选择 */}
                {renderPaymentProviders()}
              </div>

              {/* 底部结算按钮行 */}
              <div className="mt-5 flex items-center justify-between border-t border-line-subtle pt-3.5">
                <div>
                  <p className="text-caption text-ink-muted">{strings.amountToPay}</p>
                  <p className="text-2xl font-bold font-mono text-brand">{currentSelectionInfo.priceYuan > 0 ? `${subscriptionCurrency === 'Usd' ? '$' : '￥'}${currentSelectionInfo.priceYuan.toFixed(2)}` : '—'}</p>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  className="font-semibold shadow-elevation-1 cursor-pointer"
                  onClick={() => handleCreateOrder(planId, payMethod, billingCycle)}
                  disabled={loading || !currentSelectionInfo.priceYuan || !availableProviders[payMethod]?.enabled}
                >
                  {loading ? (strings.paying || '处理中...') : payMethod === 'stripe' ? (strings.goToStripe || '前往 Stripe 收银台') : payMethod === 'paypal' ? (strings.goToPaypal || '前往 PayPal 收银台') : (strings.payNow || '立即支付')}
                </Button>
              </div>
            </div>
          ) : activeTab === 'universal' ? (
            <div className="flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-line-subtle">
                  <div>
                    <h3 className="text-card-title font-semibold text-ink">{strings.universalPacksTitle}</h3>
                    <p className="text-caption text-ink-muted mt-0.5">
                      {strings.universalPacksSubtitle}
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-soft border border-brand-line px-2.5 py-1 text-label font-semibold text-brand">
                    {strings.neverExpire}
                  </span>
                </div>

                {packsError ? (
                  <div className="mt-4 space-y-2">
                    <p role="alert" className="text-danger">{orderCopy('creditPacksFailed')}</p>
                    <Button size="lg" onClick={() => setCatalogRetry(current => current + 1)}>{catalogCopy('retry')}</Button>
                  </div>
                ) : !universalPacks?.length && (
                  <p role="status" className="mt-4 text-ink-muted">{orderCopy(universalPacks ? 'creditPacksEmpty' : 'creditPacksLoading')}</p>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
                  {universalPacks?.map((pack) => {
                    const isSelected = selectedPackId === pack.id;
                    return (
                      <button
                        key={pack.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedPackId(pack.id)}
                        className={`relative rounded-xl border p-3.5 text-left transition-[background-color,border-color,box-shadow] cursor-pointer ${
                          isSelected
                            ? 'border-brand-line bg-brand-soft ring-2 ring-brand-ring shadow-elevation-1'
                            : 'border-line-subtle bg-well hover:border-line-strong'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-body-sm font-semibold text-ink truncate">{pack.name}</p>
                          <span className="text-micro text-ink-muted font-mono">{pack.credits > 0 ? strings.unitPriceDesc((pack.priceCny / pack.credits).toFixed(2)) : ''}</span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-xl font-bold font-mono text-brand">￥{pack.priceCny}</span>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between border-t border-line-subtle pt-2 text-caption">
                          <span className="font-semibold text-ink font-mono">{strings.creditsCount(pack.credits)}</span>
                          <span className="text-micro text-success">{strings.neverExpire}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 支付方式选择 */}
                {renderPaymentProviders()}
              </div>

              {/* 底部结算按钮行 */}
              <div className="mt-5 flex items-center justify-between border-t border-line-subtle pt-3.5">
                <div>
                  <p className="text-caption text-ink-muted">{strings.amountToPay}</p>
                  <p className="text-2xl font-bold font-mono text-brand">{currentSelectionInfo.id ? `￥${currentSelectionInfo.priceYuan.toFixed(2)}` : '—'}</p>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  className="font-semibold shadow-elevation-1 cursor-pointer"
                  onClick={() => handleCreateOrder(currentSelectionInfo.id, payMethod, 'one_time')}
                  disabled={!currentSelectionInfo.id || loading || !(availableProviders[payMethod]?.enabled || (payMethod === 'alipay' && pilotPackId === currentSelectionInfo.id))}
                >
                  {loading ? (strings.paying || '处理中...') : payMethod === 'stripe' ? (strings.goToStripe || '前往 Stripe 收银台') : payMethod === 'paypal' ? (strings.goToPaypal || '前往 PayPal 收银台') : (strings.payNow || '立即支付')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto my-auto w-full">
              <form onSubmit={handleInitiateRedeem} className="space-y-4 rounded-xl border border-line-subtle bg-surface-raised p-6 shadow-elevation-1">
                <div>
                  <label className="block text-label font-semibold text-ink">
                    {strings.couponTitle}
                  </label>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      if (error) setError(null);
                    }}
                    placeholder={strings.couponPlaceholder}
                    className="mt-2 w-full rounded-xl border border-line bg-well px-4 py-2.5 font-mono text-sm uppercase tracking-wider text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring"
                  />
                  <p className="mt-1.5 text-caption text-ink-subtle">
                    {strings.couponSubtitle}
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full font-semibold cursor-pointer"
                  disabled={couponLoading || !couponCode.trim()}
                >
                  {couponLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1.5" />
                      <span>{strings.verifyingCoupon}</span>
                    </>
                  ) : (
                    strings.redeemNow || '立即兑换到账'
                  )}
                </Button>

                {couponSuccess && (
                  <div className="rounded-xl border border-success-line bg-success-soft p-3.5 text-caption text-success flex items-start gap-2.5 animate-fade-in">
                    <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-success">兑换成功</p>
                      <p className="mt-0.5 text-ink-muted">{couponSuccess}</p>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-caption text-danger" role="alert">
              {error}
            </p>
          )}
        </main>
      </div>

      {/* 卡密兑换确认弹窗 */}
      {couponConfirmData && (
        <div
          className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-scrim backdrop-blur-xl animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !couponRedeeming) {
              setCouponConfirmData(null);
            }
          }}
        >
          <div
            className="relative w-full max-w-[460px] rounded-modal border border-line-strong bg-overlay p-6 sm:p-7 shadow-elevation-4 animate-scale-in text-ink"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="卡密兑换确认"
          >
            {/* 右上角关闭按钮 */}
            <button
              type="button"
              onClick={() => setCouponConfirmData(null)}
              disabled={couponRedeeming}
              className="absolute top-4 right-4 p-2 rounded-full text-ink-muted hover:text-ink hover:bg-wash active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              title="关闭"
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>

            {/* 弹窗标题 */}
            <div className="text-center">
              <h3 className="text-card-title font-semibold text-ink">卡密兑换确认</h3>
              <p className="mt-1 text-caption text-ink-muted">请核对您的兑换明细，确认后将直接充值至当前账号</p>
            </div>

            {/* 提示条 */}
            <div className="mt-4 rounded-xl border border-line-subtle bg-well p-3 text-caption text-ink-muted leading-relaxed">
              💡 兑换权益确认后将立即发放至当前登录账户，卡密一经核销无法退回或转移。
            </div>

            {/* 兑换明细列表 */}
            <div className="mt-3.5 space-y-2.5">
              <div className="flex items-center justify-between rounded-xl border border-line-subtle bg-well px-4 py-3">
                <span className="text-caption text-ink-muted">兑换卡密</span>
                <span className="font-mono font-semibold text-body-sm text-brand tracking-wider">
                  {couponConfirmData.code}
                </span>
                <span className="rounded-full bg-wash border border-line-subtle px-2.5 py-0.5 text-micro text-ink-muted">
                  有效卡密
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-line-subtle bg-well px-4 py-3">
                <span className="text-caption text-ink-muted">充值权益</span>
                <span className="text-body-sm font-semibold text-ink">
                  {couponConfirmData.rewardTitle}
                </span>
                <span className="rounded-full bg-wash border border-line-subtle px-2.5 py-0.5 text-micro text-ink-muted">
                  {couponConfirmData.validityText}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-line-subtle bg-well px-4 py-3">
                <span className="text-caption text-ink-muted">充值账号</span>
                <span className="font-mono text-body-sm text-ink">
                  {couponConfirmData.account?.email || couponConfirmData.account?.phone || couponConfirmData.account?.displayName}
                </span>
                <span className="rounded-full bg-brand-soft border border-brand-line px-2.5 py-0.5 text-micro font-medium text-brand">
                  当前账号
                </span>
              </div>
            </div>

            {/* 底部确认操作按钮 */}
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleExecuteRedeem}
              disabled={couponRedeeming}
              className="mt-5 w-full font-semibold shadow-elevation-1 cursor-pointer"
            >
              {couponRedeeming ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  <span>正在核销到账...</span>
                </>
              ) : (
                '确认兑换到账'
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCouponConfirmData(null)}
              disabled={couponRedeeming}
              className="mt-2 w-full text-caption text-ink-muted hover:text-ink cursor-pointer"
            >
              返回修改
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  function renderPaymentProviders() {
    const pilotAlipaySelected = activeTab === 'universal' && pilotPackId === currentSelectionInfo.id;
    const alipayEnabled = availableProviders?.alipay?.enabled === true || pilotAlipaySelected;
    return (
      <div className="mt-5 border-t border-line-subtle pt-3.5">
        <p className="mb-2 text-label font-semibold text-ink-muted">{strings.selectPayMethod}</p>
        <div className="flex flex-wrap gap-2.5">
          {alipayEnabled && (
            <button
              type="button"
              onClick={() => setPayMethod('alipay')}
              className={`flex items-center justify-center gap-2 h-10 px-5 rounded-lg border font-medium text-xs transition-[background-color,border-color,color,box-shadow] cursor-pointer ${
                payMethod === 'alipay'
                  ? 'border-brand-line bg-brand-soft text-ink ring-2 ring-brand-ring shadow-elevation-1'
                  : 'border-line-subtle bg-well text-ink-muted hover:border-line-strong hover:text-ink'
              }`}
            >
              <AlipayIcon className="size-4" />
              <span>{strings.alipay}</span>
            </button>
          )}

          {availableProviders?.wechat?.enabled === true && (
            <button
              type="button"
              onClick={() => setPayMethod('wechat')}
              className={`flex items-center justify-center gap-2 h-10 px-5 rounded-lg border font-medium text-xs transition-[background-color,border-color,color,box-shadow] cursor-pointer ${
                payMethod === 'wechat'
                  ? 'border-brand-line bg-brand-soft text-ink ring-2 ring-brand-ring shadow-elevation-1'
                  : 'border-line-subtle bg-well text-ink-muted hover:border-line-strong hover:text-ink'
              }`}
            >
              <WeChatPayIcon className="size-4" />
              <span>{strings.wechat}</span>
            </button>
          )}

          {availableProviders?.paypal?.enabled === true && (
            <button
              type="button"
              onClick={() => setPayMethod('paypal')}
              className={`flex items-center justify-center gap-2 h-10 px-5 rounded-lg border font-medium text-xs transition-[background-color,border-color,color,box-shadow] cursor-pointer ${
                payMethod === 'paypal'
                  ? 'border-brand-line bg-brand-soft text-ink ring-2 ring-brand-ring shadow-elevation-1'
                  : 'border-line-subtle bg-well text-ink-muted hover:border-line-strong hover:text-ink'
              }`}
            >
              <PayPalIcon className="size-4" />
              <span>PayPal</span>
            </button>
          )}

          {availableProviders?.stripe?.enabled === true && (
            <button
              type="button"
              onClick={() => setPayMethod('stripe')}
              className={`flex items-center justify-center gap-2 h-10 px-5 rounded-lg border font-medium text-xs transition-[background-color,border-color,color,box-shadow] cursor-pointer ${
                payMethod === 'stripe'
                  ? 'border-brand-line bg-brand-soft text-ink ring-2 ring-brand-ring shadow-elevation-1'
                  : 'border-line-subtle bg-well text-ink-muted hover:border-line-strong hover:text-ink'
              }`}
            >
              <CreditCard className="size-4" />
              <span>{strings.intlCard}</span>
            </button>
          )}
          {!Object.values(availableProviders || {}).some((provider) => provider?.enabled) && !pilotAlipaySelected && (
            <p className="text-body-sm text-ink-muted">{strings.noPayChannels}</p>
          )}
        </div>
      </div>
    );
  }

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
