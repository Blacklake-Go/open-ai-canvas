'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CouponGeneratorClient() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [type, setType] = useState('credits');
  const [value, setValue] = useState('50');
  const [maxUses, setMaxUses] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resultCodes, setResultCodes] = useState([]);
  const [feedback, setFeedback] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    setResultCodes([]);

    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ count, type, value, maxUses }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || '生成失败');

      setResultCodes(data.data.codes || []);
      setFeedback(`成功生成 ${data.data.count} 个兑换码！`);
      router.refresh();
    } catch (err) {
      setFeedback(`错误: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-xl bg-brand/10 border border-brand/30 px-4 py-2 text-xs font-semibold text-brand hover:bg-brand/20 transition"
        >
          {open ? '收起卡密生成器' : '＋ 批量生成卡密兑换码'}
        </button>
      </div>

      {open && (
        <form onSubmit={handleGenerate} className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <h3 className="text-sm font-bold text-white mb-4">卡密兑换码批量生成</h3>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-[11px] text-white/40 mb-1">生成数量</label>
              <input
                type="number"
                min="1"
                max="100"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-[11px] text-white/40 mb-1">权益类型</label>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  if (e.target.value === 'plan') setValue('pro');
                  else setValue('50');
                }}
                className="w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2 text-xs text-white/80 outline-none focus:border-brand"
              >
                <option value="credits">算力额度 (Credits)</option>
                <option value="plan">套餐方案 (Plan)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-white/40 mb-1">
                {type === 'credits' ? '赠送额度数值' : '开通套餐 ID'}
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === 'credits' ? '如 100' : '如 pro 或 team'}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-[11px] text-white/40 mb-1">单码可用次数</label>
              <input
                type="number"
                min="1"
                max="10000"
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            {feedback ? (
              <span className="text-xs text-brand font-medium">{feedback}</span>
            ) : <span />}

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white hover:bg-brand-hover transition disabled:opacity-50"
            >
              {loading ? '正在生成…' : '确认生成卡密'}
            </button>
          </div>

          {resultCodes.length > 0 && (
            <div className="mt-4 rounded-xl border border-brand/20 bg-black/40 p-4">
              <p className="text-xs font-bold text-brand mb-2">本次生成的卡密代码（可直接复制分发）：</p>
              <textarea
                readOnly
                rows={Math.min(6, resultCodes.length)}
                value={resultCodes.join('\n')}
                className="w-full rounded-lg bg-transparent font-mono text-xs text-white/90 outline-none select-all"
              />
            </div>
          )}
        </form>
      )}
    </div>
  );
}
