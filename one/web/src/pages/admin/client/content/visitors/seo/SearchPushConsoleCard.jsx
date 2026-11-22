'use client';

import { useState, useEffect, Fragment } from 'react';
import {
  Send,
  Zap,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  RotateCw,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, StatusBadge } from '@/components/admin/AdminUi';
import { PermissionGate } from '@/components/admin/AdminPermissions';
import { PERMISSIONS } from '@/lib/admin/permissions';

export default function SearchPushConsoleCard({
  pushConfig,
  onSavePushConfig,
  isSavingConfig,
}) {
  // Push configuration state
  const [config, setConfig] = useState({
    indexNowEnabled: pushConfig?.indexNow?.enabled ?? true,
    indexNowHost: pushConfig?.indexNow?.host || 'www.supdance.com',
    indexNowKey: pushConfig?.indexNow?.key || '3f82a45c81924619b068ad1d5d893f44',
    baiduEnabled: pushConfig?.baiduPush?.enabled ?? false,
    baiduSite: pushConfig?.baiduPush?.site || 'https://www.supdance.com',
    baiduToken: pushConfig?.baiduPush?.token || '',
  });

  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [configSavedNotice, setConfigSavedNotice] = useState(false);

  // Trigger form state
  const [selectedEngine, setSelectedEngine] = useState('all');
  const [urlsInput, setUrlsInput] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [pushFeedback, setPushFeedback] = useState(null);

  // Push history logs state
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Fetch push history logs
  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/admin/seo/push?limit=20');
      const data = await res.json();
      if (data.data) {
        setLogs(data.data);
      }
    } catch (err) {
      console.warn('[SearchPush] Failed to load history logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (onSavePushConfig) {
      await onSavePushConfig({
        indexNow: {
          enabled: config.indexNowEnabled,
          host: config.indexNowHost,
          key: config.indexNowKey,
        },
        baiduPush: {
          enabled: config.baiduEnabled,
          site: config.baiduSite,
          token: config.baiduToken,
        },
      });
      setConfigSavedNotice(true);
      setTimeout(() => setConfigSavedNotice(false), 3000);
    }
  };

  const handleQuickFillUrls = () => {
    const defaultUrls = [
      'https://www.supdance.com/',
      'https://www.supdance.com/studio',
      'https://www.supdance.com/models',
      'https://www.supdance.com/community',
      'https://www.supdance.com/pricing',
    ];
    setUrlsInput(defaultUrls.join('\n'));
    setPushFeedback(null);
  };

  const handleExecutePush = async (e) => {
    e.preventDefault();
    const parsedUrls = urlsInput
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    if (parsedUrls.length === 0) {
      setPushFeedback({
        tone: 'warn',
        message: '请至少输入一条需要主动推送的有效 URL 链接。',
      });
      return;
    }

    setIsPushing(true);
    setPushFeedback(null);

    try {
      const res = await fetch('/api/admin/seo/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: selectedEngine,
          urls: parsedUrls,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setPushFeedback({
          tone: 'danger',
          message: json.error?.message || '推送请求被拒绝，请检查 URL 格式与域名是否匹配。',
        });
      } else {
        const result = json.data;
        const remainHint = typeof result?.remain === 'number' ? `，百度当日剩余配额 ${result.remain} 条` : '';
        setPushFeedback({
          tone: result.success ? 'good' : 'warn',
          message: `主动推送完成！已成功提交 ${result.count} 条 URL 至 ${result.engine} 引擎${remainHint}。`,
        });
        // Refresh logs table
        fetchLogs();
      }
    } catch (err) {
      setPushFeedback({
        tone: 'danger',
        message: `网络或服务异常：${err.message}`,
      });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <Card className="flex flex-col justify-between p-6 col-span-full">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-amber-400">
              <Zap className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">搜索引擎实时主动推送控制台</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PermissionGate permission={PERMISSIONS.settingsWrite}>
              <button
                type="button"
                onClick={() => setShowConfigDrawer(!showConfigDrawer)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300 hover:bg-white/10 transition-colors"
              >
                <Sliders className="size-3" />
                <span>{showConfigDrawer ? '收起引擎配置' : '配置引擎凭据'}</span>
              </button>
            </PermissionGate>
            <StatusBadge tone="good">主动链路就绪</StatusBadge>
          </div>
        </div>

        {/* Optional Collapsible Push Config Panel */}
        {showConfigDrawer && (
          <form
            onSubmit={handleSaveConfig}
            className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-4"
          >
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brand">
              搜索引擎准入凭据与密钥配置
            </h4>

            <div className="grid gap-4 md:grid-cols-2">
              {/* IndexNow Config */}
              <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">IndexNow 协议</span>
                    <span className="text-[10px] text-gray-400">Bing / Yandex</span>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.indexNowEnabled}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, indexNowEnabled: e.target.checked }))
                      }
                      className="rounded border-white/20 bg-black/40 accent-brand"
                    />
                    <span>启用</span>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400">站点域名 (Host)</label>
                  <input
                    type="text"
                    value={config.indexNowHost}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, indexNowHost: e.target.value }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 font-mono text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-gray-400">32 位 API 验证 Key</label>
                    <a
                      href="/api/seo/indexnow-key"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[10px] text-brand font-semibold hover:underline"
                    >
                      <span>在线验证端点</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  </div>
                  <input
                    type="text"
                    value={config.indexNowKey}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, indexNowKey: e.target.value }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 font-mono text-xs text-white"
                  />
                </div>
              </div>

              {/* Baidu Push Config */}
              <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">百度主动推送 API</span>
                    <span className="text-[10px] text-gray-400">资源平台</span>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.baiduEnabled}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, baiduEnabled: e.target.checked }))
                      }
                      className="rounded border-white/20 bg-black/40 accent-brand"
                    />
                    <span>启用</span>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400">推送站点地址 (Site)</label>
                  <input
                    type="text"
                    value={config.baiduSite}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, baiduSite: e.target.value }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 font-mono text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400">准入密钥 (Token)</label>
                  <input
                    type="text"
                    value={config.baiduToken}
                    placeholder="百度站长平台下发的准入密钥"
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, baiduToken: e.target.value }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 font-mono text-xs text-white placeholder-white/30"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {configSavedNotice && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  推送凭据已持久化保存
                </span>
              )}
              <div className="ml-auto">
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-4 py-1.5 text-xs font-semibold shadow-sm transition-colors"
                >
                  <Save className="size-3.5" />
                  <span>{isSavingConfig ? '正在保存...' : '保存凭据设置'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Trigger Push Form */}
        <PermissionGate permission={PERMISSIONS.settingsWrite}>
        <form onSubmit={handleExecutePush} className="space-y-3.5">
          <div className="rounded-xl border border-white/[0.06] bg-black/30 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-white">
                待推送 URL 清单
              </label>
              <button
                type="button"
                onClick={handleQuickFillUrls}
                className="text-xs text-brand font-semibold hover:underline"
              >
                快速填充主要公开路由
              </button>
            </div>

            <textarea
              rows={4}
              value={urlsInput}
              onChange={(e) => setUrlsInput(e.target.value)}
              placeholder="https://www.supdance.com/&#10;https://www.supdance.com/studio&#10;https://www.supdance.com/models"
              className="w-full resize-y rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-white placeholder-white/20 outline-none focus:border-brand transition-colors"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {/* Engine Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300">目标引擎:</span>
                <div className="inline-flex rounded-lg border border-white/10 bg-black/40 p-0.5">
                  {[
                    { id: 'all', label: '全部已启用引擎' },
                    { id: 'indexnow', label: '仅 IndexNow (Bing/Yandex)' },
                    { id: 'baidu', label: '仅 百度主动推送' },
                  ].map((engine) => (
                    <button
                      key={engine.id}
                      type="button"
                      onClick={() => setSelectedEngine(engine.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        selectedEngine === engine.id
                          ? 'bg-white/15 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {engine.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPushing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/20 px-4 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <Send className="size-3.5" />
                <span>{isPushing ? '正在极速提交...' : '立即主动推送 →'}</span>
              </button>
            </div>
          </div>

          {/* Push Feedback Banner */}
          {pushFeedback && (
            <div
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                pushFeedback.tone === 'good'
                  ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                  : pushFeedback.tone === 'warn'
                  ? 'border-amber-500/30 bg-amber-950/20 text-amber-300'
                  : 'border-red-500/30 bg-red-950/20 text-red-300'
              }`}
            >
              {pushFeedback.tone === 'good' ? (
                <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
              )}
              <span className="leading-5">{pushFeedback.message}</span>
            </div>
          )}
        </form>
        </PermissionGate>

        {/* Push History Logs Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-gray-400" />
              <h4 className="text-xs font-semibold text-white">推送历史与审计日志</h4>
              <span className="text-[11px] text-gray-400">({logs.length} 条记录)</span>
            </div>
            <button
              type="button"
              onClick={fetchLogs}
              disabled={isLoadingLogs}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <RotateCw className={`size-3 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              <span>刷新日志</span>
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-6 text-center text-xs text-gray-400">
              {isLoadingLogs ? '正在加载历史记录...' : '暂无主动推送记录。提交一次主动推送后将在此生成审计日志。'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-black/30">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] font-semibold text-gray-400">
                  <tr>
                    <th className="py-2.5 px-3.5">提交时间</th>
                    <th className="py-2.5 px-3">目标引擎</th>
                    <th className="py-2.5 px-3">URL 数量</th>
                    <th className="py-2.5 px-3">状态</th>
                    <th className="py-2.5 px-3">HTTP 响应码</th>
                    <th className="py-2.5 px-3">延迟耗时</th>
                    <th className="py-2.5 px-3">操作人</th>
                    <th className="py-2.5 px-3 text-right">明细</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {logs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const logUrls = Array.isArray(log.urls) ? log.urls : (log.urls_json || []);

                    return (
                      <Fragment key={log.id}>
                        <tr className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 px-3.5 text-gray-300 font-mono text-[11px]">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : '刚刚'}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-white">
                            <span className="rounded px-1.5 py-0.5 text-[11px] bg-white/5 border border-white/10 uppercase font-mono">
                              {log.engine}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-gray-300">{log.url_count} 条</td>
                          <td className="py-2.5 px-3">
                            <StatusBadge tone={log.status === 'success' ? 'good' : 'danger'}>
                              {log.status === 'success' ? '成功' : '失败'}
                            </StatusBadge>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-gray-300">
                            {log.status_code || '-'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-gray-400 text-[11px]">
                            {log.latency_ms ? `${log.latency_ms}ms` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-gray-400 text-[11px] truncate max-w-[120px]">
                            {log.created_by || log.actor_email || 'admin'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="inline-flex items-center gap-0.5 text-brand font-semibold hover:underline text-[11px]"
                            >
                              <span>{isExpanded ? '收起' : '详情'}</span>
                              {isExpanded ? (
                                <ChevronUp className="size-3" />
                              ) : (
                                <ChevronDown className="size-3" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded details row */}
                        {isExpanded && (
                          <tr className="bg-black/60">
                            <td colSpan={8} className="p-3.5 space-y-2 border-b border-white/[0.08]">
                              <div>
                                <p className="text-[11px] font-semibold text-gray-300 mb-1">
                                  推送的 URL 列表 ({logUrls.length} 条):
                                </p>
                                <div className="rounded-lg bg-black/80 p-2 font-mono text-[11px] text-gray-300 max-h-32 overflow-y-auto space-y-0.5">
                                  {logUrls.map((u, i) => (
                                    <div key={i} className="truncate">
                                      {u}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {log.response_body && (
                                <div>
                                  <p className="text-[11px] font-semibold text-gray-300 mb-1">
                                    引擎响应结果 (Response Body):
                                  </p>
                                  <pre className="rounded-lg bg-black/80 p-2 font-mono text-[10px] text-brand/80 overflow-x-auto">
                                    {JSON.stringify(log.response_body, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
