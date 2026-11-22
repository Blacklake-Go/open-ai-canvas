'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  AdminSettingRow,
  StatusBadge,
} from '@/components/admin/AdminUi';
import LogoCropper from '@/components/admin/branding/LogoCropper';
import NavEditorDrawer from './NavEditorDrawer';
import DynamicNavIcon from '@/components/navigation/DynamicNavIcon';
import {
  Upload,
  Crop,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit2,
  Sliders,
  Layers,
  Sparkles,
  Save,
  RotateCcw,
} from 'lucide-react';

export default function BrandingTab({
  brand,
  navigation,
  setBrand,
  setNavigation,
  onSave,
  onReset,
  isSaving,
  feedback,
}) {
  const [previewTheme, setPreviewTheme] = useState('dark');
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);

  // 裁剪与上传状态
  const fileInputRef = useRef(null);
  const iconFileInputRef = useRef(null);
  const [cropTarget, setCropTarget] = useState('logo'); // 'logo' | 'icon'
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 文本就地编辑弹窗状态
  const [editingField, setEditingField] = useState(null); // 'brandName' | 'siteTitle' | 'titleTemplate' | 'brandSlogan'
  const [editValue, setEditValue] = useState('');

  // 处理 Logo 图片选择
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
    e.target.value = '';
  };

  // 处理 Icon 文件选择
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
      try {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('type', 'icon');

        const res = await fetch('/api/admin/content/branding/upload', {
          method: 'POST',
          body: formData,
        });
        const json = await res.json();
        if (!res.ok || !json?.data?.url) throw new Error(json?.error?.message || '上传失败');

        setBrand((prev) => ({ ...prev, faviconUrl: json.data.url }));
      } catch (err) {
        alert(err.message || '上传失败');
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
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

  // 裁剪完成回调
  const handleCropComplete = async (croppedBlob, dataUrl) => {
    setIsCropping(false);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append(
        'file',
        croppedBlob,
        cropTarget === 'icon' ? 'favicon.png' : 'brand-logo.png'
      );
      formData.append('type', cropTarget);

      const res = await fetch('/api/admin/content/branding/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json?.data?.url) {
        throw new Error(json?.error?.message || '上传云存储失败');
      }

      if (cropTarget === 'icon') {
        setBrand((prev) => ({ ...prev, faviconUrl: json.data.url }));
      } else {
        setBrand((prev) => ({ ...prev, logoType: 'image', logoUrl: json.data.url }));
      }
    } catch (err) {
      alert(`上传失败: ${err.message}`);
    } finally {
      setIsUploading(false);
      setRawImageSrc(null);
    }
  };

  const openTextEdit = (field, currentVal) => {
    setEditingField(field);
    setEditValue(currentVal || '');
  };

  const saveTextEdit = () => {
    if (editingField) {
      setBrand((prev) => ({ ...prev, [editingField]: editValue }));
      setEditingField(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 隐藏的图片选择 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={iconFileInputRef}
        type="file"
        accept="image/*,.ico,.svg"
        onChange={handleIconFileSelect}
        className="hidden"
      />

      {/* 1. 紧凑型 1:1 顶栏实时仿真视窗 */}
      <div className="rounded-2xl border border-line-subtle bg-surface-raised p-4 shadow-elevation-1">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-subtle">
          <div className="flex items-center gap-3">
            <span className="text-caption font-semibold text-ink">顶栏实时渲染视窗</span>
            <div className="inline-flex rounded-lg border border-line-subtle p-0.5 bg-base">
              <button
                type="button"
                onClick={() => setPreviewTheme('dark')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                  previewTheme === 'dark' ? 'bg-white/10 text-white' : 'text-ink-subtle hover:text-ink'
                }`}
              >
                深色底
              </button>
              <button
                type="button"
                onClick={() => setPreviewTheme('light')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                  previewTheme === 'light' ? 'bg-white/10 text-white' : 'text-ink-subtle hover:text-ink'
                }`}
              >
                浅色底
              </button>
            </div>
          </div>
          <Link
            href="/studio"
            target="_blank"
            className="text-[11px] text-ink-subtle hover:text-ink flex items-center gap-1 transition"
          >
            <span>新窗口打开前台</span>
            <ExternalLink className="size-3" />
          </Link>
        </div>

        {/* 仿真横条 */}
        <div
          className={`h-14 rounded-xl px-4 flex items-center justify-between border transition-colors ${
            previewTheme === 'dark'
              ? 'bg-[#0a0b0d] border-white/10 text-white'
              : 'bg-white border-slate-200 text-slate-900 shadow-sm'
          }`}
        >
          {/* Logo 与站名 */}
          <div className="flex items-center gap-3">
            {brand.logoType === 'image' && brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt="Brand Logo"
                className="h-7 max-w-[140px] object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div
                className="size-7 rounded-lg flex items-center justify-center font-bold text-xs"
                style={{
                  backgroundColor: brand.logoBgColor || '#e11d74',
                  color: brand.logoTextColor || '#ffffff',
                }}
              >
                <Layers className="size-4" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-tight">
                {brand.brandName || 'SupDance'}
              </span>
              <span className={`text-[10px] ${previewTheme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>
                {brand.brandSlogan || 'AI 创意工作室'}
              </span>
            </div>
          </div>

          {/* 顶栏导航链接 */}
          <div className="hidden md:flex items-center gap-1">
            {navigation
              .filter((it) => it.enabled)
              .slice(0, 6)
              .map((it) => (
                <div
                  key={it.id}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                    previewTheme === 'dark'
                      ? 'text-white/70 hover:text-white hover:bg-white/5'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <DynamicNavIcon iconName={it.icon} className="size-3 opacity-80" />
                  <span>{it.label}</span>
                  {it.badge && (
                    <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-brand text-white font-mono">
                      {it.badge}
                    </span>
                  )}
                </div>
              ))}
          </div>

          {/* 仿真右侧登录体验 */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold px-3 py-1 rounded-lg bg-brand text-white">
              立即体验
            </span>
          </div>
        </div>
      </div>

      {/* 裁剪工作台 */}
      {isCropping && rawImageSrc && (
        <div className="rounded-2xl border border-brand/30 bg-surface-raised p-5 shadow-elevation-2 space-y-3">
          <div className="flex items-center justify-between border-b border-line-subtle pb-3">
            <span className="text-body font-semibold text-ink flex items-center gap-2">
              <Crop className="size-4 text-brand" />
              <span>{cropTarget === 'icon' ? '裁切浏览器 Favicon (1:1)' : '裁切品牌 Logo'}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setIsCropping(false);
                setRawImageSrc(null);
              }}
              className="text-xs text-ink-subtle hover:text-ink"
            >
              取消
            </button>
          </div>
          <LogoCropper
            imageSrc={rawImageSrc}
            onCropComplete={handleCropComplete}
            onCancel={() => {
              setIsCropping(false);
              setRawImageSrc(null);
            }}
            initialRatio={cropTarget === 'icon' ? '1:1' : '3:1'}
          />
        </div>
      )}

      {/* 2. 核心属性微信四列设置模型 (The 4-Column Setting Model) */}
      <div className="rounded-2xl border border-line-subtle bg-surface-raised p-6 shadow-elevation-1">
        <div className="border-b border-line-subtle pb-3 mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-body font-semibold text-ink">品牌标识与全站导航设置</h3>
            <p className="text-caption text-ink-subtle mt-0.5">
              读写分离四列布局：直接查看生效值，右侧直达更换与编排
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
          {/* Row 1: 品牌 Logo */}
          <AdminSettingRow
            label="品牌 Logo"
            value={
              <div className="flex items-center gap-2.5">
                {brand.logoType === 'image' && brand.logoUrl ? (
                  <div className="size-9 rounded-lg border border-line-subtle bg-black/40 p-1 flex items-center justify-center overflow-hidden">
                    <img
                      src={brand.logoUrl}
                      alt="Logo"
                      className="size-full object-contain"
                    />
                  </div>
                ) : (
                  <div
                    className="size-9 rounded-lg flex items-center justify-center font-bold text-xs"
                    style={{
                      backgroundColor: brand.logoBgColor || '#e11d74',
                      color: brand.logoTextColor || '#ffffff',
                    }}
                  >
                    <Layers className="size-4" />
                  </div>
                )}
                <span className="text-xs font-medium text-ink">
                  {brand.logoType === 'image' ? '自定义图片' : '系统预设方块'}
                </span>
              </div>
            }
            context="前台顶栏主视觉识别。建议上传高度 48px ~ 64px 的透明底 PNG 或矢量 SVG 图标。"
            action={isUploading ? '上传中…' : '更换 Logo'}
            onClickAction={() => fileInputRef.current?.click()}
          />

          {/* Row 2: 浏览器 Favicon */}
          <AdminSettingRow
            label="浏览器 Favicon"
            value={
              <div className="flex items-center gap-2.5">
                <div className="size-6 rounded border border-line-subtle bg-black/40 p-0.5 flex items-center justify-center overflow-hidden">
                  <img
                    src={brand.faviconUrl || '/branding/favicon.svg?v=3'}
                    alt="Favicon"
                    className="size-full object-contain"
                  />
                </div>
                <span className="text-xs font-mono text-ink-muted truncate max-w-[160px]">
                  {brand.faviconUrl ? '自定义图标已生效' : '官方三色方块'}
                </span>
              </div>
            }
            context="浏览器标签页微型图标，支持 .ico、.svg 或透明 .png，建议尺寸 32×32 正方形。"
            action={isUploading ? '上传中…' : '上传图标'}
            onClickAction={() => iconFileInputRef.current?.click()}
          />

          {/* Row 3: 网站展示名称 */}
          <AdminSettingRow
            label="网站主名称"
            value={
              <span className="text-body-sm font-semibold text-ink">
                {brand.brandName || 'SupDance'}
              </span>
            }
            context="用于 Studio 顶栏左侧展示文本、移动端应用标头与分享元数据默认名称。"
            action="修改名称"
            onClickAction={() => openTextEdit('brandName', brand.brandName)}
          />

          {/* Row 4: 页面标题模版 */}
          <AdminSettingRow
            label="全站标题模版"
            value={
              <span className="text-caption font-mono text-ink-muted">
                {brand.titleTemplate || '%s | SupDance AI Studio'}
              </span>
            }
            context="全站 SEO 标题渲染规则，其中「%s」将被各个子工作台真实名称（如 Cinema Studio）动态替换。"
            action="编辑模版"
            onClickAction={() => openTextEdit('titleTemplate', brand.titleTemplate)}
          />

          {/* Row 5: 品牌副标语 (Slogan) */}
          <AdminSettingRow
            label="品牌副标语"
            value={
              <span className="text-body-sm font-medium text-ink">
                {brand.brandSlogan || 'AI 创意工作室'}
              </span>
            }
            context="展示于移动端抽屉或品牌宣传卡片下方，简明传达产品核心定位。"
            action="修改标语"
            onClickAction={() => openTextEdit('brandSlogan', brand.brandSlogan)}
          />

          {/* Row 6: 顶栏导航项编排 */}
          <AdminSettingRow
            label="顶栏导航菜单编排"
            value={
              <div className="flex items-center gap-2">
                <StatusBadge tone="good">
                  已启用 {navigation.filter((n) => n.enabled).length} / {navigation.length} 项
                </StatusBadge>
              </div>
            }
            context="编排前台顶栏快捷按钮的排列顺序、中英文名称、跳转目标（支持新开窗口）与角标。"
            action="编排序列 →"
            onClickAction={() => setIsNavDrawerOpen(true)}
          />
        </div>

        {/* 底部保存与重置操作栏 */}
        <div className="mt-6 pt-4 border-t border-line-subtle flex items-center justify-between">
          <button
            type="button"
            disabled={isSaving}
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-xs text-ink-subtle hover:text-rose-400 transition"
          >
            <RotateCcw className="size-3.5" />
            <span>恢复系统官方默认</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-6 py-2 text-xs font-semibold text-white hover:bg-brand-hover active:scale-[0.98] transition disabled:opacity-50 shadow-elevation-1"
          >
            <Save className="size-3.5" />
            <span>{isSaving ? '正在发布…' : '保存品牌与导航发布'}</span>
          </button>
        </div>
      </div>

      {/* 文本修改模态弹窗 */}
      {editingField && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-[#0e1013] p-5 shadow-elevation-3 space-y-4">
            <div className="flex items-center justify-between border-b border-line-subtle pb-3">
              <h4 className="text-body font-semibold text-ink">修改属性值</h4>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="text-ink-subtle hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>
            <div>
              <label className="block text-caption font-medium text-ink-muted mb-1.5">
                {editingField === 'brandName' && '网站主名称'}
                {editingField === 'titleTemplate' && 'SEO 标题模版 (包含 %s)'}
                {editingField === 'brandSlogan' && '品牌副标语'}
              </label>
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full rounded-xl border border-line bg-base px-3.5 py-2 text-xs text-ink outline-none focus:border-brand"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-subtle">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveTextEdit}
                className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover"
              >
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导航抽屉 */}
      <NavEditorDrawer
        isOpen={isNavDrawerOpen}
        onClose={() => setIsNavDrawerOpen(false)}
        navigation={navigation}
        onChange={setNavigation}
      />
    </div>
  );
}
