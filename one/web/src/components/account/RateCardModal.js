'use client';

import React, { useEffect } from 'react';
import {
  X,
  Sparkles,
  Image as ImageIcon,
  Clapperboard,
  AudioLines,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function RateCardModal({ isOpen, onClose }) {
  // 监听 Esc 键关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-6 bg-scrim backdrop-blur-xl animate-in fade-in duration-modal ease-enter cursor-pointer overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-card-title"
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-line bg-overlay p-6 shadow-elevation-4 animate-in zoom-in-95 duration-modal ease-enter cursor-default text-ink select-none my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部标题与关闭按钮 */}
        <div className="flex items-start justify-between gap-4 border-b border-line-subtle pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">
                RATE CARD & SLA
              </span>
              <Badge variant="accent" className="text-[10px] py-0 px-1.5">
                实时生效
              </Badge>
            </div>
            <h2 id="rate-card-title" className="mt-1 text-section-title font-bold text-ink flex items-center gap-2">
              <Sparkles className="size-4 text-brand" />
              <span>算力消耗规则与透明费率手册</span>
            </h2>
            <p className="mt-1 text-caption text-ink-muted">
              依据 GPU 实际显存吞吐与推理步数计费，保证每一笔算力开销透明可追溯。
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:text-ink hover:bg-wash active:scale-[0.98] active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
            aria-label="关闭手册"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 核心费率对照网格 */}
        <div className="mt-5 space-y-4 max-h-[60vh] overflow-y-auto pr-1 scrollbar-rail">
          {/* 1. 图像生成费率 */}
          <div className="rounded-xl border border-line-subtle bg-surface p-4">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-line-subtle">
              <span className="flex size-7 items-center justify-center rounded-lg border border-brand-line bg-brand-soft text-brand">
                <ImageIcon className="size-4" />
              </span>
              <span className="text-body-sm font-semibold text-ink">图像生成与超采样 (Image Studio)</span>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-line-subtle/50">
                <span className="text-ink-muted">通义万相 2.1 标准文生图 / 图生图</span>
                <span className="font-mono font-semibold text-brand">10 积分 / 张</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-line-subtle/50">
                <span className="text-ink-muted">FLUX.1 (Dev / Schnell) 影视级写实</span>
                <span className="font-mono font-semibold text-brand">20 积分 / 张</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-ink-muted">4K / 8K 高清超采样放大与局部重绘</span>
                <span className="font-mono font-semibold text-brand">10 积分 / 次</span>
              </div>
            </div>
          </div>

          {/* 2. 视频渲染费率 */}
          <div className="rounded-xl border border-line-subtle bg-surface p-4">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-line-subtle">
              <span className="flex size-7 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-400">
                <Clapperboard className="size-4" />
              </span>
              <span className="text-body-sm font-semibold text-ink">视频生成基准 (Video Studio)</span>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-line-subtle/50">
                <span className="text-ink-muted">通义万相视频 5s (720P 标准渲染通道)</span>
                <span className="font-mono font-semibold text-amber-400">80 积分 / 段</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-line-subtle/50">
                <span className="text-ink-muted">通义万相视频 5s (1080P 高清渲染通道)</span>
                <span className="font-mono font-semibold text-amber-400">140 积分 / 段</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-ink-muted">10s 镜头延展与高级插帧补帧</span>
                <span className="font-mono font-semibold text-amber-400">按推理步长实时折算</span>
              </div>
            </div>
          </div>

          {/* 3. 顶级模型专属费率 */}
          <div className="rounded-xl border border-line-subtle bg-surface p-4">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-line-subtle">
              <span className="flex size-7 items-center justify-center rounded-lg border border-brand-line bg-brand-soft text-brand">
                <Sparkles className="size-4" />
              </span>
              <span className="text-body-sm font-semibold text-ink">顶级 SOTA 生成模型 (支持专属算力包)</span>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-line-subtle/50">
                <span className="text-ink-muted">ByteDance Seedance 2.0 极速版 (5s)</span>
                <span className="font-mono font-semibold text-brand">295 积分 / 段</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-line-subtle/50">
                <span className="text-ink-muted">ByteDance Seedance 2.0 标准版 (5s 720P/1080P)</span>
                <span className="font-mono font-semibold text-brand">625 积分 / 段</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-ink-muted">Google Veo 3.1 Standard 影视级连续镜头</span>
                <span className="font-mono font-semibold text-brand">910 积分 / 条</span>
              </div>
            </div>
          </div>

          {/* 4. 动态模型说明 */}
          <div className="rounded-xl border border-white/[0.08] bg-well p-3.5 text-xs text-zinc-400 leading-relaxed">
            <span className="font-semibold text-zinc-300">💡 动态费率与音频模型说明：</span>
            音乐、语音克隆及部分第三方前沿实验性模型（如 Suno, Kling 等）上游目前无稳定公开的统一单价，平台依据实时上游 GPU 负载动态核算，并在生成提交前在面板精确展示试算积分，透明扣费无隐形支出。
          </div>

          {/* 4. SLA 失败全额退费保障条款 */}
          <div className="rounded-xl border border-brand-line bg-brand-soft/20 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="size-5 text-brand shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-body-sm font-semibold text-ink">
                  100% 自动毫秒级失败退款承诺
                </h4>
                <p className="text-caption text-ink-muted leading-relaxed">
                  若遇到云端 GPU 超时、显存溢出或第三方上游接口异常导致任务状态为“失败”，系统将即刻原路全额回滚所扣算力，并释放并发占用，无须人工提单申请。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 底部确认按钮 */}
        <div className="mt-6 flex justify-end border-t border-line-subtle pt-4">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            className="cursor-pointer"
          >
            我已知晓
          </Button>
        </div>
      </div>
    </div>
  );
}
