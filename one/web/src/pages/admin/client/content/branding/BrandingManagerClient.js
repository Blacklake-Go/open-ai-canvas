'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, StatusBadge, Button as AdminUiButton } from '@/components/admin/AdminUi';
import StandardButton from '@/components/ui/button';
import LogoCropper from '@/components/admin/branding/LogoCropper';
import { publishBrandingUpdate } from '@/lib/hooks/useBranding';
import {
  Eye,
  Save,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Link as LinkIcon,
  Sliders,
  Crop,
  Layers,
  Flame,
  FolderOpen,
  Bot,
  Compass,
  ExternalLink,
  Workflow,
  Zap,
  Globe,
  Bell,
  UserRound,
  Info,
} from 'lucide-react';
import DynamicNavIcon from '@/components/navigation/DynamicNavIcon';

const Button = AdminUiButton || StandardButton || (({ children, className = '', ...props }) => (
  <button className={`inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium transition ${className}`} {...props}>
    {children}
  </button>
));

const NAV_ICON_OPTIONS = [
  { id: 'sparkles', label: '星芒 (Sparkles)' },
  { id: 'info', label: '关于/说明 (Info)' },
  { id: 'flame', label: '火焰 (Flame)' },
  { id: 'folder', label: '作品夹 (Folder)' },
  { id: 'workflow', label: '工作流/接口 (Workflow)' },
  { id: 'bot', label: '智能体 (Bot)' },
  { id: 'zap', label: '闪电/定价 (Zap)' },
  { id: 'compass', label: '指南针 (Compass)' },
  { id: 'globe', label: '网络/全球 (Globe)' },
  { id: 'external', label: '外链 (External)' },
  { id: 'none', label: '无图标' },
];

const QUICK_ROUTES = [
  { label: '关于本站', labelEn: 'About', path: '/about', icon: 'info', badge: '' },
  { label: '商用定价', labelEn: 'Pricing', path: '/pricing', icon: 'zap', badge: 'PRO' },
  { label: '开放平台', labelEn: 'API Platform', path: '/call-api', icon: 'workflow', badge: 'NEW' },
  { label: '即梦社区', labelEn: 'Community', path: '/community', icon: 'flame', badge: 'HOT' },
  { label: '我的作品', labelEn: 'My Creations', path: '/creations', icon: 'folder', badge: '' },
  { label: '核心工作台', labelEn: 'Studio', path: '/studio', icon: 'sparkles', badge: '' },
  { label: '工作流中心', labelEn: 'Workflow', path: '/workflow', icon: 'workflow', badge: '' },
  { label: 'AI智能体', labelEn: 'Agents', path: '/agents', icon: 'bot', badge: 'AI' },
  { label: '服务条款', labelEn: 'Terms', path: '/terms', icon: 'compass', badge: '' },
];

export default function BrandingManagerClient({
  initialBrand,
  initialNavigation,
  defaults,
}) {
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

  const [navigation, setNavigation] = useState(
    Array.isArray(initialNavigation) ? initialNavigation : defaults?.navigation || []
  );

  const [previewTheme, setPreviewTheme] = useState('dark'); // 'dark' | 'light'
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [iconLoadError, setIconLoadError] = useState(false);

  useEffect(() => {
    setLogoLoadError(false);
  }, [brand.logoUrl]);

  useEffect(() => {
    setIconLoadError(false);
  }, [brand.faviconUrl]);

  // 裁剪与上传相关状态
  const fileInputRef = useRef(null);
  const iconFileInputRef = useRef(null);
  const [cropTarget, setCropTarget] = useState('logo'); // 'logo' | 'icon'
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const [showManualIconUrl, setShowManualIconUrl] = useState(false);

  // 导航项编辑模态框状态
  const [editingItem, setEditingItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 处理本地 Logo 图片选择
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('请选择有效的图片文件 (PNG, JPG, WEBP, SVG)');
      return;
    }
    setCropTarget('logo');
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setIsCropping(true);
    };
    reader.readAsDataURL(file);
    // 清空 input 允许重复选相同文件
    e.target.value = '';
  };

  // 处理 Logo 图片拖拽
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('请选择有效的图片文件 (PNG, JPG, WEBP, SVG)');
      return;
    }
    setCropTarget('logo');
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setIsCropping(true);
    };
    reader.readAsDataURL(file);
  };

  // 处理本地 Icon 文件选择 (支持 SVG, ICO 直接落盘，或 PNG/JPG 调出 1:1 方形裁切)
  const handleIconFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isDirectPass =
      file.type === 'image/svg+xml' ||
      file.type === 'image/x-icon' ||
      file.type === 'image/vnd.microsoft.icon' ||
      file.name.toLowerCase().endsWith('.ico');

    if (isDirectPass) {
      setIsUploading(true);
      setFeedback({ type: '', message: '' });
      try {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('type', 'icon');

        const res = await fetch('/api/admin/content/branding/upload', {
          method: 'POST',
          body: formData,
        });

        const json = await res.json();
        if (!res.ok || !json?.data?.url) {
          throw new Error(json?.error?.message || '图标上传失败');
        }

        setBrand((prev) => ({
          ...prev,
          faviconUrl: json.data.url,
        }));
        setFeedback({
          type: 'success',
          message: '网站 Icon 上传就绪！请点击下方“保存全网发布”使全站生效。',
        });
        setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
      } catch (err) {
        setFeedback({ type: 'error', message: err.message || '图标上传失败' });
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('请选择有效的图标文件 (PNG, JPG, WEBP, SVG, ICO)');
      return;
    }

    setCropTarget('icon');
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setIsCropping(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 处理 Icon 拖拽上传
  const handleIconDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const isDirectPass =
      file.type === 'image/svg+xml' ||
      file.type === 'image/x-icon' ||
      file.type === 'image/vnd.microsoft.icon' ||
      file.name.toLowerCase().endsWith('.ico');

    if (isDirectPass) {
      setIsUploading(true);
      setFeedback({ type: '', message: '' });
      try {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('type', 'icon');

        const res = await fetch('/api/admin/content/branding/upload', {
          method: 'POST',
          body: formData,
        });

        const json = await res.json();
        if (!res.ok || !json?.data?.url) {
          throw new Error(json?.error?.message || '图标上传失败');
        }

        setBrand((prev) => ({
          ...prev,
          faviconUrl: json.data.url,
        }));
        setFeedback({
          type: 'success',
          message: '网站 Icon 上传就绪！请点击下方“保存全网发布”使全站生效。',
        });
        setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
      } catch (err) {
        setFeedback({ type: 'error', message: err.message || '图标上传失败' });
      } finally {
        setIsUploading(false);
      }
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('请选择有效的图标文件 (PNG, JPG, WEBP, SVG, ICO)');
      return;
    }

    setCropTarget('icon');
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setIsCropping(true);
    };
    reader.readAsDataURL(file);
  };

  // 恢复默认官方三色方块图标
  const handleRestoreDefaultIcon = () => {
    setBrand((prev) => ({ ...prev, faviconUrl: '' }));
    setFeedback({
      type: 'success',
      message: '已恢复为系统官方标志性「三色方块」图标！请点击下方“保存全网发布”使全站生效。',
    });
    setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
  };

  // 确认裁剪并上传落盘
  const handleCropComplete = async ({ blob, dataUrl, width, height }) => {
    const target = cropTarget; // 'logo' | 'icon'
    setIsCropping(false);
    setIsUploading(true);
    setFeedback({ type: '', message: '' });

    try {
      const formData = new FormData();
      formData.append('file', blob, target === 'icon' ? 'icon.png' : 'logo.png');
      formData.append('type', target);

      const res = await fetch('/api/admin/content/branding/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json?.data?.url) {
        throw new Error(json?.error?.message || '图片上传处理失败，已自动降级为内联存储');
      }

      if (target === 'icon') {
        setBrand((prev) => ({
          ...prev,
          faviconUrl: json.data.url,
        }));
        setFeedback({
          type: 'success',
          message: `网站 Icon 裁剪成功 (${width}x${height}px)！请点击下方“保存全网发布”使全站生效。`,
        });
      } else {
        setBrand((prev) => ({
          ...prev,
          logoType: 'image',
          logoUrl: json.data.url,
        }));
        setFeedback({
          type: 'success',
          message: `Logo 裁剪成功并已安全就绪 (${width}x${height}px)！请点击下方“保存全网发布”使全站生效。`,
        });
      }
      setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
    } catch (err) {
      console.warn('[BrandingManager] 上传落盘失败，使用 base64 降级:', err);
      if (target === 'icon') {
        setBrand((prev) => ({
          ...prev,
          faviconUrl: dataUrl,
        }));
        setFeedback({
          type: 'success',
          message: `网站 Icon 裁剪已就绪！请点击下方“保存全网发布”使全站生效。`,
        });
      } else {
        setBrand((prev) => ({
          ...prev,
          logoType: 'image',
          logoUrl: dataUrl,
        }));
        setFeedback({
          type: 'success',
          message: `Logo 裁剪已就绪！请点击下方“保存全网发布”使全站生效。`,
        });
      }
    } finally {
      setIsUploading(false);
      setRawImageSrc(null);
    }
  };

  // 保存全网发布
  const handleSaveAll = async () => {
    setIsSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch('/api/admin/content/branding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          action: 'save',
          brand,
          navigation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || '保存失败');
      }

      setBrand(data.data.brand);
      setNavigation(data.data.navigation);
      publishBrandingUpdate(data.data.brand, data.data.navigation);
      setFeedback({
        type: 'success',
        message: '🎉 品牌设置（Logo、Icon 与导航配置）已成功保存并向全站发布！',
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // 恢复默认配置
  const handleResetToDefault = async () => {
    if (!confirm('确定要将品牌设置（Logo、网站 Icon 与顶栏导航）重置为系统官方出厂预设吗？当前未保存的自定义设置将被清空。')) {
      return;
    }

    setIsSaving(true);
    setFeedback({ type: '', message: '' });

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
      if (!res.ok) {
        throw new Error(data?.error?.message || '重置失败');
      }

      setBrand(data.data.brand);
      setNavigation(data.data.navigation);
      publishBrandingUpdate(data.data.brand, data.data.navigation);
      setFeedback({
        type: 'success',
        message: '已成功恢复系统官方默认配置！',
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // 导航项操作
  const toggleItemEnabled = (id) => {
    setNavigation((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    );
  };

  const moveItemUp = (index) => {
    setNavigation((prev) => {
      if (index <= 0 || index >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index - 1];
      copy[index - 1] = temp;
      return copy.map((item, idx) => ({ ...item, order: idx + 1 }));
    });
  };

  const moveItemDown = (index) => {
    setNavigation((prev) => {
      if (index < 0 || index >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index + 1];
      copy[index + 1] = temp;
      return copy.map((item, idx) => ({ ...item, order: idx + 1 }));
    });
  };

  const removeItem = (id) => {
    setNavigation((prev) => prev.filter((item) => item.id !== id));
  };

  const handleOpenAddModal = () => {
    setEditingItem({
      id: `nav_${Date.now()}`,
      label: '新功能菜单',
      labelEn: 'New Feature',
      href: '/studio',
      icon: 'sparkles',
      iconColor: '#e11d74',
      style: 'subtle',
      badge: 'NEW',
      enabled: true,
      target: '_self',
      order: navigation.length + 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  const handleSaveModalItem = () => {
    if (!editingItem) return;
    if (!editingItem.label.trim()) {
      alert('请输入菜单按钮标题');
      return;
    }
    if (!editingItem.href.trim()) {
      alert('请输入跳转路由链接');
      return;
    }

    setNavigation((prev) => {
      const exists = prev.some((i) => i.id === editingItem.id);
      if (exists) {
        return prev.map((i) => (i.id === editingItem.id ? editingItem : i));
      }
      return [...prev, editingItem];
    });
    setIsModalOpen(false);
    setEditingItem(null);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-28">
      {/* 隐形 Logo 文件选择器 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
      />

      {/* 隐形 Icon 文件选择器 */}
      <input
        type="file"
        ref={iconFileInputRef}
        onChange={handleIconFileSelect}
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico"
        className="hidden"
      />

      {/* 头部标题与核心描述 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ImageIcon className="w-6 h-6 text-brand" />
            品牌设置 (Logo 与网站 Icon)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            统一管理 Studio 品牌标志 Logo、网站浏览器 Icon 图标（三色方块系统预设 / 自定义上传）及顶栏导航配置。
          </p>
          {/* 快速定位锚点导航 */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <a
              href="#title-settings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand/30 bg-brand/10 hover:bg-brand/20 text-xs font-medium text-brand transition"
            >
              <Globe className="w-3.5 h-3.5 text-brand" />
              站点标题设置
            </a>
            <a
              href="#logo-settings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
            >
              <Crop className="w-3.5 h-3.5 text-brand" />
              Logo 设置
            </a>
            <a
              href="#icon-settings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand/30 bg-brand/10 hover:bg-brand/20 text-xs font-medium text-brand transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              Icon 图标设置
            </a>
            <a
              href="#nav-settings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
            >
              <Sliders className="w-3.5 h-3.5 text-brand" />
              顶栏导航菜单
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleResetToDefault}
            disabled={isSaving}
            className="border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            恢复默认配置
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={isSaving || isUploading}
            className="bg-brand hover:bg-brand-hover text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? '正在发布...' : '保存全网发布'}
          </Button>
        </div>
      </div>

      {/* 提示反馈栏 */}
      {feedback.message && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm transition-all duration-300 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 模块 1：全真 1:1 Live Header 实时顶栏仿真器 */}
      <Card className="border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-semibold text-white">网站顶栏 1:1 真实渲染仿真器</h3>
            <span className="text-xs text-slate-500 hidden md:inline">所见即所得 · 与前台全站无缝同步</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <span className="text-[11px] text-slate-500 px-2">预览背景:</span>
            <button
              type="button"
              onClick={() => setPreviewTheme('dark')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                previewTheme === 'dark'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              暗夜模式 (标准)
            </button>
            <button
              type="button"
              onClick={() => setPreviewTheme('light')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                previewTheme === 'light'
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              明亮模式
            </button>
          </div>
        </div>

        {/* 仿真画布容器 */}
        <div className="p-6 bg-slate-950/60 flex justify-center">
          <div
            className={`w-full max-w-5xl rounded-2xl border transition-all duration-300 px-6 py-3.5 flex items-center justify-between shadow-2xl ${
              previewTheme === 'dark'
                ? 'bg-slate-950 border-white/10 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* 左侧：自适应 Logo 与 品牌标题 */}
            <div className="flex items-center gap-3">
              {brand.logoUrl && !logoLoadError ? (
                <div className="h-8 max-w-[200px] flex items-center justify-center">
                  <img
                    src={brand.logoUrl}
                    alt={brand.brandName || 'Logo'}
                    className="h-full w-auto max-h-8 max-w-[200px] object-contain"
                    onError={() => setLogoLoadError(true)}
                  />
                </div>
              ) : (
                <div
                  className="size-8 rounded-lg flex items-center justify-center shadow-lg"
                  style={{
                    backgroundColor: brand.logoBgColor || '#e11d74',
                    boxShadow: `0 4px 12px ${brand.logoBgColor || '#e11d74'}33`,
                  }}
                >
                  <Layers className="size-4 text-white" />
                </div>
              )}

              {brand.showBrandName && (
                <span
                  className={`text-base font-bold tracking-tight font-jost ${
                    previewTheme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {brand.brandName || 'supdance'}
                </span>
              )}

              {/* 中间顶栏导航菜单预览 (与前台固定结构 1:1 对齐) */}
              <div className="hidden md:flex items-center gap-1.5 ml-2 lg:ml-4 border-l border-white/10 pl-2 lg:pl-3">
                <span className={`px-2.5 py-1 text-xs rounded-lg font-medium ${previewTheme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>
                  图像
                </span>
                <span className={`px-2.5 py-1 text-xs rounded-lg font-medium ${previewTheme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>
                  视频
                </span>
                <span className={`px-2.5 py-1 text-xs rounded-lg font-medium ${previewTheme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>
                  音频
                </span>
                <span className={`px-2.5 py-1 text-xs rounded-lg font-medium ${previewTheme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>
                  智能体
                </span>
                <span className={`px-2.5 py-1 text-xs rounded-lg font-medium ${previewTheme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>
                  社区
                </span>
                <span className={`px-2.5 py-1 text-xs rounded-lg font-semibold border ${
                  previewTheme === 'dark'
                    ? 'text-brand bg-brand/10 border-brand/30'
                    : 'text-brand bg-brand/10 border-brand/20'
                }`}>
                  关于 (末尾)
                </span>
              </div>
            </div>

            {/* 右侧：右上角固定图标功能区 (额度、提醒、语言切换、用户头像) */}
            <div className="flex items-center gap-2">
              {/* 额度 */}
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300">
                <Zap className="size-3 text-brand" />
                <span className="font-mono font-bold text-white text-[11px]">10</span>
                <span className="text-[9px] text-zinc-400">算力</span>
              </div>
              {/* 提醒 */}
              <div className="flex size-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 relative">
                <Bell className="size-3.5" />
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-pink-500" />
              </div>
              {/* 语言 */}
              <div className="flex size-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300">
                <Globe className="size-3.5" />
              </div>
              {/* 头像 */}
              <div className="size-7 rounded-full border border-white/20 bg-slate-800 text-brand text-xs font-bold flex items-center justify-center">
                A
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 模块 2：站点标题与浏览器标签页设置（核心基础设置） */}
      <Card id="title-settings" className="border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden scroll-mt-20">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">站点标题与浏览器标签页设置</h2>
              <p className="text-xs text-slate-400">配置全站默认主标题及各级子页面的标题后缀规则，修改后全站即刻生效并同步至搜索引擎收录</p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono">
            TDK / Title Engine
          </span>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 站点主标题 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>站点主标题 (首页及全局默认标题)</span>
                <span className="text-[11px] text-slate-500 font-normal">建议 10–60 字符</span>
              </label>
              <input
                type="text"
                value={brand.siteTitle || ''}
                onChange={(e) => setBrand((prev) => ({ ...prev, siteTitle: e.target.value }))}
                placeholder="例如 SupDance — Free AI Image & Video Studio"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand transition shadow-inner font-mono"
              />
              <p className="text-[11px] text-slate-400">
                展示在网站首页、各未单独指定标题子页面以及搜索引擎收录的主展示标题。
              </p>
            </div>

            {/* 子页面标题模板 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>子页面标题后缀模板 (Title Template)</span>
                <span className="text-[11px] text-brand font-mono font-normal">需包含 %s 通配符</span>
              </label>
              <input
                type="text"
                value={brand.titleTemplate || ''}
                onChange={(e) => setBrand((prev) => ({ ...prev, titleTemplate: e.target.value }))}
                placeholder="例如 %s | SupDance AI Studio"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand transition shadow-inner font-mono"
              />
              <p className="text-[11px] text-slate-400">
                其中 <code className="text-brand font-mono">%s</code> 将被自动替换为各子页面自身名称（如：图像工坊 | SupDance AI Studio）。
              </p>
            </div>
          </div>

          {/* 浏览器真实标签页仿真器 (Real Browser Tab Simulator) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-brand" />
                浏览器标签页实时仿真预览
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setBrand((prev) => ({
                      ...prev,
                      siteTitle: 'SupDance — Free AI Image & Video Studio',
                      titleTemplate: '%s | SupDance AI Studio',
                    }))
                  }
                  className="text-[11px] text-brand hover:underline cursor-pointer"
                >
                  填入官方标准标题方案
                </button>
              </div>
            </div>

            {/* 拟物化浏览器窗口外壳 */}
            <div className="rounded-xl border border-slate-800 bg-[#16181d] overflow-hidden shadow-lg">
              {/* 标签栏 */}
              <div className="bg-[#0f1117] px-3 pt-2 flex items-center gap-2 border-b border-slate-800/80">
                {/* 窗口三色操作圆点 */}
                <div className="flex items-center gap-1.5 pr-2">
                  <span className="size-2.5 rounded-full bg-[#ff5f56]" />
                  <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
                  <span className="size-2.5 rounded-full bg-[#27c93f]" />
                </div>

                {/* 仿真 Tab 1：网站首页 */}
                <div className="flex-1 max-w-[260px] bg-[#16181d] border-t border-x border-slate-700/60 rounded-t-lg px-3 py-1.5 flex items-center gap-2 text-xs text-slate-200">
                  <img
                    src={brand.faviconUrl || '/branding/favicon.svg?v=3'}
                    alt="Favicon"
                    className="size-3.5 shrink-0 object-contain rounded-sm"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <span className="truncate font-medium text-[11px]">
                    {brand.siteTitle || 'SupDance — Free AI Image & Video Studio'}
                  </span>
                </div>

                {/* 仿真 Tab 2：子页面 */}
                <div className="flex-1 max-w-[240px] bg-slate-900/40 hover:bg-slate-900/70 border-t border-x border-transparent rounded-t-lg px-3 py-1.5 flex items-center gap-2 text-xs text-slate-400">
                  <img
                    src={brand.faviconUrl || '/branding/favicon.svg?v=3'}
                    alt="Favicon"
                    className="size-3.5 shrink-0 object-contain rounded-sm opacity-70"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <span className="truncate text-[11px]">
                    {(brand.titleTemplate || '%s | SupDance AI Studio').replace('%s', '图像生图工坊')}
                  </span>
                </div>
              </div>

              {/* 地址栏 */}
              <div className="bg-[#16181d] px-4 py-1.5 flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="text-slate-300">https://www.supdance.com/</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 模块 3：网站 Logo 替换工具（核心交互区） */}
      <Card id="logo-settings" className="border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden scroll-mt-20">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crop className="w-5 h-5 text-brand" />
            <div>
              <h2 className="text-base font-semibold text-white">网站 Logo 替换工具</h2>
              <p className="text-xs text-slate-400">选择图片后将自动调出裁剪工具，支持 1:1 方形、3:1 横版或自由裁切</p>
            </div>
          </div>
          {brand.logoUrl && !isCropping && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-brand/10 text-brand border border-brand/20 font-medium">
              自定义 Logo 已生效
            </span>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* 如果正在裁剪 Logo，展开 LogoCropper 工作台 */}
          {isCropping && rawImageSrc && cropTarget === 'logo' ? (
            <div className="space-y-3">
              <LogoCropper
                imageSrc={rawImageSrc}
                onCropComplete={handleCropComplete}
                onCancel={() => {
                  setIsCropping(false);
                  setRawImageSrc(null);
                }}
                initialRatio="3:1"
              />
            </div>
          ) : (
            /* 未处于裁剪时：展示当前 Logo 卡片 + 替换入口 */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* 当前在用 Logo 状态展示 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">当前前台展示 Logo</span>
                  {brand.logoUrl ? (
                    logoLoadError ? (
                      <span className="text-xs text-amber-400 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" /> 图像加载异常
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 自定义图像
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-slate-500">系统官方默认</span>
                  )}
                </div>

                {/* 实际效果预览方盒 */}
                <div className="h-28 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center justify-center p-4 relative group">
                  {brand.logoUrl ? (
                    logoLoadError ? (
                      <div className="flex flex-col items-center justify-center text-center px-4 py-2">
                        <AlertCircle className="w-6 h-6 text-amber-400 mb-1.5" />
                        <span className="text-xs text-amber-300 font-medium">Logo 图片无法加载或链接已失效</span>
                        <span className="text-[11px] text-slate-500 mt-1 max-w-[280px] truncate" title={brand.logoUrl}>
                          {brand.logoUrl}
                        </span>
                      </div>
                    ) : (
                      <img
                        src={brand.logoUrl}
                        alt="Current Logo"
                        className="max-h-16 w-auto max-w-full object-contain"
                        onError={() => setLogoLoadError(true)}
                      />
                    )
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div
                        className="size-10 rounded-xl flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: brand.logoBgColor || '#e11d74' }}
                      >
                        <Layers className="size-5 text-white" />
                      </div>
                      <span className="text-base font-bold text-white font-jost">
                        {brand.brandName || 'supdance'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>支持格式: PNG, JPG, WEBP, SVG</span>
                  {brand.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setBrand((prev) => ({ ...prev, logoUrl: '' }))}
                      className="text-rose-400 hover:text-rose-300 underline"
                    >
                      清除自定义 Logo (恢复默认)
                    </button>
                  )}
                </div>
              </div>

              {/* 上传与替换拖拽区 */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-950/40 border-2 border-dashed border-slate-800 hover:border-brand/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group h-full min-h-[175px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-white group-hover:text-brand transition-colors">
                  {isUploading ? '正在处理上传...' : '点击添加图片 或 拖拽图片至此处'}
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 max-w-xs">
                  支持上传透明背景 PNG 或任意图片，添加后即可在可视画布中自由裁剪比例并即时生效
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-3 px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium transition cursor-pointer"
                >
                  选择本地文件
                </button>
              </div>
            </div>
          )}

          {/* 备选：手动粘贴图片外链（极简折叠） */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowManualUrl(!showManualUrl)}
              className="text-xs text-slate-400 hover:text-brand flex items-center gap-1.5 transition-colors"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              {showManualUrl ? '收起外部链接输入' : '高级选项: 直接输入外部图片 URL 或 CDN 链接'}
            </button>

            {showManualUrl && (
              <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
                <input
                  type="text"
                  placeholder="https://example.com/logo.png 或 /uploads/..."
                  value={brand.logoUrl}
                  onChange={(e) => setBrand((prev) => ({ ...prev, logoType: 'image', logoUrl: e.target.value }))}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (brand.logoUrl) {
                      setRawImageSrc(brand.logoUrl);
                      setIsCropping(true);
                    }
                  }}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  <Crop className="w-3.5 h-3.5 mr-1" />
                  对此图裁剪
                </Button>
              </div>
            )}
          </div>

          {/* 网站适配微调（仅保留 3 个直观核心选项） */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-slate-800">
            {/* 品牌名称 */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                品牌展示名称
              </label>
              <input
                type="text"
                value={brand.brandName}
                onChange={(e) => setBrand((prev) => ({ ...prev, brandName: e.target.value }))}
                placeholder="例如 supdance"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">全站 SEO 标题与品牌标示文本</span>
            </div>

            {/* 是否在 Logo 旁显示品牌文字 */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                旁置品牌名称显示
              </label>
              <div className="flex items-center gap-3 h-9">
                <button
                  type="button"
                  role="switch"
                  aria-checked={brand.showBrandName}
                  aria-label="切换是否显示品牌文本名称"
                  onClick={() => setBrand((prev) => ({ ...prev, showBrandName: !prev.showBrandName }))}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    brand.showBrandName ? 'bg-brand' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      brand.showBrandName ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-xs text-slate-300">
                  {brand.showBrandName ? '在 Logo 右侧显示文字' : '隐藏旁置文字 (图文一体标推荐)'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">若您的 Logo 已带有文字，建议关闭以防文字重复</span>
            </div>

            {/* Logo 点击跳转路由 */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Logo 点击跳转链接
              </label>
              <input
                type="text"
                value={brand.logoHref}
                onChange={(e) => setBrand((prev) => ({ ...prev, logoHref: e.target.value }))}
                placeholder="/studio"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">默认跳转工作室首页 `/studio`</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 模块 3：网站 Icon / 浏览器图标 (Favicon) 设置（紧随 Logo 设置位下方） */}
      <Card id="icon-settings" className="border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden scroll-mt-20">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand" />
            <div>
              <h2 className="text-base font-semibold text-white">网站 Icon / 浏览器图标 (Favicon) 设置</h2>
              <p className="text-xs text-slate-400">
                设置全站浏览器标签页、收藏夹书签及手机桌面主屏图标。系统预设为 Logo 标志性的「三色方块」，亦支持上传或指定自定义正方形图标。
              </p>
            </div>
          </div>
          {brand.faviconUrl ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-brand/10 text-brand border border-brand/20 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              自定义 Icon 已生效
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              官方「三色方块」已生效
            </span>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* 如果正在裁剪 Icon，展开 LogoCropper 工作台 */}
          {isCropping && rawImageSrc && cropTarget === 'icon' ? (
            <div className="space-y-3">
              <LogoCropper
                imageSrc={rawImageSrc}
                onCropComplete={handleCropComplete}
                onCancel={() => {
                  setIsCropping(false);
                  setRawImageSrc(null);
                }}
                initialRatio="1:1"
              />
            </div>
          ) : (
            /* 未处于裁剪时：展示当前 Icon 状态卡片 + 替换入口 */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* 当前在用 Icon 状态与浏览器标签页仿真 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    当前前台展示 Icon 与标签页仿真
                  </span>
                  {brand.faviconUrl ? (
                    iconLoadError ? (
                      <span className="text-xs text-amber-400 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" /> 图标加载异常
                      </span>
                    ) : (
                      <span className="text-xs text-brand flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 自定义正方形图标
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 官方标志性「三色方块」
                    </span>
                  )}
                </div>

                {/* 1:1 浏览器窗口标签页极真仿真器 */}
                <div className="rounded-xl border border-slate-800 bg-[#0d0f12] overflow-hidden shadow-inner">
                  {/* 浏览器窗口顶栏 */}
                  <div className="h-9 bg-[#16181d] border-b border-white/[0.06] px-3 flex items-center gap-3">
                    {/* macOS 窗口三色圆点 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="size-2.5 rounded-full bg-[#ff5f56]/80" />
                      <span className="size-2.5 rounded-full bg-[#ffbd2e]/80" />
                      <span className="size-2.5 rounded-full bg-[#27c93f]/80" />
                    </div>

                    {/* 活动标签页 */}
                    <div className="h-7 max-w-[240px] bg-[#1f232b] rounded-t-lg px-2.5 flex items-center gap-2 border-t border-x border-white/[0.08] shadow-sm select-none">
                      <img
                        src={brand.faviconUrl || '/branding/favicon.svg'}
                        alt="Favicon"
                        className="size-4 object-contain shrink-0"
                        onError={() => setIconLoadError(true)}
                      />
                      <span className="text-[11px] font-medium text-slate-200 truncate flex-1">
                        {brand.brandName || 'supdance'} — AI Studio
                      </span>
                      <span className="text-[10px] text-slate-400 hover:text-white cursor-default">✕</span>
                    </div>
                  </div>

                  {/* 模拟地址栏 */}
                  <div className="px-3 py-1.5 bg-[#121418] border-b border-white/[0.04] flex items-center gap-2">
                    <div className="flex-1 h-6 bg-[#0a0b0d] rounded-md px-2.5 flex items-center gap-1.5 text-[11px] text-slate-400 border border-white/[0.06]">
                      <svg className="size-3 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeWidth="2" />
                      </svg>
                      <span className="truncate">https://{brand.brandName ? `${brand.brandName.toLowerCase()}.com` : 'Supdance.com'}{brand.logoHref || '/studio'}</span>
                    </div>
                  </div>
                </div>

                {/* 图标规格与详情信息卡 */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center gap-3.5">
                  <div className="size-14 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-2 shrink-0 shadow-md">
                    <img
                      src={brand.faviconUrl || '/branding/favicon.svg'}
                      alt="Icon Details Preview"
                      className="size-10 object-contain"
                      onError={() => setIconLoadError(true)}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {brand.faviconUrl ? '自定义外部/上传图标' : 'Logo 官方「三色方块」图标'}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate" title={brand.faviconUrl || '/branding/favicon.svg'}>
                      {brand.faviconUrl ? brand.faviconUrl : '内置 SVG 矢量 + 多分辨率 ICO (16~256px)'}
                    </p>
                    {brand.faviconUrl && (
                      <button
                        type="button"
                        onClick={handleRestoreDefaultIcon}
                        className="mt-2 text-xs text-rose-400 hover:text-rose-300 underline inline-flex items-center gap-1"
                      >
                        <RotateCcw className="size-3" />
                        清除自定义，恢复官方「三色方块」图标
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>支持格式: PNG, SVG, ICO, JPG, WEBP</span>
                  {!brand.faviconUrl && (
                    <span className="text-emerald-400 font-medium">官方三色方块已全局生效</span>
                  )}
                </div>
              </div>

              {/* 上传与替换拖拽区 */}
              <div className="flex flex-col h-full justify-between space-y-4">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleIconDrop}
                  onClick={() => iconFileInputRef.current?.click()}
                  className="bg-slate-950/40 border-2 border-dashed border-slate-800 hover:border-brand/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group flex-1 min-h-[180px]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-white group-hover:text-brand transition-colors">
                    {isUploading ? '正在处理上传...' : '点击上传图标 或 拖拽图标至此处'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-xs">
                    支持透明 PNG、SVG、ICO 格式。图片选入后将自动启用 1:1 正方形智能裁剪
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      iconFileInputRef.current?.click();
                    }}
                    className="mt-3 px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium transition cursor-pointer"
                  >
                    选择本地文件
                  </button>
                </div>

                {/* 备选：手动粘贴图标外链 */}
                <div className="pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setShowManualIconUrl(!showManualIconUrl)}
                    className="text-xs text-slate-400 hover:text-brand flex items-center gap-1.5 transition-colors"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    {showManualIconUrl ? '收起外部图标链接输入' : '高级选项: 直接输入外部 Icon URL 或 CDN 链接'}
                  </button>

                  {showManualIconUrl && (
                    <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="https://example.com/favicon.png 或 /uploads/..."
                        value={brand.faviconUrl || ''}
                        onChange={(e) => setBrand((prev) => ({ ...prev, faviconUrl: e.target.value }))}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (brand.faviconUrl) {
                            setCropTarget('icon');
                            setRawImageSrc(brand.faviconUrl);
                            setIsCropping(true);
                          }
                        }}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200"
                      >
                        <Crop className="w-3.5 h-3.5 mr-1" />
                        1:1 裁剪
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 模块 4：顶栏导航菜单配置 */}
      <Card id="nav-settings" className="border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden scroll-mt-20">
        <div className="p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand" />
              全站顶栏导航菜单与按钮管理
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">控制全站前台顶栏导航按钮，支持自定义中英文名称、跳转链接、角标、图标与排序</p>
          </div>

          <Button
            onClick={handleOpenAddModal}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700"
          >
            <Plus className="w-3.5 h-3.5" />
            新增导航菜单项
          </Button>
        </div>

        {/* 提示条 */}
        <div className="px-5 py-3 bg-brand/5 border-b border-brand/10 flex items-center gap-2 text-xs text-brand/90">
          <Info className="size-4 shrink-0 text-brand" />
          <span>
            <strong>全站规则：</strong>「关于本站」已设定为全站顶部导航栏的最终固定入口（无论在此列表中排序如何，在前台顶栏始终位于最右端末尾）。在此处可编辑其文本名称、英文对照与图标。
          </span>
        </div>

        <div className="p-5 space-y-3">
          {navigation.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              当前暂未配置导航菜单，点击右上角“新增导航菜单项”添加。
            </div>
          ) : (
            navigation.map((item, index) => {
              const isAbout = item.href?.includes('/about');
              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition ${
                    isAbout
                      ? 'bg-slate-950/90 border-brand/30 shadow-[0_0_12px_rgba(225,29,116,0.06)]'
                      : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 w-5 text-center">
                      {index + 1}
                    </span>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.enabled}
                      aria-label={`切换${item.label || item.id}是否启用`}
                      onClick={() => toggleItemEnabled(item.id)}
                      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                        item.enabled ? 'bg-brand' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                          item.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>

                    <div className="size-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-brand shrink-0">
                      <DynamicNavIcon iconName={item.icon} className="size-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{item.label}</span>
                        {item.labelEn && (
                          <span className="text-xs text-slate-400 font-medium font-sans">
                            ({item.labelEn})
                          </span>
                        )}
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-brand/10 text-brand border border-brand/20 font-bold">
                            {item.badge}
                          </span>
                        )}
                        {isAbout && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 font-medium">
                            顶栏终位固定
                          </span>
                        )}
                        {item.style === 'gradient' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            发光渐变
                          </span>
                        )}
                        {item.target === '_blank' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            新窗口
                          </span>
                        )}
                        <span className="text-xs text-slate-500 font-mono">
                          {item.href}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveItemUp(index)}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 disabled:opacity-30"
                      title="上移"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItemDown(index)}
                      disabled={index === navigation.length - 1}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 disabled:opacity-30"
                      title="下移"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* 底部悬浮操作发布栏 */}
      <div className="fixed bottom-6 left-0 right-0 z-40 max-w-4xl mx-auto px-4 pointer-events-none">
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-brand" />
            <span>修改后请点击发布，变更将实时推送到全站前台。</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleResetToDefault}
              disabled={isSaving}
              className="text-xs border-slate-700 text-slate-300"
            >
              恢复默认
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={isSaving || isUploading}
              className="bg-brand hover:bg-brand-hover text-white font-semibold text-xs px-5 shadow-sm"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {isSaving ? '保存中...' : '保存全网发布'}
            </Button>
          </div>
        </div>
      </div>

      {/* 编辑/新增导航项模态框 */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white">
                {navigation.some((i) => i.id === editingItem.id) ? '编辑导航菜单项' : '新增导航菜单项'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {editingItem.href?.includes('/about') && (
              <div className="p-3 rounded-xl bg-brand/10 border border-brand/20 text-xs text-brand">
                💡 <strong>提示：</strong>当前项为全站「关于」页面，根据设计规范，无论在此处如何排列，都会在全站顶栏导航末端作为终位展示。
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  快捷选择系统预设路由
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ROUTES.map((qr) => (
                    <button
                      key={qr.path}
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          href: qr.path,
                          label: qr.label,
                          labelEn: qr.labelEn,
                          icon: qr.icon,
                          badge: qr.badge,
                        })
                      }
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-brand transition border border-slate-700/60"
                    >
                      {qr.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    菜单中文标题
                  </label>
                  <input
                    type="text"
                    value={editingItem.label}
                    onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    placeholder="如: 即梦社区"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    英文标题 / 别名 (选填)
                  </label>
                  <input
                    type="text"
                    value={editingItem.labelEn || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, labelEn: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    placeholder="如: Community"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  跳转路由 (URL 或相对路径)
                </label>
                <input
                  type="text"
                  value={editingItem.href}
                  onChange={(e) => setEditingItem({ ...editingItem, href: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  placeholder="/community"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    图标 (Icon)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-brand shrink-0">
                      <DynamicNavIcon iconName={editingItem.icon} className="size-4" />
                    </div>
                    <select
                      value={editingItem.icon || 'sparkles'}
                      onChange={(e) => setEditingItem({ ...editingItem, icon: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      {NAV_ICON_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    右上角角标 (Badge 选填)
                  </label>
                  <input
                    type="text"
                    value={editingItem.badge || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, badge: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    placeholder="HOT / NEW / PRO / 留空"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    展示胶囊样式
                  </label>
                  <select
                    value={editingItem.style || 'subtle'}
                    onChange={(e) => setEditingItem({ ...editingItem, style: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="subtle">低调微透 (默认推荐)</option>
                    <option value="gradient">渐变发光高亮 (强调项)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    打开方式
                  </label>
                  <select
                    value={editingItem.target || '_self'}
                    onChange={(e) => setEditingItem({ ...editingItem, target: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="_self">当前标签页 (_self)</option>
                    <option value="_blank">新标签页打开 (_blank)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveModalItem}
                className="px-5 py-2 text-xs font-semibold bg-brand hover:bg-brand-hover text-white rounded-lg shadow-sm"
              >
                保存菜单项
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
