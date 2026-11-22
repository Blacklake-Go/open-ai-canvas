'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_LOCALE, getLocaleConfig, LOCALE_CONFIGS, SUPPORTED_LOCALES, normalizeLocale } from '@/lib/locales';
import { switchLocale as switchLocaleVia } from '@/lib/client/localeSwitch';

const SUPPORTED_LANGUAGES = SUPPORTED_LOCALES.map((code) => ({
  code,
  label: LOCALE_CONFIGS[code]?.nativeName || code,
}));

export default function SettingsTab() {
  const [notifications, setNotifications] = useState(true);
  const [highQualityPreview, setHighQualityPreview] = useState(true);
  const [currentLocale, setCurrentLocale] = useState(DEFAULT_LOCALE);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const normalizedLocale = normalizeLocale(currentLocale);
  const activeLangLabel = SUPPORTED_LANGUAGES.find((l) => l.code === normalizedLocale)?.label || normalizedLocale;

  // 1. 从后端数据库加载真实偏好设置
  useEffect(() => {
    let mounted = true;
    async function loadPreferences() {
      try {
        const res = await fetch('/api/user/preferences');
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.preferences) {
            setNotifications(data.preferences.notifyOnComplete ?? true);
            setHighQualityPreview(data.preferences.highQualityPreview ?? true);
            setCurrentLocale(normalizeLocale(data.preferences.locale || DEFAULT_LOCALE));
          }
        }
      } catch (err) {
        console.error('加载偏好设置失败:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadPreferences();
    return () => { mounted = false; };
  }, []);

  // 2. 实时保存偏好设置至数据库
  const savePreference = async (updates) => {
    if (typeof window !== 'undefined') {
      try {
        const current = JSON.parse(localStorage.getItem('supdance_user_preferences') || '{}');
        const next = { ...current, ...updates };
        localStorage.setItem('supdance_user_preferences', JSON.stringify(next));
        if (updates.highQualityPreview !== undefined) {
          localStorage.setItem('supdance_high_quality_preview', String(updates.highQualityPreview));
        }
        window.dispatchEvent(new CustomEvent('supdance-preferences-changed', { detail: next }));
      } catch {}
    }

    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setToastMessage('偏好设置已同步至数据库');
        setTimeout(() => setToastMessage(''), 2500);
        return data;
      } else {
        setToastMessage('设置保存失败');
      }
    } catch {
      setToastMessage('网络连接异常');
    }
  };

  const handleToggleNotifications = () => {
    const nextVal = !notifications;
    setNotifications(nextVal);
    savePreference({ notifyOnComplete: nextVal });
  };

  const handleTogglePreview = () => {
    const nextVal = !highQualityPreview;
    setHighQualityPreview(nextVal);
    savePreference({ highQualityPreview: nextVal });
  };

  const handleSelectLanguage = (code) => {
    const norm = normalizeLocale(code);
    setCurrentLocale(norm);
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    const search = typeof window !== 'undefined' ? window.location.search : '';
    switchLocaleVia({ targetLocale: norm, pathname, search });
  };

  return (
    <div className="w-full flex flex-col gap-6 relative">
      {/* 实时保存轻量 Toast 反馈 */}
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-toast px-4 py-2 rounded-full bg-overlay border border-line text-xs text-ink shadow-elevation-4 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      <div>
        <h1 className="text-page-title font-bold tracking-tight text-ink">偏好设置</h1>
        <p className="mt-1 text-xs text-ink-muted">定制通知推送、渲染画质与语言选项</p>
      </div>

      <Card padding="lg" className="rounded-xl border border-line-subtle bg-surface p-6 flex flex-col gap-4 shadow-elevation-1">
        {/* 生成完成通知 */}
        <div className="flex items-center justify-between gap-4 border-b border-line-subtle pb-4 min-h-[50px]">
          <div className="min-w-0 flex-1">
            <h4 className="text-body-sm font-semibold text-ink">生成完成通知</h4>
            <p className="text-caption text-ink-muted mt-0.5 truncate">长时间生图或视频任务渲染完成时发送系统推送</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notifications}
            disabled={loading}
            onClick={handleToggleNotifications}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-line-subtle transition-colors duration-200 ease-in-out focus:outline-none ${
              notifications ? 'bg-brand' : 'bg-wash-strong'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                notifications ? 'translate-x-4 bg-ink-inverse' : 'translate-x-0 bg-ink-muted'
              }`}
            />
          </button>
        </div>

        {/* 高清实时画质预览 */}
        <div className="flex items-center justify-between gap-4 border-b border-line-subtle pb-4 min-h-[50px]">
          <div className="min-w-0 flex-1">
            <h4 className="text-body-sm font-semibold text-ink">高清实时画质预览</h4>
            <p className="text-caption text-ink-muted mt-0.5 truncate">在工作流中优先加载全分辨率渲染视图</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={highQualityPreview}
            disabled={loading}
            onClick={handleTogglePreview}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-line-subtle transition-colors duration-200 ease-in-out focus:outline-none ${
              highQualityPreview ? 'bg-brand' : 'bg-wash-strong'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                highQualityPreview ? 'translate-x-4 bg-ink-inverse' : 'translate-x-0 bg-ink-muted'
              }`}
            />
          </button>
        </div>

        {/* 语言与国际化 */}
        <div className="flex items-center justify-between gap-4 min-h-[50px]">
          <div className="min-w-0 flex-1">
            <h4 className="text-body-sm font-semibold text-ink">界面语言</h4>
            <p className="text-caption text-ink-muted mt-0.5 truncate">当前语言：{activeLangLabel} ({currentLocale})</p>
          </div>

          <div className="shrink-0">
            <Select value={normalizedLocale} onValueChange={handleSelectLanguage}>
              <SelectTrigger size="sm" className="w-36 text-caption" aria-label="界面语言">
                <SelectValue placeholder="选择语言" />
              </SelectTrigger>
              <SelectContent className="z-modal">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>
    </div>
  );
}
