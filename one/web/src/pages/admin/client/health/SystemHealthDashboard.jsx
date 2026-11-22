'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Cloud, Cpu, Database, HardDrive, Lock, MemoryStick, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { Button, Card, PageHeader, StatusBadge } from '@/components/admin/AdminUi';
import LiveLogViewer from './LiveLogViewer';

const REFRESH_INTERVAL_MS = 15_000;

function formatBytes(value) {
  if (value === undefined || value === null || !Number.isFinite(value)) return '--';
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** index;
  return `${amount >= 100 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

function formatDuration(seconds) {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds)) return '--';
  if (!seconds) return '不足 1 分钟';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days ? `${days} 天` : '', hours ? `${hours} 小时` : '', minutes ? `${minutes} 分钟` : '']
    .filter(Boolean)
    .slice(0, 2)
    .join(' ') || '不足 1 分钟';
}

function formatNumber(value) {
  return value === undefined || value === null || !Number.isFinite(value) ? '--' : new Intl.NumberFormat('zh-CN').format(value);
}

function percentTone(percent) {
  if (percent >= 90) return 'danger';
  if (percent >= 75) return 'warning';
  return 'brand';
}

function MeterBar({ percent }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const tone = percentTone(clamped);
  const fill = tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-brand';
  return (
    <div className="mt-3 h-1 overflow-hidden rounded-full bg-wash" aria-hidden="true">
      <div
        className={`h-full w-full origin-left rounded-full ${fill} transition-transform duration-smooth ease-standard`}
        style={{ transform: `scaleX(${clamped / 100})` }}
      />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, detail, percent }) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-ink-muted">
        <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
        <p className="text-label font-medium">{label}</p>
      </div>
      <p className="mt-2 text-page-title font-bold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-caption text-ink-subtle">{detail}</p>
      {percent === undefined ? null : <MeterBar percent={percent} />}
    </Card>
  );
}

function Fact({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line-subtle py-2 last:border-b-0 last:pb-0">
      <span className="shrink-0 text-label text-ink-muted">{label}</span>
      <span className={`text-right ${mono ? 'text-mono' : 'text-body-sm'} text-ink`}>{value}</span>
    </div>
  );
}

function SectionCard({ icon: Icon, title, description, status, statusTone = 'neutral', children }) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line-subtle bg-wash text-ink-muted">
            <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-section-title text-ink">{title}</h2>
            {description && <p className="mt-1 text-caption text-ink-subtle">{description}</p>}
          </div>
        </div>
        {status && <StatusBadge tone={statusTone}>{status}</StatusBadge>}
      </div>
      <div className="text-body">{children}</div>
    </Card>
  );
}

function SubMetrics({ items }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-line-subtle bg-well p-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-2">
          <span className="text-caption text-ink-subtle">{label}</span>
          <strong className="text-body-sm font-semibold tabular-nums text-ink">{value}</strong>
        </div>
      ))}
    </div>
  );
}

function RefreshSwitch({ checked, onChange }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full p-1 outline-none transition-[background-color] duration-fast ease-standard focus-visible:ring-1 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ${checked ? 'bg-brand' : 'bg-wash-press hover:bg-wash-strong'}`}
      >
        <span
          className={`block size-4 rounded-full bg-surface-inverse shadow-elevation-1 transition-transform duration-fast ease-bounce ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
      <span className="text-label text-ink-muted">15 秒刷新</span>
    </label>
  );
}

export default function SystemHealthDashboard({ initial }) {
  const [data, setData] = useState(initial);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const sequence = useRef(0);

  const load = useCallback(async (manual = false) => {
    const id = ++sequence.current;
    if (manual) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/health', { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error?.message || '读取系统健康失败');
      if (id !== sequence.current) return;
      setData(payload.data);
      setLoadError('');
    } catch (error) {
      if (id !== sequence.current) return;
      setLoadError(error.message || '读取系统健康失败');
    } finally {
      if (id === sequence.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => { void load(false); }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  const perf = data.performance || {};
  const host = perf.host || {};
  const memory = perf.memory || {};
  const disk = perf.disk || {};
  const perfDb = perf.database || {};
  const postgres = perfDb.postgres || null;
  const schema = perfDb.schema || { current: 0, expected: 0, ready: false };
  const pool = perfDb.pool || data.database?.pool || { total: 0, idle: 0, waiting: 0, max: 0 };
  const worker = data.worker || {};
  const migrations = data.database?.migrations || {};

  const memoryPercent = Number.isFinite(memory.usagePercent) ? memory.usagePercent : undefined;
  const diskPercent = disk.available ? disk.usagePercent : undefined;
  const connectionPercent = postgres?.maxConnections ? (postgres.connections / postgres.maxConnections) * 100 : undefined;
  const heapPercent = memory.heapTotalBytes ? (memory.heapUsedBytes / memory.heapTotalBytes) * 100 : undefined;
  const poolInUse = Math.max(0, (pool.total || 0) - (pool.idle || 0));

  const workerTone = worker.status === 'healthy' ? 'good' : worker.status === 'degraded' ? 'warn' : 'danger';
  const workerLabel = worker.status === 'healthy' ? '正常运行' : worker.status === 'degraded' ? '队列积压' : worker.status === 'unknown' ? '状态未知' : '未运行';
  const dependencyTone = (status) => (status === 'healthy' ? 'good' : status === 'degraded' ? 'warn' : 'danger');
  const dependencyLabel = (status) => ({ healthy: '正常', degraded: '降级', unhealthy: '异常', unknown: '未知' })[status] || '未知';

  return (
    <>
      <PageHeader
        eyebrow="系统运维"
        title="系统健康"
        description="紧凑查看主机性能、进程、数据库、生成队列、对象存储、邮件与公开模型渠道状态；敏感连接信息不会在此展示。"
      >
        <RefreshSwitch checked={autoRefresh} onChange={setAutoRefresh} />
        <Button size="sm" variant="outline" loading={refreshing} onClick={() => { void load(true); }}>
          {!refreshing && <RefreshCw className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          刷新
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-subtle bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={loadError ? 'warn' : data.status === 'healthy' ? 'good' : 'warn'}>
            {loadError ? '快照已过期' : data.status === 'healthy' ? '系统运行正常' : '部分服务降级'}
          </StatusBadge>
          <span className="text-caption text-ink-subtle">
            采集于 {new Date(perf.collectedAt || data.checkedAt || Date.now()).toLocaleString('zh-CN', { hour12: false })}
          </span>
          {loadError && <span className="text-caption text-warning">{loadError}</span>}
        </div>
        <span className="text-caption text-ink-subtle">进程已运行 {formatDuration(data.uptimeSeconds)}</span>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={MemoryStick}
          label="系统内存"
          value={memoryPercent === undefined ? '--' : `${memoryPercent.toFixed(1)}%`}
          detail={memoryPercent === undefined ? '主机内存不可读' : `${formatBytes(memory.usedBytes)} / ${formatBytes(memory.totalBytes)}`}
          percent={memoryPercent}
        />
        <KpiCard
          icon={HardDrive}
          label="数据磁盘"
          value={diskPercent === undefined ? '不可用' : `${diskPercent.toFixed(1)}%`}
          detail={disk.available ? `${formatBytes(disk.usedBytes)} / ${formatBytes(disk.totalBytes)}` : '无法读取文件系统指标'}
          percent={diskPercent}
        />
        <KpiCard
          icon={Database}
          label="PostgreSQL 连接"
          value={postgres ? `${postgres.connections} / ${postgres.maxConnections}` : '--'}
          detail={`PostgreSQL · ${perfDb.latencyMs ?? data.database?.latencyMs ?? '--'} ms`}
          percent={connectionPercent}
        />
        <KpiCard
          icon={Cpu}
          label="进程内存"
          value={formatBytes(memory.rssBytes)}
          detail={`堆占用 ${formatBytes(memory.heapUsedBytes)} / ${formatBytes(memory.heapTotalBytes)}`}
          percent={heapPercent}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={Server}
          title="服务器与进程"
          description="操作系统、运行时和当前进程快照。"
          status={disk.available ? (disk.writable ? '应用目录可写' : '应用目录不可写') : '磁盘不可读'}
          statusTone={disk.available ? (disk.writable ? 'good' : 'danger') : 'warn'}
        >
          <Fact label="主机" value={host.hostname || '未识别'} mono />
          <Fact label="系统" value={host.system || '--'} />
          <Fact label="CPU" value={`${host.cpuCores ?? '--'} 逻辑核`} />
          <Fact label="负载 1/5/15" value={Array.isArray(host.loadAverage) ? host.loadAverage.map((value) => value.toFixed(2)).join(' / ') : '--'} mono />
          <Fact label="进程" value={`PID ${host.processId ?? '--'}`} />
          <Fact label="主机运行" value={formatDuration(host.hostUptimeSeconds)} />
          <Fact label="任务" value={`${formatNumber(worker.liveWorkers)} 个 Worker 正在执行`} />
          <Fact label="运行时" value={`Next.js 15 · Node ${host.nodeVersion || data.runtime?.node || '--'}`} />
          <SubMetrics
            items={[
              ['RSS', formatBytes(memory.rssBytes)],
              ['堆占用', formatBytes(memory.heapUsedBytes)],
              ['堆预留', formatBytes(memory.heapTotalBytes)],
              ['外部内存', formatBytes(memory.externalBytes)],
            ]}
          />
        </SectionCard>

        <SectionCard
          icon={Database}
          title="数据库"
          description="连接池、结构版本与数据库内部统计。"
          status={perfDb.connected ? '连接正常' : '连接异常'}
          statusTone={perfDb.connected ? 'good' : 'danger'}
        >
          <Fact label="驱动" value="PostgreSQL" />
          <Fact label="结构版本" value={`${schema.current} / ${schema.expected} ${schema.ready ? '（已就绪）' : '（待检查）'}`} />
          <Fact label="最新迁移" value={perfDb.latestMigration || migrations.latest || '无迁移记录'} mono />
          <Fact label="数据库大小" value={formatBytes(postgres?.databaseBytes)} />
          <Fact label="连接池" value={`${poolInUse} 使用中 · ${pool.idle ?? 0} 空闲 · ${pool.waiting ?? 0} 次等待`} />
          <Fact label="版本" value={postgres?.serverVersion || '未知'} mono />
          <Fact label="缓存命中" value={postgres ? `${postgres.cacheHitRate.toFixed(2)}%` : '--'} />
          <Fact label="事务 / 回滚" value={postgres ? `${formatNumber(postgres.transactions)} / ${formatNumber(postgres.rollbacks)}` : '--'} />
          <Fact label="临时文件 / 死锁" value={postgres ? `${formatNumber(postgres.tempFiles)} / ${formatNumber(postgres.deadlocks)}` : '--'} />
        </SectionCard>

        <SectionCard
          icon={Activity}
          title="生成 Worker 与队列"
          description="生成任务执行与排队情况。"
          status={workerLabel}
          statusTone={workerTone}
        >
          <Fact label="活跃 Worker" value={formatNumber(worker.liveWorkers)} />
          <Fact label="排队任务" value={formatNumber(worker.queuedCount)} />
          <Fact label="超时处理中" value={formatNumber(worker.staleProcessingCount)} />
          <Fact label="近 15 分钟失败" value={formatNumber(worker.failedLast15m)} />
          {worker.latestHeartbeatAt && (
            <p className="mt-3 text-caption text-ink-subtle">
              最近心跳：{new Date(worker.latestHeartbeatAt).toLocaleString('zh-CN', { hour12: false })}
            </p>
          )}
        </SectionCard>

        <SectionCard icon={ShieldCheck} title="关键服务依赖" description="对象存储、邮件与模型渠道健康。">
          {[
            { label: '对象存储', dependency: data.storage },
            { label: '邮件 SMTP', dependency: data.email },
            {
              label: '公开模型可用渠道',
              dependency: data.modelProviders,
              detail: `${data.modelProviders?.coveredModels ?? '未知'}/${data.modelProviders?.activeModels ?? '未知'} 个模型有健康渠道${data.modelProviders?.staleHealthModels ? ` · ${data.modelProviders.staleHealthModels} 个健康记录过期` : ''}`,
            },
          ].map(({ label, dependency }) => (
            <div key={label} className="flex items-center justify-between gap-4 border-b border-line-subtle py-2 last:border-b-0 last:pb-0">
              <div>
                <p className="text-body-sm text-ink">{label}</p>
                {dependency?.detail && <p className="text-caption text-ink-subtle">{dependency.detail}</p>}
                {dependency?.errorCode && <p className="text-caption text-ink-subtle">{dependency.errorCode}</p>}
                {dependency?.checkedAt && (
                  <p className="text-caption text-ink-subtle">检查于 {new Date(dependency.checkedAt).toLocaleString('zh-CN', { hour12: false })}</p>
                )}
              </div>
              <StatusBadge tone={dependencyTone(dependency?.status)}>{dependencyLabel(dependency?.status)}</StatusBadge>
            </div>
          ))}
          <p className="mt-3 text-caption text-ink-subtle">探测结果有短时缓存；邮件健康表示 SMTP 连通与认证检查，不代表收件箱已送达。</p>
        </SectionCard>

        <SectionCard icon={Cloud} title="外部依赖与网关健康摘要" description="聚合网关与直连引擎配置状态。">
          <div className="space-y-3">
            {(data.providers || []).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-xl border border-line-subtle bg-well p-3">
                <div>
                  <p className="text-body-sm font-semibold text-ink">{p.name}</p>
                  <p className="text-caption text-ink-subtle">{p.description}</p>
                </div>
                <StatusBadge tone={p.configured ? 'good' : 'warn'}>{p.configured ? '已就绪' : '待配置'}</StatusBadge>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard icon={Lock} title="运行环境与安全规则" description="部署拓扑与数据库安全策略。">
          <Fact label="应用协议模式" value="Next.js 15 全栈 App Router" />
          <Fact label="监听地址" value="127.0.0.1:3100 (Nginx 反向代理)" mono />
          <Fact label="数据库事务隔离" value="PostgreSQL 事务 + 连接池超时" />
          <Fact label="代理策略" value="服务器内网直连 (NO_PROXY 保障)" />
        </SectionCard>
      </div>

      <LiveLogViewer />
    </>
  );
}
