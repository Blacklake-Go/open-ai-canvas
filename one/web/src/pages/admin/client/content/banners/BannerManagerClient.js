'use client';

import { useState } from 'react';
import { Card, StatusBadge, Button as AdminUiButton } from '@/components/admin/AdminUi';
import StandardButton from '@/components/ui/button';

// 防御性组件：确保无论导入形态如何，Button 100% 存在且有效
const Button = AdminUiButton || StandardButton || (({ children, className = '', ...props }) => (
  <button className={`inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium transition ${className}`} {...props}>
    {children}
  </button>
));
import { Eye, ExternalLink, Save, CheckCircle2, AlertCircle, History, RotateCcw, Trash2, Edit3, Sparkles, Wand2 } from 'lucide-react';

const THEME_OPTIONS = [
  { id: 'indigo', name: '星云紫 (默认)', bg: 'bg-gradient-to-r from-indigo-600 to-violet-600', text: 'text-white' },
  { id: 'brand', name: '品牌品红 (推荐)', bg: 'bg-gradient-to-r from-brand to-rose-600', text: 'text-white' },
  { id: 'emerald', name: '翡翠绿 (福利/活动)', bg: 'bg-gradient-to-r from-emerald-600 to-teal-600', text: 'text-white' },
  { id: 'amber', name: '暗夜金 (VIP/限免)', bg: 'bg-gradient-to-r from-amber-600 to-orange-600', text: 'text-white' },
  { id: 'rose', name: '蔷薇粉 (节日特惠)', bg: 'bg-gradient-to-r from-rose-600 to-pink-600', text: 'text-white' },
  { id: 'purple', name: '极光紫 (高贵尊享)', bg: 'bg-gradient-to-r from-purple-600 to-fuchsia-600', text: 'text-white' },
];

const GLOW_OPTIONS = [
  { id: 'aurora', name: '幻彩极光 (洋红紫交织)', color: 'from-brand via-indigo-500 to-purple-600' },
  { id: 'brand', name: '品牌品红 (标准科技)', color: 'from-brand via-pink-500 to-rose-600' },
  { id: 'amber', name: '暮光炽金 (温暖辉光)', color: 'from-amber-400 via-orange-500 to-rose-600' },
  { id: 'rose', name: '霓虹魅粉 (幻夜梦境)', color: 'from-rose-500 via-pink-500 to-purple-600' },
];

const MOTION_OPTIONS = [
  { id: 'breathe', name: '柔和呼吸 (舒缓缩放)' },
  { id: 'drift', name: '极光漂移 (流体位移)' },
  { id: 'shimmer', name: '流光扫过 (光束平移)' },
  { id: 'both', name: '呼吸 + 扫光 (双重律动)' },
  { id: 'none', name: '纯净微光 (无强动效)' },
];

export default function BannerManagerClient({ initialBanner, initialHistory = [] }) {
  const [banner, setBanner] = useState({
    title: '上新特惠公告',
    highlightText: '上新特惠：',
    message: '年会员享 Flova Image 2.5、Seedance 2.5 最低4折，1K 低至 ¥0.058/张',
    ctaText: '立即订阅',
    linkUrl: '/studio?account=open&tab=membership',
    linkTarget: '_self',
    theme: 'indigo',
    ambientGlow: true,
    glowStyle: 'aurora',
    dynamicEffect: 'breathe',
    badgeText: 'HOT',
    showPulseDot: true,
    dismissible: true,
    autoHideDays: 7,
    targetScope: 'all',
    enabled: true,
    ...initialBanner,
  });

  const [historyList, setHistoryList] = useState(initialHistory);
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const activeGlow = GLOW_OPTIONS.find((g) => g.id === banner.glowStyle) || GLOW_OPTIONS[0];

  // 刷新历史横幅列表
  const refreshHistory = async () => {
    try {
      const res = await fetch('/api/admin/content/banner/history');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.data) {
        setHistoryList(data.data);
      }
    } catch {}
  };

  // 保存并发布当前横幅配置
  const handleSave = async (e) => {
    e?.preventDefault();
    setIsSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const res = await fetch('/api/admin/content/banner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(banner),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || '保存失败');
      }

      setBanner(data.data || banner);
      setFeedback({ type: 'success', message: '横幅配置已更新，已自动归档至历史记录，全网实时生效！' });
      await refreshHistory();
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // 一键应用历史横幅
  const handleApplyHistory = async (histItem) => {
    setActionLoadingId(histItem.id);
    setFeedback({ type: '', message: '' });

    try {
      const res = await fetch(`/api/admin/content/banner/history/${encodeURIComponent(histItem.id)}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || '激活失败');
      }

      setBanner(data.data);
      setFeedback({ type: 'success', message: `已成功切换并生效历史横幅：【${histItem.title || histItem.message.slice(0, 20)}】！` });
      await refreshHistory();
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  // 载入历史横幅到编辑表单
  const handleLoadToForm = (histItem) => {
    setBanner({
      ...banner,
      ...histItem,
      id: `banner-${Date.now()}`, // 设为新 ID，避免直接覆盖原历史 ID
      title: `${histItem.title || '横幅'}(复用副本)`,
    });
    setFeedback({ type: 'success', message: '已载入该历史横幅参数至表单，微调后点击保存即可发布新版本。' });
    window.scrollTo({ top: 400, behavior: 'smooth' });
    setTimeout(() => setFeedback({ type: '', message: '' }), 3500);
  };

  // 删除历史横幅
  const handleDeleteHistory = async (histId) => {
    if (!confirm('确定要删除此条历史横幅记录吗？')) return;
    setActionLoadingId(histId);

    try {
      const res = await fetch(`/api/admin/content/banner/history/${encodeURIComponent(histId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || '删除失败');
      }

      setFeedback({ type: 'success', message: '已删除该历史横幅记录。' });
      await refreshHistory();
      setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. 实时所见即所得前台弥散流光预览卡片 */}
      <div className="rounded-2xl border border-white/10 bg-[#070709] p-5 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
            <Eye className="size-4 text-brand" />
            <span>前台 1:1 真实弥散光晕效果预览 (Flova 风格)</span>
          </div>
          <span className="text-[11px] text-white/40">所见即所得 · 毫秒级动态仿真</span>
        </div>

        {/* 模拟前台窗口顶部 */}
        <div className="rounded-xl overflow-hidden border border-white/10 bg-[#020204] relative">
          {banner.enabled ? (
            <div
              className={`w-full relative px-4 py-2.5 transition-all select-none border-b border-white/10 bg-[#060609]/90 backdrop-blur-xl ${
                banner.ambientGlow ? 'shadow-[0_12px_36px_-6px_rgba(225,29,116,0.25)]' : 'shadow-md'
              }`}
            >
              {/* 弥散光晕层 */}
              {banner.ambientGlow && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className={`absolute -left-1/4 -top-1/2 h-[200%] w-3/4 rounded-full bg-gradient-to-br ${activeGlow.color} opacity-35 blur-3xl ${
                    banner.dynamicEffect === 'breathe' || banner.dynamicEffect === 'both' ? 'animate-banner-aura' : ''
                  }`} />
                  <div className={`absolute -right-1/4 -bottom-1/2 h-[200%] w-3/4 rounded-full bg-gradient-to-tl ${activeGlow.color} opacity-35 blur-3xl ${
                    banner.dynamicEffect === 'breathe' || banner.dynamicEffect === 'both' ? 'animate-banner-aura' : ''
                  }`} />
                </div>
              )}

              {/* 扫光层 */}
              {(banner.dynamicEffect === 'shimmer' || banner.dynamicEffect === 'both') && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
                  <div className="h-full w-2/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-banner-shimmer" />
                </div>
              )}

              <div className="relative mx-auto flex items-center justify-between">
                <div className="w-6 hidden sm:block" />

                {/* 居中排版区 */}
                <div className="flex-1 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-center">
                  {banner.showPulseDot && (
                    <span className="relative flex h-2 w-2 flex-shrink-0 items-center justify-center">
                      <span className="animate-banner-radar absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]" />
                    </span>
                  )}

                  {banner.badgeText && (
                    <span className="inline-flex items-center rounded-full border border-white/30 bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                      {banner.badgeText}
                    </span>
                  )}

                  {banner.highlightText && (
                    <span className="text-xs sm:text-[13px] font-bold text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)]">
                      {banner.highlightText}
                    </span>
                  )}

                  <span className="text-xs sm:text-[13px] font-medium text-white/95">
                    {banner.message || '请输入横幅公告内容...'}
                  </span>

                  {banner.ctaText && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-0.5 text-[11px] font-bold text-white shadow-sm hover:bg-brand-hover">
                      <span>{banner.ctaText}</span>
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
                </div>

                {banner.dismissible && (
                  <button
                    type="button"
                    onClick={() => alert('预览提示：线上用户点击 ✕ 会在本地记住免打扰期限')}
                    className="ml-3 flex h-6 w-6 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-white/40 bg-[#0c0c0e]">
              横幅当前处于【已停用】状态，前台将不渲染此区域
            </div>
          )}

          {/* 模拟前台导航栏示意 */}
          <div className="h-10 border-t border-white/[0.05] bg-[#0a0a0c] px-4 flex items-center justify-between text-[11px] text-white/30">
            <div className="flex items-center gap-2">
              <div className="size-4 rounded-full bg-brand shadow-[0_0_8px_rgba(225,29,116,0.6)]" />
              <span className="font-semibold text-white/50">supdance studio</span>
            </div>
            <span>[下方工作台自然融入氛围弥散光]</span>
          </div>
        </div>
      </div>

      {/* 2. 编辑表单 */}
      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-2">
        {/* 左侧：核心文案与 CTA 按钮 */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">横幅内容与行动按钮 (CTA)</h2>
            </div>
            <StatusBadge tone={banner.enabled ? 'good' : 'neutral'}>
              {banner.enabled ? '已开启' : '已关闭'}
            </StatusBadge>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="banner_enabled"
              checked={Boolean(banner.enabled)}
              onChange={(e) => setBanner({ ...banner, enabled: e.target.checked })}
              className="size-4 rounded border-white/20 bg-black/40 text-brand focus:ring-brand/40"
            />
            <label htmlFor="banner_enabled" className="text-xs font-semibold text-white cursor-pointer">
              在前台顶部启用横幅展示
            </label>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-1.5">
              横幅内部备注标题 (方便历史记录识别)
            </label>
            <input
              type="text"
              value={banner.title || ''}
              onChange={(e) => setBanner({ ...banner, title: e.target.value })}
              placeholder="例如：618 大促 / Flova 风格上线横幅"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-white outline-none focus:border-brand"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold text-amber-300/80 mb-1.5">
                高亮前缀 (Highlight)
              </label>
              <input
                type="text"
                value={banner.highlightText || ''}
                onChange={(e) => setBanner({ ...banner, highlightText: e.target.value })}
                placeholder="例如：上新特惠："
                className="w-full rounded-xl border border-amber-500/20 bg-black/40 px-3 py-2 text-xs text-amber-300 font-bold outline-none focus:border-amber-400/60"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-white/60 mb-1.5">
                主体说明文案 <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={banner.message || ''}
                onChange={(e) => setBanner({ ...banner, message: e.target.value })}
                placeholder="例如：年会员享 Flova Image 2.5、Seedance 2.5 最低4折..."
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-white outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-brand mb-1.5">
                行动胶囊按钮文案 (CTA Text)
              </label>
              <input
                type="text"
                value={banner.ctaText || ''}
                onChange={(e) => setBanner({ ...banner, ctaText: e.target.value })}
                placeholder="例如：立即订阅 / 立即体验 (留空不显示)"
                className="w-full rounded-xl border border-brand/20 bg-black/40 px-3.5 py-2 text-xs text-brand font-bold outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1.5">
                高亮微型徽标 (Badge)
              </label>
              <input
                type="text"
                value={banner.badgeText || ''}
                onChange={(e) => setBanner({ ...banner, badgeText: e.target.value })}
                placeholder="例如：HOT / NEW / 限时"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-white outline-none focus:border-brand"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-1.5">
              点击直达 URL (Link URL)
            </label>
            <div className="relative">
              <input
                type="text"
                value={banner.linkUrl || ''}
                onChange={(e) => setBanner({ ...banner, linkUrl: e.target.value })}
                placeholder="例如：/pricing 或 https://..."
                className="w-full rounded-xl border border-white/10 bg-black/40 pl-3.5 pr-8 py-2 text-xs text-white font-mono outline-none focus:border-brand"
              />
              <ExternalLink className="absolute right-3 top-2.5 size-4 text-white/30 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1.5">
                链接打开方式
              </label>
              <select
                value={banner.linkTarget || '_self'}
                onChange={(e) => setBanner({ ...banner, linkTarget: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#0a0a0c] px-3 py-2 text-xs text-white outline-none focus:border-brand"
              >
                <option value="_self">当前页面直接跳转 (_self)</option>
                <option value="_blank">新标签页打开 (_blank)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1.5">
                关闭后免打扰天数
              </label>
              <input
                type="number"
                min="0"
                max="90"
                value={banner.autoHideDays ?? 7}
                onChange={(e) => setBanner({ ...banner, autoHideDays: parseInt(e.target.value, 10) || 0 })}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <input
              type="checkbox"
              id="banner_dismissible"
              checked={banner.dismissible !== false}
              onChange={(e) => setBanner({ ...banner, dismissible: e.target.checked })}
              className="size-4 rounded border-white/20 bg-black/40 text-brand"
            />
            <label htmlFor="banner_dismissible" className="text-xs text-white/80 cursor-pointer">
              允许用户点击右侧 ✕ 关闭横幅
            </label>
          </div>
        </Card>

        {/* 右侧：弥散光晕、动效与保存 */}
        <div className="space-y-6 flex flex-col justify-between">
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Wand2 className="size-4 text-brand" />
                <h2 className="text-sm font-bold text-white">弥散光晕与动效模式</h2>
              </div>
              <label className="flex items-center gap-2 text-xs text-brand font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={banner.ambientGlow !== false}
                  onChange={(e) => setBanner({ ...banner, ambientGlow: e.target.checked })}
                  className="size-4 rounded border-white/20 bg-black/40 text-brand"
                />
                <span>开启弥散光晕</span>
              </label>
            </div>

            {/* 弥散光色彩风格 */}
            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-2">
                弥散光色系 (Glow Style)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {GLOW_OPTIONS.map((glow) => {
                  const isSelected = banner.glowStyle === glow.id;
                  return (
                    <button
                      key={glow.id}
                      type="button"
                      onClick={() => setBanner({ ...banner, glowStyle: glow.id })}
                      className={`rounded-xl p-3 text-left border transition-all ${
                        isSelected
                          ? 'border-brand bg-white/10 shadow-sm'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                      }`}
                    >
                      <div className={`h-4 w-full rounded-full mb-2 bg-gradient-to-r ${glow.color} blur-[2px] opacity-80`} />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{glow.name}</span>
                        {isSelected && <span className="size-2 rounded-full bg-brand" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 动效节奏模式 */}
            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1.5">
                动效节奏 (Dynamic Effect)
              </label>
              <select
                value={banner.dynamicEffect || 'breathe'}
                onChange={(e) => setBanner({ ...banner, dynamicEffect: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#0a0a0c] px-3 py-2 text-xs text-white outline-none focus:border-brand"
              >
                {MOTION_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 生效页面作用域 */}
            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1.5">
                前台生效页面范围 (Target Scope)
              </label>
              <select
                value={banner.targetScope || 'all'}
                onChange={(e) => setBanner({ ...banner, targetScope: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-[#0a0a0c] px-3 py-2 text-xs text-white outline-none focus:border-brand"
              >
                <option value="all">全站所有页面展示 (all)</option>
                <option value="studio">仅在 Studio 创作工作台展示 (studio)</option>
                <option value="home">仅在首页展示 (home)</option>
              </select>
            </div>
          </Card>

          {/* 保存并全网发布卡片 */}
          <Card className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                {feedback.message && (
                  <div className={`flex items-center gap-2 text-xs ${
                    feedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {feedback.type === 'success' ? <CheckCircle2 className="size-4 flex-shrink-0" /> : <AlertCircle className="size-4 flex-shrink-0" />}
                    <span>{feedback.message}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover px-5 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50 transition-all"
              >
                <Save className="size-4" />
                <span>{isSaving ? '正在发布同步...' : '保存并全网同步'}</span>
              </button>
            </div>
          </Card>
        </div>
      </form>

      {/* 3. 历史横幅管理系统 (Banner History Management) */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <History className="size-4 text-brand" />
            <h2 className="text-sm font-bold text-white">历史横幅管理与快速恢复</h2>
          </div>
          <span className="text-[11px] text-white/40">每次发布自动归档 · 支持一键无缝回退</span>
        </div>

        {historyList && historyList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-white/80">
              <thead className="border-b border-white/10 bg-white/[0.02] text-[11px] text-white/50">
                <tr>
                  <th className="py-2.5 px-3">横幅标题与文案</th>
                  <th className="py-2.5 px-3">前缀与 CTA</th>
                  <th className="py-2.5 px-3">弥散与动效</th>
                  <th className="py-2.5 px-3">状态</th>
                  <th className="py-2.5 px-3">创建时间</th>
                  <th className="py-2.5 px-3 text-right">快捷操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {historyList.map((item) => {
                  const isActive = Boolean(item.isActive || item.id === banner.id);
                  const isActionBusy = actionLoadingId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white text-xs">{item.title || '未命名横幅'}</div>
                        <div className="text-[11px] text-white/50 truncate max-w-xs sm:max-w-sm mt-0.5">
                          {item.message}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.highlightText && (
                            <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              {item.highlightText}
                            </span>
                          )}
                          {item.ctaText ? (
                            <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand border border-brand/20">
                              CTA: {item.ctaText}
                            </span>
                          ) : (
                            <span className="text-[10px] text-white/30">无按钮</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-[11px] text-white/70">
                          {item.ambientGlow !== false ? `弥散: ${item.glowStyle || 'aurora'}` : '无弥散'}
                        </div>
                        <div className="text-[10px] text-white/40">
                          节奏: {item.dynamicEffect || 'breathe'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            当前生效中
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/40">
                            历史存档
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-[11px] text-white/40 whitespace-nowrap">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {!isActive && (
                            <button
                              type="button"
                              disabled={isActionBusy}
                              onClick={() => handleApplyHistory(item)}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand/20 transition active:scale-95 disabled:opacity-50 border border-brand/20"
                              title="立即将此横幅重新设置为全网生效"
                            >
                              <RotateCcw className="size-3" />
                              <span>一键生效</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleLoadToForm(item)}
                            className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/20 transition active:scale-95"
                            title="将此条配置参数回填至表单进行修改"
                          >
                            <Edit3 className="size-3" />
                            <span>载入编辑</span>
                          </button>

                          {!isActive && (
                            <button
                              type="button"
                              disabled={isActionBusy}
                              onClick={() => handleDeleteHistory(item.id)}
                              className="p-1 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition"
                              title="删除此条历史记录"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-white/40 border border-dashed border-white/10 rounded-xl">
            暂无历史横幅快照，发布新的横幅后将自动在此归档展示
          </div>
        )}
      </Card>
    </div>
  );
}

