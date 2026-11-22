'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck, RefreshCw, Layers, CheckCircle2, AlertTriangle,
  GitMerge, X, Loader2, Sparkles, Server, ArrowRight,
  Search, Check, Zap, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/admin/AdminUi';
import BrandLogo from '@/components/admin/BrandLogo';

export default function ModelHygieneDrawer({
  isOpen,
  onClose,
  onHygieneCompleted,
  callAPI,
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('families'); // 'families' | 'candidates'
  const [syncing, setSyncing] = useState(false);
  const [mergingId, setMergingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const [hasMutated, setHasMutated] = useState(false);

  const handleSafeClose = useCallback(() => {
    if (hasMutated && onHygieneCompleted) {
      onHygieneCompleted();
    }
    onClose();
  }, [hasMutated, onHygieneCompleted, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !syncing && !mergingId) {
        handleSafeClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, syncing, mergingId, handleSafeClose]);

  const fetchHygieneData = useCallback(async () => {
    setLoading(true);
    try {
      let payload = null;
      // 优先通过 SSOT 控制中心 hygiene_scan 读取
      try {
        const res = await fetch('/api/admin/models/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'hygiene_scan' }),
        });
        if (res.ok) {
          const json = await res.json();
          payload = json.data || json.result;
        }
      } catch {
        // Fallback to deduplicate endpoint
      }

      if (!payload) {
        const res = await fetch('/api/admin/models/deduplicate');
        if (res.ok) {
          const json = await res.json();
          payload = json.data || json.result || json;
        }
      }

      if (payload) {
        setData(payload);
      } else {
        setToast({ msg: '获取模型治理体检数据失败', type: 'error' });
      }
    } catch (err) {
      setToast({ msg: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchHygieneData();
    }
  }, [isOpen, fetchHygieneData]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 一键执行全库规范化收敛
  const handleRunFullSync = async () => {
    if (!window.confirm('确认执行全库模型规范化收敛？这会将核心规范模型激活，归并动作变体渠道，并将非核心模型下沉为备用。所有通道数据完整无损。')) {
      return;
    }
    setSyncing(true);
    try {
      if (callAPI) {
        await callAPI({ action: 'hygiene_sync' });
      } else {
        const res = await fetch('/api/admin/models/control', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': `ctrl_hygiene_sync_${Date.now()}`,
          },
          body: JSON.stringify({ action: 'hygiene_sync' }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error?.message || '执行收敛失败');
        }
      }
      setHasMutated(true);
      showToast('全库模型规范化与变体收敛执行成功！');
      await fetchHygieneData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // 单个孤立模型合并至核心模型
  const handleMergeAlias = async (sourceModelId, targetModelId) => {
    if (!targetModelId) {
      showToast('请指定目标规范模型', 'error');
      return;
    }
    setMergingId(sourceModelId);
    try {
      if (callAPI) {
        await callAPI({ action: 'hygiene_merge', sourceModelId, targetModelId });
      } else {
        const res = await fetch('/api/admin/models/control', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': `ctrl_hygiene_merge_${Date.now()}`,
          },
          body: JSON.stringify({
            action: 'hygiene_merge',
            sourceModelId,
            targetModelId,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error?.message || '合并失败');
        }
      }
      setHasMutated(true);
      showToast(`已成功将【${sourceModelId}】合并至【${targetModelId}】✓`);
      await fetchHygieneData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setMergingId(null);
    }
  };

  const summary = useMemo(() => {
    return data?.summary || {
      totalModels: 0,
      coreVisibleCount: 0,
      backupCount: 0,
      disabledCount: 0,
      totalChannels: 0,
      canonicalTotal: 0,
    };
  }, [data]);

  const totalAliasesCount = useMemo(() => {
    return (data?.canonicalFamilies || []).reduce((acc, fam) => acc + (fam.aliases?.length || 0), 0);
  }, [data]);

  const filteredFamilies = useMemo(() => {
    return (data?.canonicalFamilies || []).filter((f) => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        f.targetId.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        (f.displayName || '').toLowerCase().includes(q) ||
        f.aliases.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [data, searchTerm]);

  if (!isOpen) return null;

  const unmergedCount = data?.unmergedCandidates?.length || 0;

  return (
    <div
      className="fixed inset-0 z-modal flex justify-end bg-black/75 backdrop-blur-sm animate-fade-in"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !syncing && !mergingId) {
          handleSafeClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="模型库规范与变体收敛治理"
        className="relative w-full max-w-3xl xl:w-[860px] bg-[#131519] border-l border-white/10 shadow-[-20px_0_60px_rgba(0,0,0,0.85)] flex flex-col h-full animate-slide-left text-ink"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line-subtle px-6 py-4 bg-surface-raised shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-body font-bold text-ink">模型库规范与变体收敛治理</h3>
                <span className="rounded-full bg-emerald-500/15 text-emerald-400 px-2 py-0.5 text-micro font-bold border border-emerald-500/30">
                  SSOT 架构收敛
                </span>
              </div>
              <p className="text-caption text-ink-muted">
                将零散动作别名收敛至规范模型，自动多对一聚合供应商渠道并沉降冗余。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunFullSync}
              disabled={syncing || loading}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-elevation-1"
            >
              {syncing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  正在收敛治理...
                </>
              ) : (
                <>
                  <Zap className="size-3.5 mr-1.5 text-yellow-300" />
                  一键全库规范化收敛
                </>
              )}
            </Button>
            <button
              type="button"
              onClick={fetchHygieneData}
              disabled={loading}
              className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-wash transition-colors"
              title="刷新治理数据"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleSafeClose}
              className="rounded-lg p-2 text-ink-muted hover:bg-wash hover:text-ink transition-colors ml-1"
              title="关闭"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`px-4 py-2 text-caption font-medium text-center transition-all shrink-0 ${
              toast.type === 'error' ? 'bg-danger/15 text-danger border-b border-danger/20' : 'bg-emerald-500/15 text-emerald-400 border-b border-emerald-500/20'
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* 4-Card Compact Metric Strip (High Density, No Text Walls) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 border-b border-line-subtle bg-well/30 shrink-0">
          <div className="rounded-xl border border-line-subtle bg-well/60 p-3">
            <div className="text-caption text-ink-muted">全库模型总数</div>
            <div className="text-h3 font-bold text-ink mt-0.5">{summary.totalModels}</div>
            <div className="text-micro text-ink-subtle mt-0.5">历史全量定义</div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="text-caption text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="size-3" />
              核心规范家族
            </div>
            <div className="text-h3 font-bold text-emerald-400 mt-0.5">{summary.canonicalTotal || data?.canonicalFamilies?.length || 0}</div>
            <div className="text-micro text-emerald-500/80 mt-0.5">收敛 {totalAliasesCount} 个动作变体</div>
          </div>
          <div className="rounded-xl border border-line-subtle bg-well/60 p-3">
            <div className="text-caption text-brand font-semibold flex items-center gap-1">
              <Server className="size-3" />
              聚合渠道通道
            </div>
            <div className="text-h3 font-bold text-brand mt-0.5">{summary.totalChannels}</div>
            <div className="text-micro text-ink-subtle mt-0.5">多通道高可用分发</div>
          </div>
          <div className={`rounded-xl border p-3 ${
            unmergedCount > 0
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              : 'border-line-subtle bg-well/60'
          }`}>
            <div className="text-caption font-semibold flex items-center gap-1">
              {unmergedCount > 0 ? (
                <>
                  <AlertTriangle className="size-3 text-amber-400" />
                  <span className="text-amber-400">待归并孤立项</span>
                </>
              ) : (
                <>
                  <Check className="size-3 text-emerald-400" />
                  <span className="text-ink-muted">孤立别名状态</span>
                </>
              )}
            </div>
            <div className="text-h3 font-bold mt-0.5">{unmergedCount}</div>
            <div className="text-micro opacity-80 mt-0.5">{unmergedCount > 0 ? '建议一键吸收归并' : '全库无孤立别名'}</div>
          </div>
        </div>

        {/* Tab Navigation (WeChat Standard h-10 Track) */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-line-subtle bg-well/20 shrink-0">
          <div className="inline-flex h-10 items-center rounded-lg border border-line-subtle bg-well p-1">
            <button
              type="button"
              onClick={() => setActiveTab('families')}
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all ${
                activeTab === 'families'
                  ? 'bg-surface-raised text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Layers className="size-3.5" />
              核心规范家族 ({data?.canonicalFamilies?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('candidates')}
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all ${
                activeTab === 'candidates'
                  ? 'bg-surface-raised text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <GitMerge className="size-3.5" />
              待归并孤立变体 ({unmergedCount})
              {unmergedCount > 0 && (
                <span className="size-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          </div>

          {activeTab === 'families' && (
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-subtle" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索规范家族、ID 或别名..."
                className="w-full h-8 pl-8 pr-2.5 text-xs rounded-lg bg-well border border-line-subtle focus:border-brand focus:outline-none text-ink placeholder:text-ink-subtle"
              />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && !data ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="size-7 animate-spin text-brand" />
              <p className="text-xs text-ink-muted">深度扫描全库模型健康与通道拓扑...</p>
            </div>
          ) : activeTab === 'families' ? (
            <div className="space-y-2">
              {filteredFamilies.length === 0 ? (
                <div className="text-center py-12 text-xs text-ink-muted">未找到匹配的核心规范家族</div>
              ) : (
                filteredFamilies.map((fam) => (
                  <div
                    key={fam.targetId}
                    className="rounded-xl border border-line-subtle bg-well/30 p-3 hover:border-line transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <BrandLogo model={{ id: fam.targetId, name: fam.name }} size="sm" className="rounded-md shrink-0" />
                        <span className="font-bold text-xs text-ink">{fam.name}</span>
                        <code className="text-[11px] font-mono text-ink-subtle bg-black/30 px-1.5 py-0.5 rounded">
                          {fam.targetId}
                        </code>
                        <span className="text-[10px] uppercase font-semibold text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20">
                          {fam.category}
                        </span>
                        {fam.isLive ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            已上架
                          </span>
                        ) : (
                          <span className="text-[10px] text-ink-subtle bg-white/5 px-1.5 py-0.5 rounded">
                            储备下沉
                          </span>
                        )}
                        <span className="text-xs text-ink-muted truncate">
                          {fam.displayName}
                        </span>
                      </div>

                      {fam.aliases.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] text-ink-subtle font-medium">已收敛别名 ({fam.aliases.length}):</span>
                          {fam.aliases.map((al) => (
                            <span
                              key={al}
                              className="text-[10px] font-mono text-ink-muted bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/5"
                            >
                              {al}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      <div className="text-right">
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end font-mono">
                          <Server className="size-3" />
                          {fam.channelCount} 通道
                        </div>
                        <div className="text-[10px] text-ink-subtle">
                          汇聚 {fam.aliasCount} 个动作
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {unmergedCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2.5 text-center">
                  <CheckCircle2 className="size-9 text-emerald-400" />
                  <div className="text-body font-bold text-ink">全库已无孤立动作变体</div>
                  <p className="text-xs text-ink-muted">所有历史动作变体已全部收敛挂载到核心规范模型名下。</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(data?.unmergedCandidates || []).map((cand) => (
                    <div
                      key={cand.id}
                      className="rounded-xl border border-line-subtle bg-well/30 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-500/30 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <BrandLogo model={{ id: cand.id, name: cand.name }} size="sm" className="rounded-md shrink-0" />
                          <span className="font-semibold text-xs text-ink">{cand.name}</span>
                          <code className="text-[11px] font-mono text-ink-subtle bg-black/30 px-1.5 py-0.5 rounded">
                            {cand.id}
                          </code>
                          <span className="text-[10px] text-ink-subtle bg-white/[0.04] px-1.5 py-0.5 rounded">
                            {cand.channel_count} 通道
                          </span>
                        </div>
                        <div className="text-caption text-ink-muted flex items-center gap-1.5">
                          <span>推荐目标规范:</span>
                          <span className="font-mono text-brand font-bold">
                            {cand.suggestedTarget || '需手动指定'}
                          </span>
                        </div>
                      </div>

                      {cand.suggestedTarget && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleMergeAlias(cand.id, cand.suggestedTarget)}
                          disabled={mergingId === cand.id}
                          className="text-xs shrink-0 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-semibold"
                        >
                          {mergingId === cand.id ? (
                            <Loader2 className="size-3.5 animate-spin mr-1" />
                          ) : (
                            <GitMerge className="size-3.5 mr-1" />
                          )}
                          一键归并至 {cand.suggestedTarget}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line-subtle px-6 py-3 bg-surface-raised">
          <span className="text-[11px] text-ink-subtle">
            非破坏性收敛：历史生成与通道配置完整保留，源别名模型自动转为备用沉降。
          </span>
          <Button variant="secondary" size="sm" onClick={handleSafeClose} className="text-xs">
            完成并关闭
          </Button>
        </div>
      </div>
    </div>
  );
}
