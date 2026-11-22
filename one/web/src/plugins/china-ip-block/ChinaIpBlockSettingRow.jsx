'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AdminSettingRow, StatusBadge } from '@/components/admin/AdminUi';
import { ShieldAlert, ShieldCheck, CheckCircle2, AlertCircle, Wrench, Trash2 } from 'lucide-react';
import { formatCopy, getPluginCopy, resolvePluginBrowserLocale } from './i18n.js';

/**
 * 临时插件：中国流量屏蔽设置行与配置弹窗组件
 * 严格遵循 docs/UI_DESIGN_SYSTEM.md 与 docs/UI_REPAIR_INSTRUCTION.md 规范
 *
 * 文案全部来自 plugins/china-ip-block/messages/{locale}.json：后台页面声明英文
 * `<html lang>` 时出英文，操作者偏好中文时出中文，日/韩/繁/西同理。语言取自宿主
 * 页面自己声明的 `<html lang>`（核心根布局按 x-locale 渲染），插件不为后台发明
 * 第二套语言判定。
 *
 * 首帧用注册表默认语言，挂载后再对齐宿主语言：服务端渲染时读不到 document，若
 * 直接在 render 里取浏览器语言，SSR 首帧与 hydration 文案会不一致并触发 React
 * 警告。管理后台整体本地化（任务 #10）落地后，这一帧对齐依旧无害。
 */
export default function ChinaIpBlockSettingRow({
  settings = [],
  saveSetting,
  savingKey,
}) {
  const currentVal = (() => {
    const item = settings.find((s) => s.key === 'china_ip_block');
    return item?.value || {
      enabled: false,
      exemptAdmin: true,
      whitelistIps: '',
    };
  })();

  const [enabled, setEnabled] = useState(Boolean(currentVal.enabled));
  const [exemptAdmin, setExemptAdmin] = useState(currentVal.exemptAdmin !== false);
  const [whitelistIps, setWhitelistIps] = useState(currentVal.whitelistIps || '');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // IP 在线测试状态
  const [testIpInput, setTestIpInput] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // 语言：首帧用注册表默认语言，挂载后对齐宿主页面声明的 <html lang>
  const [locale, setLocale] = useState(null);
  useEffect(() => {
    setLocale(resolvePluginBrowserLocale());
  }, []);
  const copy = useMemo(() => getPluginCopy(locale).admin, [locale]);

  // 快捷一键开关切换
  const handleToggle = async (e) => {
    e?.stopPropagation();
    const nextState = !enabled;
    setEnabled(nextState);
    const updated = {
      ...currentVal,
      enabled: nextState,
      exemptAdmin,
      whitelistIps,
    };
    await saveSetting('china_ip_block', updated);
  };

  // 保存弹窗内的详细配置
  const handleSaveModal = async () => {
    const updated = {
      enabled,
      exemptAdmin,
      whitelistIps,
    };
    const ok = await saveSetting('china_ip_block', updated);
    if (ok) {
      setIsModalOpen(false);
    }
  };

  // 执行 IP 诊断测试
  const handleTestIp = async () => {
    if (!testIpInput.trim()) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          action: 'test_china_ip',
          ip: testIpInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || copy.testError);
      setTestResult(data.data);
    } catch (err) {
      setTestResult({ isChina: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const isSaving = savingKey === 'china_ip_block';

  return (
    <>
      <AdminSettingRow
        label={copy.rowLabel}
        value={
          <div className="flex items-center gap-3">
            <StatusBadge tone={enabled ? 'danger' : 'neutral'}>
              {enabled ? copy.badgeEnabled : copy.badgeDisabled}
            </StatusBadge>

            {/* 高精度状态开关 Switch 按钮 */}
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={enabled ? copy.switchOffAria : copy.switchOnAria}
              disabled={isSaving}
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[#0e1013] disabled:opacity-50 ${
                enabled ? 'bg-brand' : 'bg-white/10 hover:bg-white/15'
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        }
        context={enabled ? copy.contextEnabled : copy.contextDisabled}
        action={copy.openConfig}
        onClickAction={() => setIsModalOpen(true)}
      />

      {/* 高级配置与 IP 阻断模拟弹窗 */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-[#0e1013] p-6 shadow-elevation-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line-subtle pb-3">
              <h3 className="text-body font-semibold text-ink flex items-center gap-2">
                <ShieldAlert className="size-4 text-brand" />
                <span>{copy.modalTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label={copy.modalCloseAria}
                className="text-ink-subtle hover:text-ink text-sm px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 text-xs">
              {/* 开关勾选 */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-line-subtle bg-surface">
                <div>
                  <div className="font-semibold text-ink text-sm">{copy.blockCardTitle}</div>
                  <div className="text-ink-subtle mt-0.5">
                    {copy.blockCardDesc}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={enabled ? copy.switchOffAria : copy.switchOnAria}
                  disabled={isSaving}
                  onClick={() => setEnabled(!enabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 ${
                    enabled ? 'bg-brand' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 管理后台豁免保护 */}
              <div className="p-3 rounded-xl border border-line-subtle bg-surface space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exemptAdmin}
                    onChange={(e) => setExemptAdmin(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-white/20 bg-black/40 text-brand focus:ring-brand cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-ink">{copy.exemptTitle}</span>
                    <p className="text-ink-subtle mt-0.5">
                      {copy.exemptDesc}
                    </p>
                  </div>
                </label>
              </div>

              {/* IP 检测测试工具 */}
              <div className="p-3.5 rounded-xl border border-line-subtle bg-surface space-y-2.5">
                <div className="font-semibold text-ink flex items-center justify-between">
                  <span>{copy.testTitle}</span>
                  <span className="text-[11px] text-ink-subtle font-normal">{copy.testSubtitle}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testIpInput}
                    onChange={(e) => setTestIpInput(e.target.value)}
                    placeholder={copy.testPlaceholder}
                    className="flex-1 rounded-xl border border-line bg-base px-3 py-2 text-xs text-ink outline-none focus:border-brand font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestIp}
                    disabled={isTesting || !testIpInput.trim()}
                    className="rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-ink px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {isTesting ? copy.testRunning : copy.testRun}
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                      testResult.isChina
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    }`}
                  >
                    {testResult.isChina ? (
                      <AlertCircle className="size-4 shrink-0 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                    )}
                    <div>
                      <span className="font-semibold">
                        {testResult.error
                          ? testResult.error
                          : testResult.isChina
                            ? formatCopy(copy.testBlockedTitle, { ip: testResult.ip, type: testResult.type || 'CN' })
                            : formatCopy(copy.testPassedTitle, { ip: testResult.ip })}
                      </span>
                      <p className="text-[11px] opacity-80 mt-0.5">
                        {testResult.error
                          ? ''
                          : testResult.isChina
                            ? copy.testBlockedDesc
                            : copy.testPassedDesc}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 放行白名单 */}
              <div>
                <label className="block font-medium text-ink-muted mb-1.5">
                  {copy.whitelistLabel}
                </label>
                <textarea
                  rows={2}
                  value={whitelistIps}
                  onChange={(e) => setWhitelistIps(e.target.value)}
                  placeholder={copy.whitelistPlaceholder}
                  className="w-full rounded-xl border border-line bg-base p-2.5 text-xs text-ink outline-none focus:border-brand font-mono"
                />
                <p className="mt-1 text-caption text-ink-subtle">
                  {copy.whitelistHint}
                </p>
              </div>

              {/* 临时插件卸载说明 */}
              <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-200/90 text-[11px] leading-relaxed">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
                  <Wrench className="size-3.5" />
                  <span>{copy.uninstallTitle}</span>
                </div>
                {copy.uninstallIntro}
                <code className="block my-1.5 p-1.5 rounded bg-black/60 font-mono text-[10px] text-amber-100 select-all border border-amber-500/20">
                  {copy.uninstallCommand}
                </code>
                {copy.uninstallOutro}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line-subtle">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-line bg-white/[0.04] px-4 py-2 text-xs font-medium text-ink-muted hover:bg-white/[0.08] hover:text-ink transition-colors"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveModal}
                className="rounded-xl bg-brand px-5 py-2 text-xs font-semibold text-white hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
              >
                {isSaving ? copy.saving : copy.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
