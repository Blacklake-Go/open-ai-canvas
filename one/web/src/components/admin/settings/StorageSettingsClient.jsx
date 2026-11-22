'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Cloud,
  Database,
  HardDrive,
  KeyRound,
  Link2,
  Play,
  PlugZap,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { AdminSettingRow, StatusBadge } from '@/components/admin/AdminUi';
import { providerLabel } from '@/lib/storage/providers';
import BucketConfigPanel from './BucketConfigPanel';

const PHASE_LABELS = {
  assets: '主站资源库',
  creations: '生成记录',
  avatars: '用户头像',
  completed: '已完成',
};

const RUN_STATUS = {
  running: { label: '迁移中', tone: 'info' },
  completed: { label: '已完成', tone: 'good' },
  failed: { label: '失败', tone: 'danger' },
  cancelled: { label: '已取消', tone: 'neutral' },
};

const INPUT_CLASS =
  'w-full rounded-xl border border-line bg-base px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-brand disabled:cursor-not-allowed disabled:opacity-50';
const LABEL_CLASS = 'mb-1.5 block text-caption font-medium text-ink-muted';
const PRIMARY_BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-xs font-semibold text-white transition-all hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40';
const SECONDARY_BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white/[0.04] px-3.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-white/[0.08] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40';
const DANGER_BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40';

function draftFrom(settings = {}) {
  return {
    provider: settings.provider || 'local',
    endpoint: settings.endpoint || '',
    region: settings.region || '',
    bucket: settings.bucket || '',
    pathPrefix: settings.pathPrefix || 'supdance',
    publicBaseUrl: settings.publicBaseUrl || '',
    s3Preset: settings.s3Preset || 'custom',
    pathStyle: Boolean(settings.pathStyle),
    accessKeyId: '',
    accessKeySecret: '',
  };
}

function mergeConfig(saved = {}, draft = {}) {
  return {
    provider: draft.provider,
    enabled: saved.enabled !== false,
    endpoint: draft.endpoint,
    region: draft.region,
    bucket: draft.bucket,
    pathPrefix: draft.pathPrefix,
    publicBaseUrl: draft.publicBaseUrl,
    s3Preset: draft.s3Preset,
    pathStyle: draft.pathStyle,
    signedUrlTtl: saved.signedUrlTtl || 600,
    accessKeyId: draft.accessKeyId,
    accessKeySecret: draft.accessKeySecret,
    storageLocationId: saved.storageLocationId || '',
  };
}

function isDraftDirty(saved = {}, draft = {}) {
  const trim = (value) => String(value || '').trim();
  return (
    draft.provider !== (saved.provider || 'local')
    || trim(draft.endpoint) !== trim(saved.endpoint)
    || trim(draft.region) !== trim(saved.region)
    || trim(draft.bucket) !== trim(saved.bucket)
    || trim(draft.pathPrefix) !== trim(saved.pathPrefix)
    || trim(draft.publicBaseUrl) !== trim(saved.publicBaseUrl)
    || (draft.s3Preset || 'custom') !== (saved.s3Preset || 'custom')
    || Boolean(draft.pathStyle) !== Boolean(saved.pathStyle)
    || Boolean(trim(draft.accessKeyId))
    || Boolean(draft.accessKeySecret)
  );
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { hour12: false });
}

function endpointHint(provider, region, bucket) {
  const regionText = region || '<region>';
  const bucketText = bucket || '<bucket>';
  if (provider === 'cos') return `留空自动生成 https://${bucketText}.cos.${regionText}.myqcloud.com`;
  if (provider === 'oss') return `留空自动生成 https://${bucketText}.oss-${regionText}.aliyuncs.com`;
  if (provider === 'qiniu') return `留空自动生成 https://s3-${regionText}.qiniucs.com`;
  if (provider === 's3') return '例如 https://<accountid>.r2.cloudflarestorage.com';
  return '';
}

function upsertRun(list, run) {
  if (!run?.id) return list;
  return [run, ...list.filter((item) => item.id !== run.id)].slice(0, 8);
}

export default function StorageSettingsClient({ initial, catalog = [], s3Presets = [], canWrite = false }) {
  const [saved, setSaved] = useState(initial?.settings || {});
  const [locations, setLocations] = useState(initial?.locations || []);
  const [counts, setCounts] = useState(initial?.counts || {});
  const [metrics, setMetrics] = useState(initial?.metrics || null);
  const [runs, setRuns] = useState(initial?.runs || []);
  const [draft, setDraft] = useState(() => draftFrom(initial?.settings));
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [migrationTarget, setMigrationTarget] = useState('');
  const [migrationFeedback, setMigrationFeedback] = useState({ type: '', message: '' });
  const [migrationProgress, setMigrationProgress] = useState('');

  const entry = useMemo(
    () => catalog.find((item) => item.id === draft.provider) || catalog[0] || { fields: [] },
    [catalog, draft.provider]
  );
  const dirty = isDraftDirty(saved, draft);
  const sameProvider = draft.provider === (saved.provider || 'local');
  const remoteLocations = useMemo(
    () => locations.filter((item) => item.provider && item.provider !== 'local'),
    [locations]
  );
  const activeRun = useMemo(() => runs.find((item) => item.status === 'running') || null, [runs]);
  const hasField = (name) => (entry.fields || []).includes(name);

  useEffect(() => {
    const fallback = saved.storageLocationId && saved.provider !== 'local'
      ? saved.storageLocationId
      : remoteLocations[0]?.id || '';
    setMigrationTarget((prev) => (prev && (locations.some((item) => item.id === prev) || prev === fallback) ? prev : fallback));
  }, [saved.storageLocationId, saved.provider, remoteLocations, locations]);

  async function post(payload) {
    const res = await fetch('/api/admin/storage', {
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

  async function refresh() {
    const res = await fetch('/api/admin/storage', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setSaved(data?.data?.settings || {});
    setLocations(data?.data?.locations || []);
    setCounts(data?.data?.counts || {});
    setMetrics(data?.data?.metrics || null);
    setRuns(data?.data?.runs || []);
  }

  function updateField(name, value) {
    setDraft((prev) => ({ ...prev, [name]: value }));
  }

  function selectProvider(provider) {
    if (!canWrite) return;
    setFeedback({ type: '', message: '' });
    setDraft((prev) => {
      if (prev.provider === provider) return prev;
      const nextEntry = catalog.find((item) => item.id === provider);
      return {
        ...prev,
        provider,
        // 切换供应商时给出该供应商的默认区域，避免沿用上一家的 Region。
        region: nextEntry?.defaults?.region || '',
        endpoint: '',
        accessKeyId: '',
        accessKeySecret: '',
      };
    });
  }

  function discardDraft() {
    setDraft(draftFrom(saved));
    setFeedback({ type: '', message: '' });
  }

  async function handleTest() {
    if (!canWrite) return;
    setBusy('test');
    setFeedback({ type: '', message: '' });
    try {
      const data = await post({ action: 'test', config: mergeConfig(saved, draft) });
      setFeedback({
        type: 'success',
        message: `连接正常：${providerLabel(data.provider)} 写入/读取/清理探针通过，耗时 ${data.latencyMs} ms。`,
      });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handleSave() {
    if (!canWrite) return;
    setBusy('save');
    setFeedback({ type: '', message: '' });
    try {
      const data = await post({ action: 'save', config: mergeConfig(saved, draft) });
      setSaved(data.settings || {});
      setDraft(draftFrom(data.settings));
      setFeedback({ type: 'success', message: '已保存。新生成的资源将写入该位置，历史资源仍按各自记录读取。' });
      await refresh();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setBusy('');
    }
  }

  async function stepUntilFinished(runId) {
    let current = null;
    for (let index = 0; index < 200; index += 1) {
      const data = await post({ action: 'migrate.step', runId, maxItems: 20 });
      current = data.run;
      setRuns((prev) => upsertRun(prev, current));
      setMigrationProgress(
        `已扫描 ${current?.scanned || 0} · 已迁移 ${current?.migrated || 0} · 跳过 ${current?.skipped || 0} · 失败 ${current?.failed || 0}`
      );
      if (!current || current.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    await refresh();
    if (current?.status === 'completed') {
      setMigrationFeedback({ type: 'success', message: '历史资源迁移完成，资源指针已更新；本地原文件保留。' });
    } else if (current?.status === 'cancelled') {
      setMigrationFeedback({ type: 'warning', message: '迁移已取消，可稍后从断点继续。' });
    } else if (current?.status === 'running') {
      setMigrationFeedback({ type: 'info', message: '本轮批次已处理完，可点击“继续迁移”接着处理。' });
    } else {
      setMigrationFeedback({ type: 'error', message: current?.last_error || '迁移未完成，请检查源存储位置。' });
    }
  }

  async function handleStartMigration() {
    if (!canWrite || !migrationTarget) return;
    setBusy('migrate');
    setMigrationFeedback({ type: '', message: '' });
    setMigrationProgress('');
    try {
      const data = await post({ action: 'migrate.start', targetLocationId: migrationTarget });
      setRuns((prev) => upsertRun(prev, data.run));
      setMigrationFeedback({ type: 'info', message: '迁移任务已创建，正在复制历史资源…' });
      await stepUntilFinished(data.run.id);
    } catch (error) {
      setMigrationFeedback({ type: 'error', message: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handleContinueMigration() {
    if (!canWrite || !activeRun) return;
    setBusy('migrate');
    setMigrationFeedback({ type: 'info', message: '正在继续迁移…' });
    try {
      await stepUntilFinished(activeRun.id);
    } catch (error) {
      setMigrationFeedback({ type: 'error', message: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handleCancelMigration() {
    if (!canWrite || !activeRun) return;
    setBusy('cancel');
    try {
      const data = await post({ action: 'migrate.cancel', runId: activeRun.id });
      setRuns((prev) => upsertRun(prev, data.run));
      setMigrationFeedback({ type: 'warning', message: '迁移任务已取消。' });
    } catch (error) {
      setMigrationFeedback({ type: 'error', message: error.message });
    } finally {
      setBusy('');
    }
  }

  const feedbackTone = feedback.type === 'error'
    ? 'text-red-300'
    : 'text-emerald-400';

  return (
    <div className="space-y-6">
      {dirty && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-medium text-amber-200">
            <AlertCircle className="size-4" />
            有未保存的存储调整，保存后才会作用于新资源。
          </p>
          <button type="button" onClick={discardDraft} className={SECONDARY_BUTTON} disabled={!canWrite || Boolean(busy)}>
            放弃修改
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-line-subtle bg-surface-raised p-5 shadow-elevation-1">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-subtle pb-3">
          <div>
            <h2 className="text-body font-semibold text-ink">第一步：选择存储供应商</h2>
            <p className="mt-0.5 text-caption text-ink-subtle">
              选择结果决定下方需要填写的接入信息，不会自动迁移已有资源。
            </p>
          </div>
          {!canWrite && <StatusBadge tone="warn">只读权限</StatusBadge>}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {catalog.map((item) => {
            const active = draft.provider === item.id;
            const inUse = (saved.provider || 'local') === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectProvider(item.id)}
                disabled={!canWrite}
                aria-pressed={active}
                className={`flex min-h-[112px] flex-col justify-between rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? 'border-brand/50 bg-brand/10 shadow-elevation-1'
                    : 'border-line-subtle bg-surface/60 hover:border-line hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`flex size-8 items-center justify-center rounded-lg border ${
                    active ? 'border-brand/30 bg-brand/15 text-brand' : 'border-line-subtle bg-white/[0.04] text-ink-muted'
                  }`}>
                    {item.id === 'local' ? <HardDrive className="size-4" /> : <Cloud className="size-4" />}
                  </span>
                  {inUse && <StatusBadge tone="good">当前生效</StatusBadge>}
                </div>
                <div className="mt-3">
                  <p className={`text-sm font-semibold ${active ? 'text-brand' : 'text-ink'}`}>{item.label}</p>
                  <p className="mt-1 line-clamp-2 text-caption leading-5 text-ink-subtle">{item.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {draft.provider === 'local' ? (
        <section className="rounded-2xl border border-line-subtle bg-surface-raised p-5 shadow-elevation-1">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-subtle bg-white/[0.04] text-ink-muted">
              <HardDrive className="size-4" />
            </span>
            <div>
              <h2 className="text-body font-semibold text-ink">服务器本地存储</h2>
              <p className="mt-1 text-xs leading-6 text-ink-muted">
                本地存储无需接入凭据，新资源写入当前部署的数据目录，并由后端签名链接读取。
                适合作为默认位置或对象存储不可用时的回退。
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-line-subtle bg-surface-raised p-5 shadow-elevation-1">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-subtle pb-3">
            <div>
              <h2 className="text-body font-semibold text-ink">第二步：填写 {entry.label} 接入信息</h2>
              <p className="mt-0.5 text-caption text-ink-subtle">
                凭据使用 AES-256-GCM 加密后落库，页面只回显掩码；留空表示沿用已保存的凭据。
              </p>
            </div>
            {saved.hasAccessKeySecret && sameProvider && (
              <span className="inline-flex items-center gap-1 text-caption text-emerald-400">
                <ShieldCheck className="size-3.5" /> 凭据已加密保存
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {hasField('s3Preset') && (
              <div>
                <label className={LABEL_CLASS} htmlFor="storage-s3-preset">S3 预设</label>
                <select
                  id="storage-s3-preset"
                  value={draft.s3Preset}
                  onChange={(event) => updateField('s3Preset', event.target.value)}
                  disabled={!canWrite}
                  className={INPUT_CLASS}
                >
                  {s3Presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={LABEL_CLASS} htmlFor="storage-region">Region</label>
              <input
                id="storage-region"
                type="text"
                value={draft.region}
                onChange={(event) => updateField('region', event.target.value)}
                disabled={!canWrite}
                placeholder={entry.defaults?.region || '例如 ap-guangzhou'}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="storage-bucket">Bucket</label>
              <input
                id="storage-bucket"
                type="text"
                value={draft.bucket}
                onChange={(event) => updateField('bucket', event.target.value)}
                disabled={!canWrite}
                placeholder="存储桶名称"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="storage-endpoint">
                Endpoint {hasField('s3Preset') ? '' : '（可选）'}
              </label>
              <input
                id="storage-endpoint"
                type="url"
                value={draft.endpoint}
                onChange={(event) => updateField('endpoint', event.target.value)}
                disabled={!canWrite}
                placeholder={endpointHint(draft.provider, draft.region, draft.bucket)}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-caption text-ink-subtle">{endpointHint(draft.provider, draft.region, draft.bucket)}</p>
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="storage-prefix">路径前缀</label>
              <input
                id="storage-prefix"
                type="text"
                value={draft.pathPrefix}
                onChange={(event) => updateField('pathPrefix', event.target.value)}
                disabled={!canWrite}
                placeholder="supdance"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="storage-public-base">公开访问域名（可选）</label>
              <input
                id="storage-public-base"
                type="url"
                value={draft.publicBaseUrl}
                onChange={(event) => updateField('publicBaseUrl', event.target.value)}
                disabled={!canWrite}
                placeholder="https://cdn.example.com"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="storage-access-key-id">Access Key ID</label>
              <input
                id="storage-access-key-id"
                type="text"
                value={draft.accessKeyId}
                onChange={(event) => updateField('accessKeyId', event.target.value)}
                disabled={!canWrite}
                autoComplete="off"
                placeholder={sameProvider && saved.accessKeyIdMasked ? `已保存 ${saved.accessKeyIdMasked}，留空沿用` : '请输入 Access Key ID'}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="storage-access-key-secret">
                <span className="inline-flex items-center gap-1"><KeyRound className="size-3.5" /> Access Key Secret</span>
              </label>
              <input
                id="storage-access-key-secret"
                type="password"
                value={draft.accessKeySecret}
                onChange={(event) => updateField('accessKeySecret', event.target.value)}
                disabled={!canWrite}
                autoComplete="new-password"
                placeholder={sameProvider && saved.hasAccessKeySecret ? '已加密保存，留空表示沿用原密钥' : '请输入 Access Key Secret'}
                className={INPUT_CLASS}
              />
            </div>

            {hasField('pathStyle') && (
              <label htmlFor="storage-path-style" className="flex items-center gap-2.5 self-end pb-2 text-sm text-ink-muted">
                <input
                  id="storage-path-style"
                  type="checkbox"
                  checked={Boolean(draft.pathStyle)}
                  onChange={(event) => updateField('pathStyle', event.target.checked)}
                  disabled={!canWrite}
                  className="size-4 cursor-pointer rounded border-white/20 bg-black/40 text-brand focus:ring-brand"
                />
                使用 Path-Style 访问（R2 / MinIO / RustFS 常见）
              </label>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-line-subtle pt-4">
            <button type="button" onClick={handleTest} disabled={!canWrite || Boolean(busy)} className={SECONDARY_BUTTON}>
              <PlugZap className="size-3.5" />
              {busy === 'test' ? '测试中…' : '测试连接'}
            </button>
            <button type="button" onClick={handleSave} disabled={!canWrite || Boolean(busy) || !dirty} className={PRIMARY_BUTTON}>
              <Save className="size-3.5" />
              {busy === 'save' ? '保存中…' : '保存设置'}
            </button>
            {feedback.message && (
              <span className={`text-xs font-medium ${feedbackTone}`} role="status">{feedback.message}</span>
            )}
          </div>
        </section>
      )}

      {draft.provider === 'local' && feedback.message && (
        <p className={`text-xs font-medium ${feedbackTone}`} role="status">{feedback.message}</p>
      )}

      <section className="rounded-2xl border border-line-subtle bg-surface-raised p-5 shadow-elevation-1">
        <div className="border-b border-line-subtle pb-3">
          <h2 className="text-body font-semibold text-ink">当前生效策略</h2>
          <p className="mt-0.5 text-caption text-ink-subtle">
            保存只改变新增资源；历史资源仍按自己记录的 provider、Endpoint 和 Bucket 读取。
          </p>
        </div>
        <div className="divide-y divide-line-subtle">
          <AdminSettingRow
            label="新资源写入位置"
            value={<StatusBadge tone={saved.provider === 'local' ? 'neutral' : 'info'}>{providerLabel(saved.provider)}</StatusBadge>}
            context={saved.provider === 'local'
              ? '新资源写入服务器本地目录，适用于未配置对象存储或临时回退。'
              : '新生成的图片、视频、音乐、画布结果与用户头像都会写入该位置。'}
          />
          <AdminSettingRow
            label="Bucket / Region"
            value={saved.bucket ? `${saved.bucket} · ${saved.region || '未填 Region'}` : '本地目录'}
            context={saved.endpoint ? `Endpoint：${saved.endpoint}` : 'Endpoint 由供应商默认规则推导。'}
          />
          <AdminSettingRow
            label="新建对象路径前缀"
            value={saved.pathPrefix || '（根目录）'}
            context="仅作用于新上传对象，历史对象 Key 保持不变。"
          />
          <AdminSettingRow
            label="读取方式"
            value={saved.publicBaseUrl ? '公开域名 + 签名回退' : '后端签名链接'}
            context={saved.publicBaseUrl
              ? `优先使用 ${saved.publicBaseUrl} 读取，私有资源仍走签名。`
              : '资源通过带有效期的签名链接读取，避免桶被公开遍历。'}
          />
          <AdminSettingRow
            label="凭据状态"
            value={saved.hasAccessKeySecret ? `已加密 · ${saved.accessKeyIdMasked || '已保存'}` : '未配置'}
            context="密钥以 AES-256-GCM 加密存储，接口与日志不会回传明文。"
          />
          <AdminSettingRow
            label="资源总量"
            value={metrics ? `${formatBytes(metrics.totalBytes)} · ${metrics.totalFiles} 个对象` : '统计暂不可用'}
            context={metrics ? `今日新增 ${formatBytes(metrics.todayBytes)} · ${metrics.todayFiles} 个；今日失败上传 ${metrics.failedUploads} 次。` : '存储统计查询失败，不影响读写。'}
          />
        </div>
      </section>

      <BucketConfigPanel canWrite={canWrite} />

      <section className="rounded-2xl border border-line-subtle bg-surface-raised p-5 shadow-elevation-1">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-subtle pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-body font-semibold text-ink">
              <Database className="size-4 text-brand" /> 历史资源迁移
            </h2>
            <p className="mt-0.5 text-caption text-ink-subtle">
              把主站与画布的历史对象复制到已保存的远端位置，并更新资源指针。复制不移动，本地原文件保留。
            </p>
          </div>
          {activeRun && <StatusBadge tone="info">正在迁移</StatusBadge>}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { key: 'assets', label: '主站资源库', icon: HardDrive },
            { key: 'creations', label: '生成记录', icon: Link2 },
            { key: 'avatars', label: '用户头像', icon: KeyRound },
          ].map((item) => {
            const stat = counts?.[item.key] || { total: 0, local: 0 };
            const Icon = item.icon;
            return (
              <div key={item.key} className="rounded-xl border border-line-subtle bg-surface/60 p-4">
                <p className="flex items-center gap-1.5 text-caption font-medium text-ink-muted">
                  <Icon className="size-3.5 text-ink-subtle" /> {item.label}
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{stat.local}</p>
                <p className="mt-1 text-caption text-ink-subtle">仍在本地 / 共 {stat.total} 条</p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-line-subtle bg-surface/60 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className={LABEL_CLASS} htmlFor="storage-migration-target">迁移目标位置</label>
            <select
              id="storage-migration-target"
              value={migrationTarget}
              onChange={(event) => setMigrationTarget(event.target.value)}
              disabled={!canWrite || Boolean(busy) || Boolean(activeRun)}
              className={INPUT_CLASS}
            >
              <option value="">选择已保存的远端存储位置</option>
              {remoteLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {providerLabel(location.provider)} · {location.bucket || '未填 Bucket'} · {location.region || '默认 Region'}
                  {location.id === saved.storageLocationId ? '（当前生效）' : ''}
                </option>
              ))}
            </select>
            {!remoteLocations.length && (
              <p className="mt-1.5 text-caption text-amber-300">
                还没有可用的远端位置：先在上方填写并保存一个对象存储配置。
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!activeRun && (
              <button
                type="button"
                onClick={handleStartMigration}
                disabled={!canWrite || Boolean(busy) || !migrationTarget}
                className={PRIMARY_BUTTON}
              >
                <Play className="size-3.5" />
                {busy === 'migrate' ? '迁移中…' : '开始迁移'}
              </button>
            )}
            {activeRun && (
              <>
                <button type="button" onClick={handleContinueMigration} disabled={!canWrite || Boolean(busy)} className={PRIMARY_BUTTON}>
                  <RefreshCw className="size-3.5" />
                  {busy === 'migrate' ? '迁移中…' : '继续迁移'}
                </button>
                <button type="button" onClick={handleCancelMigration} disabled={!canWrite || Boolean(busy)} className={DANGER_BUTTON}>
                  <Ban className="size-3.5" /> 取消
                </button>
              </>
            )}
          </div>
        </div>

        {(migrationProgress || migrationFeedback.message) && (
          <div className="mt-3 space-y-1 rounded-xl border border-line-subtle bg-base/60 px-4 py-3">
            {migrationProgress && <p className="text-xs font-mono text-ink-muted">{migrationProgress}</p>}
            {migrationFeedback.message && (
              <p className={`text-xs font-medium ${
                migrationFeedback.type === 'error' ? 'text-red-300'
                  : migrationFeedback.type === 'success' ? 'text-emerald-400'
                    : migrationFeedback.type === 'warning' ? 'text-amber-300' : 'text-ink-muted'
              }`} role="status">
                {migrationFeedback.message}
              </p>
            )}
          </div>
        )}

        {runs.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-caption font-semibold uppercase tracking-[0.06em] text-ink-subtle">最近迁移任务</h3>
            <div className="divide-y divide-line-subtle rounded-xl border border-line-subtle">
              {runs.map((run) => {
                const status = RUN_STATUS[run.status] || RUN_STATUS.cancelled;
                return (
                  <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      <span className="font-mono text-ink-subtle">{run.id}</span>
                      <span className="text-ink-muted">{providerLabel(run.target_provider)} · {PHASE_LABELS[run.phase] || run.phase}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-ink-subtle">
                      <span>扫描 {run.scanned || 0}</span>
                      <span className="text-emerald-400">迁移 {run.migrated || 0}</span>
                      <span>跳过 {run.skipped || 0}</span>
                      <span className={run.failed ? 'text-red-300' : ''}>失败 {run.failed || 0}</span>
                      <span>{formatTime(run.started_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {runs[0]?.last_error && (
              <p className="mt-2 break-all text-caption text-ink-subtle">最近错误：{runs[0].last_error}</p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line-subtle bg-surface-raised p-5 shadow-elevation-1">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-subtle pb-3">
          <div>
            <h2 className="text-body font-semibold text-ink">存储位置清单</h2>
            <p className="mt-0.5 text-caption text-ink-subtle">
              每次保存的接入信息都会形成独立位置，历史资源按自己的位置读取，切换供应商不会让旧资源失效。
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-caption text-ink-subtle">
            <CheckCircle2 className="size-3.5 text-emerald-400" /> 共 {locations.length} 个位置
          </span>
        </div>

        {locations.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-subtle">还没有已建档的存储位置。</p>
        ) : (
          <div className="divide-y divide-line-subtle">
            {locations.map((location) => (
              <div key={location.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-sm">
                <div className="w-44 shrink-0">
                  <p className="font-semibold text-ink">{providerLabel(location.provider)}</p>
                  <p className="mt-0.5 font-mono text-caption text-ink-subtle">{location.id}</p>
                </div>
                <div className="w-56 shrink-0 text-ink">
                  {location.bucket || '本地目录'}
                  <span className="ml-2 text-caption text-ink-subtle">{location.region || ''}</span>
                </div>
                <div className="flex-1 text-xs leading-6 text-ink-subtle">
                  <span className="block truncate">{location.endpoint || 'Endpoint 自动推导'} · 前缀 {location.pathPrefix || '根目录'}</span>
                  <span className="block">
                    最近测试：{formatTime(location.testedAt)} · 绑定资源 {location.assetCount || 0}
                  </span>
                </div>
                <div className="w-28 shrink-0 text-left sm:text-right">
                  {location.id === saved.storageLocationId
                    ? <StatusBadge tone="good">当前生效</StatusBadge>
                    : <span className="text-caption text-ink-subtle">历史位置</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
