'use client';

import { useState } from 'react';
import { Card, StatusBadge } from '@/components/admin/AdminUi';

const SECRET_FIELDS = {
  tencent_sms: [
    ['secret_id', 'Tencent SecretId'],
    ['secret_key', 'Tencent SecretKey'],
  ],
  aliyun_sms: [
    ['access_key_id', 'Aliyun AccessKey ID'],
    ['access_key_secret', 'Aliyun AccessKey Secret'],
  ],
  tencent_captcha: [
    ['secret_id', 'Captcha SecretId'],
    ['secret_key', 'Captcha SecretKey'],
    ['app_secret_key', 'Captcha App SecretKey'],
  ],
};

const STATUS_LABELS = {
  healthy: ['Healthy', 'good'],
  degraded: ['Degraded', 'warn'],
  unavailable: ['Unavailable', 'danger'],
  disabled: ['Disabled', 'neutral'],
  not_checked: ['Not checked', 'neutral'],
  configured: ['Configured', 'info'],
};

function statusBadge(status) {
  const [label, tone] = STATUS_LABELS[status] || [status || 'Unknown', 'neutral'];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || payload?.error || '请求失败');
  return payload.data ?? payload;
}

export default function SmsProvidersClient({ initial, canWrite = false }) {
  const [overview, setOverview] = useState(initial);
  const [providers, setProviders] = useState(initial.settings.providers);
  const [chinaRoute, setChinaRoute] = useState(initial.routes.china);
  const [secrets, setSecrets] = useState({
    tencent_sms: { secret_id: '', secret_key: '' },
    aliyun_sms: { access_key_id: '', access_key_secret: '' },
    tencent_captcha: { secret_id: '', secret_key: '', app_secret_key: '' },
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testProvider, setTestProvider] = useState('tencent_sms');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const updateProvider = (provider, field, value) => {
    setProviders((current) => ({
      ...current,
      [provider]: { ...current[provider], [field]: value },
    }));
  };

  const updateSecret = (provider, name, value) => {
    setSecrets((current) => ({
      ...current,
      [provider]: { ...current[provider], [name]: value },
    }));
  };

  const saveConfiguration = async (event) => {
    event.preventDefault();
    setBusy('configuration');
    setMessage('');
    try {
      const response = await fetch('/api/admin/providers/sms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ providers, routing: { china: chinaRoute } }),
      });
      const result = await readResponse(response);
      setOverview(result);
      setProviders(result.settings.providers);
      setChinaRoute(result.routes.china);
      setMessage('短信路由配置已保存');
    } catch (error) {
      setMessage(error.message || '短信路由配置保存失败');
    } finally {
      setBusy('');
    }
  };

  const saveSecrets = async (event) => {
    event.preventDefault();
    if (!adminPassword) {
      setMessage('请输入当前管理员密码进行二次确认');
      return;
    }
    setBusy('secrets');
    setMessage('');
    try {
      const response = await fetch('/api/admin/providers/sms/secrets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ secrets, adminPassword }),
      });
      await readResponse(response);
      setSecrets({
        tencent_sms: { secret_id: '', secret_key: '' },
        aliyun_sms: { access_key_id: '', access_key_secret: '' },
        tencent_captcha: { secret_id: '', secret_key: '', app_secret_key: '' },
      });
      setAdminPassword('');
      setMessage('新密钥已加密保存；明文不会回显。');
      const refreshed = await readResponse(await fetch('/api/admin/providers/sms', { cache: 'no-store' }));
      setOverview(refreshed);
    } catch (error) {
      setMessage(error.message || '短信密钥保存失败');
    } finally {
      setBusy('');
    }
  };

  const runHealthCheck = async (provider) => {
    setBusy(`health:${provider}`);
    setMessage('');
    try {
      const response = await fetch('/api/admin/providers/sms/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ provider }),
      });
      const result = await readResponse(response);
      setMessage(`${provider} 健康探针完成：${result.status}${result.latencyMs == null ? '' : `（${result.latencyMs} ms）`}`);
      const refreshed = await readResponse(await fetch('/api/admin/providers/sms', { cache: 'no-store' }));
      setOverview(refreshed);
    } catch (error) {
      setMessage(error.message || '健康检查失败');
    } finally {
      setBusy('');
    }
  };

  const sendTestSms = async (event) => {
    event.preventDefault();
    if (!window.confirm(`将通过 ${testProvider} 向 ${testPhone} 发送一条真实测试短信，可能产生费用。继续吗？`)) return;
    setBusy('test');
    setMessage('');
    try {
      const response = await fetch('/api/admin/providers/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ provider: testProvider, phone: testPhone }),
      });
      const result = await readResponse(response);
      setMessage(result.message || '供应商已接受测试短信请求');
      const refreshed = await readResponse(await fetch('/api/admin/providers/sms', { cache: 'no-store' }));
      setOverview(refreshed);
    } catch (error) {
      setMessage(error.message || '测试短信发送失败');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-5">
      {message && (
        <div role="status" className="rounded-xl border border-line bg-wash px-4 py-3 text-body text-ink">
          {message}
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-card-title text-ink">短信路由</h2>
            <p className="mt-1 text-body-sm text-ink-muted">+86 只使用国内短信；其他区号由服务端路由到 Firebase Phone Auth。</p>
          </div>
          {canWrite && (
            <button type="submit" form="sms-routing-form" disabled={Boolean(busy)} className="h-9 rounded-lg bg-brand-active px-4 text-label text-ink-on-accent hover:bg-brand disabled:opacity-50">
              {busy === 'configuration' ? '保存中…' : '保存路由'}
            </button>
          )}
        </div>
        <form id="sms-routing-form" onSubmit={saveConfiguration} className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-label text-ink-muted">
            +86 主线路
            <select value={chinaRoute.primary} disabled={!canWrite} onChange={(event) => setChinaRoute((route) => ({ ...route, primary: event.target.value, fallback: route.fallback === event.target.value ? null : route.fallback }))} className="h-9 rounded-lg border border-line bg-canvas px-3 text-ink">
              <option value="tencent_sms">Tencent SMS</option>
              <option value="aliyun_sms">Aliyun SMS</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-label text-ink-muted">
            +86 备用线路
            <select value={chinaRoute.fallback || ''} disabled={!canWrite} onChange={(event) => setChinaRoute((route) => ({ ...route, fallback: event.target.value || null }))} className="h-9 rounded-lg border border-line bg-canvas px-3 text-ink">
              <option value="">不启用备用线路</option>
              {['tencent_sms', 'aliyun_sms'].filter((item) => item !== chinaRoute.primary).map((item) => <option key={item} value={item}>{item === 'tencent_sms' ? 'Tencent SMS' : 'Aliyun SMS'}</option>)}
            </select>
          </label>
          <div className="flex flex-col gap-1.5 text-label text-ink-muted">
            国际手机号主线路
            <div className="flex h-9 items-center rounded-lg border border-line bg-canvas px-3 text-ink">Firebase Phone Authentication</div>
          </div>
          <div className="grid gap-3 border-t border-line-subtle pt-4 md:col-span-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['tencent_sms', 'sdkAppId', 'Tencent SMS SDK App ID'],
              ['tencent_sms', 'signName', 'Tencent SMS 签名'],
              ['tencent_sms', 'templateId', 'Tencent SMS 模板 ID'],
              ['aliyun_sms', 'signName', 'Aliyun SMS 签名'],
              ['aliyun_sms', 'templateId', 'Aliyun SMS 模板 Code'],
              ['firebase_phone', 'apiKey', 'Firebase Web API Key（公开配置）'],
              ['firebase_phone', 'authDomain', 'Firebase Auth Domain'],
              ['firebase_phone', 'projectId', 'Firebase Project ID'],
              ['firebase_phone', 'appId', 'Firebase Web App ID'],
              ['tencent_captcha', 'appId', 'Tencent CAPTCHA App ID'],
            ].map(([provider, field, label]) => (
              <label key={`${provider}-${field}`} className="text-label text-ink-muted">
                {label}
                <input
                  type="text"
                  value={providers[provider]?.[field] || ''}
                  disabled={!canWrite}
                  onChange={(event) => updateProvider(provider, field, event.target.value)}
                  className="mt-1 h-8 w-full rounded-lg border border-line bg-canvas px-2.5 text-label text-ink disabled:opacity-60"
                />
              </label>
            ))}
          </div>
          {['tencent_sms', 'aliyun_sms', 'firebase_phone', 'tencent_captcha'].map((provider) => (
            <label key={provider} className="flex items-center gap-2 text-label text-ink">
              <input type="checkbox" checked={providers[provider]?.enabled !== false} disabled={!canWrite} onChange={(event) => updateProvider(provider, 'enabled', event.target.checked)} />
              启用 {provider === 'tencent_sms' ? 'Tencent SMS' : provider === 'aliyun_sms' ? 'Aliyun SMS' : provider === 'firebase_phone' ? 'Firebase Phone' : 'Tencent CAPTCHA'}
            </label>
          ))}
        </form>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {overview.providers.map((provider) => (
          <Card key={provider.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-label uppercase text-brand">{provider.region}</p>
                <h3 className="mt-1 text-card-title text-ink">{provider.name}</h3>
              </div>
              {statusBadge(provider.status)}
            </div>
            <dl className="mt-4 space-y-2 text-label">
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">配置</dt><dd className="text-right text-ink">{provider.configured ? '凭据与参数已配置' : '待配置'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">路由级别</dt><dd className="text-right text-ink">{provider.priority || '备用未启用'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">24 小时成功率</dt><dd className="text-right text-ink">{provider.metrics24h.successRate == null ? '暂无真实请求' : `${provider.metrics24h.successRate}% (${provider.metrics24h.successes}/${provider.metrics24h.attempts})`}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">平均成功延迟</dt><dd className="text-right text-ink">{provider.metrics24h.averageLatencyMs == null ? '—' : `${provider.metrics24h.averageLatencyMs} ms`}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">最近健康探针</dt><dd className="text-right text-ink">{dateLabel(provider.lastHealthCheck)}{provider.lastHealthLatencyMs == null ? '' : ` · ${provider.lastHealthLatencyMs} ms`}</dd></div>
              {provider.lastHealthError && <div className="flex justify-between gap-3"><dt className="text-ink-muted">最近内部错误码</dt><dd className="text-right text-warning">{provider.lastHealthError}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">密钥</dt><dd className="text-right text-ink">{Object.values(provider.secretConfigured || {}).filter(Boolean).length} 项已配置</dd></div>
            </dl>
            <div className="mt-4 border-t border-line-subtle pt-3">
              <button type="button" disabled={Boolean(busy)} onClick={() => runHealthCheck(provider.id)} className="h-8 rounded-lg border border-line bg-wash px-3 text-label text-ink hover:bg-wash-strong disabled:opacity-50">
                {busy === `health:${provider.id}` ? '探测中…' : '运行真实健康探针'}
              </button>
            </div>
          </Card>
        ))}
      </div>

      {canWrite && (
        <Card>
          <h2 className="text-card-title text-ink">服务端短信凭据</h2>
          <p className="mt-1 text-body-sm text-ink-muted">空白字段保持不变。密钥只写入 AES-GCM 加密存储，不会回显或传入浏览器配置；保存需要管理员密码二次确认。</p>
          <form onSubmit={saveSecrets} className="mt-4 space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
              {Object.entries(SECRET_FIELDS).map(([provider, fields]) => (
                <div key={provider} className="rounded-xl border border-line-subtle bg-canvas/70 p-3">
                  <h3 className="mb-3 text-label text-ink">{provider}</h3>
                  {fields.map(([name, label]) => (
                    <label key={name} className="mb-2 block text-label text-ink-muted">
                      {label}
                      <input type="password" autoComplete="new-password" value={secrets[provider][name]} onChange={(event) => updateSecret(provider, name, event.target.value)} placeholder="只写入，不可反显" className="mt-1 h-8 w-full rounded-lg border border-line bg-base px-2.5 text-label text-ink placeholder:text-ink-subtle" />
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-0 flex-1 text-label text-ink-muted">当前管理员密码
                <input type="password" required autoComplete="current-password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-3 text-body text-ink" />
              </label>
              <button type="submit" disabled={Boolean(busy)} className="h-9 rounded-lg border border-brand-line bg-brand-soft px-4 text-label text-brand-hover disabled:opacity-50">{busy === 'secrets' ? '加密保存中…' : '加密保存新密钥'}</button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-card-title text-ink">大陆风险验证</h2>
            <p className="mt-1 text-body-sm text-ink-muted">低风险 +86 请求直接发送；高频/异常请求才触发腾讯云 Web Challenge。Cloudflare Turnstile 不作为大陆依赖。</p>
          </div>
          {statusBadge(overview.riskCaptcha.status)}
        </div>
        <p className="mt-3 text-label text-ink-muted">App ID：<span className="text-mono text-ink">{overview.riskCaptcha.appId || '待配置'}</span></p>
        <p className="mt-1 text-label text-ink-muted">后台票据校验密钥配置：{Object.values(overview.riskCaptcha.secretConfigured || {}).filter(Boolean).length} 项</p>
      </Card>

      {canWrite && (
        <Card>
          <h2 className="text-card-title text-ink">发送测试短信</h2>
          <p className="mt-1 text-body-sm text-warning">该操作会向目标号码实际发送一条短信并可能产生费用；只对腾讯/阿里国内短信开放。</p>
          <form onSubmit={sendTestSms} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-label text-ink-muted">Provider
              <select value={testProvider} onChange={(event) => setTestProvider(event.target.value)} className="mt-1 block h-9 rounded-lg border border-line bg-canvas px-3 text-body text-ink">
                <option value="tencent_sms">Tencent SMS</option>
                <option value="aliyun_sms">Aliyun SMS</option>
              </select>
            </label>
            <label className="min-w-0 flex-1 text-label text-ink-muted">中国大陆手机号
              <input type="tel" required value={testPhone} onChange={(event) => setTestPhone(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-3 text-body text-ink" />
            </label>
            <button type="submit" disabled={Boolean(busy)} className="h-9 rounded-lg border border-line bg-wash px-4 text-label text-ink disabled:opacity-50">{busy === 'test' ? '发送中…' : '发送真实测试短信'}</button>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="text-card-title text-ink">最近短信投递日志</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-full text-left text-label">
            <thead className="border-b border-line text-ink-muted">
              <tr><th className="px-3 py-2">时间</th><th className="px-3 py-2">Provider</th><th className="px-3 py-2">手机号（脱敏）</th><th className="px-3 py-2">国家</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">延迟</th><th className="px-3 py-2">错误码</th></tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {overview.recentLogs.map((row, index) => (
                <tr key={`${row.provider}-${row.created_at}-${index}`}>
                  <td className="px-3 py-2.5 text-ink-muted">{dateLabel(row.created_at)}</td>
                  <td className="px-3 py-2.5 text-ink">{row.provider}</td>
                  <td className="px-3 py-2.5 font-mono text-ink">{row.masked_phone}</td>
                  <td className="px-3 py-2.5 text-ink">{row.country}</td>
                  <td className="px-3 py-2.5">{statusBadge(row.status === 'success' ? 'healthy' : 'degraded')}</td>
                  <td className="px-3 py-2.5 text-ink">{row.latency_ms == null ? '—' : `${row.latency_ms} ms`}</td>
                  <td className="px-3 py-2.5 text-warning">{row.error_code || '—'}</td>
                </tr>
              ))}
              {overview.recentLogs.length === 0 && <tr><td colSpan={7} className="px-3 py-7 text-center text-ink-muted">暂无真实短信投递记录</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
