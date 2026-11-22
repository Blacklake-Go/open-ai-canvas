'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminUnderlineTabs } from '@/components/admin/AdminUi';
import BrandingTab from '@/components/admin/settings/BrandingTab';
import BannerTab from '@/components/admin/settings/BannerTab';
import MotionTab from '@/components/admin/settings/MotionTab';
import RuntimeTab from '@/components/admin/settings/RuntimeTab';
import { publishBrandingUpdate } from '@/lib/hooks/useBranding';

const TABS = [
  { id: 'branding', label: '品牌识别与导航' },
  { id: 'banner', label: '顶部公告与横幅' },
  { id: 'motion', label: '视觉动效与能耗' },
  { id: 'runtime', label: '基础运行与安全' },
];

export default function SettingsEditorClient({
  initialSettings = [],
  initialBrand = {},
  initialNavigation = [],
  initialBanner = {},
  initialBannerHistory = [],
  initialMotion = {},
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 选项卡状态与 URL 双向同步
  const tabParam = searchParams.get('tab');
  const normalizeTab = (t) => {
    if (t === 'general') return 'runtime';
    if (t === 'announcement') return 'banner';
    if (t === 'ecosystem') return 'branding';
    if (TABS.some((tab) => tab.id === t)) return t;
    return 'branding';
  };

  const [activeTab, setActiveTab] = useState(() => normalizeTab(tabParam));

  useEffect(() => {
    if (tabParam) {
      const normalized = normalizeTab(tabParam);
      if (normalized !== activeTab) {
        setActiveTab(normalized);
      }
    }
  }, [tabParam]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.replace(`/admin/settings?${params.toString()}`, { scroll: false });
  };

  // 1. 品牌与导航状态
  const [brand, setBrand] = useState({
    brandName: 'supdance',
    siteTitle: 'SupDance — Free AI Image & Video Studio',
    titleTemplate: '%s | SupDance AI Studio',
    brandSlogan: 'AI 创意工作室',
    logoType: 'image',
    logoUrl: '',
    logoIcon: 'layers',
    logoBgColor: '#e11d74',
    logoTextColor: '#ffffff',
    logoHref: '/studio',
    logoTarget: '_self',
    showBrandName: true,
    faviconUrl: '',
    ...initialBrand,
  });
  const [navigation, setNavigation] = useState(initialNavigation || []);
  const [isBrandingSaving, setIsBrandingSaving] = useState(false);
  const [brandingFeedback, setBrandingFeedback] = useState({ type: '', message: '' });

  // 2. 横幅状态
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
  const [bannerHistory, setBannerHistory] = useState(initialBannerHistory || []);
  const [isBannerSaving, setIsBannerSaving] = useState(false);
  const [bannerFeedback, setBannerFeedback] = useState({ type: '', message: '' });

  // 3. 动效状态
  const [motion, setMotion] = useState({
    motionLevel: 'full',
    ambientGlow: true,
    cardTiltHover: true,
    particles: false,
    ...initialMotion,
  });
  const [isMotionSaving, setIsMotionSaving] = useState(false);
  const [motionFeedback, setMotionFeedback] = useState({ type: '', message: '' });

  // 4. 基础运行设置状态
  const [settings, setSettings] = useState(initialSettings || []);
  const [savingSettingKey, setSavingSettingKey] = useState(null);
  const [settingFeedback, setSettingFeedback] = useState({});

  // 保存品牌与导航
  const handleSaveBranding = async () => {
    setIsBrandingSaving(true);
    setBrandingFeedback({ type: '', message: '' });
    try {
      const res = await fetch('/api/admin/content/branding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          action: 'save',
          brand,
          navigation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || '保存品牌失败');

      setBrand(data.data.brand);
      setNavigation(data.data.navigation);
      publishBrandingUpdate(data.data.brand, data.data.navigation);
      setBrandingFeedback({ type: 'success', message: '品牌标识与顶栏导航已成功更新并向全网发布！' });
      setTimeout(() => setBrandingFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setBrandingFeedback({ type: 'error', message: err.message });
    } finally {
      setIsBrandingSaving(false);
    }
  };

  // 重置品牌默认
  const handleResetBranding = async () => {
    if (!confirm('确定要将品牌与导航重置为系统出厂预设吗？当前未保存的自定义设置将被清空。')) {
      return;
    }
    setIsBrandingSaving(true);
    setBrandingFeedback({ type: '', message: '' });
    try {
      const res = await fetch('/api/admin/content/branding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ action: 'reset' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || '重置失败');

      setBrand(data.data.brand);
      setNavigation(data.data.navigation);
      publishBrandingUpdate(data.data.brand, data.data.navigation);
      setBrandingFeedback({ type: 'success', message: '已成功恢复系统官方默认设置！' });
      setTimeout(() => setBrandingFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setBrandingFeedback({ type: 'error', message: err.message });
    } finally {
      setIsBrandingSaving(false);
    }
  };

  // 保存横幅
  const handleSaveBanner = async () => {
    setIsBannerSaving(true);
    setBannerFeedback({ type: '', message: '' });
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
      if (!res.ok) throw new Error(data?.error?.message || '保存横幅失败');

      setBanner(data.data || banner);
      setBannerFeedback({ type: 'success', message: '横幅配置已更新，全网实时生效！' });

      // 刷新历史
      try {
        const histRes = await fetch('/api/admin/content/banner/history');
        if (histRes.ok) {
          const histData = await histRes.json();
          if (histData?.data) setBannerHistory(histData.data);
        }
      } catch {}

      setTimeout(() => setBannerFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setBannerFeedback({ type: 'error', message: err.message });
    } finally {
      setIsBannerSaving(false);
    }
  };

  // 保存动效设置
  const handleSaveMotion = async () => {
    setIsMotionSaving(true);
    setMotionFeedback({ type: '', message: '' });
    try {
      const res = await fetch('/api/admin/content/motion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(motion),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || '保存动效设置失败');

      setMotion(data.data || motion);
      setMotionFeedback({ type: 'success', message: '全站动效能耗配置已生效！' });
      setTimeout(() => setMotionFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setMotionFeedback({ type: 'error', message: err.message });
    } finally {
      setIsMotionSaving(false);
    }
  };

  // 保存基础运行设置项
  const handleSaveSetting = async (key, value, visibility = 'public') => {
    setSavingSettingKey(key);
    setSettingFeedback((prev) => ({ ...prev, [key]: '' }));
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ key, value, visibility }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || '保存设置失败');

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

      setSettingFeedback((prev) => ({ ...prev, [key]: '已成功更新并留存审计' }));
      setTimeout(() => {
        setSettingFeedback((prev) => ({ ...prev, [key]: '' }));
      }, 3000);
      return true;
    } catch (err) {
      setSettingFeedback((prev) => ({ ...prev, [key]: `错误: ${err.message}` }));
      return false;
    } finally {
      setSavingSettingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 微信风格 Underline Tabs (h-12 标尺) */}
      <AdminUnderlineTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* 选项卡内容区 */}
      {activeTab === 'branding' && (
        <BrandingTab
          brand={brand}
          navigation={navigation}
          setBrand={setBrand}
          setNavigation={setNavigation}
          onSave={handleSaveBranding}
          onReset={handleResetBranding}
          isSaving={isBrandingSaving}
          feedback={brandingFeedback}
        />
      )}

      {activeTab === 'banner' && (
        <BannerTab
          banner={banner}
          setBanner={setBanner}
          historyList={bannerHistory}
          setHistoryList={setBannerHistory}
          onSave={handleSaveBanner}
          isSaving={isBannerSaving}
          feedback={bannerFeedback}
        />
      )}

      {activeTab === 'motion' && (
        <MotionTab
          motion={motion}
          setMotion={setMotion}
          onSave={handleSaveMotion}
          isSaving={isMotionSaving}
          feedback={motionFeedback}
        />
      )}

      {activeTab === 'runtime' && (
        <RuntimeTab
          settings={settings}
          saveSetting={handleSaveSetting}
          savingKey={savingSettingKey}
          feedback={settingFeedback}
        />
      )}
    </div>
  );
}
