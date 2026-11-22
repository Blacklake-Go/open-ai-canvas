'use client';

import React, { useEffect, useState } from 'react';
import { useBranding } from '@/lib/hooks/useBranding';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

function formatDateTime(value, fallback = '待支付') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatPaymentMethod(provider) {
  const methods = {
    alipay: '支付宝',
    wechat: '微信支付',
    stripe: 'Stripe',
    mock: '平台支付',
  };
  return methods[String(provider || '').toLowerCase()] || provider || '在线支付';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ReceiptBrand({ brand, compact = false }) {
  const brandName = brand?.brandName || 'supdance';
  const logoUrl = brand?.logoUrl;

  return (
    <div className={`flex items-center ${compact ? 'gap-2.5' : 'gap-3'}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={brandName}
          className={`${compact ? 'h-7 max-w-[150px]' : 'h-10 max-w-[210px]'} w-auto object-contain`}
        />
      ) : (
        <span className={`${compact ? 'text-lg' : 'text-2xl'} font-bold tracking-tight text-ink`}>
          {brandName}
        </span>
      )}
    </div>
  );
}

function statusClasses(color) {
  if (color === 'emerald') return 'bg-brand-soft text-brand border-brand-line';
  if (color === 'amber') return 'bg-amber-400/10 text-amber-400 border-amber-400/25';
  if (color === 'blue') return 'bg-brand-soft text-brand border-brand-line';
  return 'bg-wash text-ink-muted border-line-subtle';
}

function buildReceiptHtml(order, brand) {
  const brandName = escapeHtml(brand?.brandName || 'supdance');
  const logoUrl = String(brand?.logoUrl || '');
  const logoSrc = logoUrl.startsWith('/') && typeof window !== 'undefined'
    ? `${window.location.origin}${logoUrl}`
    : logoUrl;
  const logoMarkup = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" alt="${brandName}" style="height:40px;max-width:220px;object-fit:contain;display:block;" />`
    : `<div style="font-size:28px;font-weight:900;letter-spacing:-0.06em;color:#0f172a;">${brandName}</div>`;
  const status = escapeHtml(order.status || '已支付');
  const paidAt = escapeHtml(formatDateTime(order.paidAt));
  const createdAt = escapeHtml(formatDateTime(order.createdAt, order.date || '—'));

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${brandName} 支付凭证 - ${escapeHtml(order.id)}</title>
<style>
  :root { color-scheme: light; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f1f5f9; color: #0f172a; padding: 48px 20px; }
  .paper { max-width: 780px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 56px; box-shadow: 0 18px 60px rgba(15, 23, 42, .12); }
  .top { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; padding-bottom:40px; border-bottom:1px solid #e2e8f0; }
  .eyebrow { margin: 0 0 14px; color:#64748b; font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; }
  h1 { margin:0; font-size:32px; letter-spacing:-.04em; }
  .amount { margin: 42px 0; padding: 28px; border-radius:18px; background:#f8fafc; }
  .amount-label { color:#64748b; font-size:13px; }
  .amount-value { margin-top:10px; font-size:42px; line-height:1; font-weight:800; letter-spacing:-.05em; }
  dl { display:grid; grid-template-columns:1fr 1fr; gap: 26px 42px; margin:0; }
  dt { color:#64748b; font-size:12px; margin-bottom:7px; }
  dd { margin:0; font-size:15px; font-weight:650; word-break:break-word; }
  .footer { margin-top:46px; padding-top:20px; border-top:1px solid #e2e8f0; color:#64748b; font-size:12px; display:flex; justify-content:space-between; gap:20px; }
  @media (max-width: 620px) { body { padding:16px 10px; } .paper { padding:28px 22px; border-radius:18px; } .top, dl { display:block; } .top > * + * { margin-top:24px; } dl > div + div { margin-top:20px; } .amount-value { font-size:34px; } .footer { display:block; } .footer > * + * { margin-top:8px; } }
</style></head><body><main class="paper">
  <div class="top"><div>${logoMarkup}<p class="eyebrow" style="margin-top:24px;">PAYMENT RECEIPT</p><h1>支付凭证</h1></div><div style="text-align:right;color:#64748b;font-size:12px;line-height:1.7;">${status}<br />电子凭证</div></div>
  <section class="amount"><div class="amount-label">实付金额</div><div class="amount-value">${escapeHtml(order.amount)}</div></section>
  <dl>
    <div><dt>订单号</dt><dd>${escapeHtml(order.id)}</dd></div>
    <div><dt>支付时间</dt><dd>${paidAt}</dd></div>
    <div><dt>支付方式</dt><dd>${escapeHtml(formatPaymentMethod(order.provider))}</dd></div>
    <div><dt>购买项目</dt><dd>${escapeHtml(order.plan)}</dd></div>
    <div><dt>下单时间</dt><dd>${createdAt}</dd></div>
    ${order.providerOrderId ? `<div><dt>支付流水号</dt><dd>${escapeHtml(order.providerOrderId)}</dd></div>` : ''}
  </dl>
  <div class="footer"><span>${brandName} · 创作服务支付凭证</span><span>请妥善保存此凭证</span></div>
</main></body></html>`;
}

function ReceiptPreview({ order, brand, onClose, onDownload }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/75 p-3 backdrop-blur-xl sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="支付凭证预览"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[94vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-line-subtle bg-surface-raised shadow-elevation-4">
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4 sm:px-7">
          <div>
            <h4 className="text-body-sm font-semibold text-ink">支付凭证预览</h4>
            <p className="mt-0.5 text-caption text-ink-muted">电子付款收据与凭据明细</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-caption font-medium text-ink-muted transition-colors hover:bg-wash hover:text-ink cursor-pointer"
          >
            关闭
          </button>
        </div>

        <div className="overflow-y-auto p-3 sm:p-7 custom-scrollbar">
          <article className="mx-auto max-w-[650px] rounded-xl border border-slate-200 bg-white p-6 text-slate-950 shadow-elevation-2 sm:p-10">
            <div className="flex flex-col gap-5 border-b border-slate-200 pb-8 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <ReceiptBrand brand={brand} />
                <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Payment receipt</p>
                <h5 className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">支付凭证</h5>
              </div>
              <div className="text-left text-xs leading-6 text-slate-500 sm:text-right">
                <p className="font-semibold text-emerald-700">{order.status || '已支付'}</p>
                <p>电子凭证</p>
              </div>
            </div>

            <div className="my-8 rounded-xl bg-slate-50 px-5 py-6 sm:px-7">
              <p className="text-xs font-medium text-slate-500">实付金额</p>
              <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">{order.amount}</p>
            </div>

            <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">订单号</dt><dd className="mt-1 break-all text-sm font-semibold text-slate-950">{order.id}</dd></div>
              <div><dt className="text-xs text-slate-500">支付时间</dt><dd className="mt-1 text-sm font-semibold text-slate-950">{formatDateTime(order.paidAt)}</dd></div>
              <div><dt className="text-xs text-slate-500">支付方式</dt><dd className="mt-1 text-sm font-semibold text-slate-950">{formatPaymentMethod(order.provider)}</dd></div>
              <div><dt className="text-xs text-slate-500">购买项目</dt><dd className="mt-1 text-sm font-semibold text-slate-950">{order.plan}</dd></div>
              <div><dt className="text-xs text-slate-500">下单时间</dt><dd className="mt-1 text-sm font-semibold text-slate-950">{formatDateTime(order.createdAt, order.date || '—')}</dd></div>
              {order.providerOrderId && <div><dt className="text-xs text-slate-500">支付流水号</dt><dd className="mt-1 break-all text-sm font-semibold text-slate-950">{order.providerOrderId}</dd></div>}
            </dl>

            <div className="mt-9 flex items-center justify-between gap-4 border-t border-slate-200 pt-5 text-xs text-slate-500">
              <span>{brand?.brandName || 'supdance'} · 创作服务支付凭证</span>
              <span>请妥善保存</span>
            </div>
          </article>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-line-subtle bg-surface px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            返回列表
          </Button>
          <Button type="button" variant="primary" size="md" onClick={onDownload}>
            下载支付凭证
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function InvoicesTab() {
  const { brand } = useBranding();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewOrder, setPreviewOrder] = useState(null);

  useEffect(() => {
    let active = true;
    async function fetchOrders() {
      try {
        const res = await fetch('/api/billing/orders/my', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (active && data.orders) setOrders(data.orders);
        }
      } catch (err) {
        console.error('加载支付凭证失败:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchOrders();
    return () => { active = false; };
  }, []);

  const handleDownloadReceipt = (order) => {
    if (!order?.downloadable) return;
    const blob = new Blob([buildReceiptHtml(order, brand)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${brand?.brandName || 'supdance'}_支付凭证_${order.id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-page-title text-ink">支付凭证</h1>
          <p className="mt-1 text-body-subtle text-ink-muted">
            查看并下载已支付订单的电子凭证。
          </p>
        </div>
        <div className="rounded-xl border border-line-subtle bg-surface px-4 py-2.5 self-start sm:self-auto">
          <ReceiptBrand brand={brand} compact />
        </div>
      </div>

      <Card className="rounded-xl border border-line-subtle bg-surface shadow-elevation-1 overflow-hidden p-0">
        <div className="flex flex-col gap-1 border-b border-line-subtle px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-body-sm font-semibold text-ink">历史订单</h4>
            <p className="mt-0.5 text-caption text-ink-muted">仅已支付订单支持凭证预览与下载</p>
          </div>
          <span className="text-caption text-ink-subtle">共 {orders.length} 笔</span>
        </div>

        {loading ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-ink-muted">
            <span className="size-5 animate-spin rounded-full border-2 border-brand-line border-t-brand" aria-hidden="true" />
            <span className="text-caption">正在加载订单…</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
            <p className="text-body-sm font-semibold text-ink">暂无支付凭证</p>
            <p className="mt-1 max-w-sm text-caption text-ink-muted">完成充值或订阅后，支付成功的订单会自动同步在此。</p>
          </div>
        ) : (
          <div className="divide-y divide-line-subtle">
            {orders.map((order) => (
              <div key={order.id} className="flex flex-col gap-4 px-6 py-4 transition-colors hover:bg-wash sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="truncate text-body-sm font-semibold text-ink">{order.plan}</span>
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-micro font-medium ${statusClasses(order.color)}`}>{order.status}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
                    <span>订单号：{order.id}</span>
                    <span>下单：{formatDateTime(order.createdAt, order.date || '—')}</span>
                    <span>支付：{formatDateTime(order.paidAt)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                  <span className="text-base font-semibold tracking-tight text-ink tabular-nums">{order.amount}</span>
                  {order.downloadable ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setPreviewOrder(order)}
                    >
                      预览支付凭证
                    </Button>
                  ) : (
                    <span className="text-caption text-ink-subtle">支付成功后可下载</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {previewOrder && (
        <ReceiptPreview
          order={previewOrder}
          brand={brand}
          onClose={() => setPreviewOrder(null)}
          onDownload={() => handleDownloadReceipt(previewOrder)}
        />
      )}
    </div>
  );
}
