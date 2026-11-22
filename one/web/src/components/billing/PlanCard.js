'use client';

// Adapted from Nano Banana Generator's pricing-card anatomy. Checkout and
// entitlement decisions remain in SupDance's billing routes.
export default function PlanCard({ plan, current = false, providers = {}, busy = false, onCheckout }) {
  const isFree = plan.id === 'free';
  return (
    <article className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-transform duration-200 hover:-translate-y-0.5 ${current ? 'border-cyan-300/50 bg-cyan-300/[0.06]' : 'border-white/10 bg-white/[0.04]'}`}>
      {current && <span className="absolute right-4 top-4 text-[10px] font-semibold text-cyan-200">当前方案</span>}
      <div>
        <h2 className="font-semibold text-white">{plan.name}</h2>
        <p className="mt-4 text-2xl font-bold text-white">{plan.monthlyCny ? `¥${plan.monthlyCny}` : '免费'}<span className="ml-1 text-xs font-normal text-white/40">/月</span></p>
        <ul className="mt-4 space-y-2 text-xs leading-5 text-white/65">{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
      </div>
      {!isFree && (
        <div className="mt-5 space-y-2">
          <button type="button" disabled={busy || !providers.stripe?.enabled} onClick={() => onCheckout(plan.id, 'stripe')} className="w-full rounded-lg border border-white/15 px-3 py-2 text-xs transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">{providers.stripe?.enabled ? `海外：Stripe ${providers.stripe.mode === 'test' ? '测试订阅' : '订阅'}` : 'Stripe 待配置'}</button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy || !providers.wechat?.enabled} onClick={() => onCheckout(plan.id, 'wechat')} className="rounded-lg border border-white/15 px-2 py-2 text-xs transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">{providers.wechat?.enabled ? '微信支付' : '微信待配置'}</button>
            <button type="button" disabled={busy || !providers.alipay?.enabled} onClick={() => onCheckout(plan.id, 'alipay')} className="rounded-lg border border-white/15 px-2 py-2 text-xs transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">{providers.alipay?.enabled ? '支付宝' : '支付宝待配置'}</button>
          </div>
        </div>
      )}
    </article>
  );
}
