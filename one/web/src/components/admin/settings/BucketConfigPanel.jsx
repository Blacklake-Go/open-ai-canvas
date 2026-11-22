'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CloudCog,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import { StatusBadge } from '@/components/admin/AdminUi';

const INPUT_CLASS =
  'w-full rounded-xl border border-line bg-base px-3.5 py-2.5 text-body text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-brand disabled:cursor-not-allowed disabled:opacity-50';
const LABEL_CLASS = 'mb-1.5 block text-label font-medium text-ink-muted';
const PRIMARY_BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-label font-semibold text-white transition-all hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40';
const SECONDARY_BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white/[0.04] px-3.5 text-label font-semibold text-ink-muted transition-colors hover:bg-white/[0.08] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40';

const ACL_LABELS = {
  private: '私有读写',
  'public-read': '公有读私有写',
  'public-read-write': '公有读写',
};

const RECOMMENDED_CORS = {
  rules: [
    {
      id: 'supdance-web',
      allowedOrigins: ['https://supdance.com', 'https://*.supdance.com'],
      allowedMethods: ['GET', 'HEAD'],
      allowedHeaders: ['*'],
      exposeHeaders: ['ETag', 'Content-Length', 'x-cos-request-id'],
      maxAgeSeconds: 600,
    },
  ],
};

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { hour12: false });
}

function jsonFrom(value) {
  return JSON.stringify(value, null, 2);
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}不是合法 JSON`);
  }
}

function draftsFromConfig(config = {}) {
  return {
    acl: config.acl?.cannedAcl || 'private',
    versioning: config.versioning?.status || 'Suspended',
    encryption: config.encryption
      ? {
        enabled: Boolean(config.encryption.enabled),
        algorithm: config.encryption.algorithm || 'AES256',
        kmsMasterKeyId: config.encryption.kmsMasterKeyId || '',
      }
      : { enabled: false, algorithm: 'AES256', kmsMasterKeyId: '' },
    referer: config.referer
      ? {
        enabled: config.referer.status === 'Enabled',
        allowEmpty: config.referer.allowEmpty !== false,
        domainsText: (config.referer.domains || []).join('\n'),
      }
      : { enabled: false, allowEmpty: true, domainsText: '' },
    corsText: jsonFrom({ rules: config.cors?.rules || [] }),
    lifecycleText: jsonFrom({ rules: config.lifecycle?.rules || [] }),
    policyText: config.policy?.document ? jsonFrom(config.policy.document) : '',
  };
}

function SectionCard({ title, description, badge, children, footer }) {
  return (
    <div className="rounded-xl border border-line-subtle bg-surface/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-card-title font-semibold text-ink">{title}</h3>
          <p className="mt-0.5 text-caption leading-5 text-ink-subtle">{description}</p>
        </div>
        {badge}
      </div>
      <div className="mt-3">{children}</div>
      {footer && <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-line-subtle pt-3">{footer}</div>}
    </div>
  );
}

function FieldFeedback({ feedback }) {
  if (!feedback?.message) return null;
  const tone = feedback.type === 'error'
    ? 'text-danger'
    : feedback.type === 'warning' ? 'text-warning' : 'text-success';
  return <span className={`text-caption font-medium ${tone}`} role="status">{feedback.message}</span>;
}

export default function BucketConfigPanel({ canWrite = false }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState({ section: '', type: '', message: '' });
  const [credentials, setCredentials] = useState({ accessKeyId: '', accessKeySecret: '' });
  const [drafts, setDrafts] = useState(() => draftsFromConfig({}));

  const config = overview?.config || null;
  const configured = Boolean(overview?.configured);

  function hydrate(next) {
    setOverview(next);
    setDrafts(draftsFromConfig(next?.config || {}));
  }

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/admin/storage/bucket', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || '桶级配置读取失败');
      hydrate(data.data);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function post(payload) {
    const res = await fetch('/api/admin/storage/bucket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || '请求失败');
    return data.data;
  }

  function updateDraft(name, value) {
    setDrafts((prev) => ({ ...prev, [name]: value }));
  }

  function report(section, type, message) {
    setFeedback({ section, type, message });
  }

  async function saveCredentials() {
    if (!canWrite) return;
    setBusy('credentials');
    report('credentials', '', '');
    try {
      const data = await post({ action: 'credentials.save', ...credentials });
      setCredentials({ accessKeyId: '', accessKeySecret: '' });
      hydrate(data.overview);
      report('credentials', 'success', '桶级管理密钥已校验并加密保存。');
    } catch (error) {
      report('credentials', 'error', error.message);
    } finally {
      setBusy('');
    }
  }

  async function saveSection(section, value) {
    if (!canWrite) return;
    setBusy(section);
    report(section, '', '');
    try {
      const data = await post({ action: 'config.update', section, value });
      const next = data.overview;
      setOverview(next);
      setDrafts(draftsFromConfig(next?.config || {}));
      report(section, 'success', '已写入存储桶并重新读取确认。');
    } catch (error) {
      report(section, 'error', error.message);
    } finally {
      setBusy('');
    }
  }

  function saveJsonSection(section, text, label, normalize) {
    let parsed;
    try {
      parsed = normalize(parseJson(text, label));
    } catch (error) {
      report(section, 'error', error.message);
      return;
    }
    saveSection(section, parsed);
  }

  const sectionFooter = (section, onClick, label = '保存到存储桶', disabled = false) => (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={!canWrite || Boolean(busy) || disabled}
        className={PRIMARY_BUTTON}
      >
        <Save className="size-3.5" />
        {busy === section ? '写入中…' : label}
      </button>
      <FieldFeedback feedback={feedback.section === section ? feedback : null} />
    </>
  );

  return (
    <section className="rounded-2xl border border-line-subtle bg-surface-raised p-5 shadow-elevation-1">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-subtle pb-3">
        <div>
          <h2 className="flex items-center gap-2 text-body font-semibold text-ink">
            <CloudCog className="size-4 text-brand" /> 桶级配置（腾讯云 COS）
          </h2>
          <p className="mt-0.5 text-caption text-ink-subtle">
            通过 COS API 直接读写当前存储桶的 ACL、CORS、版本控制、加密、防盗链、生命周期与桶策略。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!canWrite && <StatusBadge tone="warn">只读权限</StatusBadge>}
          {overview?.supported && (
            <StatusBadge tone={configured ? 'good' : 'warn'}>
              {configured ? '管理通道已连接' : '待配置管理密钥'}
            </StatusBadge>
          )}
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-8 text-caption text-ink-muted">
          <Loader2 className="size-4 animate-spin text-brand" /> 正在读取桶级配置…
        </p>
      ) : loadError ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-line bg-danger-soft px-4 py-3">
          <p className="flex items-center gap-2 text-caption font-medium text-danger">
            <AlertCircle className="size-4" /> {loadError}
          </p>
          <button type="button" onClick={load} className={SECONDARY_BUTTON}>
            <RefreshCw className="size-3.5" /> 重试
          </button>
        </div>
      ) : !overview?.supported ? (
        <p className="mt-4 rounded-xl border border-line-subtle bg-surface/60 px-4 py-3 text-body-sm text-ink-muted">
          {overview?.reason || '当前生效存储不支持桶级配置。'}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-line-subtle bg-surface/60 px-4 py-3 text-caption text-ink-subtle">
            <span>读取地址：<span className="font-mono text-ink-muted">{config?.host || overview.target?.bucket || '—'}</span></span>
            <span>Bucket：<span className="text-ink-muted">{overview.target?.bucket || '—'}</span></span>
            <span>Region：<span className="text-ink-muted">{overview.target?.region || '—'}</span></span>
            {config?.fetchedAt && <span>读取时间：{formatTime(config.fetchedAt)}</span>}
          </div>

          {overview.error && (
            <p className="flex items-center gap-2 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-caption font-medium text-warning">
              <AlertCircle className="size-4" /> {overview.error}
            </p>
          )}

          {config?.errors && Object.keys(config.errors).length > 0 && (
            <div className="rounded-xl border border-warning-line bg-warning-soft px-4 py-3">
              <p className="flex items-center gap-2 text-caption font-medium text-warning">
                <AlertCircle className="size-4" /> 部分配置读取失败
              </p>
              <ul className="mt-1 space-y-0.5 pl-6 text-caption text-warning">
                {Object.entries(config.errors).map(([section, message]) => (
                  <li key={section} className="list-disc break-all">{section}：{message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-line-subtle bg-surface/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-1.5 text-card-title font-semibold text-ink">
                  <KeyRound className="size-4 text-brand" /> 桶级管理密钥
                </h3>
                <p className="mt-0.5 text-caption leading-5 text-ink-subtle">
                  使用具备桶级管理权限的子账号密钥，与运行时上传密钥分开保存；Secret 以 AES-256-GCM 加密落库，不再回传明文。
                </p>
              </div>
              {overview.credentials?.hasAccessKeySecret ? (
                <StatusBadge tone="good">已加密保存 · {overview.credentials.accessKeyIdMasked || '已配置'}</StatusBadge>
              ) : (
                <StatusBadge tone="warn">未配置</StatusBadge>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={LABEL_CLASS} htmlFor="bucket-admin-key-id">Access Key ID</label>
                <input
                  id="bucket-admin-key-id"
                  type="text"
                  autoComplete="off"
                  value={credentials.accessKeyId}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, accessKeyId: event.target.value }))}
                  disabled={!canWrite}
                  placeholder={configured ? '留空沿用已保存的 Key ID' : '请输入桶级管理 Access Key ID'}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="bucket-admin-key-secret">Access Key Secret</label>
                <input
                  id="bucket-admin-key-secret"
                  type="password"
                  autoComplete="new-password"
                  value={credentials.accessKeySecret}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, accessKeySecret: event.target.value }))}
                  disabled={!canWrite}
                  placeholder={configured ? '留空沿用已保存的 Secret' : '请输入桶级管理 Access Key Secret'}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-line-subtle pt-3">
              <button
                type="button"
                onClick={saveCredentials}
                disabled={!canWrite || Boolean(busy) || (!configured && (!credentials.accessKeyId || !credentials.accessKeySecret)) || (configured && !credentials.accessKeyId && !credentials.accessKeySecret)}
                className={PRIMARY_BUTTON}
              >
                <ShieldCheck className="size-3.5" />
                {busy === 'credentials' ? '校验中…' : '校验并保存密钥'}
              </button>
              <FieldFeedback feedback={feedback.section === 'credentials' ? feedback : null} />
            </div>
          </div>

          {!configured ? (
            <p className="rounded-xl border border-line-subtle bg-surface/60 px-4 py-3 text-body-sm text-ink-muted">
              保存密钥后即可读取并修改下方桶级配置。
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SectionCard
                  title="访问权限（ACL）"
                  description="控制匿名访问者的读写能力；私有读写是推荐值。"
                  badge={config?.acl ? <StatusBadge tone={config.acl.cannedAcl === 'private' ? 'good' : 'warn'}>{ACL_LABELS[config.acl.cannedAcl] || config.acl.cannedAcl}</StatusBadge> : null}
                  footer={sectionFooter('acl', () => saveSection('acl', { cannedAcl: drafts.acl }))}
                >
                  <select
                    aria-label="存储桶访问权限"
                    value={drafts.acl}
                    onChange={(event) => updateDraft('acl', event.target.value)}
                    disabled={!canWrite}
                    className={INPUT_CLASS}
                  >
                    {Object.entries(ACL_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </SectionCard>

                <SectionCard
                  title="版本控制"
                  description="保留对象历史版本，防止覆盖或误删；历史版本会占用存储。"
                  badge={config?.versioning ? <StatusBadge tone={config.versioning.status === 'Enabled' ? 'good' : 'neutral'}>{config.versioning.status === 'Enabled' ? '已开启' : '已暂停'}</StatusBadge> : <StatusBadge tone="neutral">未配置</StatusBadge>}
                  footer={sectionFooter('versioning', () => saveSection('versioning', { status: drafts.versioning }))}
                >
                  <select
                    aria-label="存储桶版本控制状态"
                    value={drafts.versioning}
                    onChange={(event) => updateDraft('versioning', event.target.value)}
                    disabled={!canWrite}
                    className={INPUT_CLASS}
                  >
                    <option value="Enabled">开启</option>
                    <option value="Suspended">暂停</option>
                  </select>
                </SectionCard>

                <SectionCard
                  title="服务端加密"
                  description="写入对象时由 COS 自动加密，读取时透明解密。"
                  badge={config?.encryption?.enabled ? <StatusBadge tone="good">{config.encryption.algorithm}</StatusBadge> : <StatusBadge tone="neutral">未启用</StatusBadge>}
                  footer={sectionFooter('encryption', () => saveSection('encryption', drafts.encryption))}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <select
                      aria-label="服务端加密状态"
                      value={drafts.encryption.enabled ? drafts.encryption.algorithm : 'none'}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateDraft('encryption', value === 'none'
                          ? { ...drafts.encryption, enabled: false }
                          : { ...drafts.encryption, enabled: true, algorithm: value });
                      }}
                      disabled={!canWrite}
                      className={INPUT_CLASS}
                    >
                      <option value="none">不启用</option>
                      <option value="AES256">SSE-COS（AES256）</option>
                      <option value="aws:kms">SSE-KMS</option>
                    </select>
                    {drafts.encryption.enabled && drafts.encryption.algorithm === 'aws:kms' && (
                      <input
                        type="text"
                        aria-label="KMS 主密钥 ID"
                        value={drafts.encryption.kmsMasterKeyId}
                        onChange={(event) => updateDraft('encryption', { ...drafts.encryption, kmsMasterKeyId: event.target.value })}
                        disabled={!canWrite}
                        placeholder="KMS 主密钥 ID"
                        className={INPUT_CLASS}
                      />
                    )}
                  </div>
                </SectionCard>

                <SectionCard
                  title="防盗链 Referer"
                  description="仅允许白名单域名引用；留空域名列表时不启用。"
                  badge={config?.referer?.status === 'Enabled' ? <StatusBadge tone="good">已启用 · {config.referer.domains.length} 个域名</StatusBadge> : <StatusBadge tone="neutral">未启用</StatusBadge>}
                  footer={sectionFooter('referer', () => saveSection('referer', {
                    enabled: drafts.referer.enabled,
                    allowEmpty: drafts.referer.allowEmpty,
                    domains: drafts.referer.domainsText.split('\n').map((item) => item.trim()).filter(Boolean),
                  }), '保存防盗链')}
                >
                  <label className="flex items-center gap-2.5 text-body-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={drafts.referer.enabled}
                      onChange={(event) => updateDraft('referer', { ...drafts.referer, enabled: event.target.checked })}
                      disabled={!canWrite}
                      className="size-4 cursor-pointer rounded border-white/20 bg-black/40 text-brand focus:ring-brand"
                    />
                    启用 Referer 白名单
                  </label>
                  <textarea
                    aria-label="防盗链白名单域名"
                    rows={3}
                    value={drafts.referer.domainsText}
                    onChange={(event) => updateDraft('referer', { ...drafts.referer, domainsText: event.target.value })}
                    disabled={!canWrite || !drafts.referer.enabled}
                    placeholder={'supdance.com\n*.supdance.com'}
                    className={`${INPUT_CLASS} mt-2 resize-y font-mono`}
                  />
                  <label className="mt-2 flex items-center gap-2.5 text-body-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={drafts.referer.allowEmpty}
                      onChange={(event) => updateDraft('referer', { ...drafts.referer, allowEmpty: event.target.checked })}
                      disabled={!canWrite}
                      className="size-4 cursor-pointer rounded border-white/20 bg-black/40 text-brand focus:ring-brand"
                    />
                    允许空 Referer（浏览器直接打开）
                  </label>
                </SectionCard>
              </div>

              <SectionCard
                title="跨域资源共享（CORS）"
                description="浏览器直连读取或预检时需要；推荐仅放行站点域名与 GET/HEAD。"
                badge={config?.cors ? <StatusBadge tone={config.cors.rules.length ? 'good' : 'neutral'}>{config.cors.rules.length} 条规则</StatusBadge> : <StatusBadge tone="neutral">未配置</StatusBadge>}
                footer={(
                  <>
                    {sectionFooter('cors', () => saveJsonSection('cors', drafts.corsText, 'CORS 配置', (parsed) => {
                      if (!Array.isArray(parsed?.rules) || !parsed.rules.length) throw new Error('CORS 至少需要一条规则');
                      return parsed;
                    }))}
                    <button
                      type="button"
                      onClick={() => updateDraft('corsText', jsonFrom(RECOMMENDED_CORS))}
                      disabled={!canWrite || Boolean(busy)}
                      className={SECONDARY_BUTTON}
                    >
                      <Wand2 className="size-3.5" /> 填入站点推荐规则
                    </button>
                  </>
                )}
              >
                <textarea
                  aria-label="CORS 规则 JSON"
                  rows={10}
                  value={drafts.corsText}
                  onChange={(event) => updateDraft('corsText', event.target.value)}
                  disabled={!canWrite}
                  spellCheck={false}
                  className={`${INPUT_CLASS} resize-y font-mono leading-5`}
                />
              </SectionCard>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SectionCard
                  title="生命周期"
                  description="按前缀清理过期对象或中断的未完成分片上传；规则为空表示删除生命周期配置。"
                  badge={config?.lifecycle ? <StatusBadge tone="neutral">{config.lifecycle.rules.length} 条规则</StatusBadge> : <StatusBadge tone="neutral">未配置</StatusBadge>}
                  footer={sectionFooter('lifecycle', () => saveJsonSection('lifecycle', drafts.lifecycleText, '生命周期配置', (parsed) => {
                    if (!Array.isArray(parsed?.rules)) throw new Error('生命周期配置需要 rules 数组');
                    return parsed;
                  }), '保存生命周期')}
                >
                  <textarea
                    aria-label="生命周期规则 JSON"
                    rows={8}
                    value={drafts.lifecycleText}
                    onChange={(event) => updateDraft('lifecycleText', event.target.value)}
                    disabled={!canWrite}
                    spellCheck={false}
                    className={`${INPUT_CLASS} resize-y font-mono leading-5`}
                  />
                </SectionCard>

                <SectionCard
                  title="桶策略"
                  description="允许匿名读取或限制来源 IP 时使用；清空内容会删除桶策略。"
                  badge={config?.policy ? <StatusBadge tone="neutral">{config.policy.statementCount} 条 statement</StatusBadge> : <StatusBadge tone="neutral">未配置</StatusBadge>}
                  footer={sectionFooter('policy', () => {
                    if (!drafts.policyText.trim()) {
                      saveSection('policy', null);
                      return;
                    }
                    saveJsonSection('policy', drafts.policyText, '桶策略', (parsed) => {
                      if (!Array.isArray(parsed?.statement) || !parsed.statement.length) throw new Error('桶策略至少包含一条 statement');
                      return { document: parsed };
                    });
                  }, '保存桶策略')}
                >
                  <textarea
                    aria-label="桶策略 JSON"
                    rows={8}
                    value={drafts.policyText}
                    onChange={(event) => updateDraft('policyText', event.target.value)}
                    disabled={!canWrite}
                    spellCheck={false}
                    placeholder="留空表示删除桶策略"
                    className={`${INPUT_CLASS} resize-y font-mono leading-5`}
                  />
                </SectionCard>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-subtle bg-surface/60 px-4 py-3">
                <p className="text-caption text-ink-subtle">
                  所有修改都会先写入 COS，再重新读取确认；历史对象与读取链路不受影响。
                </p>
                <button type="button" onClick={load} disabled={Boolean(busy)} className={SECONDARY_BUTTON}>
                  <RefreshCw className="size-3.5" /> 重新读取
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
