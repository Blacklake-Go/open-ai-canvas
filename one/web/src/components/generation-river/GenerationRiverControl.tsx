import { useEffect, useRef, useState } from 'react';
import { Activity, AlertCircle, Check, ChevronDown, Clock3, ExternalLink, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { Collapsible, Popover } from 'radix-ui';
import Link from 'next/link';
import { FOCUS_RING, OVERLAY_PANEL } from 'studio/ui/tokens';
import { useGenerationRiver } from '@/lib/hooks/useGenerationRiver';
import { getLocaleConfig, normalizeLocale } from '@/lib/locales';
import { canRestoreHomeTask, isRiverTaskActive, riverResultUrl, riverTaskId, type RiverTask } from '@/services/api/generation-river';
import { getRiverCopy } from './copy';

const actionClass = `inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-caption font-medium text-ink-muted transition-colors duration-fast ease-standard hover:bg-wash hover:text-ink disabled:opacity-45 ${FOCUS_RING}`;
const announcementDuration = 6500;
const announcementKey = (task: RiverTask) => `${riverTaskId(task)}:${task.status}:${task.announcedAt}`;

function groupByDay(tasks: RiverTask[], locale: string, copy: ReturnType<typeof getRiverCopy>) {
  const groups = new Map<string, RiverTask[]>();
  const today = new Date().toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const heading = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  for (const task of tasks) {
    const date = new Date(task.createdAt);
    if (Number.isNaN(date.valueOf())) continue;
    const day = date.toDateString();
    const label = day === today ? copy.today : day === yesterday.toDateString() ? copy.yesterday : heading.format(date);
    const group = groups.get(label) || [];
    group.push(task);
    groups.set(label, group);
  }
  return Array.from(groups);
}

function TaskIcon({ task }: { task: RiverTask }) {
  if (task.status === 'succeeded') return <Check className="size-4 text-success" aria-hidden="true" />;
  if (task.status === 'failed' || task.status === 'canceled') return <AlertCircle className="size-4 text-danger" aria-hidden="true" />;
  if (task.status === 'running' || task.status === 'submitting') return <LoaderCircle className="size-4 text-brand-text motion-safe:animate-spin" aria-hidden="true" />;
  return <Clock3 className="size-4 text-ink-muted" aria-hidden="true" />;
}

function ResultPreview({ url, outputs, label, image, copy }: {
  url: string;
  outputs?: string[];
  label: string;
  image: boolean;
  copy: ReturnType<typeof getRiverCopy>;
}) {
  const [failed, setFailed] = useState(false);
  const mediaClass = 'block max-h-60 w-full rounded-lg bg-raised object-contain';
  const urls = outputs && outputs.length > 1 ? outputs : [url];

  if (urls.length > 1 && image) {
    return (
      <div className="mt-1 grid grid-cols-2 gap-1.5 overflow-hidden rounded-lg border border-line bg-raised p-1.5 sm:grid-cols-3">
        {urls.map((u, idx) => (
          <a key={u + idx} href={u} target="_blank" rel="noopener noreferrer" className="group relative block aspect-square overflow-hidden rounded-md bg-wash">
            <img src={u} alt={`${label} (${idx + 1})`} decoding="async" className="size-full object-contain transition-transform duration-fast group-hover:scale-105" onError={() => setFailed(true)} />
            <span className="absolute bottom-1 right-1 rounded bg-surface/80 px-1 text-[10px] font-mono text-ink backdrop-blur-sm">L${idx + 1}</span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-1 overflow-hidden rounded-lg border border-line bg-raised">
      {failed ? (
        <p role="status" className="p-3 text-caption text-ink-muted">{copy.previewError}</p>
      ) : image ? (
        <img src={url} alt={label} decoding="async" className={mediaClass} onError={() => setFailed(true)} />
      ) : (
        <video src={url} aria-label={label} controls playsInline preload="metadata" className={mediaClass} onError={() => setFailed(true)} />
      )}
    </div>
  );
}

function TaskCard({ task, locale, copy, selected }: { task: RiverTask; locale: string; copy: ReturnType<typeof getRiverCopy>; selected: boolean }) {
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected) card.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  const meta = [task.model, task.ratio, task.resolution].filter(Boolean).join(' · ');
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(task.createdAt));
  const result = task.status === 'succeeded' ? riverResultUrl(task.resultUrl) : undefined;
  const canPreview = result && (task.mode === 'image' || task.mode === 'video' || task.mode === 'digital-human');
  const attachment = result?.match(/^\/api\/assets\/[A-Za-z0-9_-]+\/download(?:\?inline=1)?$/)
    ? result.split('?')[0] + '?disposition=attachment' : undefined;
  const restoreQuery = new URLSearchParams(task.requestId ? { restoreTask: task.requestId } : { restoreAttempt: task.id });
  const restoreHref = `${getLocaleConfig(locale).rootPath || '/'}?${restoreQuery}`;
  const restoreLabel = result && task.studioId === 'home-avatar-speech' ? copy.useDrivingAudio : copy.editInputs;
  return (
    <Collapsible.Root asChild>
      <article ref={card} className={`rounded-xl border bg-surface px-3 py-2.5 ${selected ? 'border-brand-line' : 'border-line'}`}
        data-river-status={task.status} data-river-task={riverTaskId(task)}>
        <div className="flex items-center gap-2 text-caption text-ink-muted">
          <TaskIcon task={task} />
          <span className="font-medium text-ink">{copy[task.mode]}</span>
          <span>{copy[task.status]}</span>
          <time dateTime={task.createdAt} className="ml-auto tabular-nums">{time}</time>
        </div>
        {task.prompt && <p className="mt-1 line-clamp-2 break-words text-body-sm text-ink" title={task.prompt}>{task.prompt}</p>}
        {meta && <p className="mt-1 break-words font-mono text-caption text-ink-muted">{meta}</p>}
        {task.error && <p className="mt-1 break-words text-caption text-danger">{task.error}</p>}
        {task.status === 'succeeded' && task.resultText && (
          <details className="mt-2 text-caption text-ink">
            <summary className={`cursor-pointer rounded-md ${FOCUS_RING}`}>{copy.viewText}</summary>
            <p className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words">{task.resultText}</p>
          </details>
        )}
        {result && task.mode === 'audio' && <audio className="mt-2 w-full" controls preload="none" src={result} />}
        <div className="mt-1 flex flex-wrap items-center gap-1 empty:hidden">
          {canPreview && <Collapsible.Trigger className={`${actionClass} group`}>
            {copy.preview} <ChevronDown className="size-3 group-aria-expanded:rotate-180" aria-hidden="true" />
          </Collapsible.Trigger>}
          {result && <a href={result} target="_blank" rel="noopener noreferrer" className={actionClass}>
            {copy.openResult} <ExternalLink className="size-3" aria-hidden="true" />
          </a>}
          {attachment && <a href={attachment} download className={actionClass}>{copy.download}</a>}
          {canRestoreHomeTask(task) && <Link href={restoreHref} className={actionClass}>{restoreLabel}</Link>}
        </div>
        {canPreview && (
          <Collapsible.Content>
            <ResultPreview key={result} url={result} outputs={task.outputs} label={task.prompt || copy[task.mode]} image={task.mode === 'image'} copy={copy} />
          </Collapsible.Content>
        )}
      </article>
    </Collapsible.Root>
  );
}

export default function GenerationRiverControl({ userId, locale }: { userId: string; locale: string }) {
  const normLocale = normalizeLocale(locale);
  const copy = getRiverCopy(normLocale);
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [clock, setClock] = useState(0);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const { tasks, activity, isPending, isError, isFetching, refetch } = useGenerationRiver(userId);
  const active = tasks.filter(isRiverTaskActive).length;
  const now = Math.max(clock, Date.now());
  const fresh = activity.filter(task => (task.announcedAt || 0) + announcementDuration > now);
  const announcements = fresh.filter(task => !dismissed.includes(announcementKey(task))).slice(0, 3);
  const nextExpiry = fresh.length ? Math.min(...fresh.map(task => (task.announcedAt || 0) + announcementDuration)) : null;

  useEffect(() => {
    if (nextExpiry === null) return undefined;
    const timer = window.setTimeout(() => setClock(Date.now()), Math.max(0, nextExpiry - Date.now()));
    return () => window.clearTimeout(timer);
  }, [nextExpiry]);

  if (!userId) return null;

  return (
    <div className="shrink-0">
      <Popover.Root open={open} onOpenChange={(nextOpen) => {
        if (!nextOpen) setSelectedTask(null);
        setOpen(nextOpen);
      }}>
        <Popover.Trigger asChild>
          <button type="button" aria-label={copy.title} title={copy.title}
            className={`relative flex size-11 items-center justify-center rounded-lg text-ink-muted hover:bg-wash hover:text-ink ${FOCUS_RING}`}>
            <Activity className="size-4" aria-hidden="true" />
            {active > 0 && <span className="absolute right-0 top-0 rounded-full bg-brand px-1.5 text-caption tabular-nums text-ink-on-accent">{active}</span>}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} collisionPadding={12} aria-label={copy.title}
          className={`${OVERLAY_PANEL} z-popover w-[min(360px,calc(100vw-24px))] bg-overlay p-3 text-ink`}>
          <div className="flex items-center justify-between gap-2 border-b border-line pb-1">
            <h2 className="px-1 text-body font-semibold">{copy.title}</h2>
            <button type="button" onClick={() => void refetch()} disabled={isFetching}
              aria-label={copy.refresh} title={copy.refresh} className={`${actionClass} min-w-11 justify-center`}>
              <RefreshCw className={`size-4 ${isFetching ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>
          <div className="max-h-[min(72dvh,520px)] overflow-y-auto pr-1 scrollbar-rail">
            {isPending && tasks.length === 0 && <p role="status" className="px-1 py-4 text-caption text-ink-muted">{copy.loading}</p>}
            {isError && <p role="alert" className="px-1 py-3 text-caption text-danger">{copy.loadError}</p>}
            {!isPending && !isError && tasks.length === 0 && <p className="px-1 py-4 text-caption text-ink-muted">{copy.empty}</p>}
            {groupByDay(tasks, normLocale, copy).map(([day, entries]) => (
              <section key={day} className="space-y-1.5">
                <h3 className="px-1 pt-3 text-caption font-medium text-ink-muted">{day}</h3>
                {entries.map(task => <TaskCard key={riverTaskId(task)} task={task} locale={normLocale} copy={copy}
                  selected={selectedTask === riverTaskId(task)} />)}
              </section>
            ))}
          </div>
        </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcements.map(task => `${copy[task.mode]} · ${copy[task.status]}`).join(' · ')}
      </div>
      {!open && announcements.length > 0 && (
        <div className="absolute right-3 top-full z-toast mt-2 grid w-[min(300px,calc(100vw-24px))] gap-1">
          {announcements.map(task => {
            const label = `${copy[task.mode]} · ${copy[task.status]}`;
            const key = announcementKey(task);
            return <div key={key} data-river-feedback={task.status} className="flex items-center gap-1 rounded-xl border border-line bg-overlay p-1 shadow-elevation-3">
              <button type="button" className={`${actionClass} min-w-0 flex-1 justify-start text-left`} aria-label={label}
                onClick={() => { setSelectedTask(riverTaskId(task)); setOpen(true); }}>
                <TaskIcon task={task} />
                <span className="min-w-0">
                  <span className="block truncate">{label}</span>
                  {task.prompt && <span className="block truncate font-normal" title={task.prompt}>{task.prompt}</span>}
                </span>
              </button>
              <button type="button" className={`${actionClass} min-w-11 justify-center`}
                onClick={() => setDismissed(items => [...items.slice(-19), key])} aria-label={copy.close}>
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>;
          })}
        </div>
      )}
    </div>
  );
}
