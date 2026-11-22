'use client';

import React, { useState } from 'react';
import {
  X,
  Plus,
  MoveUp,
  MoveDown,
  Trash2,
  Edit2,
  Check,
  Sparkles,
  Link as LinkIcon,
  Eye,
  EyeOff,
} from 'lucide-react';
import DynamicNavIcon from '@/components/navigation/DynamicNavIcon';

const NAV_ICON_OPTIONS = [
  { id: 'sparkles', label: '星芒' },
  { id: 'info', label: '说明' },
  { id: 'flame', label: '热门' },
  { id: 'folder', label: '作品' },
  { id: 'workflow', label: '工作流' },
  { id: 'bot', label: '智能体' },
  { id: 'zap', label: '闪电/定价' },
  { id: 'compass', label: '指南针' },
  { id: 'globe', label: '网络' },
  { id: 'external', label: '外链' },
  { id: 'none', label: '无图标' },
];

const QUICK_ROUTES = [
  { label: '核心工作台', labelEn: 'Studio', path: '/studio', icon: 'sparkles', badge: '' },
  { label: '商用定价', labelEn: 'Pricing', path: '/pricing', icon: 'zap', badge: 'PRO' },
  { label: '开放平台', labelEn: 'API Platform', path: '/call-api', icon: 'workflow', badge: '筹备中' },
  { label: '即梦社区', labelEn: 'Community', path: '/community', icon: 'flame', badge: 'HOT' },
  { label: '我的作品', labelEn: 'My Creations', path: '/creations', icon: 'folder', badge: '' },
  { label: '工作流中心', labelEn: 'Workflow', path: '/workflow', icon: 'workflow', badge: '' },
  { label: 'AI智能体', labelEn: 'Agents', path: '/agents', icon: 'bot', badge: 'AI' },
  { label: '关于本站', labelEn: 'About', path: '/about', icon: 'info', badge: '' },
  { label: '服务条款', labelEn: 'Terms', path: '/terms', icon: 'compass', badge: '' },
];

export default function NavEditorDrawer({
  isOpen,
  onClose,
  navigation,
  onChange,
}) {
  const [editingItem, setEditingItem] = useState(null);

  if (!isOpen) return null;

  // 移动项
  const moveItem = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= navigation.length) return;
    const next = [...navigation];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
  };

  // 切换启用态
  const toggleEnabled = (id) => {
    onChange(
      navigation.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  // 删除项
  const deleteItem = (id) => {
    if (!confirm('确定要移除该导航项吗？')) return;
    onChange(navigation.filter((item) => item.id !== id));
  };

  // 保存正在编辑的单项
  const handleSaveItem = (itemData) => {
    if (editingItem?.id && navigation.some((it) => it.id === editingItem.id)) {
      onChange(
        navigation.map((it) => (it.id === editingItem.id ? { ...it, ...itemData } : it))
      );
    } else {
      const newItem = {
        id: `nav-${Date.now()}`,
        enabled: true,
        target: '_self',
        ...itemData,
      };
      onChange([...navigation, newItem]);
    }
    setEditingItem(null);
  };

  // 快捷添加路由
  const handleQuickAdd = (route) => {
    const newItem = {
      id: `nav-${Date.now()}`,
      label: route.label,
      labelEn: route.labelEn,
      path: route.path,
      icon: route.icon,
      badge: route.badge || '',
      enabled: true,
      target: '_self',
    };
    onChange([...navigation, newItem]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl h-full bg-[#0e1013] border-l border-line-subtle shadow-2xl flex flex-col">
        {/* 抽屉顶栏 */}
        <div className="h-14 px-6 border-b border-line-subtle flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-body font-semibold text-ink">顶栏导航菜单编排</h3>
            <p className="text-caption text-ink-subtle">
              调整前台顶栏按钮顺序、中英文名称与跳转目标
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-ink-subtle hover:text-ink hover:bg-white/[0.06] transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 抽屉内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 编辑单项表单模式 */}
          {editingItem ? (
            <div className="rounded-xl border border-line bg-surface-raised p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-line-subtle pb-3">
                <h4 className="text-sm font-semibold text-ink">
                  {editingItem.id ? '编辑导航项' : '新增导航项'}
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="text-xs text-ink-subtle hover:text-ink"
                >
                  取消
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  handleSaveItem({
                    label: fd.get('label'),
                    labelEn: fd.get('labelEn'),
                    path: fd.get('path'),
                    badge: fd.get('badge'),
                    icon: fd.get('icon'),
                    target: fd.get('target'),
                  });
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-caption font-medium text-ink-muted mb-1">
                      中文名称 (必填)
                    </label>
                    <input
                      name="label"
                      type="text"
                      required
                      defaultValue={editingItem.label || ''}
                      className="w-full rounded-lg border border-line bg-base px-3 py-1.5 text-xs text-ink outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-caption font-medium text-ink-muted mb-1">
                      英文名称
                    </label>
                    <input
                      name="labelEn"
                      type="text"
                      defaultValue={editingItem.labelEn || ''}
                      className="w-full rounded-lg border border-line bg-base px-3 py-1.5 text-xs text-ink outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-caption font-medium text-ink-muted mb-1">
                      跳转路径 (Path / URL)
                    </label>
                    <input
                      name="path"
                      type="text"
                      required
                      defaultValue={editingItem.path || '/'}
                      className="w-full rounded-lg border border-line bg-base px-3 py-1.5 text-xs text-ink font-mono outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-caption font-medium text-ink-muted mb-1">
                      高亮角标 (如 PRO, HOT)
                    </label>
                    <input
                      name="badge"
                      type="text"
                      defaultValue={editingItem.badge || ''}
                      placeholder="选填"
                      className="w-full rounded-lg border border-line bg-base px-3 py-1.5 text-xs text-ink outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-caption font-medium text-ink-muted mb-1">
                      前置图标
                    </label>
                    <select
                      name="icon"
                      defaultValue={editingItem.icon || 'none'}
                      className="w-full rounded-lg border border-line bg-base px-3 py-1.5 text-xs text-ink outline-none focus:border-brand"
                    >
                      {NAV_ICON_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-caption font-medium text-ink-muted mb-1">
                      打开方式
                    </label>
                    <select
                      name="target"
                      defaultValue={editingItem.target || '_self'}
                      className="w-full rounded-lg border border-line bg-base px-3 py-1.5 text-xs text-ink outline-none focus:border-brand"
                    >
                      <option value="_self">当前标签页 (_self)</option>
                      <option value="_blank">新标签页 (_blank)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover"
                  >
                    保存该项
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-caption text-ink-subtle">
                当前前台共有 {navigation.length} 个导航项
              </span>
              <button
                type="button"
                onClick={() => setEditingItem({})}
                className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] px-3 py-1.5 text-xs text-ink transition"
              >
                <Plus className="size-3.5" />
                <span>自定义新增</span>
              </button>
            </div>
          )}

          {/* 导航列表 */}
          <div className="space-y-2">
            {navigation.map((item, index) => (
              <div
                key={item.id || index}
                className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                  item.enabled
                    ? 'border-line-subtle bg-surface-raised/80 hover:bg-surface-raised'
                    : 'border-line-subtle/50 bg-white/[0.01] opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveItem(index, -1)}
                      className="p-0.5 text-ink-subtle hover:text-ink disabled:opacity-20"
                    >
                      <MoveUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      disabled={index === navigation.length - 1}
                      onClick={() => moveItem(index, 1)}
                      className="p-0.5 text-ink-subtle hover:text-ink disabled:opacity-20"
                    >
                      <MoveDown className="size-3" />
                    </button>
                  </div>

                  <div className="size-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 text-ink-muted">
                    <DynamicNavIcon iconName={item.icon} className="size-3.5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink truncate">
                        {item.label}
                      </span>
                      {item.labelEn && (
                        <span className="text-[10px] text-ink-subtle font-mono">
                          {item.labelEn}
                        </span>
                      )}
                      {item.badge && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-brand/20 text-brand font-mono">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-ink-subtle font-mono block truncate">
                      {item.path}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleEnabled(item.id)}
                    title={item.enabled ? '点击隐藏' : '点击显示'}
                    className={`p-1.5 rounded-lg text-xs transition ${
                      item.enabled
                        ? 'text-emerald-400 hover:bg-emerald-500/10'
                        : 'text-ink-subtle hover:bg-white/[0.06]'
                    }`}
                  >
                    {item.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingItem(item)}
                    className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-white/[0.06] transition"
                  >
                    <Edit2 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 快捷添加预设 */}
          <div className="pt-4 border-t border-line-subtle space-y-2">
            <span className="text-caption font-medium text-ink-muted block">
              快速添加官方内置路由项：
            </span>
            <div className="flex flex-wrap gap-2">
              {QUICK_ROUTES.map((qr) => (
                <button
                  key={qr.path}
                  type="button"
                  onClick={() => handleQuickAdd(qr)}
                  className="rounded-lg border border-line-subtle bg-white/[0.02] hover:bg-white/[0.06] px-2.5 py-1 text-[11px] text-ink-muted hover:text-ink transition flex items-center gap-1.5"
                >
                  <Plus className="size-3 text-brand" />
                  <span>{qr.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 抽屉底栏 */}
        <div className="h-14 px-6 border-t border-line-subtle flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-brand px-5 py-2 text-xs font-semibold text-white hover:bg-brand-hover active:scale-[0.98] transition shadow-elevation-1"
          >
            完成编排并返回
          </button>
        </div>
      </div>
    </div>
  );
}
