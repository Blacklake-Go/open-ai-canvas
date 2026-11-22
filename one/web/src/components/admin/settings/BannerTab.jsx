'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AdminSettingRow,
  StatusBadge,
} from '@/components/admin/AdminUi';
import BannerHistoryDrawer from './BannerHistoryDrawer';
import {
  Eye,
  ExternalLink,
  History,
  RotateCcw,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  Wand2,
} from 'lucide-react';

const THEME_OPTIONS = [
  { id: 'indigo', name: '星云紫', bg: 'bg-gradient-to-r from-indigo-600 to-violet-600', text: 'text-white' },
  { id: 'brand', name: '品牌品红', bg: 'bg-gradient-to-r from-brand to-rose-600', text: 'text-white' },
  { id: 'emerald', name: '翡翠绿', bg: 'bg-gradient-to-r from-emerald-600 to-teal-600', text: 'text-white' },
  { id: 'amber', name: '暗夜金', bg: 'bg-gradient-to-r from-amber-600 to-orange-600', text: 'text-white' },
  { id: 'rose', name: '蔷薇粉', bg: 'bg-gradient-to-r from-rose-600 to-pink-600', text: 'text-white' },
  { id: 'purple', name: '极光紫', bg: 'bg-gradient-to-r from-purple-600 to-fuchsia-600', text: 'text-white' },
];

const GLOW_OPTIONS = [
  { id: 'aurora', name: '幻彩极光', color: 'from-brand via-indigo-500 to-purple-600' },
  { id: 'brand', name: '品牌品红', color: 'from-brand via-pink-500 to-rose-600' },
  { id: 'amber', name: '暮光炽金', color: 'from-amber-400 via-orange-500 to-rose-600' },
  { id: 'rose', name: '霓虹魅粉', color: 'from-rose-500 via-pink-500 to-purple-600' },
];

const MOTION_OPTIONS = [
  { id: 'breathe', name: '柔和呼吸' },
  { id: 'drift', name: '极光漂移' },
  { id: 'shimmer', name: '流光扫过' },
  { id: 'both', name: '呼吸+扫光' },
  { id: 'none', name: '纯净微光' },
];

export default function BannerTab({
  banner,
  setBanner,
  historyList,
  setHistoryList,
  onSave,
  isSaving,
  feedback,
}) {
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // 就地修改文案/CTA弹窗
  const [modalMode, setModalMode] = useState(null); // 'text' | 'cta' | null
  const [tempHighlight, setTempHighlight] = useState('');
  const [tempMessage, setTempMessage] = useState('');
  const [tempBadge, setTempBadge] = useState('');
  const [tempCtaText, setTempCtaText] = useState('');
  const [tempLinkUrl, setTempLinkUrl] = useState('');
  const [tempLinkTarget, setTempLinkTarget] = useState('_self');

  const currentTheme = THEME_OPTIONS.find((t) => t.id === banner.theme) || THEME_OPTIONS[0];
  const activeGlow = GLOW_OPTIONS.find((g) => g.id === banner.glowStyle) || GLOW_OPTIONS[0];

  // 刷新历史
  const refreshHistory = async () => {
    try {
      const res = await fetch('/api/admin/content/banner/history');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.data) setHistoryList(data.data);
    } catch {}
  };

  // 应用历史版本
  const handleApplyHistory = async (histItem) => {
    setActionLoadingId(histItem.id);
    try {
      const res = await fetch(`/api/admin/content/banner/history/${encodeURIComponent(histItem.id)}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || '激活失败');
      setBanner(data.data);
      await refreshHistory();
      setIsHistoryDrawerOpen(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // 载入历史版本至表单
  const handleLoadToForm = (histItem) => {
    setBanner({
      ...banner,
      ...histItem,
      id: `banner-${Date.now()}`,
      title: `${histItem.title || '横幅'}(复用副本)`,
    });
    setIsHistoryDrawerOpen(false);
  };

  // 删除历史版本
  const handleDeleteHistory = async (histId) => {
    if (!confirm('确定要删除此条历史记录吗？')) return;
    try {
      const res = await fetch(`/api/admin/content/banner/history/${encodeURIComponent(histId)}`, {
        method: 'DELETE',
      });
      if (res.ok) await refreshHistory();
    } catch {}
  };

  const openTextModal = () => {
    setTempHighlight(banner.highlightText || '');
    setTempMessage(banner.message || '');
    setTempBadge(banner.badgeText || '');
    setModalMode('text');
  };

  const saveTextModal = () => {
    setBanner((prev) => ({
      ...prev,
      highlightText: tempHighlight,
      message: tempMessage,
      badgeText: tempBadge,
    }));
    setModalMode(null);
  };

  const openCtaModal = () => {
    setTempCtaText(banner.ctaText || '');
    setTempLinkUrl(banner.linkUrl || '');
    setTempLinkTarget(banner.linkTarget || '_self');
    setModalMode('cta');
  };

  const saveCtaModal = () => {
    setBanner((prev) => ({
      ...prev,
      ctaText: tempCtaText,
      linkUrl: tempLinkUrl,
      linkTarget: tempLinkTarget,
    }));
    setModalMode(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. 紧凑型 1:1 动态仿真横幅预览视窗 */}
      <div className="rounded-2xl border border-line-subtle bg-surface-raised p-4 shadow-elevation-1">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-subtle">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" />
            <span className="text-caption font-semibold text-ink">前台横幅实时仿真效果</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-ink-subtle hover:text-ink text-xs transition"
            >
              <History className="size-3.5" />
              <span>历史版本库 ({historyList?.length || 0})</span>
            </button>
          </div>
        </div>

        {/* 仿真横幅条 */}
        <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-lg min-h-[52px] flex items-center justify-center p-3">
          {/* 背景弥散光晕 */}
          {banner.ambientGlow && (
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${activeGlow.color} opacity-40 blur-xl animate-pulse`}
            />
          )}

          {/* 横幅主体背景 */}
          <div className={`absolute inset-0 ${currentTheme.bg} opacity-90`} />

          {/* 内容 */}
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-white">
            {banner.badgeText && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white font-mono uppercase tracking-wider backdrop-blur-sm">
                {banner.badgeText}
              </span>
            )}

            {banner.highlightText && (
              <span className="font-bold underline decoration-white/30 underline-offset-4">
                {banner.highlightText}
              </span>
            )}

            <span className="opacity-95">{banner.message || '年会员特惠进行中…'}</span>

            {banner.ctaText && (
              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-white text-slate-900 font-semibold text-[11px] shadow-sm ml-1 hover:bg-white/90 cursor-pointer">
                <span>{banner.ctaText}</span>
                <span className="text-[10px]">→</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. 微信四列设置模型 (The 4-Column Setting Model) */}
      <div className="rounded-2xl border border-line-subtle bg-surface-raised p-6 shadow-elevation-1">
        <div className="border-b border-line-subtle pb-3 mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-body font-semibold text-ink">横幅内容与视觉光晕设置</h3>
            <p className="text-caption text-ink-subtle mt-0.5">
              单项即刻调整，下方统一保存发布至全站
            </p>
          </div>
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
          {/* Row 1: 前台展示总开关 */}
          <AdminSettingRow
            label="前台顶部横幅开关"
            value={
              <div className="flex items-center gap-2">
                <StatusBadge tone={banner.enabled ? 'brand' : 'neutral'}>
                  {banner.enabled ? '前台展示中' : '已关闭'}
                </StatusBadge>
              </div>
            }
            context="开启后常驻在 Studio 顶栏上方，关闭后前台页面立即隐藏横幅。"
            action={banner.enabled ? '隐藏横幅' : '开启展示'}
            onClickAction={() => setBanner((prev) => ({ ...prev, enabled: !prev.enabled }))}
          />

          {/* Row 2: 活动文案与高亮 */}
          <AdminSettingRow
            label="公告文案与前缀"
            value={
              <div className="max-w-[200px] truncate">
                <span className="text-xs font-semibold text-brand mr-1">
                  {banner.badgeText ? `[${banner.badgeText}]` : ''}
                </span>
                <span className="text-xs text-ink truncate">{banner.message}</span>
              </div>
            }
            context="支持前缀高亮标签（如 HOT）、强调语句与正文，建议 60 字以内。"
            action="修改文案"
            onClickAction={openTextModal}
          />

          {/* Row 3: CTA 行动按钮 */}
          <AdminSettingRow
            label="行动呼吁 (CTA) 按钮"
            value={
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/[0.06] text-ink">
                  {banner.ctaText || '未设置'}
                </span>
                <span className="text-[11px] font-mono text-ink-subtle truncate max-w-[120px]">
                  {banner.linkUrl}
                </span>
              </div>
            }
            context="引导用户直达转化落地页（如商用定价或新模型工坊）。"
            action="配置按钮"
            onClickAction={openCtaModal}
          />

          {/* Row 4: 视觉主题色 */}
          <AdminSettingRow
            label="视觉主题渐变"
            value={
              <div className="flex flex-wrap gap-1.5">
                {THEME_OPTIONS.map((thm) => (
                  <button
                    key={thm.id}
                    type="button"
                    onClick={() => setBanner((prev) => ({ ...prev, theme: thm.id }))}
                    className={`size-5 rounded-full ${thm.bg} transition-all ${
                      banner.theme === thm.id
                        ? 'ring-2 ring-brand ring-offset-2 ring-offset-black scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    title={thm.name}
                  />
                ))}
              </div>
            }
            context={`当前选择：${currentTheme.name}。配合不同运营节点灵活切换色系。`}
            action=""
          />

          {/* Row 5: 弥散光晕与动效 */}
          <AdminSettingRow
            label="弥散发光与律动"
            value={
              <div className="flex flex-wrap gap-2 text-xs">
                <select
                  value={banner.glowStyle}
                  onChange={(e) => setBanner((prev) => ({ ...prev, glowStyle: e.target.value }))}
                  className="rounded-lg border border-line bg-base px-2 py-1 text-xs text-ink outline-none"
                >
                  {GLOW_OPTIONS.map((g) => (
                    <option key={g.id} value={g.id}>
                      光晕: {g.name}
                    </option>
                  ))}
                </select>
                <select
                  value={banner.dynamicEffect}
                  onChange={(e) => setBanner((prev) => ({ ...prev, dynamicEffect: e.target.value }))}
                  className="rounded-lg border border-line bg-base px-2 py-1 text-xs text-ink outline-none"
                >
                  {MOTION_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      律动: {m.name}
                    </option>
                  ))}
                </select>
              </div>
            }
            context="CSS 硬件加速的弥散极光与呼吸律动，增强前台活动质感。"
            action={banner.ambientGlow ? '关闭光晕' : '开启光晕'}
            onClickAction={() => setBanner((prev) => ({ ...prev, ambientGlow: !prev.ambientGlow }))}
          />
        </div>

        {/* 底部保存按钮 */}
        <div className="mt-6 pt-4 border-t border-line-subtle flex items-center justify-between">
          <span className="text-caption text-ink-subtle">
            每次保存将自动创建历史版本快照，支持无缝一键回滚。
          </span>

          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-6 py-2 text-xs font-semibold text-white hover:bg-brand-hover active:scale-[0.98] transition disabled:opacity-50 shadow-elevation-1"
          >
            <Save className="size-3.5" />
            <span>{isSaving ? '正在发布…' : '保存并发布横幅'}</span>
          </button>
        </div>
      </div>

      {/* 修改文案弹窗 */}
      {modalMode === 'text' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-[#0e1013] p-5 shadow-elevation-3 space-y-4">
            <div className="flex items-center justify-between border-b border-line-subtle pb-3">
              <h4 className="text-body font-semibold text-ink">修改横幅文案内容</h4>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-ink-subtle hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-caption font-medium text-ink-muted mb-1">
                    角标 (如 HOT)
                  </label>
                  <input
                    type="text"
                    value={tempBadge}
                    onChange={(e) => setTempBadge(e.target.value)}
                    className="w-full rounded-xl border border-line bg-base px-3 py-2 text-xs text-ink outline-none focus:border-brand"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-caption font-medium text-ink-muted mb-1">
                    高亮前缀 (加粗下划线)
                  </label>
                  <input
                    type="text"
                    value={tempHighlight}
                    onChange={(e) => setTempHighlight(e.target.value)}
                    className="w-full rounded-xl border border-line bg-base px-3 py-2 text-xs text-ink outline-none focus:border-brand"
                  />
                </div>
              </div>
              <div>
                <label className="block text-caption font-medium text-ink-muted mb-1">
                  公告核心文案 (必填)
                </label>
                <textarea
                  rows={2}
                  value={tempMessage}
                  onChange={(e) => setTempMessage(e.target.value)}
                  className="w-full rounded-xl border border-line bg-base px-3.5 py-2 text-xs text-ink outline-none focus:border-brand"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-subtle">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveTextModal}
                className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover"
              >
                应用文案
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 修改 CTA 弹窗 */}
      {modalMode === 'cta' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-[#0e1013] p-5 shadow-elevation-3 space-y-4">
            <div className="flex items-center justify-between border-b border-line-subtle pb-3">
              <h4 className="text-body font-semibold text-ink">配置 CTA 行动按钮</h4>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-ink-subtle hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-caption font-medium text-ink-muted mb-1">
                  按钮文案 (如 立即订阅)
                </label>
                <input
                  type="text"
                  value={tempCtaText}
                  onChange={(e) => setTempCtaText(e.target.value)}
                  className="w-full rounded-xl border border-line bg-base px-3 py-2 text-xs text-ink outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-caption font-medium text-ink-muted mb-1">
                  跳转链接
                </label>
                <input
                  type="text"
                  value={tempLinkUrl}
                  onChange={(e) => setTempLinkUrl(e.target.value)}
                  className="w-full rounded-xl border border-line bg-base px-3 py-2 text-xs text-ink font-mono outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-caption font-medium text-ink-muted mb-1">
                  打开方式
                </label>
                <select
                  value={tempLinkTarget}
                  onChange={(e) => setTempLinkTarget(e.target.value)}
                  className="w-full rounded-xl border border-line bg-base px-3 py-2 text-xs text-ink outline-none focus:border-brand"
                >
                  <option value="_self">当前窗口 (_self)</option>
                  <option value="_blank">新标签页 (_blank)</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-subtle">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveCtaModal}
                className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover"
              >
                确认配置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 历史版本抽屉 */}
      <BannerHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        historyList={historyList}
        currentBannerId={banner.id}
        onApply={handleApplyHistory}
        onLoad={handleLoadToForm}
        onDelete={handleDeleteHistory}
        loadingId={actionLoadingId}
      />
    </div>
  );
}
