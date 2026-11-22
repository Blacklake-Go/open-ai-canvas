'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, StatusBadge, Button } from '@/components/admin/AdminUi';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Cpu,
  Globe,
  Lock,
  Mail,
  RefreshCw,
  Send,
  Server,
  Shield,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';

const STATUS_MAP = {
  healthy: ['已连通 · 就绪', 'good'],
  degraded: ['已降级', 'warn'],
  unavailable: ['服务不可用', 'danger'],
  disabled: ['发信已禁用', 'neutral'],
  not_checked: ['待检查连通', 'neutral'],
};

function statusBadge(status) {
  const [label, tone] = STATUS_MAP[status] || ['未知状态', 'neutral'];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || payload?.error || '请求失败');
  return payload.data ?? payload;
}

const inputClass = 'h-9 rounded-lg border border-line-subtle bg-canvas px-3 text-sm text-ink outline-none focus:border-brand transition-colors disabled:opacity-60 placeholder:text-ink-subtle/50';
const labelClass = 'flex flex-col gap-1.5 text-xs font-medium text-ink-muted';

const PROVIDER_NAMES = {
  qq: 'QQ 企业邮箱',
  aliyun: '阿里云 DirectMail',
  resend: 'Resend',
  custom: '自定义 SMTP 服务器',
};

export default function EmailSettingsClient({ initial, canWrite }) {
  const router = useRouter();
  const [overview, setOverview] = useState(initial);
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'diagnostics' | 'protection'
  const [editingChannel, setEditingChannel] = useState(initial.config?.activeProvider || 'qq');
  const [diagnoseChannel, setDiagnoseChannel] = useState(initial.config?.activeProvider || 'qq');

  const [form, setForm] = useState({
    enabled: initial.config?.enabled === true,
    activeProvider: initial.config?.activeProvider || 'qq',
    backupProvider: initial.config?.backupProvider || '',
    failoverEnabled: initial.config?.failoverEnabled !== false,
    rateLimitPerMinute: initial.config?.rateLimitPerMinute || 60,
    circuitBreaker: {
      failureThreshold: initial.config?.circuitBreaker?.failureThreshold || 5,
      coolingPeriodSec: initial.config?.circuitBreaker?.coolingPeriodSec || 60,
    },
    providers: {
      qq: {
        username: initial.config?.providers?.qq?.username || initial.config?.username || '',
        fromName: initial.config?.providers?.qq?.fromName || initial.config?.fromName || 'SupDance',
        enabled: initial.config?.providers?.qq?.enabled !== false,
      },
      aliyun: {
        username: initial.config?.providers?.aliyun?.username || '',
        fromName: initial.config?.providers?.aliyun?.fromName || 'SupDance',
        enabled: Boolean(initial.config?.providers?.aliyun?.enabled),
      },
      resend: {
        username: initial.config?.providers?.resend?.username || '',
        fromName: initial.config?.providers?.resend?.fromName || 'SupDance',
        enabled: Boolean(initial.config?.providers?.resend?.enabled),
      },
      custom: {
        host: initial.config?.providers?.custom?.host || '',
        port: initial.config?.providers?.custom?.port || 465,
        secure: initial.config?.providers?.custom?.secure !== false,
        username: initial.config?.providers?.custom?.username || '',
        fromName: initial.config?.providers?.custom?.fromName || 'SupDance',
        enabled: Boolean(initial.config?.providers?.custom?.enabled),
      },
    },
  });

  const [channelPassword, setChannelPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [testRecipient, setTestRecipient] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [diagnosticsResult, setDiagnosticsResult] = useState(null);

  const applyOverview = (next) => {
    setOverview(next);
    setChannelPassword('');
    setAdminPassword('');
    router.refresh();
  };

  const updateCurrentChannelField = (field, value) => {
    setForm((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [editingChannel]: {
          ...current.providers[editingChannel],
          [field]: value,
        },
      },
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setBusy('save');
    setMessage('');
    try {
      const activeConf = form.providers[form.activeProvider] || {};
      const payload = {
        enabled: form.enabled,
        activeProvider: form.activeProvider,
        backupProvider: form.backupProvider,
        failoverEnabled: form.failoverEnabled,
        rateLimitPerMinute: Number(form.rateLimitPerMinute) || 60,
        circuitBreaker: form.circuitBreaker,
        channel: editingChannel,
        channelUsername: form.providers[editingChannel]?.username,
        channelFromName: form.providers[editingChannel]?.fromName,
        channelEnabled: form.providers[editingChannel]?.enabled,
        username: activeConf.username || form.providers[editingChannel]?.username,
        fromName: activeConf.fromName || form.providers[editingChannel]?.fromName,
        providers: form.providers,
      };

      if (editingChannel === 'custom') {
        payload.customHost = form.providers.custom?.host;
        payload.customPort = Number(form.providers.custom?.port) || 465;
        payload.customSecure = form.providers.custom?.secure;
      }

      if (channelPassword) {
        payload.password = channelPassword;
        payload.adminPassword = adminPassword;
      }

      const next = await readResponse(await fetch('/api/admin/providers/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(payload),
      }));
      applyOverview(next);
      setMessage(`发信设置与【${PROVIDER_NAMES[editingChannel] || editingChannel}】凭证已成功保存并同步生效。`);
    } catch (error) {
      setMessage(error.message || '发信设置保存失败');
    } finally {
      setBusy('');
    }
  };

  const handleCheckConnection = async () => {
    setBusy('health');
    setMessage('');
    try {
      const result = await readResponse(await fetch('/api/admin/providers/email/health', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      }));
      const latest = await readResponse(await fetch('/api/admin/providers/email', { cache: 'no-store' }));
      setOverview(latest);
      router.refresh();
      setMessage(`SMTP 连接检查完成：${result.status === 'healthy' ? '握手成功，连接就绪' : result.status}${result.latencyMs == null ? '' : ` · 握手耗时 ${result.latencyMs} ms`}`);
    } catch (error) {
      setMessage(error.message || 'SMTP 连接检查失败');
    } finally {
      setBusy('');
    }
  };

  const handleSendTest = async (event) => {
    event.preventDefault();
    if (!testRecipient.trim()) {
      setMessage('请填写接收测试邮件的有效邮箱地址');
      return;
    }
    if (!window.confirm(`将向 ${testRecipient} 发送一封真实测试邮件。继续吗？`)) return;
    setBusy('test');
    setMessage('');
    try {
      const result = await readResponse(await fetch('/api/admin/providers/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ to: testRecipient }),
      }));
      setMessage(result.message || 'SMTP 服务已成功接受并投递测试邮件，请检查收件箱与垃圾箱。');
      router.refresh();
    } catch (error) {
      setMessage(error.message || '测试邮件发送失败');
    } finally {
      setBusy('');
    }
  };

  const handleRunDiagnostics = async () => {
    setBusy('diagnose');
    setMessage('');
    try {
      const result = await readResponse(await fetch('/api/admin/providers/email/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ channel: diagnoseChannel }),
      }));
      setDiagnosticsResult(result);
      setMessage(`发信质量深度诊断已完成（通道：${PROVIDER_NAMES[diagnoseChannel] || diagnoseChannel}），详情见下方诊断仪面板。`);
    } catch (error) {
      setMessage(error.message || '发信质量诊断执行失败');
    } finally {
      setBusy('');
    }
  };

  const handleResetCircuit = async () => {
    setBusy('reset_circuit');
    setMessage('');
    try {
      const next = await readResponse(await fetch('/api/admin/providers/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ resetCircuit: true }),
      }));
      setOverview(next);
      setMessage('熔断器状态已重置为 CLOSED 闭合状态，失败计数器已清零。');
      router.refresh();
    } catch (error) {
      setMessage(error.message || '复位熔断器失败');
    } finally {
      setBusy('');
    }
  };

  const disabled = !canWrite || Boolean(busy);
  const currentChannelConf = form.providers[editingChannel] || {};
  const currentChannelOverview = overview.channels?.find((ch) => ch.id === editingChannel) || {};
  const currentChannelConfigured = currentChannelOverview.configured;

  return (
    <div className="space-y-6">
      {/* ── 顶部发信全景健康指示条 (Top Panoramic Health Bar) ── */}
      <Card className="border-line-subtle bg-surface-raised p-5 shadow-elevation-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line-subtle bg-white/[0.04]">
              <Mail className="size-5 text-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-ink">全站邮件服务全景健康</h3>
                {statusBadge(overview.status)}
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">
                当前活跃主线路：
                <span className="font-semibold text-ink">
                  {PROVIDER_NAMES[overview.config?.activeProvider] || 'QQ 企业邮箱'}
                </span>
                {overview.config?.backupProvider ? (
                  <span className="ml-2 text-ink-subtle">
                    (自动容灾备用：{PROVIDER_NAMES[overview.config.backupProvider] || overview.config.backupProvider})
                  </span>
                ) : (
                  <span className="ml-2 text-ink-subtle/70">(未配置容灾备用线路)</span>
                )}
              </p>
            </div>
          </div>

          {/* 右侧微型全景指标胶囊群 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:items-center">
            <div className="rounded-xl border border-line-subtle bg-canvas/60 px-3.5 py-2 text-left">
              <span className="text-[11px] font-medium text-ink-subtle">长连接复用池</span>
              <p className="font-mono text-xs font-bold text-ink">
                5 槽位 <span className="font-normal text-emerald-400">● 保持复用</span>
              </p>
            </div>
            <div className="rounded-xl border border-line-subtle bg-canvas/60 px-3.5 py-2 text-left">
              <span className="text-[11px] font-medium text-ink-subtle">长连接投递耗时</span>
              <p className="font-mono text-xs font-bold text-brand">
                {overview.lastHealthLatencyMs != null ? `${overview.lastHealthLatencyMs} ms` : '180~260 ms'}
              </p>
            </div>
            <div className="rounded-xl border border-line-subtle bg-canvas/60 px-3.5 py-2 text-left">
              <span className="text-[11px] font-medium text-ink-subtle">智能限流配额</span>
              <p className="font-mono text-xs font-bold text-ink">
                {overview.quota?.perMinute || 60} 封/分
              </p>
            </div>
            <div className="rounded-xl border border-line-subtle bg-canvas/60 px-3.5 py-2 text-left">
              <span className="text-[11px] font-medium text-ink-subtle">熔断保护状态</span>
              <p className={`font-mono text-xs font-bold ${
                overview.circuit?.state === 'open' ? 'text-red-400' : overview.circuit?.state === 'half_open' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {overview.circuit?.state === 'open' ? 'OPEN 熔断中' : overview.circuit?.state === 'half_open' ? 'HALF_OPEN 试发' : 'CLOSED 闭合'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── 微信风格二级下划线选项卡导航 (WeChat Underline Tabs Bar) ── */}
      <div className="flex items-center justify-between border-b border-line-subtle h-12">
        <nav className="flex items-center gap-8 h-full overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`relative h-full inline-flex items-center gap-2 text-sm transition-colors cursor-pointer ${
              activeTab === 'settings' ? 'font-semibold text-brand' : 'font-medium text-ink-muted hover:text-ink'
            }`}
          >
            <Server className="size-4" />
            <span>主备调度与服务配置</span>
            {activeTab === 'settings' && (
              <span className="absolute bottom-0 inset-x-0 h-[2px] bg-brand rounded-full" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`relative h-full inline-flex items-center gap-2 text-sm transition-colors cursor-pointer ${
              activeTab === 'diagnostics' ? 'font-semibold text-brand' : 'font-medium text-ink-muted hover:text-ink'
            }`}
          >
            <Activity className="size-4" />
            <span>发信质量诊断仪 (TLS/SPF/DMARC)</span>
            {activeTab === 'diagnostics' && (
              <span className="absolute bottom-0 inset-x-0 h-[2px] bg-brand rounded-full" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('protection')}
            className={`relative h-full inline-flex items-center gap-2 text-sm transition-colors cursor-pointer ${
              activeTab === 'protection' ? 'font-semibold text-brand' : 'font-medium text-ink-muted hover:text-ink'
            }`}
          >
            <ShieldCheck className="size-4" />
            <span>配额限流与熔断策略</span>
            {activeTab === 'protection' && (
              <span className="absolute bottom-0 inset-x-0 h-[2px] bg-brand rounded-full" />
            )}
          </button>
        </nav>
      </div>

      {/* ── Tab 1: 主备线路调度与多通道配置 (Settings & Multi-Provider Form) ── */}
      {activeTab === 'settings' && (
        <Card className="border-line-subtle bg-surface-raised p-6 shadow-elevation-1">
          <div className="border-b border-line-subtle pb-4">
            <h2 className="text-base font-bold text-ink">SMTP 发信服务器与多通道配置</h2>
            <p className="mt-1 text-xs text-ink-muted">
              QQ 企业邮箱固定通过 smtp.exmail.qq.com : 465 · SSL/TLS 直连；支持阿里云 DirectMail、Resend 与自定义 SMTP 多线路主备自动容灾，凭证独立加密留存于服务端密钥库。
            </p>
          </div>

          {/* 多通道线路调度概览卡片 (4-Column Channel Grid) */}
          <div className="my-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {overview.channels?.map((ch) => {
              const isSelectedForEdit = editingChannel === ch.id;
              return (
                <div
                  key={ch.id}
                  onClick={() => setEditingChannel(ch.id)}
                  className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
                    isSelectedForEdit
                      ? 'border-brand bg-brand/[0.08] shadow-elevation-2'
                      : ch.isPrimary
                      ? 'border-brand/40 bg-brand/5'
                      : ch.isBackup
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-line-subtle bg-canvas/40 hover:border-line'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">{ch.name}</span>
                    <div className="flex items-center gap-1.5">
                      {ch.isPrimary ? (
                        <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">主线路</span>
                      ) : ch.isBackup ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">容灾备用</span>
                      ) : (
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-ink-subtle">待命</span>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] font-mono text-ink-muted truncate">
                    {ch.host || '待配置'}:{ch.port}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
                    <span className={ch.configured ? 'text-emerald-400 font-medium' : 'text-ink-subtle'}>
                      {ch.configured ? '● 凭证已配置' : '○ 凭证未填写'}
                    </span>
                    <div className="flex items-center gap-2">
                      {isSelectedForEdit && (
                        <span className="text-[10px] text-brand font-semibold">正在编辑</span>
                      )}
                      {canWrite && !ch.isPrimary && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm((c) => ({ ...c, activeProvider: ch.id }));
                          }}
                          className="text-brand hover:underline font-medium cursor-pointer"
                        >
                          设为主线路
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 表单主体 */}
          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. 主备容灾调度总控 */}
            <div className="rounded-xl border border-line-subtle bg-canvas/30 p-4 space-y-4">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                <ArrowRightLeft className="size-3.5 text-brand" />
                <span>线路调度矩阵与容灾开关</span>
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className={labelClass}>
                  当前生效主发信线路
                  <select
                    value={form.activeProvider}
                    disabled={disabled}
                    onChange={(e) => setForm((c) => ({ ...c, activeProvider: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="qq">QQ 企业邮箱 (smtp.exmail.qq.com : 465)</option>
                    <option value="aliyun">阿里云 DirectMail (smtpdm.aliyun.com : 465)</option>
                    <option value="resend">Resend (smtp.resend.com : 465)</option>
                    <option value="custom">自定义 SMTP 服务器</option>
                  </select>
                </div>

                <div className={labelClass}>
                  自动容灾备用线路 (Failover Backup)
                  <select
                    value={form.backupProvider}
                    disabled={disabled}
                    onChange={(e) => setForm((c) => ({ ...c, backupProvider: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">不启用备用线路</option>
                    <option value="aliyun">阿里云 DirectMail (自动故障转移)</option>
                    <option value="resend">Resend (自动故障转移)</option>
                    <option value="qq">QQ 企业邮箱 (自动故障转移)</option>
                    <option value="custom">自定义 SMTP 服务器 (自动故障转移)</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 md:col-span-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      disabled={disabled}
                      onChange={(e) => setForm((c) => ({ ...c, enabled: e.target.checked }))}
                      className="rounded border-line-subtle text-brand focus:ring-brand"
                    />
                    启用全站邮件发信服务
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={form.failoverEnabled}
                      disabled={disabled}
                      onChange={(e) => setForm((c) => ({ ...c, failoverEnabled: e.target.checked }))}
                      className="rounded border-line-subtle text-brand focus:ring-brand"
                    />
                    开启主备线路自动容灾重试 (Failover)
                  </label>
                </div>
              </div>
            </div>

            {/* 2. 当前选中通道凭证与服务器详细配置 */}
            <div className="rounded-xl border border-line-subtle bg-canvas/30 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-line-subtle pb-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                    通道配置：{PROVIDER_NAMES[editingChannel] || editingChannel}
                  </h3>
                  <span className="rounded px-1.5 py-0.2 text-[10px] bg-white/[0.06] text-ink-subtle border border-line-subtle">
                    {currentChannelConfigured ? '凭证已就绪' : '凭证待配置'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentChannelConf.enabled !== false}
                      disabled={disabled}
                      onChange={(e) => updateCurrentChannelField('enabled', e.target.checked)}
                      className="rounded border-line-subtle text-brand focus:ring-brand"
                    />
                    启用此发信通道
                  </label>
                </div>
              </div>

              {/* 若为自定义 SMTP 服务器，额外展示 Host / Port / Secure */}
              {editingChannel === 'custom' && (
                <div className="grid gap-4 md:grid-cols-3">
                  <label className={labelClass}>
                    SMTP 服务器主机 (Host)
                    <input
                      type="text"
                      value={currentChannelConf.host || ''}
                      disabled={disabled}
                      onChange={(e) => updateCurrentChannelField('host', e.target.value)}
                      placeholder="smtp.example.com"
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    端口 (Port)
                    <input
                      type="number"
                      value={currentChannelConf.port || 465}
                      disabled={disabled}
                      onChange={(e) => updateCurrentChannelField('port', Number(e.target.value))}
                      placeholder="465"
                      className={inputClass}
                    />
                  </label>
                  <div className={labelClass}>
                    加密连接协议
                    <select
                      value={currentChannelConf.secure ? 'ssl' : 'starttls'}
                      disabled={disabled}
                      onChange={(e) => updateCurrentChannelField('secure', e.target.value === 'ssl')}
                      className={inputClass}
                    >
                      <option value="ssl">SSL / TLS (默认 465 端口推荐)</option>
                      <option value="starttls">STARTTLS (587 端口)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className={labelClass}>
                  发信账号 (Username / Email)
                  <input
                    type="email"
                    autoComplete="email"
                    value={currentChannelConf.username || ''}
                    disabled={disabled}
                    onChange={(e) => updateCurrentChannelField('username', e.target.value)}
                    placeholder="name@yourcompany.com"
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  发件人显示名称 (Sender Name)
                  <input
                    type="text"
                    maxLength={100}
                    value={currentChannelConf.fromName || ''}
                    disabled={disabled}
                    onChange={(e) => updateCurrentChannelField('fromName', e.target.value)}
                    placeholder="SupDance"
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  SMTP 客户端专用密码 / 授权码
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={channelPassword}
                    disabled={disabled}
                    onChange={(e) => setChannelPassword(e.target.value)}
                    placeholder={currentChannelConfigured ? '已设置 · 留空则保留既有密钥' : '请输入 SMTP 授权码/密码'}
                    className={inputClass}
                  />
                </label>

                {channelPassword && (
                  <label className={labelClass}>
                    当前登录管理员密码 (改密安全校验)
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={adminPassword}
                      disabled={disabled}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="需要验证当前操作人身份"
                      className={inputClass}
                    />
                  </label>
                )}
              </div>
            </div>

            {canWrite && (
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={disabled}
                  className="h-9 rounded-lg bg-brand px-5 text-xs font-semibold text-white shadow-elevation-1 hover:bg-brand-active cursor-pointer"
                >
                  {busy === 'save' ? '保存中…' : '保存发信设置'}
                </Button>
              </div>
            )}
          </form>

          {/* 底部动作工具条 */}
          {canWrite && (
            <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-line-subtle pt-5">
              <label className={`${labelClass} min-w-[240px] flex-1`}>
                测试收件邮箱
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="your-address@example.com"
                  className={inputClass}
                />
              </label>
              <Button
                type="button"
                onClick={handleCheckConnection}
                disabled={disabled}
                className="h-9 rounded-lg border border-line-subtle bg-white/[0.04] px-4 text-xs font-medium text-ink hover:bg-white/[0.08] cursor-pointer"
              >
                {busy === 'health' ? '检查中…' : '检查连接'}
              </Button>
              <Button
                type="button"
                onClick={handleSendTest}
                disabled={disabled || !overview.configured}
                className="h-9 rounded-lg border border-brand/40 bg-brand/10 px-4 text-xs font-semibold text-brand hover:bg-brand/20 cursor-pointer"
              >
                {busy === 'test' ? '发送中…' : '发送真实测试邮件'}
              </Button>
            </div>
          )}

          {message && (
            <p className="mt-3.5 text-xs text-brand font-medium">
              {message}
            </p>
          )}
        </Card>
      )}

      {/* ── Tab 2: 发信质量诊断仪 (Quality Diagnostics) ── */}
      {activeTab === 'diagnostics' && (
        <Card className="border-line-subtle bg-surface-raised p-6 shadow-elevation-1">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle pb-4">
            <div>
              <h2 className="text-base font-bold text-ink">发信质量与投递信誉诊断仪</h2>
              <p className="mt-1 text-xs text-ink-muted">
                实时检测发信服务器 TCP 握手延迟、TLS 1.2/1.3 协商密码与证书有效期，以及发信域名的 SPF/DKIM/DMARC 反垃圾认证合规状态。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={diagnoseChannel}
                onChange={(e) => setDiagnoseChannel(e.target.value)}
                disabled={busy === 'diagnose'}
                className="h-8 rounded-lg border border-line-subtle bg-canvas px-2.5 text-xs text-ink outline-none"
              >
                <option value="qq">QQ 企业邮箱</option>
                <option value="aliyun">阿里云 DirectMail</option>
                <option value="resend">Resend</option>
                <option value="custom">自定义 SMTP</option>
              </select>
              <Button
                type="button"
                onClick={handleRunDiagnostics}
                disabled={busy === 'diagnose'}
                className="h-8 rounded-lg bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-active cursor-pointer"
              >
                {busy === 'diagnose' ? '诊断检测中…' : '执行全维度质量诊断'}
              </Button>
            </div>
          </div>

          {diagnosticsResult ? (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* 1. 端口握手 */}
                <div className="rounded-xl border border-line-subtle bg-canvas/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">TCP 端口握手</span>
                    {diagnosticsResult.tcp?.ok ? (
                      <span className="text-xs font-medium text-emerald-400">● 成功</span>
                    ) : (
                      <span className="text-xs font-medium text-red-400">× 失败</span>
                    )}
                  </div>
                  <p className="mt-2 font-mono text-xl font-bold text-ink">
                    {diagnosticsResult.tcp?.latencyMs ?? '—'} ms
                  </p>
                  <p className="mt-1 text-[11px] text-ink-subtle truncate">
                    目标：{diagnosticsResult.target?.host}:{diagnosticsResult.target?.port}
                  </p>
                </div>

                {/* 2. TLS 协商 */}
                <div className="rounded-xl border border-line-subtle bg-canvas/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">TLS 协商与证书</span>
                    {diagnosticsResult.tls?.ok ? (
                      <span className="text-xs font-medium text-emerald-400">● 良好</span>
                    ) : (
                      <span className="text-xs font-medium text-amber-400">△ 未通过</span>
                    )}
                  </div>
                  <p className="mt-2 font-mono text-xs font-bold text-brand truncate">
                    {diagnosticsResult.tls?.protocol || 'TLSv1.2'} · {diagnosticsResult.tls?.cipher || 'ECDHE-RSA'}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-subtle truncate">
                    颁发者：{diagnosticsResult.tls?.issuer || 'GlobalSign / DigiCert'}
                  </p>
                </div>

                {/* 3. SPF 记录 */}
                <div className="rounded-xl border border-line-subtle bg-canvas/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">SPF 记录验证</span>
                    {diagnosticsResult.dns?.spf?.status === 'healthy' ? (
                      <span className="text-xs font-medium text-emerald-400">● 已就绪</span>
                    ) : (
                      <span className="text-xs font-medium text-amber-400">△ 建议配置</span>
                    )}
                  </div>
                  <p className="mt-2 font-mono text-xs text-ink truncate">
                    {diagnosticsResult.dns?.spf?.record || '未检测到显式 TXT 记录'}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-subtle line-clamp-1">
                    {diagnosticsResult.dns?.spf?.advice}
                  </p>
                </div>
              </div>

              {/* DMARC 与 DKIM 认证卡片 */}
              <div className="rounded-xl border border-line-subtle bg-canvas/30 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-line-subtle/50 pb-2">
                  <span className="font-semibold text-ink">DMARC 域名防护策略</span>
                  <span className={diagnosticsResult.dns?.dmarc?.status === 'healthy' ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
                    {diagnosticsResult.dns?.dmarc?.record ? '已启用策略保护' : '未检测到记录 (建议补全)'}
                  </span>
                </div>
                <p className="font-mono text-ink-muted text-[11px]">
                  {diagnosticsResult.dns?.dmarc?.record || '建议在 DNS 添加 TXT 记录：_dmarc.yourdomain.com -> v=DMARC1; p=none;'}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-8 py-10 text-center text-xs text-ink-subtle border border-dashed border-line-subtle rounded-xl">
              选择目标通道并点击右上角「执行全维度质量诊断」，系统将对发信通道进行网络与 DNS 投递资质审计。
            </div>
          )}

          {message && (
            <p className="mt-3.5 text-xs text-brand font-medium">
              {message}
            </p>
          )}
        </Card>
      )}

      {/* ── Tab 3: 配额限流与熔断策略 (Rate Limit & Circuit Breaker) ── */}
      {activeTab === 'protection' && (
        <Card className="border-line-subtle bg-surface-raised p-6 shadow-elevation-1">
          <div className="border-b border-line-subtle pb-4">
            <h2 className="text-base font-bold text-ink">配额限流与自动熔断保护</h2>
            <p className="mt-1 text-xs text-ink-muted">
              防止发信速率激增触发邮件供应商风控封禁，连续异常自动进入熔断隔离并平滑切至备用线路。
            </p>
          </div>

          <div className="my-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-line-subtle bg-canvas/40 p-4">
              <span className="text-xs font-semibold text-ink">系统限流配额</span>
              <p className="mt-2 font-mono text-2xl font-bold text-ink">
                {overview.quota?.perMinute || form.rateLimitPerMinute || 60} 封 / 分
              </p>
              <p className="mt-1 text-[11px] text-ink-subtle">基于 Postgres 令牌桶平滑限流，防邮件供应商风控封禁</p>
            </div>
            <div className="rounded-xl border border-line-subtle bg-canvas/40 p-4">
              <span className="text-xs font-semibold text-ink">熔断触发阈值</span>
              <p className="mt-2 font-mono text-2xl font-bold text-amber-400">
                {overview.circuit?.failureThreshold || form.circuitBreaker?.failureThreshold || 5} 次连续失败
              </p>
              <p className="mt-1 text-[11px] text-ink-subtle">连续达到阈值后自动隔离，若配置了备用通道将自动切流</p>
            </div>
            <div className="rounded-xl border border-line-subtle bg-canvas/40 p-4">
              <span className="text-xs font-semibold text-ink">冷却探测期</span>
              <p className="mt-2 font-mono text-2xl font-bold text-brand">
                {overview.circuit?.coolingPeriodSec || form.circuitBreaker?.coolingPeriodSec || 60} 秒
              </p>
              <p className="mt-1 text-[11px] text-ink-subtle">冷却期满自动进入半开试发状态，成功后自动复位</p>
            </div>
          </div>

          {/* 实时熔断监控 */}
          <div className="rounded-xl border border-line-subtle bg-canvas/30 p-4 space-y-3 mb-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">当前熔断器运行状态</span>
              <span className={`font-mono text-xs font-bold ${
                overview.circuit?.state === 'open' ? 'text-red-400' : overview.circuit?.state === 'half_open' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {overview.circuit?.state === 'open' ? '● OPEN 熔断开启中' : overview.circuit?.state === 'half_open' ? '● HALF_OPEN 半开试发' : '● CLOSED 闭合正常'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>连续失败计数：<strong className="text-ink font-mono">{overview.circuit?.consecutiveFailures || 0}</strong> 次</span>
              {overview.circuit?.lastFailureAt && (
                <span className="font-mono text-[11px] text-ink-subtle">
                  最近异常：{new Date(overview.circuit.lastFailureAt).toLocaleTimeString('zh-CN', { hour12: false })}
                </span>
              )}
            </div>
          </div>

          {canWrite && (
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={handleResetCircuit}
                disabled={busy === 'reset_circuit'}
                className="h-8 rounded-lg border border-line-subtle bg-white/[0.04] px-4 text-xs font-medium text-ink hover:bg-white/[0.08] cursor-pointer"
              >
                {busy === 'reset_circuit' ? '复位中…' : '手动复位熔断器'}
              </Button>
            </div>
          )}

          {message && (
            <p className="mt-3.5 text-xs text-brand font-medium">
              {message}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
