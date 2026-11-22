'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, MetricCard, StatusBadge, Button, EmptyState } from '@/components/admin/AdminUi';
import BrandLogo from '@/components/admin/BrandLogo';
import {
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronRight,
  ExternalLink,
  Layers,
  Copy,
  Check,
  Trash2,
  Sliders,
  Filter,
  ArrowUpDown,
  Tag,
  Zap,
  ShieldCheck,
  Eye,
  EyeOff,
  Server,
  ArrowLeft,
} from 'lucide-react';

const CATEGORY_TABS = [
  { id: 'all', label: '全部模态' },
  { id: 'image', label: '图像模型' },
  { id: 'video', label: '视频模型' },
  { id: 'audio', label: '音频模型' },
  { id: 'text', label: '语言/智能体' },
];

export default function BrandsManagerClient({
  initialData = {},
  canWrite = false,
  initialProviderId = 'all',
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [providers, setProviders] = useState(initialData.providers || []);
  const [channels, setChannels] = useState(initialData.channels || []);
  const [canonicalCandidates] = useState(initialData.canonicalCandidates || []);
  const [allBrands] = useState(initialData.allBrands || []);

  // 筛选状态
  const [selectedProvider, setSelectedProvider] = useState(initialProviderId);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 交互状态
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [operatingId, setOperatingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [toast, setToast] = useState(null);

  // 快速挂载弹窗状态
  const [isMountModalOpen, setIsMountModalOpen] = useState(false);
  const [mountForm, setMountForm] = useState({
    providerId: initialProviderId !== 'all' ? initialProviderId : providers[0]?.id || '',
    brandId: 'bytedance',
    modelId: '',
    providerModelId: '',
    providerEndpoint: '',
    priority: 100,
    baseCost: 0.02,
    currency: 'USD',
    enabled: true,
  });
  const [isSavingMount, setIsSavingMount] = useState(false);

  // 优先级行内调整状态
  const [editingPriorityId, setEditingPriorityId] = useState(null);
  const [tempPriority, setTempPriority] = useState(100);

  const showToast = (message, tone = 'good') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const copyText = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // 切换供应商并同步 URL
  const handleSelectProvider = (pid) => {
    setSelectedProvider(pid);
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (pid === 'all') {
      params.delete('provider');
    } else {
      params.set('provider', pid);
    }
    router.replace(`/admin/models/brands${params.toString() ? `?${params.toString()}` : ''}`, {
      scroll: false,
    });
  };

  // 刷新所有渠道模型数据
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/admin/models/brands${selectedProvider !== 'all' ? `?provider=${selectedProvider}` : ''}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setProviders(json.data.providers || []);
        setChannels(json.data.channels || []);
        showToast('品牌模型数据已刷新');
      }
    } catch (err) {
      showToast('刷新数据失败: ' + err.message, 'danger');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 启/禁用渠道模型
  const handleToggleChannel = async (channel) => {
    if (!canWrite) return;
    const nextEnabled = !channel.enabled;
    setOperatingId(channel.id);
    try {
      const res = await fetch('/api/admin/models/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          channelId: channel.id,
          enabled: nextEnabled,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setChannels((prev) =>
          prev.map((c) => (c.id === channel.id ? { ...c, enabled: nextEnabled } : c))
        );
        showToast(`已${nextEnabled ? '启用' : '禁用'}模型 [${channel.displayName}]`);
      } else {
        showToast(data.error?.message || '操作失败', 'danger');
      }
    } catch (err) {
      showToast('网络请求异常: ' + err.message, 'danger');
    } finally {
      setOperatingId(null);
    }
  };

  // 保存修改优先级
  const handleSavePriority = async (channelId) => {
    if (!canWrite) return;
    setOperatingId(channelId);
    try {
      const res = await fetch('/api/admin/models/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'priority',
          channelId,
          priority: Number(tempPriority),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setChannels((prev) =>
          prev.map((c) => (c.id === channelId ? { ...c, priority: Number(tempPriority) } : c))
        );
        setEditingPriorityId(null);
        showToast('优先级更新成功');
      } else {
        showToast(data.error?.message || '更新优先级失败', 'danger');
      }
    } catch (err) {
      showToast('网络请求异常: ' + err.message, 'danger');
    } finally {
      setOperatingId(null);
    }
  };

  // 解绑/删除渠道模型挂载
  const handleUnbind = async (channel) => {
    if (!canWrite) return;
    if (!window.confirm(`确定要解除供应商 [${channel.providerName}] 对模型 [${channel.displayName}] 的挂载吗？`)) {
      return;
    }
    setOperatingId(channel.id);
    try {
      const res = await fetch('/api/admin/models/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unbind',
          channelId: channel.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setChannels((prev) => prev.filter((c) => c.id !== channel.id));
        showToast(`已成功解除 [${channel.displayName}] 挂载`);
      } else {
        showToast(data.error?.message || '解绑失败', 'danger');
      }
    } catch (err) {
      showToast('操作异常: ' + err.message, 'danger');
    } finally {
      setOperatingId(null);
    }
  };

  // 提交新增挂载表单
  const handleSubmitMount = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setIsSavingMount(true);
    try {
      const res = await fetch('/api/admin/models/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mountForm),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('品牌模型挂载成功！');
        setIsMountModalOpen(false);
        await refreshData();
      } else {
        showToast(data.error?.message || '挂载失败', 'danger');
      }
    } catch (err) {
      showToast('保存出错: ' + err.message, 'danger');
    } finally {
      setIsSavingMount(false);
    }
  };

  // 当前渠道过滤后的通道列表
  const providerFilteredChannels = useMemo(() => {
    if (selectedProvider === 'all') return channels;
    return channels.filter((c) => c.providerId === selectedProvider);
  }, [channels, selectedProvider]);

  // 全量品牌统计（用于品牌速滤胶囊）
  const brandStatsList = useMemo(() => {
    const counts = new Map();
    for (const c of providerFilteredChannels) {
      counts.set(c.brandId, (counts.get(c.brandId) || 0) + 1);
    }
    return allBrands
      .map((b) => ({
        ...b,
        count: counts.get(b.id) || 0,
      }))
      .filter((b) => b.count > 0 || b.id === 'all');
  }, [providerFilteredChannels, allBrands]);

  // 多条件过滤后的最终展示列表
  const finalFilteredChannels = useMemo(() => {
    return providerFilteredChannels.filter((c) => {
      // 品牌过滤
      if (selectedBrand !== 'all' && c.brandId !== selectedBrand) return false;

      // 模态分类过滤
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'text' && !['text', 'chat', 'reasoning'].includes(c.category)) {
          return false;
        } else if (selectedCategory !== 'text' && !String(c.category || '').includes(selectedCategory)) {
          return false;
        }
      }

      // 关键词搜索
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchModel = String(c.modelName || '').toLowerCase().includes(q);
        const matchDisp = String(c.displayName || '').toLowerCase().includes(q);
        const matchId = String(c.modelId || '').toLowerCase().includes(q);
        const matchProvModel = String(c.providerModelId || '').toLowerCase().includes(q);
        const matchProvName = String(c.providerName || '').toLowerCase().includes(q);
        if (!matchModel && !matchDisp && !matchId && !matchProvModel && !matchProvName) {
          return false;
        }
      }

      return true;
    });
  }, [providerFilteredChannels, selectedBrand, selectedCategory, searchQuery]);

  // 按品牌对列表进行聚合分组
  const brandGroups = useMemo(() => {
    const groupsMap = new Map();

    for (const c of finalFilteredChannels) {
      if (!groupsMap.has(c.brandId)) {
        const brandMeta = allBrands.find((b) => b.id === c.brandId) || {
          id: c.brandId,
          name: c.brandName,
          shortName: c.brandShortName,
          badge: '品牌',
          tone: 'neutral',
        };
        groupsMap.set(c.brandId, {
          brand: brandMeta,
          channels: [],
          total: 0,
          enabledCount: 0,
        });
      }
      const g = groupsMap.get(c.brandId);
      g.channels.push(c);
      g.total++;
      if (c.enabled) g.enabledCount++;
    }

    // 转换为数组并按模型总数排序
    return Array.from(groupsMap.values()).sort((a, b) => b.total - a.total);
  }, [finalFilteredChannels, allBrands]);

  // 顶部关键指标
  const totalChannelsCount = providerFilteredChannels.length;
  const activeChannelsCount = providerFilteredChannels.filter((c) => c.enabled).length;
  const activeRate = totalChannelsCount > 0 ? ((activeChannelsCount / totalChannelsCount) * 100).toFixed(1) : '100.0';
  const currentProviderMeta = providers.find((p) => p.id === selectedProvider);

  // 供快速挂载表单按品牌过滤的候选平台模型
  const filteredCandidatesForMount = useMemo(() => {
    if (!mountForm.brandId) return canonicalCandidates;
    return canonicalCandidates.filter((m) => m.brandId === mountForm.brandId);
  }, [canonicalCandidates, mountForm.brandId]);

  return (
    <div className="space-y-6">
      {/* 顶部轻量浮动 Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-white/[0.12] bg-[#161820]/95 px-4 py-2.5 text-xs text-white shadow-2xl backdrop-blur-md">
          {toast.tone === 'danger' ? (
            <AlertTriangle className="size-4 text-red-400" />
          ) : (
            <CheckCircle2 className="size-4 text-emerald-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 顶栏概览与上下文提示 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/models/providers"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            返回供应商管理
          </Link>
          <div className="h-4 w-px bg-white/[0.1]" />
          <h2 className="text-sm font-semibold text-white">
            {selectedProvider !== 'all' && currentProviderMeta
              ? `[${currentProviderMeta.id}] ${currentProviderMeta.name} — 品牌模型明细`
              : '全部 AI 供应商 — 品牌模型全局明细'}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            onClick={refreshData}
            className="h-8 border-white/[0.1] text-xs hover:bg-white/[0.05]"
          >
            <RefreshCw className={`mr-1.5 size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新状态
          </Button>

          {canWrite && (
            <Button
              size="sm"
              onClick={() => {
                setMountForm((prev) => ({
                  ...prev,
                  providerId: selectedProvider !== 'all' ? selectedProvider : providers[0]?.id || '',
                }));
                setIsMountModalOpen(true);
              }}
              className="h-8 bg-brand hover:bg-brand-hover text-xs font-semibold text-white shadow-sm"
            >
              <Plus className="mr-1 size-3.5" />
              快速挂载品牌模型
            </Button>
          )}
        </div>
      </div>

      {/* 顶部指标卡片 (Zone 1) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="当前视角供应商"
          value={selectedProvider === 'all' ? '全部渠道 (聚合)' : `[${selectedProvider}]`}
          hint={selectedProvider === 'all' ? `覆盖平台已接入 ${providers.length} 个渠道` : currentProviderMeta?.name || '指定服务渠道'}
          tone="info"
        />
        <MetricCard
          label="挂载模型总数"
          value={totalChannelsCount}
          hint={`已激活并启用 ${activeChannelsCount} 个模型路由`}
          tone="good"
        />
        <MetricCard
          label="涉及模型品牌"
          value={brandStatsList.length}
          hint="涵盖快手、字节、BFL、OpenAI 等主流厂商"
          tone="neutral"
        />
        <MetricCard
          label="渠道启用运行率"
          value={`${activeRate}%`}
          hint="正常参与智能路由与承接调度"
          tone={Number(activeRate) >= 90 ? 'good' : 'warn'}
        />
      </div>

      {/* 综合控制工具栏 (Zone 2) */}
      <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-surface/80 p-4 backdrop-blur-md">
        {/* 第一行：供应商切换胶囊群 */}
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-white/[0.06]">
          <span className="text-xs font-medium text-gray-400 flex items-center gap-1.5 shrink-0">
            <Server className="size-3.5 text-brand" />
            渠道筛选:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectProvider('all')}
              className={`h-7 rounded-full px-3 text-xs font-medium transition-all ${
                selectedProvider === 'all'
                  ? 'bg-brand text-white font-semibold shadow-sm'
                  : 'border border-white/[0.08] bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              全部渠道 ({channels.length})
            </button>
            {providers.map((p) => {
              const active = selectedProvider === p.id;
              const count = channels.filter((c) => c.providerId === p.id).length;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProvider(p.id)}
                  className={`h-7 rounded-full px-3 text-xs font-medium transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-brand text-white font-semibold shadow-sm'
                      : 'border border-white/[0.08] bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <span>{p.name}</span>
                  <span className={`text-[10px] font-mono px-1 rounded ${active ? 'bg-black/20 text-white' : 'bg-white/[0.06] text-gray-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 第二行：品牌胶囊群 */}
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-white/[0.06]">
          <span className="text-xs font-medium text-gray-400 flex items-center gap-1.5 shrink-0">
            <Tag className="size-3.5 text-amber-400" />
            品牌厂商:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedBrand('all')}
              className={`h-7 rounded-full px-3 text-xs font-medium transition-all flex items-center gap-1.5 ${
                selectedBrand === 'all'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'border border-white/[0.08] bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <Layers className="size-3.5" />
              <span>全部品牌</span>
            </button>
            {brandStatsList.map((b) => {
              const active = selectedBrand === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBrand(b.id)}
                  className={`h-7 rounded-full px-2.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'border border-white/[0.08] bg-white/[0.03] text-gray-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <BrandLogo brand={b} size="xs" className="size-3.5 rounded-sm" />
                  <span>{b.shortName}</span>
                  <span className={`text-[10px] font-mono px-1 rounded ${active ? 'bg-black/20 text-black' : 'bg-white/[0.06] text-gray-400'}`}>
                    {b.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 第三行：模态类型切换与搜索框 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_TABS.map((tab) => {
              const active = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`h-7 rounded-lg px-2.5 text-xs font-medium transition-all ${
                    active
                      ? 'bg-white/[0.12] text-white font-semibold'
                      : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索模型名称、ID 或渠道标识..."
              className="h-8 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] pl-8 pr-3 text-xs text-white placeholder-gray-500 focus:border-brand focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 品牌模型聚合矩阵 (Zone 3) */}
      {brandGroups.length === 0 ? (
        <EmptyState
          title="未找到匹配的品牌模型"
          description={
            searchQuery
              ? `在当前筛选条件下未检索到与「${searchQuery}」相关的模型规格`
              : '该供应商或品牌分类下暂未挂载模型'
          }
        />
      ) : (
        <div className="space-y-5">
          {brandGroups.map((group) => {
            const { brand, channels: groupChannels, total, enabledCount } = group;

            return (
              <Card
                key={brand.id}
                className="overflow-hidden border border-white/[0.08] bg-surface transition-all duration-200"
              >
                {/* 品牌卡片头部 */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] p-1.5 shadow-elevation-1">
                      <BrandLogo brand={brand} size="md" className="size-full" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{brand.name}</h3>
                        <span className="rounded-full border border-brand/20 bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                          {brand.badge || '核心品牌'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        {brand.company ? `${brand.company} · ` : ''}
                        共挂载 {total} 个模型规格，{enabledCount} 个处于启用状态
                      </p>
                    </div>
                  </div>

                  {canWrite && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMountForm((prev) => ({
                          ...prev,
                          providerId: selectedProvider !== 'all' ? selectedProvider : providers[0]?.id || '',
                          brandId: brand.id,
                          modelId: filteredCandidatesForMount[0]?.id || '',
                        }));
                        setIsMountModalOpen(true);
                      }}
                      className="h-7 border-white/[0.1] text-[11px] hover:bg-white/[0.06]"
                    >
                      <Plus className="mr-1 size-3" />
                      挂载新规格至此品牌
                    </Button>
                  )}
                </div>

                {/* 品牌模型明细表格 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.04] bg-white/[0.01] text-[11px] font-medium text-gray-400">
                        <th className="px-5 py-2.5">平台规范模型</th>
                        <th className="px-3 py-2.5">供应商底层标识 (Provider Model ID)</th>
                        <th className="px-3 py-2.5">承载供应商</th>
                        <th className="px-3 py-2.5">模态类别</th>
                        <th className="px-3 py-2.5">预估成本底价</th>
                        <th className="px-3 py-2.5">路由优先级</th>
                        <th className="px-3 py-2.5">状态</th>
                        <th className="px-5 py-2.5 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {groupChannels.map((c) => {
                        const isOperating = operatingId === c.id;
                        const isEditingPriority = editingPriorityId === c.id;

                        return (
                          <tr
                            key={c.id}
                            className={`transition-colors hover:bg-white/[0.02] ${
                              !c.enabled ? 'opacity-60 bg-black/20' : ''
                            }`}
                          >
                            {/* 平台模型 */}
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5 min-w-[180px]">
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] p-1 shadow-sm">
                                  <BrandLogo brandId={c.brandId} size="xs" className="size-full" />
                                </div>
                                <div>
                                  <div className="font-semibold text-white">{c.displayName}</div>
                                  <div className="font-mono text-[11px] text-gray-500">{c.modelId}</div>
                                </div>
                              </div>
                            </td>

                            {/* 供应商底层标识 */}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5 font-mono text-xs">
                                <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-brand border border-white/[0.06]">
                                  {c.providerModelId}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyText(c.providerModelId, c.id)}
                                  className="text-gray-500 hover:text-white transition-colors"
                                  title="复制 Provider Model ID"
                                >
                                  {copiedId === c.id ? (
                                    <Check className="size-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                </button>
                              </div>
                              {c.providerEndpoint && (
                                <div className="mt-1 font-mono text-[10px] text-gray-500 truncate max-w-[200px]" title={c.providerEndpoint}>
                                  端点: {c.providerEndpoint}
                                </div>
                              )}
                            </td>

                            {/* 承载供应商 */}
                            <td className="px-3 py-3">
                              <div className="min-w-[120px]">
                                <span className="font-medium text-gray-300">{c.providerName}</span>
                                <div className="text-[10px] uppercase font-mono text-gray-500">
                                  {c.providerType}
                                </div>
                              </div>
                            </td>

                            {/* 模态类别 */}
                            <td className="px-3 py-3">
                              <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium border border-white/[0.08] bg-white/[0.03] text-gray-300">
                                {c.category === 'image'
                                  ? '图像'
                                  : c.category === 'video'
                                  ? '视频'
                                  : c.category === 'audio'
                                  ? '音频'
                                  : '语言/对话'}
                              </span>
                            </td>

                            {/* 成本底价 */}
                            <td className="px-3 py-3 font-mono text-xs text-gray-300">
                              {c.costConfig?.base_cost !== undefined
                                ? `${c.costConfig.base_cost} ${c.costConfig.currency || 'USD'}`
                                : '—'}
                            </td>

                            {/* 优先级 */}
                            <td className="px-3 py-3">
                              {isEditingPriority ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={tempPriority}
                                    onChange={(e) => setTempPriority(e.target.value)}
                                    className="h-6 w-16 rounded border border-white/[0.2] bg-black px-1.5 text-xs text-white font-mono focus:outline-none focus:border-brand"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSavePriority(c.id)}
                                    className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-brand-hover shadow-sm"
                                  >
                                    保存
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingPriorityId(null)}
                                    className="text-gray-400 hover:text-white text-[10px] px-1"
                                  >
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!canWrite) return;
                                    setEditingPriorityId(c.id);
                                    setTempPriority(c.priority);
                                  }}
                                  className="group flex items-center gap-1 font-mono font-semibold text-brand hover:underline"
                                  title="点击修改路由优先级"
                                >
                                  <span>{c.priority}</span>
                                  {canWrite && <Sliders className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                </button>
                              )}
                            </td>

                            {/* 状态 */}
                            <td className="px-3 py-3">
                              <StatusBadge tone={c.enabled ? 'good' : 'neutral'}>
                                {c.enabled ? '已启用' : '已禁用'}
                              </StatusBadge>
                            </td>

                            {/* 操作 */}
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {canWrite && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isOperating}
                                      onClick={() => handleToggleChannel(c)}
                                      className={`rounded-lg px-2 py-1 text-xs transition-colors ${
                                        c.enabled
                                          ? 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                                          : 'text-emerald-400 hover:bg-emerald-500/10'
                                      }`}
                                    >
                                      {c.enabled ? '停用' : '启用'}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isOperating}
                                      onClick={() => handleUnbind(c)}
                                      className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                                      title="解除此模型挂载"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 快速挂载品牌模型弹窗 (Quick Mount Modal) */}
      {isMountModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingMount) {
              setIsMountModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.12] bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="size-5 text-brand" />
              快速挂载品牌模型规格
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              在所选供应商渠道下关联标准 AI 模型，配置其专属底层 Model ID、费率底价与调用端点。
            </p>

            <form onSubmit={handleSubmitMount} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* 目标供应商 */}
                <div>
                  <label className="block text-xs font-medium text-gray-300">目标供应商渠道</label>
                  <select
                    value={mountForm.providerId}
                    onChange={(e) => setMountForm({ ...mountForm, providerId: e.target.value })}
                    required
                    className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#161820] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 关联品牌 */}
                <div>
                  <label className="block text-xs font-medium text-gray-300">所属品牌厂商</label>
                  <select
                    value={mountForm.brandId}
                    onChange={(e) => {
                      const newBrand = e.target.value;
                      const matchedCandidates = canonicalCandidates.filter((m) => m.brandId === newBrand);
                      setMountForm({
                        ...mountForm,
                        brandId: newBrand,
                        modelId: matchedCandidates[0]?.id || '',
                      });
                    }}
                    required
                    className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#161820] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                  >
                    {allBrands
                      .filter((b) => b.id !== 'all')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* 平台规范模型 */}
              <div>
                <label className="block text-xs font-medium text-gray-300">
                  平台规范模型 (Canonical Model)
                </label>
                <select
                  value={mountForm.modelId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setMountForm({
                      ...mountForm,
                      modelId: selId,
                      providerModelId: mountForm.providerModelId || selId,
                    });
                  }}
                  required
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#161820] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none font-mono"
                >
                  <option value="">-- 请选择平台模型 --</option>
                  {filteredCandidatesForMount.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} [{m.id}] ({m.category})
                    </option>
                  ))}
                  {filteredCandidatesForMount.length === 0 && (
                    <option value="" disabled>
                      当前品牌下暂无可绑定的平台模型
                    </option>
                  )}
                </select>
              </div>

              {/* 供应商内部 Model ID */}
              <div>
                <label className="block text-xs font-medium text-gray-300">
                  供应商内部模型标识 (Provider Model ID)
                </label>
                <input
                  type="text"
                  value={mountForm.providerModelId}
                  onChange={(e) => setMountForm({ ...mountForm, providerModelId: e.target.value })}
                  required
                  placeholder="例如: seedream-5-0-lite-260128 或 kling-v1-standard"
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none font-mono"
                />
              </div>

              {/* 内部端点 */}
              <div>
                <label className="block text-xs font-medium text-gray-300">
                  端点路径 (Endpoint，选填)
                </label>
                <input
                  type="text"
                  value={mountForm.providerEndpoint}
                  onChange={(e) => setMountForm({ ...mountForm, providerEndpoint: e.target.value })}
                  placeholder="例如: /images/generations 或留空"
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* 路由优先级 */}
                <div>
                  <label className="block text-xs font-medium text-gray-300">优先级 (0-200)</label>
                  <input
                    type="number"
                    value={mountForm.priority}
                    onChange={(e) => setMountForm({ ...mountForm, priority: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none font-mono"
                  />
                </div>

                {/* 成本底价 */}
                <div>
                  <label className="block text-xs font-medium text-gray-300">基础成本 (Cost)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={mountForm.baseCost}
                    onChange={(e) => setMountForm({ ...mountForm, baseCost: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none font-mono"
                  />
                </div>

                {/* 币种 */}
                <div>
                  <label className="block text-xs font-medium text-gray-300">结算币种</label>
                  <select
                    value={mountForm.currency}
                    onChange={(e) => setMountForm({ ...mountForm, currency: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#161820] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="CNY">CNY (¥)</option>
                  </select>
                </div>
              </div>

              {/* 启用开关 */}
              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mountForm.enabled}
                    onChange={(e) => setMountForm({ ...mountForm, enabled: e.target.checked })}
                    className="size-4 rounded border-white/[0.2] bg-white/[0.05] text-brand focus:ring-0"
                  />
                  立即启用该品牌模型路由
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsMountModalOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingMount || !mountForm.modelId || !mountForm.providerModelId}
                  className="bg-brand hover:bg-brand-hover text-white font-semibold shadow-sm"
                >
                  {isSavingMount ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                  确认挂载
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
