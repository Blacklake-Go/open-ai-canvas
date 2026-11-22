'use client';

import React, { useState } from 'react';
import Link from 'next/link';
/* --- [TEMPORARY PLUGIN: china-ip-block START] --- */
import ChinaIpBlockSettingRow from '@/plugins/china-ip-block/ChinaIpBlockSettingRow';
/* --- [TEMPORARY PLUGIN: china-ip-block END] --- */

import {
  AdminSettingRow,
  StatusBadge,
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
import {
  ShieldAlert,
  Wrench,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertCircle,
  Users,
  Compass,
} from 'lucide-react';

export default function RuntimeTab({
  settings,
  saveSetting,
  savingKey,
  feedback,
}) {
  const getVal = (key, fallback) => {
    const item = settings.find((s) => s.key === key);
    return item?.value !== undefined ? item.value : fallback;
  };

  // 1. 注册开关
  const reg = getVal('registration_enabled', { enabled: true, allow_oauth: true });
  const [allowRegister, setAllowRegister] = useState(Boolean(reg.enabled));
  const [allowOauth, setAllowOauth] = useState(Boolean(reg.allow_oauth));

  // 2. 维护模式
  const maint = getVal('maintenance_mode', { enabled: false, message: '' });
  const [maintEnabled, setMaintEnabled] = useState(Boolean(maint.enabled));
  const [maintMsg, setMaintMsg] = useState(maint.message || '系统正在例行升级，请稍候访问');

  // 3. 探索应用 (Explore Apps)
  const exploreAppsCfg = getVal('feature_explore_apps', { enabled: false });
  const [exploreAppsEnabled, setExploreAppsEnabled] = useState(Boolean(exploreAppsCfg.enabled));

  // 弹窗状态
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line-subtle bg-surface-raised p-6 shadow-elevation-1">
        <div className="border-b border-line-subtle pb-3 mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-body font-semibold text-ink">系统基础运行与安全访问控制</h3>
            <p className="text-caption text-ink-subtle mt-0.5">
              控制全局流量准入、访客拦截边界及前台生态插件可见性
            </p>
          </div>
          {Object.values(feedback || {}).some(Boolean) && (
            <span className="text-caption font-medium text-emerald-400 animate-in fade-in">
              {Object.values(feedback).filter(Boolean).pop()}
            </span>
          )}
        </div>

        <div className="divide-y divide-line-subtle">
          {/* Row 1: 全局系统维护模式 */}
          <AdminSettingRow
            label="系统维护拦截模式"
            value={
              <div className="flex items-center gap-2">
                <StatusBadge tone={maintEnabled ? 'danger' : 'good'}>
                  {maintEnabled ? '维护拦截中' : '对外正常营业'}
                </StatusBadge>
              </div>
            }
            context={
              maintEnabled
                ? `拦截提示：“${maintMsg}”。开启后前台所有页面将展示 503 拦截页，仅管理员可正常访问。`
                : '当前对外正常开放访问。紧急检修或发布重大迁移时可一键拦截前台普通用户流量。'
            }
            action="配置维护模式"
            onClickAction={() => setIsMaintModalOpen(true)}
          />

          {/* --- [TEMPORARY PLUGIN: china-ip-block START] --- */}
          <ChinaIpBlockSettingRow
            settings={settings}
            saveSetting={saveSetting}
            savingKey={savingKey}
          />
          {/* --- [TEMPORARY PLUGIN: china-ip-block END] --- */}

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

          {/* Row 3: 探索应用入口 */}
          <AdminSettingRow
            label="探索应用 (Explore Apps)"
            value={
              <div className="flex items-center gap-2">
                <StatusBadge tone={exploreAppsEnabled ? 'good' : 'neutral'}>
                  {exploreAppsEnabled ? '前台已显示' : '已隐藏入口'}
                </StatusBadge>
              </div>
            }
            context="控制 Studio 创作者左侧边栏底部的「Explore Apps」功能入口。首发生态插件成熟前建议保持隐藏。"
            action={savingKey === 'feature_explore_apps' ? '保存中…' : exploreAppsEnabled ? '隐藏入口' : '显示入口'}
            onClickAction={toggleExploreApps}
          />

          {/* Row 4: 第三方社交登录鉴权 */}
          <AdminSettingRow
            label="第三方快捷登录 (OAuth)"
            value={
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                  <WeChatIcon size={11} /> 微信
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                  <QQIcon size={11} /> QQ
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-pink-500/20 bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-medium text-pink-300">
                  <BilibiliIcon size={11} /> B站
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                  <GoogleIcon size={11} /> Google
                </span>
              </div>
            }
            context="主流社交渠道快捷鉴权凭据与网络探针诊断，自动同步登录通道状态。"
            action="配置登录通道 →"
            onClickAction={() => window.location.assign('/admin/system/login?category=social')}
          />

          {/* Row 5: 新用户与签到额度策略 */}
          <AdminSettingRow
            label="新用户赠送与签到额度"
            value={
              <div className="flex items-center gap-2">
                <StatusBadge tone="good">
                  新人 90 积分 · 获客成本 ¥1.26
                </StatusBadge>
              </div>
            }
            context="新用户注册赠送 40+50 积分策略与每日主动签到额度，契约保证获客成本在红线内。"
            action="管理额度规则 →"
            onClickAction={() => window.location.assign('/admin/credits?tab=rules')}
          />
        </div>
      </div>

      {/* 维护模式编辑弹窗 */}
      {isMaintModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-[#0e1013] p-6 shadow-elevation-3 space-y-4">
            <div className="flex items-center justify-between border-b border-line-subtle pb-3">
              <h3 className="text-body font-semibold text-ink flex items-center gap-2">
                <Wrench className="size-4 text-brand" />
                <span>配置全局系统维护模式</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsMaintModalOpen(null)}
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
                <label htmlFor="maint_dialog_toggle" className="text-sm font-semibold text-rose-300 select-none cursor-pointer">
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
                  className="w-full rounded-xl border border-line bg-base px-3.5 py-2.5 text-xs text-ink outline-none focus:border-brand"
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
                onClick={() => setIsMaintModalOpen(false)}
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
                  if (ok) setIsMaintModalOpen(false);
                }}
                className="rounded-xl bg-brand px-5 py-2 text-xs font-semibold text-white hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {savingKey === 'maintenance_mode' ? '保存中…' : '保存维护设置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
