import { apiRequest } from './http';

export type RiverStatus = 'submitting' | 'queued' | 'running' | 'checking' | 'succeeded' | 'failed' | 'canceled';
export type RiverMode = 'image' | 'video' | 'audio' | 'digital-human' | 'agent' | 'other';
export type HomeRiverMode = Exclude<RiverMode, 'other'>;
export type HomeRiverDraft = { mode: HomeRiverMode; fields: Record<string, unknown> };

export interface RiverTask {
  id: string;
  requestId?: string;
  studioId?: string;
  mode: RiverMode;
  status: RiverStatus;
  prompt?: string;
  model?: string;
  ratio?: string;
  resolution?: string;
  resultUrl?: string;
  outputs?: string[];
  resultText?: string;
  error?: string;
  createdAt: string;
  announcedAt?: number;
  homeDraft?: HomeRiverDraft;
}

interface ServerCreation {
  id: string;
  studio_id?: string;
  label?: string;
  model?: string;
  status: string;
  asset_id?: string;
  result_url?: string;
  result_text?: string;
  error_reason?: string;
  created_at: string;
  input_summary_json?: { prompt?: string; aspect_ratio?: string; resolution?: string };
}

const serverStatuses: Record<string, RiverStatus> = {
  created: 'queued', quoted: 'queued', credit_reserved: 'queued', pending: 'queued', queued: 'queued', reserved: 'queued',
  routing: 'running', submitted: 'running', running: 'running', processing: 'running',
  succeeded: 'succeeded', completed: 'succeeded', success: 'succeeded',
  failed: 'failed', error: 'failed', canceled: 'canceled', cancelled: 'canceled',
  reconciliation_required: 'checking', refunding: 'checking',
};

function normalizeRiverStatus(value: string) {
  return Object.hasOwn(serverStatuses, value) ? serverStatuses[value] : 'checking';
}

export function riverResultUrl(value?: string) {
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value)) return undefined;
  if (/^\/(?!\/)/.test(value)) return value;
  try { return new URL(value).protocol === 'https:' ? value : undefined; } catch { return undefined; }
}

export function riverMode(studioId = ''): RiverMode {
  const mode = studioId.replace(/^home-/, '').split(':', 1)[0];
  if (mode === 'digital-human' || mode === 'ai-influencer' || mode === 'lipsync') return 'digital-human';
  if (mode === 'agents' || mode === 'agent' || mode === 'design-agent' || mode === 'agent-chat') return 'agent';
  if (mode === 'avatar-speech' || mode === 'music') return 'audio';
  if (mode === 'image' || mode === 'video' || mode === 'audio') return mode;
  return 'other';
}

function extractOutputs(row: ServerCreation, primaryUrl?: string): string[] {
  let list: string[] = [];
  const metaRaw = (row as any).metadata_json;
  if (metaRaw) {
    const meta = typeof metaRaw === 'string'
      ? (() => { try { return JSON.parse(metaRaw); } catch { return {}; } })()
      : metaRaw;
    if (Array.isArray(meta?.outputs) && meta.outputs.length > 0) list = meta.outputs;
    else if (Array.isArray(meta?.images) && meta.images.length > 0) list = meta.images;
  }
  if (!list.length && row.result_text) {
    try {
      const parsed = JSON.parse(row.result_text);
      if (Array.isArray(parsed)) list = parsed;
      else if (Array.isArray(parsed?.outputs)) list = parsed.outputs;
      else if (Array.isArray(parsed?.images)) list = parsed.images;
    } catch {}
  }
  if (!list.length && primaryUrl) list = [primaryUrl];
  return list.map(u => riverResultUrl(u)).filter(Boolean) as string[];
}

export function fromServer(row: ServerCreation): RiverTask {
  const inputs = row.input_summary_json;
  const primaryUrl = row.asset_id
    ? `/api/assets/${encodeURIComponent(row.asset_id)}/download?inline=1`
    : riverResultUrl(row.result_url);
  const outputs = extractOutputs(row, primaryUrl);
  return {
    id: row.id,
    requestId: row.id,
    studioId: row.studio_id,
    mode: riverMode(row.studio_id),
    status: normalizeRiverStatus(row.status),
    prompt: inputs?.prompt || row.label,
    model: row.model,
    ratio: inputs?.aspect_ratio,
    resolution: inputs?.resolution,
    resultUrl: primaryUrl,
    outputs: outputs.length > 0 ? outputs : undefined,
    resultText: row.result_text,
    error: row.error_reason,
    createdAt: row.created_at,
  };
}

export function isRiverTaskActive(task: RiverTask) {
  return task.status === 'submitting' || task.status === 'queued' || task.status === 'running';
}

export function riverTaskId(task: RiverTask) {
  return task.requestId || task.id;
}

function hasFinished(task: RiverTask) {
  return task.status === 'succeeded' || task.status === 'failed' || task.status === 'canceled';
}

export function recordRiverActivity(previous: RiverTask[], incoming: RiverTask[], time: number) {
  let next = previous;
  for (const task of incoming) {
    const id = riverTaskId(task);
    const existing = next.find(item => riverTaskId(item) === id || item.id === task.id);
    if (existing?.status === task.status && existing.requestId === task.requestId) continue;
    if (existing && hasFinished(existing) && !hasFinished(task)) continue;
    next = [
      { ...existing, ...task, announcedAt: time },
      ...next.filter(item => riverTaskId(item) !== id && item.id !== task.id),
    ].slice(0, 20);
  }
  return next;
}

export function changedRiverTasks(previous: RiverTask[], current: RiverTask[]) {
  const statuses = new Map(previous.map(task => [riverTaskId(task), task.status]));
  return current.filter(task => {
    const oldStatus = statuses.get(riverTaskId(task));
    return oldStatus === undefined ? isRiverTaskActive(task) : oldStatus !== task.status;
  }).reverse();
}

export function mergeRiverTasks(server: RiverTask[], local: RiverTask[]) {
  const tasks = new Map(server.map(task => [task.id, task]));
  for (const attempt of local) {
    const id = riverTaskId(attempt);
    const stored = tasks.get(id);
    if (stored && (!isRiverTaskActive(stored) || isRiverTaskActive(attempt))) {
      tasks.set(id, {
        ...attempt,
        ...stored,
        prompt: stored.prompt || attempt.prompt,
        resultText: stored.resultText || attempt.resultText,
        resultUrl: stored.resultUrl || attempt.resultUrl,
      });
    } else {
      tasks.set(id, { ...stored, ...attempt });
    }
  }
  return [...tasks.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function readGenerationRiver(owner: string, signal?: AbortSignal, followed: RiverTask[] = []) {
  const params = new URLSearchParams({ limit: '30', includeActive: 'true' });
  const ids = new Set(followed.filter(task => task.requestId && (isRiverTaskActive(task) || task.status === 'checking')).map(riverTaskId));
  for (const id of [...ids].slice(0, 100)) params.append('track', id);
  const result = await apiRequest<{ creations: ServerCreation[] }>(`/api/generations?${params}`, {
    contract: 'domain', cache: 'no-store', headers: { 'X-ONE-Expected-User': owner }, signal,
  });
  return result.creations.map(fromServer);
}

const homeStudios: Record<string, HomeRiverMode> = {
  'home-image': 'image', 'home-video': 'video', 'home-audio': 'audio',
  'home-digital-human': 'digital-human', 'home-avatar-speech': 'digital-human', 'home-agent': 'agent',
};

function homeRiverMode(studio: string) {
  return Object.hasOwn(homeStudios, studio) ? homeStudios[studio] : undefined;
}

export function canRestoreHomeTask(task: RiverTask) {
  return Boolean(task.studioId && homeRiverMode(task.studioId)) &&
    (task.status === 'failed' || task.status === 'canceled' ||
      (task.studioId === 'home-avatar-speech' && task.status === 'succeeded' && ownedReference(task.resultUrl)));
}

function ownedReference(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const asset = /^koyo-asset:([A-Za-z0-9_-]{1,160})$/.exec(value);
  if (asset) return `/api/assets/${asset[1]}/download?inline=1`;
  return /^\/api\/assets\/[A-Za-z0-9_-]{1,160}\/download(?:\?inline=1)?$/.test(value) ? value : undefined;
}

function stringValue(value: unknown) { return typeof value === 'string' ? value : undefined; }
function numberValue(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function boolValue(value: unknown) { return typeof value === 'boolean' ? value : undefined; }

type HomeCreation = Omit<ServerCreation, 'input_summary_json'> & {
  input_summary_json?: Record<string, unknown>;
};

export function restoreHomeCreation(creation: HomeCreation): HomeRiverDraft | undefined {
  const studio = creation.studio_id || '';
  const mode = homeRiverMode(studio);
  if (!mode) return undefined;
  const status = normalizeRiverStatus(creation.status);
  const avatarSpeech = studio === 'home-avatar-speech';
  const readySpeech = avatarSpeech && status === 'succeeded';
  if (!readySpeech && status !== 'failed' && status !== 'canceled') return undefined;

  const input = creation.input_summary_json || {};
  const fields: Record<string, unknown> = { prompt: stringValue(input.prompt) ?? creation.label ?? '' };
  if (!avatarSpeech) fields.modelId = creation.model;
  if (mode === 'image' || mode === 'video') {
    fields.ar = stringValue(input.aspect_ratio);
    fields.imageUrls = Array.isArray(input.image_urls)
      ? input.image_urls.map(ownedReference).filter(Boolean) : [];
  }
  switch (mode) {
    case 'image':
      fields.quality = stringValue(input.resolution);
      fields.width = numberValue(input.width);
      fields.height = numberValue(input.height);
      fields.batch = numberValue(input.batch_size);
      fields.advanced = { seed: numberValue(input.seed) ?? -1, negativePrompt: stringValue(input.negative_prompt) ?? '' };
      break;
    case 'video':
      fields.videoMode = stringValue(input.reference_mode);
      fields.resolution = stringValue(input.resolution);
      fields.duration = numberValue(input.duration);
      fields.firstFrameUrl = ownedReference(input.first_frame_url) || null;
      fields.endFrameUrl = ownedReference(input.end_frame_url) || null;
      fields.videoRefUrl = ownedReference(input.video_url) || null;
      fields.advanced = { cameraMotion: stringValue(input.camera_motion) ?? 'fixed', generateAudio: boolValue(input.generate_audio) ?? true };
      break;
    case 'audio': {
      const music = creation.model === 'suno-create-music' || typeof input.custom_mode === 'boolean';
      const clone = creation.model === 'minimax-voice-clone' || typeof input.custom_voice_id === 'string';
      fields.subMode = music ? 'music' : clone ? 'clone' : 'tts';
      fields.musicStyle = stringValue(input.style);
      fields.isInstrumental = boolValue(input.instrumental);
      fields.voiceId = stringValue(input.voice_id);
      fields.speed = numberValue(input.speed);
      fields.cloneAudioUrl = ownedReference(input.audio_url) || null;
      break;
    }
    case 'digital-human':
      if (avatarSpeech) {
        const output = creation.asset_id
          ? ownedReference(`koyo-asset:${creation.asset_id}`) : ownedReference(creation.result_url);
        if (readySpeech && !output) return undefined;
        fields.driveType = readySpeech ? 'audio' : 'text';
        fields.driveAudioUrl = output || null;
        fields.voiceId = stringValue(input.voice_id);
      } else {
        fields.driveType = 'audio';
        fields.avatarKind = input.video_url ? 'video' : 'image';
        fields.avatarUrl = ownedReference(input.video_url || input.image_url) || null;
        fields.driveAudioUrl = ownedReference(input.audio_url) || null;
        fields.resolution = stringValue(input.resolution);
      }
      break;
  }
  return { mode, fields: Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) };
}

export async function readHomeRiverDraft(id: string, signal: AbortSignal, owner: string) {
  const response = await apiRequest<{ creation: HomeCreation }>(`/api/generations?id=${encodeURIComponent(id)}`, {
    cache: 'no-store', headers: { 'X-ONE-Expected-User': owner }, signal,
  });
  return restoreHomeCreation(response.creation);
}
