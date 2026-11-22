'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  StatusBadge,
  AdminSettingRow,
  AdminCardGridItem,
  AdminUnderlineTabs,
} from '@/components/admin/AdminUi';
import {
  BilibiliIcon,
  DouyinIcon,
  GoogleIcon,
  InstagramIcon,
  QQIcon,
  TikTokIcon,
  WeChatIcon,
  XIcon,
} from '@/components/SocialIcons';
import { ShieldAlert, Megaphone, Wrench, Sparkles, ExternalLink } from 'lucide-react';

const TABS = [
  { id: 'general', label: '基础运行与访问' },
  { id: 'announcement', label: '前台公告横幅' },
  { id: 'ecosystem', label: '生态与品牌中枢' },
];

export default function SettingsEditor({ initialSettings }) {
  const [settings, setSettings] = useState(initialSettings || []);
  const [activeTab, setActiveTab] = useState('general');
  const [savingKey, setSavingKey] = useState(null);
  const [feedback, setFeedback] = useState({});

  // 模态弹窗状态（编辑维护模式 / 编辑横幅）
  const [modalMode, setModalMode] = useState(null); // 'maintenance' | 'banner' | null

  const getVal = (key, fallback) => {
    const item = settings.find((s) => s.key === key);
    return item?.value !== undefined ? item.value : fallback;
  };

  const saveSetting = async (key, value, visibility = 'public') => {
    setSavingKey(key);
    setFeedback((prev) => ({ ...prev, [key]: '' }));

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ key, value, visibility }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || '保存失败');

      // 更新本地状态列表
      setSettings((prev) => {
        const next = [...prev];
        const idx = next.findIndex((s) => s.key === key);
        if (idx >= 0) {
          next[idx] = { ...next[idx], value };
        } else {
          next.push({ key, value, visibility });
        }
        return next;
      });

      setFeedback((prev) => ({ ...prev, [key]: '已成功更新并留存审计' }));
      setTimeout(() => {
        setFeedback((prev) => ({ ...prev, [key]: '' }));
      }, 3000);
      return true;
    } catch (err) {
      setFeedback((prev) => ({ ...prev, [key]: `错误: ${err.message}` }));
      return false;
    } finally {
      setSavingKey(null);
    }
  };

  // 1. 全站公告横幅
  const banner = getVal('site_banner', { enabled: false, message: '', tone: 'info', dismissible: true });
  const [bannerEnabled, setBannerEnabled] = useState(Boolean(banner.enabled));
  const [bannerMsg, setBannerMsg] = useState(banner.message || '');
  const [bannerTone, setBannerTone] = useState(banner.tone || 'info');

  // 2. 注册开关
  const reg = getVal('registration_enabled', { enabled: true, allow_oauth: true });
  const [allowRegister, setAllowRegister] = useState(Boolean(reg.enabled));
  const [allowOauth, setAllowOauth] = useState(Boolean(reg.allow_oauth));

  // 3. 维护模式
  const maint = getVal('maintenance_mode', { enabled: false, message: '' });
  const [maintEnabled, setMaintEnabled] = useState(Boolean(maint.enabled));
  const [maintMsg, setMaintMsg] = useState(maint.message || '系统正在例行升级，请稍候访问');

  // 4. 探索应用 (Explore Apps)
  const exploreAppsCfg = getVal('feature_explore_apps', { enabled: false });
  const [exploreAppsEnabled, setExploreAppsEnabled] = useState(Boolean(exploreAppsCfg.enabled));

  // 快速切换处理
  const toggleExploreApps = async () => {
    const next = !exploreAppsEnabled;
    setExploreAppsEnabled(next);
    await saveSetting('feature_explore_apps', { enabled: next });
  };

  const toggleRegister = async () => {
    const next = !allowRegister;
    setAllowRegister(next);
    await saveSetting('registration_enabled', { enabled: next, allow_oauth: allowOauth });
  };

  const toggleMaintenance = async () => {
    const next = !maintEnabled;
    setMaintEnabled(next);
    await saveSetting('maintenance_mode', { enabled: next, message: maintMsg });
  };

  const toggleBanner = async () => {
    const next = !bannerEnabled;
    setBannerEnabled(next);
    await saveSetting('site_banner', {
      enabled: next,
      message: bannerMsg,
      tone: bannerTone,
      dismissible: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* 微信风格二级下划线选项卡 */}
      <AdminUnderlineTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* 选项卡内容区 */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* 四列设置列表卡片 */}
          <div className="rounded-2xl border border-line-subtle bg-surface-raised p-6 shadow-elevation-1">
            <div className="border-b border-line-subtle pb-3 mb-2 flex items-center justify-between">
              <div>
                <h3 className="text-body font-semibold text-ink">系统核心运行设置</h3>
                <p className="text-caption text-ink-subtle mt-0.5">
                  四列读写分离布局：直接查看生效值、合规风控边界与快捷操作
                </p>
              </div>
              {Object.values(feedback).some(Boolean) && (
                <span className="text-caption font-medium text-emerald-400 animate-in fade-in">
                  {Object.values(feedback).filter(Boolean).pop()}
                </span>
              )}
            </div>

            <div className="divide-y divide-line-subtle">
              {/* Row 1: 探索应用入口 */}
              <AdminSettingRow
                label="探索应用 (Explore Apps)"
                value={
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={exploreAppsEnabled ? 'good' : 'neutral'}>
                      {exploreAppsEnabled ? '前台已显示' : '已隐藏 (推荐)'}
                    </StatusBadge>
                  </div>
                }
                context="控制 Studio 创作者左侧边栏底部的「Explore Apps」功能入口。首发生态插件成熟前建议保持隐藏。"
                action={savingKey === 'feature_explore_apps' ? '保存中…' : exploreAppsEnabled ? '隐藏入口' : '显示入口'}
                onClickAction={toggleExploreApps}
              />

              {/* Row 2: 新用户自主注册 */}
              <AdminSettingRow
                label="新用户自主注册"
                value={
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={allowRegister ? 'good' : 'warn'}>
                      {allowRegister ? '开放自主注册' : '已暂停注册'}
                    </StatusBadge>
                  </div>
                }
                context="关闭后仅已有账号或受邀用户可登入 Studio，有效拦截未知访客并控制算力并发消耗。"
                action={savingKey === 'registration_enabled' ? '保存中…' : allowRegister ? '暂停注册' : '开启注册'}
                onClickAction={toggleRegister}
              />

              {/* Row 3: 全局维护模式 */}
              <AdminSettingRow
                label="系统维护拦截模式"
                value={
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={maintEnabled ? 'danger' : 'good'}>
                      {maintEnabled ? '维护拦截中' : '对外正常营业'}
                    </StatusBadge>
                  </div>
                }
                context={`当前提示：“${maintMsg}”。开启后前台所有页面将显示拦截页，仅管理员可正常访问。`}
                action="配置维护模式"
                onClickAction={() => setModalMode('maintenance')}
              />

              {/* Row 4: 前台横幅公告 */}
              <AdminSettingRow
                label="前台顶部横幅公告"
                value={
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={bannerEnabled ? 'brand' : 'neutral'}>
                      {bannerEnabled ? '已开启展示' : '已关闭'}
                    </StatusBadge>
                  </div>
                }
                context={bannerMsg ? `当前文案：“${bannerMsg}”` : '暂未设置公告文案，处于关闭状态。'}
                action="编辑公告"
                onClickAction={() => setModalMode('banner')}
              />
            </div>
          </div>

          {/* 微信风格分步推进网格 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AdminCardGridItem
              title="品牌与图标工作台"
              badge="动态全站响应"
              subtext="Logo、网站 Favicon 与深浅双底色顶栏光学适配"
              actionLabel="前往配置 →"
              onAction={() => window.location.assign('/admin/content/branding')}
            />
            <AdminCardGridItem
              title="登录方式与连通性"
              badge="微信/QQ/海外OAuth"
              subtext="主流社交账号快捷鉴权凭据与网络探针"
              actionLabel="配置渠道 →"
              onAction={() => window.location.assign('/admin/system/login?category=social')}
            />
            <AdminCardGridItem
              title="新用户与签到额度"
              badge="动态规则中枢"
              subtext="新用户 40+50 算力积分与每日主动签到策略"
              actionLabel="进入中枢 →"
              onAction={() => window.location.assign('/admin/credits?tab=rules')}
            />
          </div>
        </div>
      )}

      {activeTab === 'announcement' && (
        <div className="rounded-2xl border border-line-subtle bg-surface-raised p-6 shadow-elevation-1 space-y-6">
          <div className="border-b border-line-subtle pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-body font-semibold text-ink flex items-center gap-2">
                <Megaphone className="size-4 text-brand" />
                <span>前台顶部全站横幅公告 (Site Banner)</span>
              </h3>
              <p className="text-caption text-ink-subtle mt-1">
                公告横幅将固定展示在 Studio 所有端顶栏上方，支持管理员随时发布更新广播、活动通知或维护预警。
              </p>
            </div>
            <StatusBadge tone={bannerEnabled ? 'brand' : 'neutral'}>
              {bannerEnabled ? '前台展示中' : '已关闭'}
            </StatusBadge>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await saveSetting('site_banner', {
                enabled: bannerEnabled,
                message: bannerMsg,
                tone: bannerTone,
                dismissible: true,
              });
            }}
            className="space-y-4 max-w-2xl"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="banner_toggle_tab"
                checked={bannerEnabled}
                onChange={(e) => setBannerEnabled(e.target.checked)}
                className="size-4 rounded border-white/20 bg-black/40 text-brand focus:ring-brand cursor-pointer"
              />
              <label htmlFor="banner_toggle_tab" className="text-sm font-semibold text-ink select-none cursor-pointer">
                启用前台顶部公告横幅展示
              </label>
            </div>

            <div>
              <label className="block text-caption font-medium text-ink-muted mb-1.5">
                公告文案内容 (必填)
              </label>
              <input
                type="text"
                required
                value={bannerMsg}
                onChange={(e) => setBannerMsg(e.target.value)}
                placeholder="例如：系统已升级支持全新 Flux 与 Hailuo 视频生成模型！"
                className="w-full rounded-xl border border-line bg-black/40 px-3.5 py-2.5 text-body-sm text-ink outline-none focus:border-brand/60 transition-colors"
              />
            </div>

            <div>
              <label className="block text-caption font-medium text-ink-muted mb-1.5">
                展示色调风格
              </label>
              <select
                value={bannerTone}
                onChange={(e) => setBannerTone(e.target.value)}
                className="w-full rounded-xl border border-line bg-base px-3.5 py-2.5 text-body-sm text-ink outline-none focus:border-brand/60 transition-colors"
              >
                <option value="info">中性冷灰 (常规系统信息)</option>
                <option value="good">翡翠绿 (新模型/福利上线)</option>
                <option value="warn">琥珀橙 (注意/重要提醒)</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-caption text-brand">{feedback['site_banner']}</span>
              <button
                type="submit"
                disabled={savingKey === 'site_banner'}
                className="rounded-xl bg-brand px-5 py-2 text-xs font-semibold text-white hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingKey === 'site_banner' ? '保存中…' : '保存公告配置'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'ecosystem' && (
        <div className="space-y-6">
          {/* 品牌工作台卡片 */}
          <div className="rounded-2xl border border-line-subtle bg-surface-raised p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-brand" />
                  <h3 className="text-body font-semibold text-ink">品牌设置 (Logo 与网站 Icon)</h3>
                  <StatusBadge tone="good">动态全站响应</StatusBadge>
                </div>
                <p className="text-caption text-ink-subtle">
                  统一管理 Studio 前台品牌 Logo、网站浏览器 Icon 图标（官方三色方块系统预设 / 自定义上传）、跳转路径以及顶栏右侧菜单导航。
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Link
                  href="/admin/content/branding#icon-settings"
                  className="rounded-xl border border-line bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-ink-muted hover:bg-white/[0.08] hover:text-ink transition-colors"
                >
                  Icon 图标定位 →
                </Link>
                <Link
                  href="/admin/content/branding"
                  className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover active:scale-[0.98] transition-all shadow-elevation-1"
                >
                  进入品牌工作台 →
                </Link>
              </div>
            </div>
          </div>

          {/* 第三方社交登录卡片 */}
          <div className="rounded-2xl border border-line-subtle bg-surface-raised p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle pb-4 mb-4">
              <div className="space-y-1">
                <h3 className="text-body font-semibold text-ink">第三方社交平台快捷登录 (OAuth)</h3>
                <p className="text-caption text-ink-subtle">
                  支持境内外主流社交账号快速鉴权与新用户无感建档，内置网络探针诊断。
                </p>
              </div>
              <Link
                href="/admin/system/login?category=social"
                className="text-xs font-semibold text-brand hover:underline"
              >
                管理各渠道凭据与网络探针 →
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                <WeChatIcon size={13} /> 微信
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
                <QQIcon size={13} /> QQ
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white">
                <DouyinIcon size={13} /> 抖音
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-pink-500/20 bg-pink-500/10 px-2 py-0.5 text-[11px] font-medium text-pink-300">
                <BilibiliIcon size={13} /> 哔哩哔哩
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                <GoogleIcon size={13} /> Google
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white">
                <XIcon size={13} /> X
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white">
                <TikTokIcon size={13} /> TikTok
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                <InstagramIcon size={13} /> Instagram
              </span>
            </div>
          </div>

          {/* 新用户额度卡片 */}
          <div className="rounded-2xl border border-line-subtle bg-surface-raised p-6">
            <div className="flex items-center justify-between border-b border-line-subtle pb-3 mb-4">
              <div className="space-y-1">
                <h3 className="text-body font-semibold text-ink">新用户赠送与每日签到额度策略</h3>
                <p className="text-caption text-ink-subtle">
                  控制新用户初始获赠积分、引导奖励与每日签到，契约校验获客成本在红线内。
                </p>
              </div>
              <StatusBadge tone="good">动态规则中枢就绪</StatusBadge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 mb-4">
              <div className="rounded-xl border border-line-subtle bg-white/[0.02] p-3">
                <span className="text-caption text-ink-subtle block">新用户注册初始</span>
                <span className="text-body font-bold text-brand font-mono mt-1 block">40 算力积分</span>
                <span className="text-caption text-ink-muted mt-0.5 block">注册即入账，门槛试用</span>
              </div>
              <div className="rounded-xl border border-line-subtle bg-white/[0.02] p-3">
                <span className="text-caption text-ink-subtle block">完善资料 / 引导奖励</span>
                <span className="text-body font-bold text-emerald-400 font-mono mt-1 block">+50 算力积分</span>
                <span className="text-caption text-ink-muted mt-0.5 block">完成昵称或问卷立得</span>
              </div>
              <div className="rounded-xl border border-line-subtle bg-white/[0.02] p-3">
                <span className="text-caption text-ink-subtle block">每日主动签到</span>
                <span className="text-body font-bold text-amber-400 font-mono mt-1 block">10 算力积分</span>
                <span className="text-caption text-ink-muted mt-0.5 block">当日有效，促进日活</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-subtle bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 text-caption text-ink-muted">
                <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>定价契约验证：新人合计 90 积分 = 1 次旗舰试用，边际获客成本 ¥1.26 ≤ 预算红线 ¥2.50</span>
              </div>
              <Link
                href="/admin/credits?tab=rules"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover active:scale-[0.98] transition-all shadow-elevation-1"
              >
                <span>进入新用户与签到规则控制台</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 维护模式编辑弹窗 */}
      {modalMode === 'maintenance' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface-raised p-6 shadow-elevation-3 space-y-4">
            <div className="flex items-center justify-between border-b border-line-subtle pb-3">
              <h3 className="text-body font-semibold text-ink flex items-center gap-2">
                <Wrench className="size-4 text-brand" />
                <span>配置全局系统维护模式</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-ink-subtle hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="maint_dialog_toggle"
                  checked={maintEnabled}
                  onChange={(e) => setMaintEnabled(e.target.checked)}
                  className="size-4 rounded border-white/20 bg-black/40 text-brand focus:ring-brand cursor-pointer"
                />
                <label htmlFor="maint_dialog_toggle" className="text-sm font-semibold text-red-300 select-none cursor-pointer">
                  立即启用全站维护拦截
                </label>
              </div>

              <div>
                <label className="block text-caption font-medium text-ink-muted mb-1.5">
                  对外维护提示语
                </label>
                <input
                  type="text"
                  value={maintMsg}
                  onChange={(e) => setMaintMsg(e.target.value)}
                  className="w-full rounded-xl border border-line bg-base px-3.5 py-2.5 text-body-sm text-ink outline-none focus:border-brand/60"
                  placeholder="系统正在例行升级，请稍候访问"
                />
                <p className="mt-1 text-caption text-ink-subtle">
                  开启后普通访客访问任何 Studio 前台页面都将看到此提示，管理员后台正常通行。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line-subtle">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="rounded-xl border border-line bg-white/[0.04] px-4 py-2 text-xs font-medium text-ink-muted hover:bg-white/[0.08] hover:text-ink transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                disabled={savingKey === 'maintenance_mode'}
                onClick={async () => {
                  const ok = await saveSetting('maintenance_mode', {
                    enabled: maintEnabled,
                    message: maintMsg,
                  });
                  if (ok) setModalMode(null);
                }}
                className="rounded-xl bg-brand px-5 py-2 text-xs font-semibold text-white hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {savingKey === 'maintenance_mode' ? '保存中…' : '保存维护设置'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 横幅公告编辑弹窗 */}
      {modalMode === 'banner' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface-raised p-6 shadow-elevation-3 space-y-4">
            <div className="flex items-center justify-between border-b border-line-subtle pb-3">
              <h3 className="text-body font-semibold text-ink flex items-center gap-2">
                <Megaphone className="size-4 text-brand" />
                <span>配置全站横幅公告 (Banner)</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-ink-subtle hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="banner_dialog_toggle"
                  checked={bannerEnabled}
                  onChange={(e) => setBannerEnabled(e.target.checked)}
                  className="size-4 rounded border-white/20 bg-black/40 text-brand focus:ring-brand cursor-pointer"
                />
                <label htmlFor="banner_dialog_toggle" className="text-sm font-semibold text-ink select-none cursor-pointer">
                  启用前台顶部公告横幅展示
                </label>
              </div>

              <div>
                <label className="block text-caption font-medium text-ink-muted mb-1.5">
                  公告文案内容
                </label>
                <input
                  type="text"
                  required
                  value={bannerMsg}
                  onChange={(e) => setBannerMsg(e.target.value)}
                  placeholder="例如：系统已升级支持全新 Flux 与 Hailuo 视频生成模型！"
                  className="w-full rounded-xl border border-line bg-base px-3.5 py-2.5 text-body-sm text-ink outline-none focus:border-brand/60"
                />
              </div>

              <div>
                <label className="block text-caption font-medium text-ink-muted mb-1.5">
                  展示色调风格
                </label>
                <select
                  value={bannerTone}
                  onChange={(e) => setBannerTone(e.target.value)}
                  className="w-full rounded-xl border border-line bg-base px-3.5 py-2.5 text-body-sm text-ink outline-none focus:border-brand/60"
                >
                  <option value="info">中性冷灰 (常规系统信息)</option>
                  <option value="good">翡翠绿 (新模型/福利上线)</option>
                  <option value="warn">琥珀橙 (注意/重要提醒)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line-subtle">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="rounded-xl border border-line bg-white/[0.04] px-4 py-2 text-xs font-medium text-ink-muted hover:bg-white/[0.08] hover:text-ink transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                disabled={savingKey === 'site_banner'}
                onClick={async () => {
                  const ok = await saveSetting('site_banner', {
                    enabled: bannerEnabled,
                    message: bannerMsg,
                    tone: bannerTone,
                    dismissible: true,
                  });
                  if (ok) setModalMode(null);
                }}
                className="rounded-xl bg-brand px-5 py-2 text-xs font-semibold text-white hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {savingKey === 'site_banner' ? '保存中…' : '保存公告配置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
