'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Card, StatusBadge, DataTable, EmptyState } from '@/components/admin/AdminUi';
import { Star, RefreshCw, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';

const ROUTING_MODE_LABELS = {
  cost: '成本优先',
  quality: '质量优先',
  stability: '稳定优先',
  balanced: '智能平衡',
};

const CATEGORY_LABELS = {
  all: '全部类型',
  image: '图像生成',
  video: '视频生成',
  audio: '音频/音乐',
  text: '大语言模型',
};

const PROVIDER_NAMES = {
  muapi: 'MuAPI',
  kling: '快手可灵',
  minimax: 'MiniMax海螺',
  alibaba: '阿里百炼',
  openai: 'OpenAI',
  google: 'Google',
  runway: 'Runway',
  luma: 'Luma',
  volcengine: '火山引擎',
  byteplus: 'BytePlus',
  runninghub: 'RunningHub',
};

/**
 * 快捷主渠道切换下拉菜单 (Popover Dropdown)
 */
function QuickChannelSwitcher({ model, onSwitch, isBusy }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const channels = model.channels || [];
  const primaryChannel = channels.find((c) => c.is_primary) || channels[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  if (channels.length <= 1) {
    return null;
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={isBusy}
        className="inline-flex h-[26px] items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-2 text-[10px] font-semibold text-brand transition-all hover:bg-brand/20 active:scale-[0.98] disabled:opacity-40"
        title="点击快速切换默认主渠道"
      >
        {isBusy ? (
          <RefreshCw className="size-2.5 animate-spin text-brand" />
        ) : (
          <Star className="size-2.5 text-amber-400 fill-amber-400" />
        )}
        <span>切换主渠道</span>
        <ChevronDown className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-white/10 bg-[#16181d] p-1.5 shadow-2xl backdrop-blur-md">
          <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 border-b border-white/[0.06] mb-1">
            选择「{model.display_name || model.name}」主选通道
          </div>
          <div className="space-y-1">
            {channels.map((ch) => {
              const isPrimary = ch.is_primary;
              return (
                <button
                  key={ch.id}
                  type="button"
                  disabled={isPrimary || isBusy || !ch.enabled}
                  onClick={() => {
                    setOpen(false);
                    onSwitch(ch.id);
                  }}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                    isPrimary
                      ? 'bg-brand/15 text-brand font-semibold'
                      : ch.enabled
                      ? 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                      : 'text-gray-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">
                        {ch.provider_name || PROVIDER_NAMES[ch.provider_id] || ch.provider_id}
                      </span>
                      {isPrimary && <span className="text-amber-400 text-[10px]">★</span>}
                    </div>
                    <p className="text-[10px] font-mono text-white/40 truncate">
                      {ch.provider_model_id}
                    </p>
                  </div>
                  <span className="text-[10px] shrink-0 font-medium">
                    {isPrimary ? (
                      <span className="text-brand font-semibold">当前主选</span>
                    ) : ch.enabled ? (
                      <span className="text-gray-400 hover:text-brand">设为主选</span>
                    ) : (
                      <span className="text-gray-500">已禁用</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const CANONICAL_MODEL_SET = new Set([
  'kling-2.6', 'kling-3.0', 'kling-2.5', 'kling-2.1', 'kling-o1',
  'hailuo-02', 'hailuo-2.3', 'minimax-speech-2.6', 'minimax-voice-clone',
  'wan-2.1', 'wan-2.2',
  'seedream-5.0', 'seedream-5.0-edit', 'seedream-4.5', 'seedream-4.0', 'seedream-3.0',
  'seedance-2.0', 'seedance-2.5', 'seedance-1.5',
  'veo-2', 'veo-3', 'imagen-4', 'gemini-omni-flash',
  'gpt-image', 'dall-e-3', 'sora-turbo',
  'flux-1-dev', 'flux-1-pro', 'flux-1.1-pro', 'flux-3',
  'runway-image-to-video', 'luma-dream-machine', 'vidu-2.0',
  'pika-2.1', 'pika-2.0', 'ideogram-v3', 'recraft-v3',
  'midjourney-v7', 'midjourney-v6.1', 'hunyuan-video', 'grok-imagine', 'infinitetalk'
]);

export default function RoutingViewClient({ initialModels = [] }) {
  const [models, setModels] = useState(initialModels);
  const [activeTab, setActiveTab] = useState('canonical'); // 'canonical' | 'multi_channel' | 'all'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyModelId, setBusyModelId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  const handleSwitchPrimary = async (modelId, channelId) => {
    const targetModel = models.find((m) => m.id === modelId);
    if (!targetModel) return;

    setBusyModelId(modelId);
    try {
      const res = await fetch(`/api/admin/routing/${encodeURIComponent(modelId)}/channels`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channelId,
          is_primary: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || json.error || '切换主渠道失败');
      }

      // Optimistic update
      setModels((prev) =>
        prev.map((m) => {
          if (m.id !== modelId) return m;
          const updatedChannels = (m.channels || []).map((ch) => ({
            ...ch,
            is_primary: ch.id === channelId,
          }));
          return {
            ...m,
            channels: updatedChannels,
          };
        })
      );

      const targetChannel = targetModel.channels?.find((c) => c.id === channelId);
      const chName = targetChannel?.provider_name || PROVIDER_NAMES[targetChannel?.provider_id] || '目标渠道';
      showToast(`已成功将「${targetModel.display_name || targetModel.name}」主选通道切换为「${chName}」（已同步级联变体）`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyModelId(null);
    }
  };

  const stats = useMemo(() => {
    const canonical = models.filter((m) => CANONICAL_MODEL_SET.has(m.id) || (m.sort <= 10 && m.total_channels >= 2));
    const multiChannel = models.filter((m) => m.total_channels >= 2);
    return {
      total: models.length,
      canonicalCount: canonical.length,
      multiChannelCount: multiChannel.length,
    };
  }, [models]);

  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      // Tab filter
      if (activeTab === 'canonical' && !CANONICAL_MODEL_SET.has(model.id) && !(model.sort <= 10 && model.total_channels >= 2)) {
        return false;
      }
      if (activeTab === 'multi_channel' && model.total_channels < 2) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && model.category !== selectedCategory) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const idMatch = model.id.toLowerCase().includes(query);
        const nameMatch = (model.display_name || model.name || '').toLowerCase().includes(query);
        const providerMatch = (model.provider_slugs || []).some((p) => p.toLowerCase().includes(query));
        if (!idMatch && !nameMatch && !providerMatch) return false;
      }

      return true;
    });
  }, [models, activeTab, selectedCategory, searchQuery]);

  const columns = [
    {
      key: 'model',
      label: '模型名称 / ID',
      render: (row) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-white text-xs">{row.display_name || row.name}</span>
            {row.has_pricing && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                在售
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono text-white/40">{row.id}</p>
        </div>
      ),
    },
    {
      key: 'category',
      label: '业务类型',
      render: (row) => (
        <StatusBadge tone="info">
          {CATEGORY_LABELS[row.category] || row.category}
        </StatusBadge>
      ),
    },
    {
      key: 'providers',
      label: '已挂载渠道与主选',
      render: (row) => {
        const channels = row.channels || [];
        const primary = channels.find((c) => c.is_primary) || channels[0];
        const backupCount = channels.length - 1;

        if (!channels.length) {
          return <span className="text-[11px] text-white/30">未绑定渠道</span>;
        }

        return (
          <div className="flex flex-col gap-1.5 max-w-[220px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              {primary && (
                <span className="inline-flex items-center gap-1 rounded-md bg-brand/10 border border-brand/25 px-2 py-0.5 text-[10px] font-semibold text-brand">
                  <span className="text-amber-400">★</span>
                  <span className="truncate max-w-[110px]">
                    {primary.provider_name || PROVIDER_NAMES[primary.provider_id] || primary.provider_id}
                  </span>
                  <span className="text-brand/70 font-normal">主选</span>
                </span>
              )}
              {backupCount > 0 && (
                <span className="inline-flex items-center rounded-md bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 text-[10px] text-white/60">
                  +{backupCount} 备用
                </span>
              )}
            </div>

            {/* 快捷渠道切换按钮 */}
            {channels.length >= 2 && (
              <div>
                <QuickChannelSwitcher
                  model={row}
                  isBusy={busyModelId === row.id}
                  onSwitch={(targetChannelId) => handleSwitchPrimary(row.id, targetChannelId)}
                />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'routing_mode',
      label: '调度策略',
      render: (row) => (
        <span className="text-xs font-medium text-white/90">
          {ROUTING_MODE_LABELS[row.routing_mode] || '智能平衡'}
        </span>
      ),
    },
    {
      key: 'channels',
      label: '渠道状态',
      render: (row) => (
        <div className="text-xs font-mono tabular-nums">
          <span className="text-emerald-400 font-bold">{row.healthy_channels}</span>
          <span className="text-white/30"> / </span>
          <span className="text-white">{row.enabled_channels}</span>
          <span className="text-white/30"> / </span>
          <span className="text-white/40">{row.total_channels}</span>
        </div>
      ),
    },
    {
      key: 'health',
      label: '健康评估',
      render: (row) => {
        if (row.total_channels === 0) return <StatusBadge tone="neutral">无渠道</StatusBadge>;
        if (row.healthy_channels === row.enabled_channels && row.enabled_channels > 0) {
          return <StatusBadge tone="good">全部正常</StatusBadge>;
        }
        if (row.healthy_channels > 0) return <StatusBadge tone="warn">部分降级</StatusBadge>;
        return <StatusBadge tone="danger">全部异常</StatusBadge>;
      },
    },
    {
      key: 'failover',
      label: '容灾热备',
      render: (row) => (
        <StatusBadge tone={row.failover_enabled !== false ? 'good' : 'neutral'}>
          {row.failover_enabled !== false ? '自动切换' : '已关闭'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Link
            href={`/admin/routing/${row.id}`}
            className="inline-flex h-[28px] items-center rounded-lg border border-brand/30 bg-brand/10 px-2.5 text-[11px] font-semibold text-brand transition-all hover:bg-brand/20 active:scale-[0.98]"
          >
            配置渠道
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* 提示通知条 */}
      {toast && (
        <div
          className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium transition-all duration-300 ${
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="size-4 shrink-0 text-red-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 顶部主过滤 Tab */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl">
          <button
            onClick={() => setActiveTab('canonical')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'canonical'
                ? 'bg-brand text-white font-semibold shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>核心去重模型</span>
            <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${activeTab === 'canonical' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'}`}>
              {stats.canonicalCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('multi_channel')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'multi_channel'
                ? 'bg-brand text-white font-semibold shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>多渠道成熟模型</span>
            <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${activeTab === 'multi_channel' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'}`}>
              {stats.multiChannelCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-brand text-white font-semibold shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>全量在架池</span>
            <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] font-mono text-white/70">
              {stats.total}
            </span>
          </button>
        </div>

        {/* 搜索框 */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="搜索模型名称、ID 或供应商..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 二级业务分类胶囊导航 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
          const isSelected = selectedCategory === catKey;
          return (
            <button
              key={catKey}
              onClick={() => setSelectedCategory(catKey)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'bg-white/[0.04] text-white/60 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {catLabel}
            </button>
          );
        })}
      </div>

      {/* 主数据表格 */}
      {filteredModels.length === 0 ? (
        <EmptyState
          title="未找到匹配的模型"
          description="当前筛选条件下没有匹配的 AI 智能路由配置，请尝试切换分类或搜索词。"
        />
      ) : (
        <DataTable columns={columns} rows={filteredModels} empty="暂无匹配的模型路由配置" />
      )}
    </div>
  );
}
