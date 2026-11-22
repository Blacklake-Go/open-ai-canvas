'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Briefcase, Check, ChevronDown, CircleUserRound, CreditCard, Gift, Loader2, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AuthModal from '@/components/AuthModal';
import RechargeModal from '@/components/account/RechargeModal';

const PLAN_CODE_NAMES = {
  starter: 'BASE',
  basic: 'STAR',
  plus: 'PRO',
  pro: 'APEX',
};

const FAQS = [
  {
    question: '订阅额度和通用算力有什么区别？',
    answer: '订阅方案展示每月随方案发放的额度；通用算力包是一次性购买，到账后进入永久算力余额。余额扣减顺序以账户的实际钱包明细为准。',
  },
  {
    question: '目前支持哪些订阅周期和付款方式？',
    answer: '当前可下单周期为月付。季付、年付暂未开放；付款方式仅显示服务端确认可用的渠道，未配置成功的渠道不会生成订单。',
  },
  {
    question: '付款后额度如何到账？',
    answer: '当前新购暂未开放。新购重新开放前会完成支付回调、退款和对账验收；已创建订单仍按支付状态正常处理。',
  },
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function getPlanFeatureGroups(plan) {
  const features = (Array.isArray(plan.features) ? plan.features : []).filter((feature) => !/^每月\s/.test(String(feature || '').trim()));
  const configured = plan.featureGroups;
  if (configured && typeof configured === 'object') {
    const sourceGroups = [
      { label: '视频模型专享', items: configured.video },
      { label: '图像模型特惠', items: configured.image },
      { label: '更多权益', items: configured.more },
    ];
    const normalized = sourceGroups.map((group) => ({
      label: group.label,
      items: Array.isArray(group.items) ? group.items.map((item) => String(item || '').trim()).filter(Boolean) : [],
    })).filter((group) => group.items.length > 0);
    if (normalized.length) return normalized;
  }

  const groups = [
    { label: '视频模型专享', items: [] },
    { label: '图像模型特惠', items: [] },
    { label: '更多权益', items: [] },
  ];

  for (const feature of features) {
    const value = String(feature || '').trim();
    if (!value) continue;
    if (/seedance|wan\b|视频|video/i.test(value)) groups[0].items.push(value);
    else if (/flova|图片|图像|image/i.test(value)) groups[1].items.push(value);
    else groups[2].items.push(value);
  }
  return groups.filter((group) => group.items.length > 0);
}

async function getJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败 (${response.status})`);
  return payload;
}

function PlanCard({ plan, onBuy, disabled }) {
  const base = Number(plan.quotaBase || 0);
  const bonus = Number(plan.quotaBonus || 0);
  const total = base + bonus;
  const groups = getPlanFeatureGroups(plan);
  const isPopular = plan.id === 'basic';
  const isFlagship = plan.id === 'pro';

  return (
    <article
      className={`pricing-plan-card relative flex min-w-0 flex-col rounded-2xl border p-5 transition-[background-color,border-color,color,transform] duration-page hover:-translate-y-0.5 hover:shadow-elevation-3 sm:p-6 xl:min-h-[802px] ${
        isPopular
          ? 'border-brand/40 bg-surface-raised shadow-elevation-2'
          : isFlagship
            ? 'border-brand-line bg-surface-raised shadow-elevation-2'
            : 'border-line bg-surface-raised hover:border-line-strong'
      }`}
    >
      {isPopular && (
        <span className="bg-brand text-white absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-micro font-extrabold uppercase tracking-wider shadow-elevation-2">
          最受欢迎
        </span>
      )}
      {isFlagship && (
        <span className="bg-brand text-white absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-micro font-extrabold uppercase tracking-wider shadow-elevation-2">
          旗舰尊享
        </span>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-sm font-black tracking-wider text-ink">{PLAN_CODE_NAMES[plan.id] || plan.id.toUpperCase()}</span>
          <h2 className="mt-1 truncate text-body-sm text-ink-muted">{plan.name}</h2>
        </div>
        <span className="shrink-0 rounded-full border border-line bg-well px-2.5 py-1 text-micro font-bold text-ink-muted">
          {plan.badge || '月度会员'}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-extrabold tracking-tight text-ink">¥{formatNumber(plan.monthlyCny)}</span>
          <span className="text-xs text-ink-subtle">/ 月</span>
        </div>
        <p className="mt-1 text-caption text-ink-subtle">月度计费 · 暂仅开放月付</p>
      </div>

      <div className="mt-4 rounded-xl border border-line-subtle bg-well p-3">
        <div className="flex items-center justify-between gap-2 text-xs font-bold">
          <span className="flex items-center gap-2 text-ink"><Zap className="size-3.5 text-warning" />每月到账</span>
          <span className="text-brand font-mono text-sm">{formatNumber(total)} 算力</span>
        </div>
        <p className="mt-1.5 text-micro text-ink-subtle">基础 {formatNumber(base)} + 赠送 {formatNumber(bonus)}</p>
      </div>

      <button
        type="button"
        onClick={() => onBuy(plan.id)}
        disabled={disabled}
        className={`mt-4 min-h-11 w-full rounded-full px-3 text-xs font-extrabold tracking-wide transition-[background-color,border-color,color] duration-base active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
          isPopular || isFlagship
            ? 'bg-brand hover:bg-brand-hover text-white shadow-elevation-3 hover:brightness-110'
            : 'bg-ink text-ink-inverse hover:brightness-110'
        }`}
      >
        {disabled ? '新购暂未开放' : '立即订阅'}
      </button>

      <div className="mt-5 flex-1 space-y-4 border-t border-line-subtle pt-4">
        {groups.map((group) => (
          <section key={group.label}>
            <h3 className="text-label font-bold uppercase tracking-widest text-ink-subtle">{group.label}</h3>
            <ul className="mt-2 space-y-2">
              {group.items.map((feature, index) => (
                <li key={`${group.label}-${index}`} className="flex items-start gap-2 text-body-sm leading-5 text-ink-muted">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-line-subtle pt-3 text-micro text-ink-subtle">
        <span className="inline-flex items-center gap-1.5"><CreditCard className="size-3.5 text-info" />按可用支付渠道结算</span>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-info" />订单核验后到账</span>
      </div>
    </article>
  );
}

function CreditPackCard({ pack, selected, onSelect }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(pack.id)}
      className={`group relative flex min-h-24 flex-col items-center justify-center rounded-2xl border px-3 py-4 text-center transition-[background-color,border-color,color,transform] duration-base hover:-translate-y-0.5 hover:shadow-elevation-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring active:scale-95 ${
        selected
          ? 'pricing-pink-border pricing-pink-soft-bg shadow-elevation-2'
          : 'border-line pricing-surface-bg hover:border-line-strong'
      }`}
    >
      <span className={`inline-flex items-center gap-2 text-sm font-extrabold ${selected ? 'pricing-pink-text' : 'text-ink'}`}>
        <Briefcase className="size-4" aria-hidden="true" />
        {formatNumber(pack.credits)}
      </span>
      <span className={`mt-1 text-xs font-bold ${selected ? 'text-ink' : 'text-ink-muted'}`}>¥{formatNumber(pack.priceCny)}</span>
    </button>
  );
}

export default function PricingClient() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [packs, setPacks] = useState([]);
  const [planProviders, setPlanProviders] = useState({});
  const [credits, setCredits] = useState(null);
  const [currentPlanName, setCurrentPlanName] = useState('FREE 工作室');
  const [plansLoading, setPlansLoading] = useState(true);
  const [packsLoading, setPacksLoading] = useState(true);
  const [planError, setPlanError] = useState('');
  const [packError, setPackError] = useState('');
  const [selectedPackId, setSelectedPackId] = useState('credit_490');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [openFaq, setOpenFaq] = useState(0);
  const pendingCheckoutRef = useRef(null);

  const loadInitialData = useCallback(async () => {
    const [accountResult, planResult, packResult] = await Promise.allSettled([
      getJson('/api/auth/me'),
      getJson('/api/billing/plans'),
      getJson('/api/billing/credit-packs'),
    ]);

    if (accountResult.status === 'fulfilled') {
      const account = accountResult.value;
      setUser(account.user || null);
      setCurrentPlanName(account.entitlements?.planName || (account.user ? '创作者会员' : 'FREE 工作室'));
      const buckets = account.entitlements?.creditBuckets;
      setCredits(Number(buckets?.totalAvailable ?? account.entitlements?.credits ?? 0));
    } else {
      setUser(null);
      setCurrentPlanName('FREE 工作室');
      setCredits(null);
    }

    if (planResult.status === 'fulfilled') {
      const published = Array.isArray(planResult.value.plans) ? planResult.value.plans : [];
      const commercial = published
        .filter((plan) => ['starter', 'basic', 'plus', 'pro'].includes(plan.id) && plan.enabled !== false)
        .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
      setPlans(commercial);
      setPlanProviders(planResult.value.providers || {});
      setPlanError(commercial.length ? '' : '当前没有可用的会员方案。');
    } else {
      setPlans([]);
      setPlanProviders({});
      setPlanError(planResult.reason?.message || '会员方案暂时无法读取，请稍后重试。');
    }
    setPlansLoading(false);

    if (packResult.status === 'fulfilled') {
      const published = Array.isArray(packResult.value.packs) ? packResult.value.packs : [];
      setPacks(published);
      setPackError(published.length ? '' : '通用算力包暂不可用。');
      if (published.length) setSelectedPackId((current) => published.some((pack) => pack.id === current) ? current : published[0].id);
    } else {
      setPacks([]);
      setPackError(packResult.reason?.message || '通用算力包暂时无法读取，请稍后重试。');
    }
    setPacksLoading(false);

    return accountResult.status === 'fulfilled' ? accountResult.value : null;
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const sectionId = window.location.hash.slice(1);
    if (!['plans', 'credit-packs'].includes(sectionId)) return undefined;
    if (sectionId === 'credit-packs' && (plansLoading || packsLoading)) return undefined;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ block: 'start', behavior: 'auto' });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [packsLoading, plansLoading]);

  const selectedPack = useMemo(() => packs.find((pack) => pack.id === selectedPackId) || null, [packs, selectedPackId]);
  const hasSubscriptionProvider = Object.values(planProviders).some((provider) => provider?.enabled);
  const startCheckout = (type, id) => {
    if (!user) {
      pendingCheckoutRef.current = { type, id };
      setShowAuthModal(true);
      return;
    }
    setCheckout({ type, id });
  };

  const handleAuthSuccess = async () => {
    setShowAuthModal(false);
    await loadInitialData();
    if (pendingCheckoutRef.current) {
      setCheckout(pendingCheckoutRef.current);
      pendingCheckoutRef.current = null;
    }
  };

  return (
    <div className="pricing-page pricing-page-bg min-h-screen px-3 py-4 text-ink selection:bg-brand-soft sm:px-6 sm:py-8 lg:px-16">
      <main className="relative mx-auto w-full max-w-screen-2xl rounded-2xl border border-line bg-base px-4 pb-12 pt-12 shadow-elevation-3 sm:px-8 sm:pt-12 sm:pb-64 lg:px-10">
        <button type="button" onClick={() => router.back()} aria-label="关闭会员方案" className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full border border-line bg-raised text-ink-muted transition-colors duration-fast hover:bg-wash hover:text-ink">
          <X className="size-4" />
        </button>
        <section className="mx-auto max-w-6xl text-center pt-2">
          <h1 className="mt-2 text-4xl font-black tracking-tight text-ink sm:text-5xl lg:text-6xl">订阅会员，升级你的创作权益</h1>
          <p className="mx-auto mt-3 max-w-3xl text-xs leading-6 text-ink-muted sm:text-sm">
            专享高并发 GPU 算力通道 · 200+ 顶级 AI 模型全开
          </p>

          <div className="mt-7 grid w-full grid-cols-1 justify-items-center gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-0 sm:justify-items-stretch">
            <div className="inline-flex items-center justify-center rounded-full border border-line pricing-card-bg p-1 shadow-elevation-2 sm:col-start-2 sm:min-w-max" aria-label="订阅周期">
              <span className="rounded-full bg-ink px-5 py-2 text-xs font-bold text-ink-inverse">月付</span>
              <button type="button" disabled aria-label="季付暂未开放" title="季付暂未开放" className="cursor-not-allowed rounded-full px-5 py-2 text-xs font-semibold text-ink-disabled opacity-70">
                季付 <span className="ml-1 text-micro">即将开放</span>
              </button>
              <button type="button" disabled aria-label="年付暂未开放" title="年付暂未开放" className="cursor-not-allowed rounded-full px-5 py-2 text-xs font-semibold text-ink-disabled opacity-70">
                年付 <span className="ml-1 text-micro">即将开放</span>
              </button>
            </div>
            <Link href="#credit-packs" className="pricing-pink-outline pricing-pink-wash-bg pricing-pink-hover-border inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-bold text-ink transition-[background-color,border-color,color,transform] duration-base hover:-translate-y-0.5 hover:shadow-elevation-3 sm:col-start-3 sm:min-w-menu sm:justify-self-end">
              <Gift className="size-3.5 pricing-pink-text" /> 查看通用算力包 <span className="pricing-pink-bg rounded-full px-2 py-0.5 text-micro font-extrabold text-white">新购暂停</span> <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <p className="mt-2 text-micro text-ink-subtle">季付、年付待支付与周期履约完整接入后开放</p>
          <p className="mx-auto mt-4 max-w-3xl rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-xs leading-5 text-warning" role="status">
            新购暂未开放。支付成功、退款与对账流程完成验收后再开放；已有订单查询与支付回调仍可正常处理。
          </p>
        </section>

        <section id="plans" aria-label="会员订阅方案" className="scroll-mt-0 mt-8">
          {plansLoading ? (
            <div className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-line pricing-card-bg text-xs text-ink-muted">
              <Loader2 className="size-4 animate-spin" /> 正在读取会员方案…
            </div>
          ) : planError ? (
            <div className="rounded-2xl border border-warning-line bg-warning-soft p-5 text-sm text-warning" role="alert">{planError}</div>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} disabled={!hasSubscriptionProvider} onBuy={(id) => startCheckout('subscription', id)} />
              ))}
            </div>
          )}
          {!plansLoading && plans.length > 0 && !hasSubscriptionProvider && (
            <p className="mt-3 text-center text-xs text-warning" role="status">新购暂未开放；不会创建付款订单。</p>
          )}
        </section>

        <section id="credit-packs" className="scroll-mt-0 mt-16">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-line-subtle pb-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-ink">补充通用算力</h2>
              <p className="mt-1 text-xs text-ink-muted">一次性购买、到账后永久有效；与会员月度额度分开显示。</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-micro text-ink-subtle"><ShieldCheck className="size-3.5 text-info" />新购暂未开放</span>
          </div>

          <div className="pricing-frame-bg rounded-2xl border border-line p-4 shadow-elevation-4 sm:p-6 lg:p-7">
            <div className="pricing-raised-bg flex flex-col gap-4 rounded-2xl border border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="pricing-avatar-bg flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-elevation-2"><CircleUserRound className="size-5" /></span>
                <div className="min-w-0 text-left">
                  <p className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
                    <span>目前是</span><span className="rounded border border-line px-1.5 py-0.5 font-bold text-ink">{user ? currentPlanName : 'FREE 工作室'}</span>
                    <Link href="#plans" className="font-semibold pricing-pink-text hover:underline">升级会员 →</Link>
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <span className="text-caption font-semibold text-ink-muted">通用盒</span>
              <span className="inline-flex items-center gap-1.5 text-lg font-black text-ink"><Zap className="size-4" />{credits === null ? '登录后同步' : formatNumber(credits)}</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold text-ink">通用算力包</h3>
              <span className="text-micro text-ink-subtle">新购验收完成后开放</span>
            </div>

            {packsLoading ? (
              <div className="flex min-h-36 items-center justify-center gap-2 text-xs text-ink-muted"><Loader2 className="size-4 animate-spin" />正在读取算力包…</div>
            ) : packError ? (
              <div className="mt-4 rounded-xl border border-warning-line bg-warning-soft p-4 text-xs text-warning" role="alert">{packError}</div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {packs.map((pack) => (
                    <CreditPackCard key={pack.id} pack={pack} selected={selectedPackId === pack.id} onSelect={setSelectedPackId} />
                  ))}
                </div>
                <p className="mt-4 flex items-start gap-2 text-micro leading-5 text-ink-subtle">
                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" />
                  算力包新购目前未开放；恢复购买前会先完成对应结账、到账、退款和对账验收。
                </p>
                <button
                  type="button"
                  disabled
                  className="bg-brand hover:bg-brand-hover mx-auto mt-5 flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-full px-6 text-sm font-extrabold text-white shadow-elevation-3 transition-transform duration-base hover:-translate-y-0.5 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Zap className="size-4" />
                  {selectedPack ? `算力包购买暂未开放 · ¥${formatNumber(selectedPack.priceCny)}` : '算力包购买暂未开放'}
                </button>
                <p className="mt-3 text-center text-xs text-warning" role="status">算力包新购暂未开放。已完成支付成功、退款及对账验收后再启用。</p>
              </>
            )}
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-4xl">
          <h2 className="mb-3 text-center text-lg font-extrabold text-ink">订阅与算力常见问题</h2>
          <div className="pricing-card-bg divide-y divide-line-subtle rounded-2xl border border-line px-4 sm:px-6">
            {FAQS.map((item, index) => (
              <div key={item.question} className="py-4">
                <button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} className="flex w-full items-center justify-between gap-4 text-left text-xs font-bold text-ink">
                  <span>{item.question}</span><ChevronDown className={`size-4 shrink-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === index && <p className="mt-3 max-w-3xl text-xs leading-6 text-ink-muted">{item.answer}</p>}
              </div>
            ))}
          </div>
        </section>
      </main>

      {showAuthModal && (
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />
      )}

      {checkout && (
        <RechargeModal
          key={`${checkout.type}:${checkout.id}`}
          isOpen
          initialTab={checkout.type === 'credit_pack' ? 'points' : 'sub'}
          initialPlanId={checkout.type === 'subscription' ? checkout.id : null}
          initialCreditPackId={checkout.type === 'credit_pack' ? checkout.id : null}
          onClose={() => setCheckout(null)}
          onPaySuccess={loadInitialData}
        />
      )}
    </div>
  );
}
