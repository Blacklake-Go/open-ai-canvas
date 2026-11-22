'use client';

/**
 * 实时报价预览组件。
 *
 * 选择模型+参数后，向后台请求预报价，展示预计积分消耗。
 */

import { useState, useEffect } from 'react';
import { Coins, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function QuotePreview({ model, parameters }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!model?.id) {
      setQuote(null);
      return;
    }

    const controller = new AbortController();
    const fetchQuote = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/app/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId: model.id, parameters }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (res.ok && data.data) {
          setQuote(data.data);
        } else {
          setError(data.error?.message || '报价失败');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('网络异常');
        }
      } finally {
        setLoading(false);
      }
    };

    // 节流 500ms
    const timer = setTimeout(fetchQuote, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [model?.id, parameters]);

  if (!model) return null;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <Coins className="size-3.5 text-amber-400" />
          <span className="text-gray-300 font-medium">预计消耗</span>
        </div>
        {loading && <Loader2 className="size-3 animate-spin text-gray-500" />}
      </div>

      {error ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="size-3" />
          {error}
        </div>
      ) : quote ? (
        <div className="mt-2 flex items-center gap-4">
          <div>
            <span className="text-2xl font-bold font-mono text-cyan-400">{quote.credits}</span>
            <span className="ml-1 text-xs text-gray-500">积分</span>
          </div>
          {quote.priceCny && (
            <div className="text-xs text-gray-400">
              ≈ ¥{Number(quote.priceCny).toFixed(2)}
            </div>
          )}
          {quote.marginOk !== false && (
            <CheckCircle className="size-3.5 text-emerald-400" />
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500">选择参数后自动报价</p>
      )}
    </div>
  );
}
