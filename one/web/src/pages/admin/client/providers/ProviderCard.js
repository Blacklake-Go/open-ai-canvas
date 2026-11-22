'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  X,
  CreditCard,
  Radio,
  AlertTriangle,
  Activity,
  Zap,
} from 'lucide-react';
import { StatusBadge } from '@/components/admin/AdminUi';
import {
  WeChatIcon,
  AlipayIcon,
  StripeIcon,
  PayPalIcon,
  getSocialIcon,
} from '@/components/SocialIcons';

const ICON_MAP = {
  wechat: WeChatIcon,
  weixin: WeChatIcon,
  alipay: AlipayIcon,
  stripe: StripeIcon,
  paypal: PayPalIcon,
};

const CONSOLE_LINKS = {
  wechat: { label: '微信支付商户平台', url: 'https://pay.weixin.qq.com/' },
  alipay: { label: '支付宝开放平台', url: 'https://open.alipay.com/' },
  stripe: { label: 'Stripe 开发者后台', url: 'https://dashboard.stripe.com/' },
  paypal: { label: 'PayPal 开发者控制台', url: 'https://developer.paypal.com/dashboard/' },
};

export function Toggle({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? 'border-brand/50 bg-brand' : 'border-white/[0.12] bg-white/[0.08]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-[12px] rounded-full bg-white transition-transform duration-200 ${
          checked ? 'translate-x-[16px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

function probeView(result) {
  if (!result) return null;
  const latency = result.latency_ms || result.latencyMs || 0;
  if (result.status === 'healthy') {
    return { dot: 'bg-emerald-400', text: 'text-emerald-400', label: `正常在线 ${latency}ms` };
  }
  if (result.status === 'unconfigured') {
    return { dot: 'bg-amber-400', text: 'text-amber-400', label: '待录入凭证' };
  }
  if (result.status === 'degraded') {
    return { dot: 'bg-orange-400', text: 'text-orange-300', label: `响应稍慢 ${latency}ms` };
  }
  return { dot: 'bg-red-400', text: 'text-red-400', label: '离线 / 超时' };
}

function formatTime(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
  } catch {}
  return String(isoStr);
}

export default function ProviderCard({ provider, canWrite = true }) {
  const [channelEnabled, setChannelEnabled] = useState(provider.channelEnabled !== false);
  const [channelBusy, setChannelBusy] = useState(false);
  const [testResult, setTestResult] = useState(provider.lastCheck || null);
  const [testingEnv, setTestingEnv] = useState(null); // 'production' | 'sandbox' | 'probe' | null

  // Modal State
  const [formOpen, setFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('credentials'); // 'credentials' | 'webhooks'
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  // Mode (production vs sandbox)
  const [activeEnv, setActiveEnv] = useState(provider.activeKeyEnv || 'production');
  const [envBusy, setEnvBusy] = useState(false);

  // Form values
  const [secretValues, setSecretValues] = useState({});
  const [showPlaintext, setShowPlaintext] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Webhook Logs
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [webhooksLoaded, setWebhooksLoaded] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!formOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setFormOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formOpen]);

  const fetchWebhookLogs = useCallback(async () => {
    setWebhooksLoading(true);
    try {
      const res = await fetch(`/api/admin/providers/${provider.id}/webhooks?limit=10`, {
        headers: {
          'Idempotency-Key': crypto.randomUUID(),
        },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.data)) {
        setWebhookLogs(data.data);
      }
    } catch {
      // ignore network errors for polling
    } finally {
      setWebhooksLoading(false);
      setWebhooksLoaded(true);
    }
  }, [provider.id]);

  useEffect(() => {
    if (formOpen && activeTab === 'webhooks') {
      fetchWebhookLogs();
    }
  }, [formOpen, activeTab, fetchWebhookLogs]);

  const keyDefs = provider.secretKeys || [];
  const callbackPath = provider.callbackPath || `/api/billing/webhooks/${provider.id}`;
  const fullWebhookUri = `${origin || 'https://www.Supdance.com'}${callbackPath}`;

  const ProviderIcon =
    ICON_MAP[provider.id] ||
    ICON_MAP[provider.id?.toLowerCase()] ||
    getSocialIcon(provider.id) ||
    CreditCard;

  const consoleLink = provider.consoleUrl
    ? { label: provider.consoleLabel || '商户开发者控制台', url: provider.consoleUrl }
    : CONSOLE_LINKS[provider.id];

  const probe = probeView(testResult);

  const effectiveValue = (keyDef) => {
    const typed = secretValues[keyDef.name];
    if (typed !== undefined) return typed;
    return keyDef.isSecret === false ? keyDef.currentValue || '' : '';
  };

  const handleCopyWebhookUri = async () => {
    try {
      await navigator.clipboard.writeText(fullWebhookUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = fullWebhookUri;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const togglePaymentChannel = async () => {
    setChannelBusy(true);
    setMessage('');
    try {
      const next = !channelEnabled;
      const response = await fetch(`/api/admin/providers/${provider.id}/enabled`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ enabled: next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || '支付渠道状态更新失败');
      setChannelEnabled(next);
      setMessage(next ? '渠道前台展示已开启（需凭据配置就绪方可出单）' : '渠道前台展示已关闭，已从收银台隐藏');
    } catch (err) {
      setMessage(err.message || '支付渠道状态更新失败');
    } finally {
      setChannelBusy(false);
    }
  };

  const runTest = async (targetEnv = activeEnv) => {
    setTestingEnv(targetEnv);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/providers/${provider.id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ env: targetEnv }),
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setTestResult(data.data);
        setIsSuccess(true);
        const latency = data.data.latency_ms || data.data.latencyMs || 0;
        const note = data.data.details?.note || (data.data.status === 'healthy' ? '接口网关连通正常' : '连通异常');
        setMessage(`[${targetEnv === 'sandbox' ? '沙盒环境' : '生产环境'}] 连通检测完成：${note} (${latency}ms)`);
      } else {
        setIsSuccess(false);
        setMessage(`[${targetEnv === 'sandbox' ? '沙盒环境' : '生产环境'}] 检测失败：${data?.error?.message || data?.error || '请求响应异常'}`);
      }
    } catch (err) {
      setIsSuccess(false);
      setMessage(`探针网络异常：${err.message || '无法建立网络连接'}`);
    } finally {
      setTestingEnv(null);
    }
  };

  const handleSwitchEnv = async (nextEnv) => {
    if (nextEnv === activeEnv || envBusy) return;
    setEnvBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/providers/${provider.id}/env`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ env: nextEnv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || '运行模式切换失败');
      setActiveEnv(nextEnv);
      setIsSuccess(true);
      setMessage(`当前运行模式已切换为「${nextEnv === 'sandbox' ? '沙盒测试环境' : '生产环境 (Live)'}」`);
    } catch (err) {
      setIsSuccess(false);
      setMessage(err.message || '模式切换失败');
    } finally {
      setEnvBusy(false);
    }
  };

  const handleSaveSecrets = async (event) => {
    event.preventDefault();
    if (!window.confirm(`确认将配置加密写入 ${provider.name} 的安全商户托管保管库吗？`)) return;

    const secretsToUpdate = {};
    for (const keyDef of keyDefs) {
      const val = effectiveValue(keyDef);
      if (typeof val === 'string' && val.trim() !== '') {
        secretsToUpdate[keyDef.name] = val.trim();
      }
    }

    if (Object.keys(secretsToUpdate).length === 0) {
      setMessage('请输入需要更新的凭证内容');
      setIsSuccess(false);
      return;
    }

    setBusy(true);
    setMessage('');
    setIsSuccess(false);

    try {
      const res = await fetch(`/api/admin/providers/${provider.id}/secret`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ secrets: secretsToUpdate, activeEnv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || '配置保存失败');

      setIsSuccess(true);
      setMessage('商户凭证已通过 AES-256-GCM 存盘，正在更新渠道连通性状态。');
      if (data?.data?.latestCheck) {
        setTestResult(data.data.latestCheck);
      } else {
        runTest(activeEnv);
      }

      setTimeout(() => {
        setFormOpen(false);
        window.location.reload();
      }, 1500);
    } catch (err) {
      setIsSuccess(false);
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cardStatus = !provider.configured
    ? { tone: 'warn', text: '待配置凭证' }
    : channelEnabled
      ? { tone: 'good', text: '已就绪' }
      : { tone: 'neutral', text: '前台隐藏' };

  return (
    <section
      className={`flex flex-col justify-between rounded-xl border bg-surface/90 p-3.5 transition-colors duration-200 hover:border-brand/30 shadow-elevation-2 ${
        provider.configured ? 'border-white/[0.08]' : 'border-amber-500/25'
      }`}
    >
      <div>
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
            <ProviderIcon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-card-title text-white font-semibold" title={provider.name}>
              {provider.name}
            </h3>
            <p className="mt-0.5 truncate font-mono text-caption text-gray-500" title={provider.mode}>
              {provider.mode}
            </p>
          </div>
          <StatusBadge tone={cardStatus.tone}>{cardStatus.text}</StatusBadge>
        </div>

        {/* Webhook 快捷信息行 */}
        <div className="mt-3 flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/30 py-1 pl-2.5 pr-1">
          <code className="min-w-0 flex-1 truncate font-mono text-caption text-gray-400" title={fullWebhookUri}>
            {fullWebhookUri}
          </code>
          <button
            type="button"
            onClick={handleCopyWebhookUri}
            title="一键复制 Webhook 回调地址"
            className="shrink-0 rounded-lg p-1.5 text-gray-500 transition hover:bg-white/[0.06] hover:text-brand"
          >
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          </button>
          {consoleLink && (
            <a
              href={consoleLink.url}
              target="_blank"
              rel="noreferrer"
              title={consoleLink.label}
              className="shrink-0 rounded-lg p-1.5 text-gray-500 transition hover:bg-white/[0.06] hover:text-brand"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>

        {/* 凭据字段状态胶囊 */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 font-mono text-[11px]">
          {keyDefs.slice(0, 3).map((k) => {
            const shortLabel = k.label
              ? k.label.replace(/\s*[\u4e00-\u9fa5（(].*$/, '').trim() || k.label
              : k.name;
            const isConfigured = Boolean(k.configured && (k.maskedValue || k.currentValue));
            return (
              <div key={k.name} className="flex min-w-0 items-center gap-1">
                <span className="text-gray-500">{shortLabel}:</span>
                {isConfigured ? (
                  <span className="truncate font-semibold text-emerald-400" title={k.maskedValue || '已配置'}>
                    {k.maskedValue || '已配置'}
                  </span>
                ) : (
                  <span className="text-amber-400/80">未配置</span>
                )}
              </div>
            );
          })}
          {keyDefs.length > 3 && (
            <span className="text-gray-500 text-[10px]">+{keyDefs.length - 3} 项</span>
          )}
        </div>
      </div>

      {/* 卡片底部操作栏 */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Toggle
            checked={Boolean(channelEnabled)}
            disabled={!canWrite || channelBusy}
            onChange={togglePaymentChannel}
            label="前台展示开关"
          />
          <span className="text-label text-gray-400">前台展示</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {probe && (
            <span className={`inline-flex items-center gap-1 text-caption font-medium ${probe.text}`}>
              <span className={`size-1.5 rounded-full ${probe.dot}`} />
              {probe.label}
            </span>
          )}
          <button
            type="button"
            disabled={Boolean(testingEnv)}
            onClick={() => runTest(activeEnv)}
            title="接口健康探针检测"
            className="inline-flex size-7 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-gray-300 transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand active:scale-[0.96] disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${testingEnv ? 'animate-spin text-brand' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setMessage('');
              setFormOpen(true);
            }}
            className="inline-flex h-7 items-center rounded-full border border-brand/30 bg-brand/10 px-3 text-label font-medium text-brand transition hover:bg-brand/20 active:scale-[0.96]"
          >
            渠道配置浮窗 ⚙
          </button>
        </div>
      </div>

      {message && <p className="mt-2 text-caption text-brand">{message}</p>}

      {/* 渠道配置浮窗 (Modal) */}
      {formOpen && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label={`${provider.name} 渠道配置`}
          onClick={() => {
            if (Object.keys(secretValues).length === 0) setFormOpen(false);
          }}
        >
          <div
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.12] bg-surface-raised p-5 sm:p-6 shadow-modal animate-fade-in custom-scrollbar"
            onClick={(event) => event.stopPropagation()}
          >
            {/* 浮窗顶栏 */}
            <div className="flex items-start gap-3 border-b border-white/[0.08] pb-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                <ProviderIcon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-card-title text-white font-semibold">{provider.name}</h4>
                  <StatusBadge tone={provider.configured ? 'good' : 'warn'}>
                    {provider.configured ? '凭证已就绪' : '待配置凭证'}
                  </StatusBadge>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] ${activeEnv === 'sandbox' ? 'bg-amber-500/15 text-amber-300' : 'bg-brand/15 text-brand'}`}>
                    {activeEnv === 'sandbox' ? '沙盒环境' : '生产环境'}
                  </span>
                </div>
                <p className="mt-1 text-caption text-gray-400">{provider.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="关闭浮窗"
                className="shrink-0 rounded-lg p-1.5 text-gray-500 transition hover:bg-white/[0.06] hover:text-gray-200"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 顶栏摘要元信息 */}
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 rounded-xl border border-white/[0.06] bg-black/25 p-3 text-caption">
              <div>
                <span className="text-gray-500">通信协议规范：</span>
                <span className="font-mono text-gray-200 ml-1">{provider.mode}</span>
              </div>
              <div>
                <span className="text-gray-500">凭证存储机制：</span>
                <span className="inline-flex items-center gap-1 text-emerald-400 ml-1">
                  <ShieldCheck className="size-3.5" />
                  写入式 (AES-256-GCM 密文)
                </span>
              </div>
              <div className="sm:col-span-2 flex items-center justify-between border-t border-white/[0.05] pt-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                  <span className="shrink-0 text-gray-500">异步 Webhook：</span>
                  <code className="truncate font-mono text-[11px] text-gray-300">{fullWebhookUri}</code>
                </div>
                <button
                  type="button"
                  onClick={handleCopyWebhookUri}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-brand hover:bg-brand/10 transition"
                >
                  {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
              {consoleLink && (
                <div className="sm:col-span-2 border-t border-white/[0.05] pt-2 flex items-center justify-between">
                  <span className="text-gray-500">开发者凭证平台：</span>
                  <a
                    href={consoleLink.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-gray-300 transition hover:text-brand"
                  >
                    {consoleLink.label}
                    <ExternalLink className="size-3 text-gray-500" />
                  </a>
                </div>
              )}
            </div>

            {/* 生产与测试模式 API 切换与连通性检测卡片 */}
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/30 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <h5 className="text-body-sm font-semibold text-white">运行模式与 API 连通性测试</h5>
                  <p className="mt-0.5 text-caption text-gray-400">
                    在正式生产网关与沙盒联调测试环境之间快速切换，并一键验证 API 可达性。
                  </p>
                </div>

                {/* 模式快速切换 Pill */}
                <div
                  role="radiogroup"
                  aria-label="运行模式"
                  className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-black/40 p-0.5"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={activeEnv === 'production'}
                    disabled={envBusy || !canWrite}
                    onClick={() => handleSwitchEnv('production')}
                    className={`h-6 rounded-full px-3 text-caption font-medium transition-colors ${
                      activeEnv === 'production'
                        ? 'bg-brand text-white shadow-elevation-1'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    🚀 生产环境 (Live)
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={activeEnv === 'sandbox'}
                    disabled={envBusy || !canWrite}
                    onClick={() => handleSwitchEnv('sandbox')}
                    className={`h-6 rounded-full px-3 text-caption font-medium transition-colors ${
                      activeEnv === 'sandbox'
                        ? 'bg-amber-500 text-black font-semibold shadow-elevation-1'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    🧪 沙盒测试 (Sandbox)
                  </button>
                </div>
              </div>

              {/* 生产和测试 API 触发按钮组 */}
              <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  disabled={Boolean(testingEnv)}
                  onClick={() => runTest('production')}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 text-caption font-medium text-gray-200 transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand active:scale-[0.96] disabled:opacity-50"
                >
                  <RefreshCw className={`size-3 ${testingEnv === 'production' ? 'animate-spin text-brand' : ''}`} />
                  测试生产 API
                </button>

                <button
                  type="button"
                  disabled={Boolean(testingEnv)}
                  onClick={() => runTest('sandbox')}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 text-caption font-medium text-amber-300 transition hover:bg-amber-500/20 active:scale-[0.96] disabled:opacity-50"
                >
                  <RefreshCw className={`size-3 ${testingEnv === 'sandbox' ? 'animate-spin text-amber-300' : ''}`} />
                  测试沙盒 API
                </button>

                {probe && (
                  <span className={`ml-auto inline-flex items-center gap-1 text-caption font-medium ${probe.text}`}>
                    <span className={`size-1.5 rounded-full ${probe.dot}`} />
                    {probe.label}
                  </span>
                )}
              </div>
            </div>

            {/* 浮窗二级 Tabs 切换：商户凭据配置 vs Webhook 接收日志 */}
            <div className="mt-4 flex items-center justify-between border-b border-white/[0.08] pb-2">
              <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-black/30 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('credentials')}
                  className={`h-7 rounded-full px-3.5 text-label font-medium transition-colors ${
                    activeTab === 'credentials'
                      ? 'bg-white/[0.12] text-white shadow-elevation-1'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  商户凭据配置
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('webhooks')}
                  className={`h-7 rounded-full px-3.5 text-label font-medium transition-colors ${
                    activeTab === 'webhooks'
                      ? 'bg-white/[0.12] text-white shadow-elevation-1'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Webhook 日志
                  {webhooksLoaded && ` (${webhookLogs.length})`}
                </button>
              </div>

              {activeTab === 'webhooks' && (
                <button
                  type="button"
                  disabled={webhooksLoading}
                  onClick={fetchWebhookLogs}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-white/[0.10] bg-white/[0.04] px-2.5 text-caption font-medium text-gray-300 hover:bg-white/[0.08] hover:text-white transition"
                >
                  <RefreshCw className={`size-3 ${webhooksLoading ? 'animate-spin text-brand' : ''}`} />
                  刷新日志
                </button>
              )}
            </div>

            {/* TAB 1: 凭据配置表单 */}
            {activeTab === 'credentials' && (
              <form onSubmit={handleSaveSecrets} className="mt-3.5 space-y-3.5">
                {!canWrite && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-caption text-amber-300">
                    当前账号仅具备只读权限（缺少 providers.write），无法编辑商户凭证或变更渠道状态。
                  </div>
                )}
                <div className="space-y-3">
                  {keyDefs.map((k) => {
                    const isSecret = Boolean(k.isSecret);
                    const isConfigured = Boolean(k.configured && (k.maskedValue || k.currentValue));
                    const isPlain = Boolean(showPlaintext[k.name]);
                    const currentVal = effectiveValue(k);
                    const isTextarea = k.name === 'private_key' || k.name === 'public_key';

                    return (
                      <div key={k.name} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-caption font-medium text-gray-300">
                            {k.label || k.name}
                          </label>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                              isConfigured
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {isConfigured ? '已托管存盘' : '未配置'}
                          </span>
                        </div>

                        {isTextarea ? (
                          <div className="relative">
                            <textarea
                              rows={3}
                              value={currentVal}
                              onChange={(e) =>
                                setSecretValues((prev) => ({ ...prev, [k.name]: e.target.value }))
                              }
                              placeholder={
                                isConfigured
                                  ? '•••••••••••••••• (已加密托管存盘，留空保持现有凭据，粘贴新密钥覆盖)'
                                  : k.placeholder || `输入 ${k.label}`
                              }
                              disabled={!canWrite || busy}
                              className="w-full rounded-xl border border-white/[0.10] bg-canvas p-3 text-xs text-white font-mono placeholder:text-gray-500 focus:border-brand focus:ring-1 focus:ring-brand/30 outline-none transition resize-y disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>
                        ) : (
                          <div className="relative flex items-center">
                            <input
                              type={isSecret && !isPlain ? 'password' : 'text'}
                              value={currentVal}
                              onChange={(e) =>
                                setSecretValues((prev) => ({ ...prev, [k.name]: e.target.value }))
                              }
                              placeholder={
                                isConfigured
                                  ? isSecret
                                    ? k.maskedValue
                                      ? `${k.maskedValue} (留空保持现有凭证，输入新值覆盖)`
                                      : '•••••••••••••••• (留空保持现有凭证，输入新值覆盖)'
                                    : k.placeholder || '输入新值覆盖'
                                  : k.placeholder || `输入 ${k.label}`
                              }
                              disabled={!canWrite || busy}
                              className={`h-10 w-full rounded-xl border border-white/[0.10] bg-canvas px-3.5 text-xs text-white font-mono placeholder:text-gray-500 focus:border-brand focus:ring-1 focus:ring-brand/30 outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                isSecret ? 'pr-10' : ''
                              }`}
                            />
                            {isSecret && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowPlaintext((prev) => ({ ...prev, [k.name]: !prev[k.name] }))
                                }
                                className="absolute right-2.5 p-1 text-gray-500 hover:text-gray-200 transition"
                                title={isPlain ? '隐藏明文' : '查看明文'}
                              >
                                {isPlain ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-caption text-gray-500">
                    凭证修改将触发 AES-256-GCM 安全轮换
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormOpen(false)}
                      className="h-8 rounded-lg border border-white/[0.10] bg-transparent px-3 text-caption font-medium text-gray-400 hover:bg-white/[0.06] hover:text-white transition active:scale-[0.98]"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={busy || !canWrite}
                      className="inline-flex h-8 items-center rounded-full bg-brand px-4 text-caption font-semibold text-white transition hover:bg-brand-hover active:scale-[0.98] disabled:opacity-50"
                    >
                      {busy ? '安全存盘中…' : '安全加密存盘'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 2: Webhook 日志信息 */}
            {activeTab === 'webhooks' && (
              <div className="mt-3.5 space-y-3">
                {webhooksLoading && webhookLogs.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-caption text-gray-400">
                    <RefreshCw className="mr-2 size-4 animate-spin text-brand" />
                    正在检索该渠道最新的 Webhook 事件日志…
                  </div>
                ) : webhookLogs.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 p-6 text-center text-caption text-gray-400">
                    <p className="font-medium text-gray-300">暂无该渠道的 Webhook 接收日志</p>
                    <p className="mt-1 text-gray-500">
                      当结账订单产生支付通知、退款回调或平台沙盒事件推送时，对应的验签与执行日志将在此实时显示。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[48vh] overflow-y-auto custom-scrollbar pr-1">
                    {webhookLogs.map((log) => {
                      const isSuccess = log.status === 'processed' || log.status === 'received';
                      const isRejected = log.status === 'rejected';

                      return (
                        <div
                          key={log.eventId}
                          className="rounded-xl border border-white/[0.06] bg-black/25 p-3 text-caption transition hover:border-white/[0.12]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`size-2 shrink-0 rounded-full ${
                                  isSuccess
                                    ? 'bg-emerald-400'
                                    : isRejected
                                      ? 'bg-red-400'
                                      : 'bg-amber-400'
                                }`}
                              />
                              <span className="font-mono font-semibold text-white truncate" title={log.eventType}>
                                {log.eventType}
                              </span>
                              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-gray-400">
                                {log.eventId}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <StatusBadge
                                tone={
                                  isSuccess
                                    ? 'good'
                                    : isRejected
                                      ? 'danger'
                                      : 'warn'
                                }
                              >
                                {log.signatureStatus || log.status}
                              </StatusBadge>
                              <span className="font-mono text-[11px] text-gray-500">
                                {formatTime(log.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400 border-t border-white/[0.04] pt-2 font-mono">
                            <div>
                              <span className="text-gray-500">关联订单：</span>
                              <span className={log.orderId ? 'text-gray-200' : 'text-gray-600'}>
                                {log.orderId || '无订单关联'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">投递轮次：</span>
                              <span className="text-gray-300">{log.attempts || 1} 次</span>
                            </div>
                            {log.lastError && (
                              <div className="w-full text-red-400 truncate" title={log.lastError}>
                                <span className="text-red-500">异常记录：</span>
                                {log.lastError}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 浮窗底部状态提示 */}
            {message && (
              <div className={`mt-3 rounded-lg px-3 py-2 text-caption ${isSuccess ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {message}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
