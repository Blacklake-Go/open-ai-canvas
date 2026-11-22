'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Coins, Loader2, Sparkles, ShoppingBag, ShieldCheck } from 'lucide-react';
import StudioHeader from '@/components/site/StudioHeader';
import AuthModal from '@/components/AuthModal';
import AvatarFrame from '@/components/profile/AvatarFrame';
import { Button } from '@/components/ui/button';

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `coin-reward-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const PREVIEW_THEME = {
  solar: 'from-amber-300 via-yellow-500 to-orange-600',
  neon: 'from-cyan-300 via-sky-500 to-blue-600',
  aurora: 'from-fuchsia-300 via-violet-500 to-emerald-400',
};

export default function CoinExchangeClient() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState('');
  const [message, setMessage] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meResponse, rewardsResponse] = await Promise.all([
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/financial/currency/rewards', { cache: 'no-store' }),
      ]);
      const me = meResponse.ok ? await meResponse.json() : {};
      const catalog = rewardsResponse.ok ? await rewardsResponse.json() : { rewards: [] };
      setUser(me.user || null);
      setBalance(Number(me.entitlements?.currencyWallet?.availableBalance ?? me.user?.kcoins ?? 0));
      setRewards(Array.isArray(catalog.rewards) ? catalog.rewards : []);
    } catch {
      setMessage('兑换中心暂时无法加载，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const equipped = useMemo(() => rewards.find((reward) => reward.equipped), [rewards]);

  const handleReward = async (reward) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (busySlug) return;
    setBusySlug(reward.slug);
    setMessage('');
    try {
      if (!reward.owned) {
        const response = await fetch('/api/financial/currency/rewards', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-idempotency-key': createIdempotencyKey(),
          },
          body: JSON.stringify({ action: 'redeem', rewardSlug: reward.slug }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || '头像框兑换失败');
        setBalance(Number(data.balanceAfter ?? balance));
      }

      const equipResponse = await fetch('/api/financial/currency/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'equip', rewardSlug: reward.slug }),
      });
      const equipData = await equipResponse.json().catch(() => ({}));
      if (!equipResponse.ok) throw new Error(equipData.error || '头像框佩戴失败');
      setMessage(`${reward.name} 已${reward.owned ? '佩戴' : '兑换并佩戴'}，头像框会同步到用户菜单。`);
      await load();
    } catch (error) {
      setMessage(error.message || '操作失败，请稍后重试');
    } finally {
      setBusySlug('');
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-white flex flex-col selection:bg-amber-500/30">
      <StudioHeader title="K 币兑换中心" subtitle="用社区互动硬币兑换专属头像框" />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/credits" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="size-3.5" /> 返回资产中心
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
            <Coins className="size-3.5" />
            <span>我的 K 币</span>
            <strong className="font-mono text-amber-200">{balance.toLocaleString()}</strong>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-xs font-semibold text-cyan-200">
            {message}
          </div>
        )}

        <section className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-[#10131c] to-[#0b0d13] p-6 sm:p-8 shadow-2xl">
          <div className="absolute -right-20 -top-28 size-72 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-amber-300">
                <ShoppingBag className="size-5" />
                <span className="text-xs font-bold uppercase tracking-[0.2em]">K-Coin Rewards</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">兑换并佩戴你的专属头像框</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300">
                K 币来自每日登录和社区作品投币。兑换成功后会写入账户权益，并可在用户菜单、社区和个人主页继续展示。
              </p>
            </div>
            {equipped && (
              <div className="shrink-0 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-right">
                <div className="text-[11px] text-zinc-400">当前佩戴</div>
                <div className="mt-1 text-sm font-bold text-amber-200">{equipped.name}</div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold"><Sparkles className="size-4 text-cyan-300" />头像框专区</h2>
              <p className="mt-1 text-xs text-zinc-500">永久权益，重复点击不会重复扣币。</p>
            </div>
            <div className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:flex"><ShieldCheck className="size-3.5 text-emerald-400" /> 事务扣账 · 幂等保护</div>
          </div>

          {loading ? (
            <div className="flex min-h-52 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-400"><Loader2 className="mr-2 size-4 animate-spin" />正在加载兑换商品…</div>
          ) : rewards.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-zinc-400">暂无可兑换头像框</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {rewards.map((reward) => {
                const theme = reward.assetConfig?.theme || 'solar';
                return (
                  <article key={reward.slug} className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${reward.equipped ? 'border-amber-400/60 bg-amber-500/10' : 'border-white/[0.09] bg-base hover:border-cyan-400/40'}`}>
                    {reward.equipped && <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-300"><Check className="size-3" />已佩戴</div>}
                    <div className="flex items-center gap-4">
                      <AvatarFrame frame={reward} className="size-16 shrink-0 bg-[#171922] p-0.5">
                        <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#252938] to-[#0e1017] text-2xl font-black text-white">K</div>
                      </AvatarFrame>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white">{reward.name}</h3>
                        <div className={`mt-1 h-1.5 w-24 rounded-full bg-gradient-to-r ${PREVIEW_THEME[theme] || PREVIEW_THEME.solar}`} />
                        <div className="mt-2 font-mono text-sm font-bold text-amber-300">🪙 {reward.costCoins} K 币</div>
                      </div>
                    </div>
                    <p className="mt-4 min-h-10 text-xs leading-relaxed text-zinc-400">{reward.description}</p>
                    <Button type="button" size="sm" onClick={() => handleReward(reward)} disabled={busySlug === reward.slug || reward.equipped} className="mt-5 w-full cursor-pointer bg-white text-black hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500">
                      {busySlug === reward.slug ? <Loader2 className="size-3.5 animate-spin" /> : reward.equipped ? '当前已佩戴' : reward.owned ? '佩戴头像框' : '兑换并佩戴'}
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onSuccess={() => { setShowAuthModal(false); load(); }} />
    </div>
  );
}
