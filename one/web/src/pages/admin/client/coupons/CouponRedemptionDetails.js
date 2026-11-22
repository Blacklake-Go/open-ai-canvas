'use client';

import React, { useState } from 'react';
import { X, User, Clock, CheckCircle2, ShieldCheck, ExternalLink } from 'lucide-react';
import { CopyableId } from '@/components/admin/AdminUi';

function formatDate(value) {
  return value
    ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
    : '—';
}

export default function CouponRedemptionDetails({
  couponCode,
  redemptions = [],
  usedCount = 0,
  maxUses = 1,
  type = 'credits',
  value = '',
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const items = Array.isArray(redemptions) ? redemptions : [];

  if (usedCount === 0 || items.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-white/35">
        <span className="size-1.5 rounded-full bg-white/20" />
        <span>待核销 / 暂无明细</span>
      </div>
    );
  }

  const latest = items[0];

  return (
    <>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-white">
          <span className="text-brand font-medium truncate max-w-[190px]" title={latest.userEmail || latest.userName || latest.userId}>
            👤 {latest.userEmail || latest.userName || latest.userId}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-white/50">
          <span className="font-mono">🕒 {formatDate(latest.redeemedAt)}</span>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-brand hover:text-brand-hover underline cursor-pointer shrink-0 font-medium"
          >
            {items.length > 1 ? `共 ${items.length} 条明细` : '明细详情'}
          </button>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#12141a] p-6 shadow-elevation-4 animate-in zoom-in-95 duration-150">
            {/* 弹窗头部 */}
            <div className="flex items-start justify-between pb-4 border-b border-white/[0.08]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">卡密兑换明细</h3>
                  <span className="font-mono font-bold text-xs text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-lg">
                    {couponCode}
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-1">
                  该卡密面值: {type === 'credits' ? `+${value} 创作算力` : `${String(value).toUpperCase()} 会员`} · 累计已核销 {usedCount} / {maxUses} 次
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition cursor-pointer"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 明细列表 */}
            <div className="mt-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] bg-white/[0.02] text-white/40 font-semibold uppercase">
                  <tr>
                    <th className="px-3 py-2.5">序号</th>
                    <th className="px-3 py-2.5">兑换用户</th>
                    <th className="px-3 py-2.5">用户 ID</th>
                    <th className="px-3 py-2.5">手机号</th>
                    <th className="px-3 py-2.5">兑换时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-3 text-white/40 font-mono">#{idx + 1}</td>
                      <td className="px-3 py-3 font-medium text-white">
                        <div>{item.userEmail || item.userName || '—'}</div>
                        {item.userName && item.userEmail && item.userName !== item.userEmail && (
                          <div className="text-[11px] text-white/40">{item.userName}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-brand">
                        <CopyableId id={item.userId} />
                      </td>
                      <td className="px-3 py-3 text-white/70 font-mono">
                        {item.userPhone || '—'}
                      </td>
                      <td className="px-3 py-3 text-white/60 font-mono">
                        {formatDate(item.redeemedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 弹窗底部 */}
            <div className="mt-5 flex justify-end pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2 text-xs font-semibold text-white transition cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
