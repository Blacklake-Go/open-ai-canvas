'use client';

import { useState } from 'react';
import { Search, Save, CheckCircle2, Globe, Eye, Sparkles } from 'lucide-react';
import { Card, StatusBadge } from '@/components/admin/AdminUi';
import { PermissionGate } from '@/components/admin/AdminPermissions';
import { PERMISSIONS } from '@/lib/admin/permissions';

export default function SeoMetadataCard({ config, onSave, isSaving }) {
  const [formData, setFormData] = useState({
    title: config?.title || '',
    titleTemplate: config?.titleTemplate || '%s | SupDance AI Studio',
    description: config?.description || '',
    keywords: Array.isArray(config?.keywords) ? config.keywords.join(', ') : (config?.keywords || ''),
    canonicalBase: config?.canonicalBase || 'https://www.supdance.com',
    ogImage: config?.openGraph?.image || 'https://www.supdance.com/og-image.png',
    twitterCard: config?.twitter?.card || 'summary_large_image',
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSavedSuccess(false);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (onSave) {
      const payload = {
        title: formData.title,
        titleTemplate: formData.titleTemplate,
        description: formData.description,
        keywords: formData.keywords,
        canonicalBase: formData.canonicalBase,
        openGraph: {
          title: formData.title,
          description: formData.description,
          image: formData.ogImage,
          type: 'website',
        },
        twitter: {
          card: formData.twitterCard,
          site: '@SupDanceAI',
          creator: '@SupDanceAI',
        },
      };
      await onSave(payload);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  const previewTitle = formData.titleTemplate.includes('%s')
    ? formData.titleTemplate.replace('%s', 'AI 视频与图像创作')
    : `${formData.title} | AI 创作`;

  return (
    <Card className="flex flex-col justify-between p-6">
      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand">
              <Search className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">全局 TDK 与社交分享元数据</h3>
            </div>
          </div>
          <StatusBadge tone="good">已生效</StatusBadge>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3 space-y-1.5">
            <label className="text-[11px] font-medium text-gray-300">站点主标题 (Title)</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="SupDance — Free AI Image & Video Studio"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-brand transition-colors"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3 space-y-1.5">
              <label className="text-[11px] font-medium text-gray-300">标题模版 (Title Template)</label>
              <input
                type="text"
                value={formData.titleTemplate}
                onChange={(e) => handleChange('titleTemplate', e.target.value)}
                placeholder="%s | SupDance AI Studio"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-brand transition-colors"
              />
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3 space-y-1.5">
              <label className="text-[11px] font-medium text-gray-300">规范网址主域名 (Canonical Base)</label>
              <input
                type="text"
                value={formData.canonicalBase}
                onChange={(e) => handleChange('canonicalBase', e.target.value)}
                placeholder="https://www.supdance.com"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-brand transition-colors"
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3 space-y-1.5">
            <label className="text-[11px] font-medium text-gray-300">全局元描述 (Meta Description)</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="生成高品质 AI 图像与视频，集成 Flux, Midjourney, Kling 等 200+ 顶尖模型..."
              className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-brand transition-colors"
            />
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3 space-y-1.5">
            <label className="text-[11px] font-medium text-gray-300">关键词 (Keywords)</label>
            <input
              type="text"
              value={formData.keywords}
              onChange={(e) => handleChange('keywords', e.target.value)}
              placeholder="AI Image Generator, AI Video, Flux AI, Midjourney"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-brand transition-colors"
            />
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3 space-y-1.5">
            <label className="text-[11px] font-medium text-gray-300">社交分享封面 (OG Image URL)</label>
            <input
              type="text"
              value={formData.ogImage}
              onChange={(e) => handleChange('ogImage', e.target.value)}
              placeholder="https://www.supdance.com/og-image.png"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-brand transition-colors"
            />
          </div>

          {/* SERP Search Result Live Preview */}
          <div className="rounded-xl border border-brand/20 bg-brand/[0.04] p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand">
              <Eye className="size-3.5" />
              <span>Google 搜索结果实时渲染预览</span>
            </div>
            <div className="rounded-lg bg-black/60 p-3 border border-white/[0.05] space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <Globe className="size-3" />
                <span>{formData.canonicalBase}</span>
              </div>
              <p className="text-sm font-medium text-blue-400 hover:underline cursor-pointer truncate">
                {previewTitle}
              </p>
              <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                {formData.description || '站点元描述尚未配置，搜索引擎将自动抓取页面主体文字作为摘要。'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-white/[0.08] pt-4">
          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="size-3.5" />
                配置已持久化保存并在前台生效
              </span>
            )}
          </div>
          <PermissionGate permission={PERMISSIONS.settingsWrite}>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-5 py-2 text-xs font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Save className="size-3.5" />
              <span>{isSaving ? '正在保存...' : '保存 TDK 配置'}</span>
            </button>
          </PermissionGate>
        </div>
      </form>
    </Card>
  );
}
