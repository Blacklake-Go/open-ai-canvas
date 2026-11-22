'use client';

import { useEffect, useState } from 'react';
import { Check, CheckCircle2, Copy, ExternalLink, Eye, EyeOff, RefreshCw, ShieldCheck, X, Zap } from 'lucide-react';
import { StatusBadge } from '@/components/admin/AdminUi';
import {
  BilibiliIcon,
  DouyinIcon,
  GoogleIcon,
  InstagramIcon,
  QQIcon,
  TikTokIcon,
  WeChatIcon,
  XIcon,
  GithubIcon,
  AppleIcon,
  AlipayIcon,
  getSocialIcon,
} from '@/components/SocialIcons';

const ICON_MAP = {
  google: GoogleIcon,
  x: XIcon,
  twitter: XIcon,
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
  wechat: WeChatIcon,
  wechat_oauth: WeChatIcon,
  weixin: WeChatIcon,
  qq: QQIcon,
  douyin: DouyinIcon,
  bilibili: BilibiliIcon,
  bili: BilibiliIcon,
  github: GithubIcon,
  apple: AppleIcon,
  alipay: AlipayIcon,
};

const CONSOLE_LINKS = {
  google: { label: 'Google Cloud 凭据控制台', url: 'https://console.cloud.google.com/apis/credentials' },
  x: { label: 'X Developer 开发者门户', url: 'https://developer.x.com/en/portal/dashboard' },
  twitter: { label: 'X Developer 开发者门户', url: 'https://developer.x.com/en/portal/dashboard' },
  tiktok: { label: 'TikTok for Developers 控制台', url: 'https://developers.tiktok.com/' },
  instagram: { label: 'Meta for Developers 控制台', url: 'https://developers.facebook.com/apps/' },
  wechat: { label: '微信开放平台', url: 'https://open.weixin.qq.com/' },
  wechat_oauth: { label: '微信开放平台', url: 'https://open.weixin.qq.com/' },
  qq: { label: 'QQ 互联管理中心', url: 'https://connect.qq.com/manage.html' },
  douyin: { label: '抖音开放平台', url: 'https://developer.open-douyin.com/' },
  bilibili: { label: '哔哩哔哩开放平台', url: 'https://open.bilibili.com/' },
};

const KEY_FALLBACK = [
  { name: 'client_id', label: 'Client ID 客户端标识', placeholder: '输入客户端 ID' },
  { name: 'client_secret', label: 'Client Secret 客户端密钥', placeholder: '输入客户端密钥' },
];

function formatUpdatedAt(value) {
  if (!value) return '';
  if (value === '环境配置') return '环境变量配置';
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(date.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      const y = date.getFullYear();
      const m = pad(date.getMonth() + 1);
      const d = pad(date.getDate());
      const hh = pad(date.getHours());
      const mm = pad(date.getMinutes());
      const ss = pad(date.getSeconds());
      return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
    }
  } catch {}
  if (typeof value === 'string') {
    return value.length >= 19 ? value.slice(0, 19).replace('T', ' ') : value;
  }
  return String(value);
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
  return { dot: 'bg-red-400', text: 'text-red-400', label: '网络离线 / 超时' };
}

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

function MetaRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-body-sm text-gray-500">{label}</span>
      <span className="min-w-0 text-right text-body-sm text-gray-300">{children}</span>
    </div>
  );
}

export default function SocialProviderCard({ provider, enabled, configured, onToggleEnabled, canWrite }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(provider.lastCheck || null);
  const [formOpen, setFormOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  const [secretValues, setSecretValues] = useState({});
  const [showPlaintext, setShowPlaintext] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

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

  const keyDefs = provider.secretKeys || KEY_FALLBACK;
  const fullRedirectUri =
    provider.redirectUri || (
      provider.id === 'douyin' || provider.id === 'google' || provider.id === 'instagram'
        ? `https://www.supdance.com${provider.callbackPath || ''}`
        : `${origin || 'https://www.supdance.com'}${provider.callbackPath || ''}`
    );
  const ProviderIcon =
    ICON_MAP[provider.id] ||
    ICON_MAP[provider.id?.toLowerCase()] ||
    getSocialIcon(provider.id) ||
    Zap;
  const consoleLink = CONSOLE_LINKS[provider.id];
  const probe = probeView(testResult);

  // 公开标识（Client ID / AppID）可反显，进浮层即带出当前值供管理员确认；密钥只留占位。
  const effectiveValue = (keyDef) => {
    const typed = secretValues[keyDef.name];
    if (typed !== undefined) return typed;
    return keyDef.isSecret === false ? keyDef.currentValue || '' : '';
  };

  const handleCopyUri = async () => {
    try {
      await navigator.clipboard.writeText(fullRedirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = fullRedirectUri;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/providers/${provider.id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setTestResult(data.data);
        setIsSuccess(true);
        const latency = data.data.latency_ms || data.data.latencyMs || 0;
        const note =
          data.data.status === 'healthy'
            ? data.data.details?.note
              ? '平台网关可达'
              : '正常在线'
            : data.data.status === 'unconfigured'
              ? '待录入凭证'
              : '响应稍慢或异常';
        setMessage(`探针检测完成：${note} (${latency}ms)`);
      } else {
        setIsSuccess(false);
        setMessage(`探针诊断失败：${data?.error?.message || data?.error || '健康检查请求失败'}`);
      }
    } catch (err) {
      setIsSuccess(false);
      setMessage(`探针连接异常：${err.message || '网络无法连通'}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSecrets = async (event) => {
    event.preventDefault();
    if (!window.confirm(`确认将配置加密写入 ${provider.name} 的安全托管保管库吗？`)) return;

    const secretsToUpdate = {};
    for (const keyDef of keyDefs) {
      const val = effectiveValue(keyDef);
      if (typeof val === 'string' && val.trim() !== '') {
        secretsToUpdate[keyDef.name] = val.trim();
      } else if (!keyDef.configured) {
        setMessage(`请完整录入 ${keyDef.label}`);
        setIsSuccess(false);
        return;
      }
    }

    if (Object.keys(secretsToUpdate).length === 0) {
      setMessage('凭证内容未做任何修改');
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
        body: JSON.stringify({ secrets: secretsToUpdate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || '配置保存失败');

      setIsSuccess(true);
      setMessage('凭证已通过 AES-256-GCM 加密存盘，正在更新渠道诊断状态。');
      if (data?.data?.latestCheck) {
        setTestResult(data.data.latestCheck);
      } else {
        runTest();
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

  const status = !configured
    ? { tone: 'warn', text: '凭据未录入' }
    : enabled
      ? { tone: 'good', text: '已就绪' }
      : { tone: 'neutral', text: '已隐藏' };

  return (
    <section
      className={`flex flex-col rounded-xl border bg-surface/90 p-3.5 transition-colors duration-200 hover:border-brand/25 ${
        configured ? 'border-white/[0.08]' : 'border-amber-500/25'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
          <ProviderIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-card-title text-white" title={provider.name}>
            {provider.name}
          </h3>
          <p className="mt-0.5 truncate font-mono text-caption text-gray-500" title={provider.mode}>
            {provider.mode}
          </p>
        </div>
        <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
      </div>

      <div className="mt-3 flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/30 py-1 pl-2.5">
        <code className="min-w-0 flex-1 truncate font-mono text-caption text-gray-400" title={fullRedirectUri}>
          {fullRedirectUri}
        </code>
        <button
          type="button"
          onClick={handleCopyUri}
          title="一键复制回调地址"
          className="shrink-0 rounded p-1.5 text-gray-500 transition hover:bg-white/[0.06] hover:text-brand"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
        </button>
        {consoleLink && (
          <a
            href={consoleLink.url}
            target="_blank"
            rel="noreferrer"
            title={consoleLink.label}
            className="shrink-0 rounded p-1.5 text-gray-500 transition hover:bg-white/[0.06] hover:text-brand"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 font-mono text-[11px]">
        {keyDefs.map((k) => {
          const shortLabel = k.label
            ? k.label.replace(/\s*[\u4e00-\u9fa5（(].*$/, '').trim() || k.label
            : k.name;
          const isConfigured = Boolean(k.configured && k.maskedValue);
          return (
            <div key={k.name} className="flex min-w-0 items-center gap-1.5">
              <span className="text-gray-500">{shortLabel}:</span>
              {isConfigured ? (
                <span className="truncate font-semibold text-emerald-400" title={k.maskedValue}>
                  {k.maskedValue}
                </span>
              ) : (
                <span className="text-amber-400/80">未配置</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Toggle checked={Boolean(enabled)} disabled={!canWrite} onChange={onToggleEnabled} label="前台展示" />
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
            disabled={testing}
            onClick={runTest}
            title="测试连接 / 网关可达性探针"
            className="inline-flex size-7 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-gray-300 transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand active:scale-[0.96] disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${testing ? 'animate-spin text-brand' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setMessage('');
              setFormOpen(true);
            }}
            className="inline-flex h-7 items-center rounded-full border border-brand/30 bg-brand/10 px-3 text-label font-medium text-brand transition hover:bg-brand/20 active:scale-[0.96]"
          >
            配置密钥 / 轮换
          </button>
        </div>
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label={`${provider.name} 凭证配置`}
          onClick={() => {
            // 已录入凭证时不响应空白点击，避免误触丢掉粘贴进来的密钥
            if (Object.keys(secretValues).length === 0) setFormOpen(false);
          }}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.12] bg-surface-raised p-5 shadow-modal animate-fade-in custom-scrollbar"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-2.5 border-b border-white/[0.08] pb-3.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                <ProviderIcon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-card-title text-white">{provider.name}</h4>
                <p className="mt-0.5 text-caption text-gray-500">{provider.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="关闭"
                className="shrink-0 rounded p-1 text-gray-500 transition hover:bg-white/[0.06] hover:text-gray-200"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-black/20 px-3 py-1">
              <MetaRow label="授权规范">
                <span className="font-mono text-gray-200">{provider.mode}</span>
              </MetaRow>
              <MetaRow label="密钥安全机制">
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="size-3.5" />
                  写入式（AES-256-GCM 不可反显）
                </span>
              </MetaRow>
              {consoleLink && (
                <MetaRow label="凭证申请平台">
                  <a
                    href={consoleLink.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-gray-300 transition hover:text-brand"
                  >
                    {consoleLink.label}
                    <ExternalLink className="size-3 text-gray-500" />
                  </a>
                </MetaRow>
              )}
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-gray-500">授权回调重定向地址 (Redirect URI)</span>
                <button
                  type="button"
                  onClick={handleCopyUri}
                  className="inline-flex items-center gap-1 text-caption font-semibold text-brand transition hover:underline"
                >
                  {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  {copied ? '已复制' : '一键复制'}
                </button>
              </div>
              <code className="mt-1.5 block break-all rounded-lg border border-white/[0.06] bg-black/30 px-2.5 py-1.5 font-mono text-caption text-gray-300 select-all">
                {fullRedirectUri}
              </code>
              {provider.callbackHint && (
                <p className="mt-1.5 text-caption leading-4 text-gray-500">{provider.callbackHint}</p>
              )}
              {provider.id === 'douyin' && (
                <div className="mt-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-200/90 leading-relaxed">
                  <div className="font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                    <span>⚠️ 抖音开放平台“非法重定向链接”排查建议</span>
                  </div>
                  <p>
                    抖音严格比对发起授权的地址与开放平台【开发配置 ➔ 授权回调地址】。抖音支持添加最多 10 条地址，强烈建议在开放平台同时添加以下两条（带与不带 www）：
                  </p>
                  <div className="mt-2 space-y-1 font-mono text-[11px] text-white/90">
                    <div className="bg-black/40 px-2 py-1 rounded border border-white/10 select-all">https://www.supdance.com/api/auth/oauth/douyin/callback</div>
                    <div className="bg-black/40 px-2 py-1 rounded border border-white/10 select-all">https://supdance.com/api/auth/oauth/douyin/callback</div>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveSecrets} className="mt-4 space-y-3">
              <p className="text-label font-semibold text-brand">凭证托管录入（加密存盘后不可反显）</p>

              {keyDefs.map((keyDef) => {
                const hasConfigured = Boolean(keyDef.configured);
                const isSecret = keyDef.isSecret !== false;
                const inputType = !isSecret || showPlaintext[keyDef.name] ? 'text' : 'password';

                return (
                  <div key={keyDef.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-body-sm font-medium text-gray-400">{keyDef.label}</label>
                      {hasConfigured && (
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-caption text-emerald-400">
                          <CheckCircle2 className="size-2.5" />
                          已托管存盘
                        </span>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type={inputType}
                        value={effectiveValue(keyDef)}
                        onChange={(event) =>
                          setSecretValues((prev) => ({ ...prev, [keyDef.name]: event.target.value }))
                        }
                        placeholder={
                          hasConfigured
                            ? isSecret
                              ? keyDef.maskedValue
                                ? `${keyDef.maskedValue} (留空保持现有凭证，输入新值覆盖)`
                                : '•••••••••••••••• (留空保持现有凭证，输入新值覆盖)'
                              : keyDef.placeholder || '输入新值覆盖'
                            : keyDef.placeholder || '请输入凭证明文…'
                        }
                        className="h-[38px] w-full rounded-lg border border-white/[0.10] bg-black/30 px-3 pr-9 font-mono text-body-sm text-gray-100 outline-none transition placeholder:text-gray-600 focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
                      />
                      {isSecret && (
                        <button
                          type="button"
                          onClick={() => setShowPlaintext((prev) => ({ ...prev, [keyDef.name]: !prev[keyDef.name] }))}
                          title={showPlaintext[keyDef.name] ? '隐藏明文' : '查看明文'}
                          className="absolute right-2 p-1 text-gray-500 transition hover:text-gray-200"
                        >
                          {showPlaintext[keyDef.name] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                      )}
                    </div>

                    {hasConfigured && keyDef.updatedAt && (
                      <p className="text-caption text-ink-subtle">
                        {`上次更新时间：${formatUpdatedAt(keyDef.updatedAt)}`}
                      </p>
                    )}
                  </div>
                );
              })}

              {message && (
                <div
                  className={`rounded-lg border p-2.5 text-center text-body-sm font-medium ${
                    isSuccess
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}
                >
                  {message}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    setMessage('');
                  }}
                  className="inline-flex h-8 items-center rounded-full border border-white/[0.10] px-3.5 text-body-sm font-medium text-gray-400 transition hover:bg-white/[0.06] hover:text-gray-200 active:scale-[0.98]"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-8 items-center rounded-full bg-brand px-4 text-body-sm font-semibold text-white transition hover:bg-brand-hover active:scale-[0.98] disabled:opacity-50"
                >
                  {busy ? '正在加密保存…' : '安全提交凭证'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
