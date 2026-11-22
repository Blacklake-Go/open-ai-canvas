'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/locales';
import { switchLocale as switchLocaleVia } from '@/lib/client/localeSwitch';
import { Bell, Eye, Globe, CheckCircle2, AlertCircle, ChevronDown, Check } from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '/flags/en.svg' },
  { code: 'zh-CN', label: '简体中文', flag: '/flags/zh-cn.svg' },
  { code: 'ja-JP', label: '日本語', flag: '/flags/ja.svg' },
  { code: 'ko-KR', label: '한국어', flag: '/flags/ko.svg' },
  { code: 'zh-TW', label: '繁體中文', flag: '/flags/zh-tw.svg' },
  { code: 'es', label: 'Español', flag: '/flags/es.svg' },
];

export default function SystemPreferencesSection({ user = null, className = '' }) {
  const [notifications, setNotifications] = useState(() => user?.preferences?.notifyOnComplete ?? true);
  const [highQualityPreview, setHighQualityPreview] = useState(() => user?.preferences?.highQualityPreview ?? true);
  const [currentLocale, setCurrentLocale] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(localStorage.getItem('supdance_user_preferences') || '{}');
        if (local.locale) return normalizeLocale(local.locale);
        const match = document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/);
        if (match) return normalizeLocale(decodeURIComponent(match[1]));
      } catch {}
    }
    return normalizeLocale(user?.locale || DEFAULT_LOCALE);
  });
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  const dropdownRef = useRef(null);

  const normalizedLocale = normalizeLocale(currentLocale);
  const activeLangItem = SUPPORTED_LANGUAGES.find((l) => l.code === normalizedLocale) || SUPPORTED_LANGUAGES[0];
  const activeLangLabel = activeLangItem.label;

  const isZhTw = normalizedLocale === 'zh-TW';
  const isZhCn = normalizedLocale === 'zh-CN' || normalizedLocale === 'zh';
  const copy = {
    title: isZhTw ? '偏好與體驗' : (isZhCn ? '偏好与体验' : (normalizedLocale === 'ja-JP' ? '環境設定と体験' : (normalizedLocale === 'ko-KR' ? '환경설정 및 경험' : (normalizedLocale === 'es' ? 'Preferencias y experiencia' : 'Preferences & Experience')))),
    notifications: isZhTw ? '生成完成通知' : (isZhCn ? '生成完成通知' : (normalizedLocale === 'ja-JP' ? '生成完了通知' : (normalizedLocale === 'ko-KR' ? '생성 완료 알림' : (normalizedLocale === 'es' ? 'Notificaciones de generación' : 'Generation Notifications')))),
    notificationsDesc: isZhTw ? '在影片、音訊或圖像生成完畢後推播提醒' : (isZhCn ? '在视频、音频或图像生成完毕后推送提醒' : (normalizedLocale === 'ja-JP' ? '画像・動画・音声の生成完了時にプッシュ通知' : (normalizedLocale === 'ko-KR' ? '이미지, 비디오 또는 오디오 생성 완료 시 푸시 알림' : (normalizedLocale === 'es' ? 'Recibir notificaciones cuando se completen las generaciones' : 'Receive push notifications when image, video, or audio tasks complete')))),
    preview: isZhTw ? '高畫質即時預覽' : (isZhCn ? '高画质即时预览' : (normalizedLocale === 'ja-JP' ? '高画質リアルタイムプレビュー' : (normalizedLocale === 'ko-KR' ? '고화질 실시간 미리보기' : (normalizedLocale === 'es' ? 'Vista previa de alta calidad' : 'High-Quality Live Preview')))),
    previewDesc: isZhTw ? '在工作區使用全保真動態預覽（消耗更多顯存與頻寬）' : (isZhCn ? '在工作区使用全保真动态预览（消耗更多显存与带宽）' : (normalizedLocale === 'ja-JP' ? 'ワークスペースで全解像度プレビューを使用（メモリ・帯域幅消費）' : (normalizedLocale === 'ko-KR' ? '작업 공간에서 전체 해상도 미리보기 사용 (메모리 및 대역폭 추가 소모)' : (normalizedLocale === 'es' ? 'Usar vista previa de fidelidad total en el espacio de trabajo' : 'Render full-fidelity preview in workspace (uses more memory and bandwidth)')))),
    language: isZhTw ? '介面語言' : (isZhCn ? '界面语言' : (normalizedLocale === 'ja-JP' ? 'インターフェース言語' : (normalizedLocale === 'ko-KR' ? '인터페이스 언어' : (normalizedLocale === 'es' ? 'Idioma de la interfaz' : 'Interface Language')))),
    currentLang: isZhTw ? `目前選擇：${activeLangLabel}` : (isZhCn ? `当前选择：${activeLangLabel}` : (normalizedLocale === 'ja-JP' ? `現在の選択：${activeLangLabel}` : (normalizedLocale === 'ko-KR' ? `현재 선택: ${activeLangLabel}` : (normalizedLocale === 'es' ? `Selección actual: ${activeLangLabel}` : `Current selection: ${activeLangLabel}`)))),
    placeholder: isZhTw ? '選擇語言' : (isZhCn ? '选择语言' : (normalizedLocale === 'ja-JP' ? '言語を選択' : (normalizedLocale === 'ko-KR' ? '언어 선택' : (normalizedLocale === 'es' ? 'Seleccionar idioma' : 'Select Language')))),
    syncedToast: isZhTw ? '偏好設定已同步至資料庫' : (isZhCn ? '偏好设置已同步至数据库' : (normalizedLocale === 'ja-JP' ? '設定がデータベースに同期されました' : (normalizedLocale === 'ko-KR' ? '환경설정이 데이터베이스에 동기화되었습니다' : (normalizedLocale === 'es' ? 'Preferencias sincronizadas con la base de datos' : 'Preferences synced to database')))),
    saveFailed: isZhTw ? '設定儲存失敗' : (isZhCn ? '设置保存失败' : (normalizedLocale === 'ja-JP' ? '設定の保存に失敗しました' : (normalizedLocale === 'ko-KR' ? '설정 저장에 실패했습니다' : (normalizedLocale === 'es' ? 'Error al guardar ajustes' : 'Failed to save settings')))),
    networkError: isZhTw ? '網路異常，無法儲存偏好設定' : (isZhCn ? '网络异常，无法保存偏好设置' : (normalizedLocale === 'ja-JP' ? 'ネットワーク接続異常' : (normalizedLocale === 'ko-KR' ? '네트워크 오류가 발생했습니다' : (normalizedLocale === 'es' ? 'Error de red' : 'Network error, unable to save preferences')))),
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. 从后端加载真实偏好设置，若有本地快照先即时应用
  useEffect(() => {
    let mounted = true;
    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(localStorage.getItem('supdance_user_preferences') || '{}');
        if (local.notifyOnComplete !== undefined) setNotifications(local.notifyOnComplete);
        if (local.highQualityPreview !== undefined) setHighQualityPreview(local.highQualityPreview);
        if (local.locale) setCurrentLocale(normalizeLocale(local.locale));
      } catch {}
    }

    async function loadPreferences() {
      try {
        const res = await fetch('/api/user/preferences');
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.preferences) {
            const notif = data.preferences.notifyOnComplete ?? true;
            const hq = data.preferences.highQualityPreview ?? true;
            const loc = normalizeLocale(data.preferences.locale || DEFAULT_LOCALE);
            setNotifications(notif);
            setHighQualityPreview(hq);
            setCurrentLocale(loc);
            try {
              localStorage.setItem('supdance_user_preferences', JSON.stringify({
                notifyOnComplete: notif,
                highQualityPreview: hq,
                locale: loc,
              }));
            } catch {}
          }
        }
      } catch (err) {
        console.error('加载偏好设置失败:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadPreferences();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. 实时保存偏好设置至本地与后端数据库
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
        setToastType('success');
        setToastMessage(copy.syncedToast);
        setTimeout(() => setToastMessage(''), 2500);
        return data;
      } else {
        setToastType('error');
        setToastMessage(copy.saveFailed);
        setTimeout(() => setToastMessage(''), 2500);
      }
    } catch {
      setToastType('error');
      setToastMessage(copy.networkError);
      setTimeout(() => setToastMessage(''), 2500);
    }
  };

  const handleToggleNotifications = async (val) => {
    setNotifications(val);
    if (val && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {}
    }
    await savePreference({ notifyOnComplete: val });
  };

  const handleTogglePreview = async (val) => {
    setHighQualityPreview(val);
    await savePreference({ highQualityPreview: val });
  };

  const handleLanguageChange = async (targetCode) => {
    setDropdownOpen(false);
    const norm = normalizeLocale(targetCode);
    if (norm === normalizedLocale) return;

    setCurrentLocale(norm);
    await savePreference({ locale: norm });

    try {
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
      const search = typeof window !== 'undefined' ? window.location.search : '';
      await switchLocaleVia({ targetLocale: norm, pathname, search });
    } catch (err) {
      console.warn('Locale cookie write failed, falling back to reload', err);
      window.location.reload();
    }
  };

  const handleTriggerKeyDown = (e) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setDropdownOpen((prev) => !prev);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {toastMessage && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-lg border p-3 text-caption animate-in fade-in ${
            toastType === 'success'
              ? 'border-success-line bg-success-soft text-success'
              : 'border-danger-line bg-danger-soft text-danger'
          }`}
        >
          {toastType === 'success' ? <CheckCircle2 className="size-4 shrink-0" strokeWidth={1.8} /> : <AlertCircle className="size-4 shrink-0" strokeWidth={1.8} />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 偏好设置卡片 */}
      <Card className="p-5 sm:p-6 bg-surface-raised border-line-subtle">
        <h3 className="mb-4 flex items-center gap-2 text-card-title text-ink">
          <span>{copy.title}</span>
        </h3>

        <div className="space-y-4">
          {/* 通知设置 */}
          <div className="flex items-center justify-between py-2 border-b border-line-subtle">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-wash border border-line-subtle flex items-center justify-center shrink-0">
                <Bell className="size-4 text-ink-muted" />
              </div>
              <div>
                <p className="text-body-sm font-medium text-ink">{copy.notifications}</p>
                <p className="text-caption text-ink-muted">{copy.notificationsDesc}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications}
                disabled={loading}
                onChange={(e) => handleToggleNotifications(e.target.checked)}
                className="sr-only peer"
              />
              <div className="peer h-6 w-11 rounded-full bg-well peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-base after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-line-strong after:bg-ink-on-accent after:transition-transform after:duration-fast after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-transparent"></div>
            </label>
          </div>

          {/* 高画质预览 */}
          <div className="flex items-center justify-between py-2 border-b border-line-subtle">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-wash border border-line-subtle flex items-center justify-center shrink-0">
                <Eye className="size-4 text-ink-muted" />
              </div>
              <div>
                <p className="text-body-sm font-medium text-ink">{copy.preview}</p>
                <p className="text-caption text-ink-muted">{copy.previewDesc}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={highQualityPreview}
                disabled={loading}
                onChange={(e) => handleTogglePreview(e.target.checked)}
                className="sr-only peer"
              />
              <div className="peer h-6 w-11 rounded-full bg-well peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-base after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-line-strong after:bg-ink-on-accent after:transition-transform after:duration-fast after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-transparent"></div>
            </label>
          </div>

          {/* 多语言切换：流畅交互式下拉菜单，支持勾选高亮与确认生效 */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-wash border border-line-subtle flex items-center justify-center shrink-0">
                <Globe className="size-4 text-ink-muted" />
              </div>
              <div>
                <p className="text-body-sm font-medium text-ink">{copy.language}</p>
                <p className="text-caption text-ink-muted">{copy.currentLang}</p>
              </div>
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                onKeyDown={handleTriggerKeyDown}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
                className="control-focus flex h-control-md w-48 select-none items-center justify-between gap-2 rounded-xl border border-line-subtle bg-well px-3 text-label font-medium text-ink transition-[border-color,background-color] duration-fast ease-standard hover:border-line cursor-pointer active:scale-[0.98] active:duration-press"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <img
                    src={activeLangItem.flag}
                    alt=""
                    className="h-4 w-5 shrink-0 rounded-sm object-cover ring-1 ring-line-subtle"
                  />
                  <span className="truncate font-medium text-ink">{activeLangItem.label}</span>
                </div>
                <ChevronDown
                  className={`size-3.5 shrink-0 text-ink-muted transition-transform duration-fast ease-standard ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                  strokeWidth={1.8}
                />
              </button>

              {dropdownOpen && (
                <div
                  role="listbox"
                  aria-label={copy.language}
                  data-state="open"
                  className="popover-surface absolute right-0 top-full z-dropdown mt-1.5 w-52 p-1.5"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const isSelected = lang.code === normalizedLocale;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`control-focus flex min-h-10 w-full items-center justify-between rounded-md px-3 py-2 text-body transition-none cursor-pointer ${
                          isSelected
                            ? 'bg-wash-press font-medium text-ink'
                            : 'text-ink-muted hover:bg-wash-strong hover:text-ink'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <img
                            src={lang.flag}
                            alt=""
                            className="h-4 w-5 shrink-0 rounded-sm object-cover ring-1 ring-line-subtle"
                          />
                          <span className="truncate">{lang.label}</span>
                        </div>
                        {isSelected && <Check className="size-3.5 shrink-0 text-ink-muted" strokeWidth={1.8} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
