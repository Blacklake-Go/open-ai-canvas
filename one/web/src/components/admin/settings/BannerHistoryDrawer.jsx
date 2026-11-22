'use client';

import React from 'react';
import { X, Check, RotateCcw, Trash2, ArrowUpRight, History } from 'lucide-react';

export default function BannerHistoryDrawer({
  isOpen,
  onClose,
  historyList,
  currentBannerId,
  onApply,
  onLoad,
  onDelete,
  loadingId,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg h-full bg-[#0e1013] border-l border-line-subtle shadow-2xl flex flex-col">
        {/* 抽屉顶栏 */}
        <div className="h-14 px-6 border-b border-line-subtle flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <History className="size-4 text-brand" />
            <div>
              <h3 className="text-body font-semibold text-ink">历史横幅版本库</h3>
              <p className="text-caption text-ink-subtle">
                一键回滚历史优秀活动横幅，或载入参数作为新活动模版
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-ink-subtle hover:text-ink hover:bg-white/[0.06] transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 列表区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {(!historyList || historyList.length === 0) && (
            <div className="text-center py-12 text-ink-subtle text-caption">
              暂无历史归档横幅，保存当前横幅后将自动生成历史版本快照。
            </div>
          )}

          {historyList?.map((item) => {
            const isCurrent = currentBannerId === item.id;
            const isLoading = loadingId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 transition-all ${
                  isCurrent
                    ? 'border-brand/40 bg-brand/5'
                    : 'border-line-subtle bg-surface-raised/80 hover:bg-surface-raised'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink">
                      {item.title || '活动公告横幅'}
                    </span>
                    {isCurrent && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-brand text-white">
                        当前生效
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-ink-subtle font-mono">
                    {item.updatedAt
                      ? new Date(item.updatedAt).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '历史存档'}
                  </span>
                </div>

                <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed mb-3">
                  {item.highlightText && (
                    <span className="font-semibold text-ink mr-1">{item.highlightText}</span>
                  )}
                  {item.message}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-line-subtle text-xs">
                  <div className="flex items-center gap-1.5 text-ink-subtle text-[11px]">
                    <span className="capitalize">{item.theme || 'indigo'}</span>
                    <span>·</span>
                    <span>{item.glowStyle || 'aurora'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => onLoad(item)}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-ink text-xs transition"
                    >
                      载入微调
                    </button>
                    {!isCurrent && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => onApply(item)}
                        className="px-3 py-1 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-hover transition disabled:opacity-50"
                      >
                        {isLoading ? '生效中…' : '一键生效'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="p-1 rounded-lg text-ink-subtle hover:text-rose-400 transition"
                      title="删除此历史记录"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 抽屉底栏 */}
        <div className="h-14 px-6 border-t border-line-subtle flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-5 py-2 text-xs font-medium text-ink hover:bg-white/[0.05] transition"
          >
            关闭版本库
          </button>
        </div>
      </div>
    </div>
  );
}
