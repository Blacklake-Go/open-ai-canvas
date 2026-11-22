'use client';

import React from 'react';
import {
  AdminSettingRow,
  StatusBadge,
} from '@/components/admin/AdminUi';
import {
  Sparkles,
  Zap,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
} from 'lucide-react';

const MOTION_LEVELS = [
  {
    id: 'full',
    name: '炫酷高帧',
    badge: '推荐高配',
    subtext: '全开流光与呼吸脉冲',
    icon: Sparkles,
  },
  {
    id: 'balanced',
    name: '平衡模式',
    badge: '通用标准',
    subtext: '微动效，关闭高频循环',
    icon: Zap,
  },
  {
    id: 'minimal',
    name: '极简节能',
    badge: '省电流畅',
    subtext: '关闭全站背景流光与重度动画',
    icon: Shield,
  },
];

export default function MotionTab({
  motion,
  setMotion,
  onSave,
  isSaving,
  feedback,
}) {
  const currentLevel = motion.motionLevel || 'full';

  return (
    <div className="space-y-6">
      {/* 1. 能耗档位分段胶囊选择器 */}
      <div className="rounded-2xl border border-line-subtle bg-surface-raised p-5 shadow-elevation-1 space-y-3">
        <div className="flex items-center justify-between border-b border-line-subtle pb-3">
          <div>
            <h3 className="text-body font-semibold text-ink">全站视觉动效与能耗等级</h3>
            <p className="text-caption text-ink-subtle mt-0.5">
              一键切换全站设备能耗档位，兼顾视觉高级感与低配设备流畅度
            </p>
          </div>
          <StatusBadge tone={currentLevel === 'minimal' ? 'neutral' : currentLevel === 'balanced' ? 'warn' : 'brand'}>
            当前：{currentLevel.toUpperCase()}
          </StatusBadge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {MOTION_LEVELS.map((level) => {
            const Icon = level.icon;
            const isSelected = currentLevel === level.id;

            return (
              <button
                key={level.id}
                type="button"
                onClick={() => setMotion((prev) => ({ ...prev, motionLevel: level.id }))}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-brand/50 bg-brand/10 shadow-elevation-1'
                    : 'border-line-subtle bg-base/50 hover:bg-base hover:border-line'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`size-4 ${isSelected ? 'text-brand' : 'text-ink-muted'}`} />
                    <span className={`text-xs font-semibold ${isSelected ? 'text-brand' : 'text-ink'}`}>
                      {level.name}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                      isSelected
                        ? 'bg-brand text-white'
                        : 'bg-white/[0.04] text-ink-subtle'
                    }`}
                  >
                    {level.badge}
                  </span>
                </div>
                <p className="text-caption text-ink-subtle leading-relaxed">
                  {level.subtext}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 交互试窗 + 细项硬件开关 (微信四列设置模型) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 左侧四列设置项 */}
        <div className="lg:col-span-7 rounded-2xl border border-line-subtle bg-surface-raised p-6 shadow-elevation-1">
          <div className="border-b border-line-subtle pb-3 mb-2 flex items-center justify-between">
            <h4 className="text-body font-semibold text-ink">细项硬件加速开关</h4>
            {feedback?.message && (
              <span
                className={`text-caption font-medium ${
                  feedback.type === 'error' ? 'text-rose-400' : 'text-emerald-400'
                } animate-in fade-in`}
              >
                {feedback.message}
              </span>
            )}
          </div>

          <div className="divide-y divide-line-subtle">
            {/* Row 1: 径向漫射光晕 */}
            <AdminSettingRow
              label="径向漫射光晕"
              value={
                <StatusBadge tone={motion.ambientGlow ? 'brand' : 'neutral'}>
                  {motion.ambientGlow ? '已开启' : '已关闭'}
                </StatusBadge>
              }
              context="前台顶栏及工作台背景的高斯模糊发光扩散层。"
              action={motion.ambientGlow ? '关闭' : '开启'}
              onClickAction={() =>
                setMotion((prev) => ({ ...prev, ambientGlow: !prev.ambientGlow }))
              }
            />

            {/* Row 2: 卡片 3D 透视悬停 */}
            <AdminSettingRow
              label="卡片 3D 透视悬停"
              value={
                <StatusBadge tone={motion.cardTiltHover ? 'brand' : 'neutral'}>
                  {motion.cardTiltHover ? '已开启' : '已关闭'}
                </StatusBadge>
              }
              context="鼠标滑过 Studio 推荐卡片时的物理视角轻微倾斜过渡。"
              action={motion.cardTiltHover ? '关闭' : '开启'}
              onClickAction={() =>
                setMotion((prev) => ({ ...prev, cardTiltHover: !prev.cardTiltHover }))
              }
            />

            {/* Row 3: 背景粒子浮动 */}
            <AdminSettingRow
              label="背景流动粒子微粒"
              value={
                <StatusBadge tone={motion.particles ? 'brand' : 'neutral'}>
                  {motion.particles ? '已开启' : '已关闭'}
                </StatusBadge>
              }
              context="轻量 Canvas 粒子动效，关闭后可减少移动端或低性能 GPU 负荷。"
              action={motion.particles ? '关闭' : '开启'}
              onClickAction={() =>
                setMotion((prev) => ({ ...prev, particles: !prev.particles }))
              }
            />
          </div>

          {/* 底部保存按钮 */}
          <div className="mt-6 pt-4 border-t border-line-subtle flex items-center justify-end">
            <button
              type="button"
              disabled={isSaving}
              onClick={onSave}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-6 py-2 text-xs font-semibold text-white hover:bg-brand-hover active:scale-[0.98] transition disabled:opacity-50 shadow-elevation-1"
            >
              <Save className="size-3.5" />
              <span>{isSaving ? '正在发布…' : '保存动效设置'}</span>
            </button>
          </div>
        </div>

        {/* 右侧：物理微动实时感应试窗 */}
        <div className="lg:col-span-5 rounded-2xl border border-line-subtle bg-surface-raised p-5 shadow-elevation-1 space-y-3">
          <div className="flex items-center justify-between border-b border-line-subtle pb-2">
            <span className="text-caption font-semibold text-ink flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-brand" />
              <span>动效手感实时试窗</span>
            </span>
            <span className="text-[10px] text-ink-subtle">鼠标滑入测试卡片手感</span>
          </div>

          <div className="relative rounded-xl border border-line-subtle bg-canvas p-6 min-h-[190px] flex items-center justify-center overflow-hidden">
            {/* 模拟环境流光 */}
            {motion.ambientGlow && (
              <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-[300px] h-[120px] bg-gradient-to-b from-brand/25 via-brand/10 to-transparent blur-2xl opacity-80 animate-pulse" />
            )}

            {/* 模拟卡片 */}
            <div
              className={`relative z-10 w-full max-w-xs rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-xl backdrop-blur-md transition-all duration-300 select-none ${
                motion.cardTiltHover
                  ? 'hover:scale-[1.03] hover:border-brand/50 hover:shadow-brand/10 cursor-pointer'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-brand" />
                  <span className="text-xs font-bold text-white">Cinema Studio</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white/60 font-mono">
                  {(motion.motionLevel || 'full').toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed mb-3">
                模拟 Studio 前台功能卡片。鼠标悬停测试 3D 浮动反馈。
              </p>
              <div className="flex items-center justify-between text-[10px] text-brand font-medium">
                <span>进入电影工坊 →</span>
                <span className="text-white/30 text-[9px]">4K 渲染</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
