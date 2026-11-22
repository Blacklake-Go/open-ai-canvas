/**
 * 反馈附件与 GitHub 链接的共享校验：客户端选择文件、服务端接收 multipart 都走这一份，
 * 保证"前端显示 30MB"和"后端真正接受 30MB"不会各说各话。
 * 这里不引入 Node 专用模块，浏览器与 route handler 都能直接 import。
 */
export const FEEDBACK_ATTACHMENT_MAX_FILES = 5;
export const FEEDBACK_ATTACHMENT_MAX_TOTAL_BYTES = 30 * 1024 * 1024;

/** 白名单同时约束扩展名与上传类型，故意不收 SVG / HTML 等可执行内容。 */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg']);
const FILE_EXTENSIONS = new Set(['pdf', 'txt', 'log', 'json', 'zip']);

const ALLOWED_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...FILE_EXTENSIONS,
]);

export const FEEDBACK_ATTACHMENT_ACCEPT = [
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...FILE_EXTENSIONS,
]
  .map((ext) => `.${ext}`)
  .join(',');

export const FEEDBACK_ATTACHMENT_KIND_LABELS = {
  image: '图片',
  video: '视频',
  audio: '音频',
  file: '文件',
};

function extensionOf(name) {
  const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

function sanitizeFileName(name) {
  return String(name || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .trim()
    .slice(0, 200);
}

export function getFeedbackAttachmentKind(name, mimeType = '') {
  const ext = extensionOf(name);
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (mime.startsWith('audio/') || AUDIO_EXTENSIONS.has(ext)) return 'audio';
  return 'file';
}

/** 映射到 ingestBuffer 的存储类型；document 只接受 PDF，其余文本/压缩包归入 other。 */
export function getFeedbackAttachmentStorageType(name, mimeType = '') {
  const kind = getFeedbackAttachmentKind(name, mimeType);
  if (kind === 'image' || kind === 'video' || kind === 'audio') return kind;
  return extensionOf(name) === 'pdf' ? 'document' : 'other';
}

export function formatFeedbackBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

/**
 * 返回 `{ items, totalBytes }` 或 `{ error }`。items 保留原始文件引用，
 * 调用方（API）再逐个读取 arrayBuffer；元数据里的 name 已去掉路径并截断。
 */
export function validateFeedbackAttachments(files) {
  const list = Array.from(files || []).filter(Boolean);
  if (list.length === 0) return { items: [], totalBytes: 0 };
  if (list.length > FEEDBACK_ATTACHMENT_MAX_FILES) {
    return { error: `最多上传 ${FEEDBACK_ATTACHMENT_MAX_FILES} 个附件，请合并或删除多余文件` };
  }

  const items = [];
  let totalBytes = 0;

  for (const file of list) {
    const name = sanitizeFileName(file?.name);
    const sizeBytes = Number(file?.size);
    if (!name || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return { error: '存在无法读取的空附件，请重新选择文件' };
    }
    if (sizeBytes > FEEDBACK_ATTACHMENT_MAX_TOTAL_BYTES) {
      return { error: `单个附件不能超过 ${formatFeedbackBytes(FEEDBACK_ATTACHMENT_MAX_TOTAL_BYTES)}` };
    }
    const ext = extensionOf(name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return {
        error: `不支持 ${ext ? `.${ext}` : '该类型'} 文件；可用图片、视频、音频、PDF、TXT、LOG、JSON 或 ZIP`,
      };
    }

    totalBytes += sizeBytes;
    if (totalBytes > FEEDBACK_ATTACHMENT_MAX_TOTAL_BYTES) {
      return { error: `附件总大小不能超过 ${formatFeedbackBytes(FEEDBACK_ATTACHMENT_MAX_TOTAL_BYTES)}` };
    }

    const mimeType = String(file?.type || '').toLowerCase();
    items.push({
      file,
      name,
      sizeBytes,
      mimeType,
      kind: getFeedbackAttachmentKind(name, mimeType),
      storageType: getFeedbackAttachmentStorageType(name, mimeType),
    });
  }

  return { items, totalBytes };
}

/** 只接受 github.com 上具体仓库 / Issue / PR / Discussion 的链接；空值表示不填。 */
export function normalizeGithubUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return { url: null };
  if (raw.length > 500) return { error: 'GitHub 链接过长，请填写 500 字以内的地址' };

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: 'GitHub 链接格式不正确，请粘贴完整地址' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { error: 'GitHub 链接必须以 http(s):// 开头' };
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') {
    return { error: '请填写 github.com 上的仓库或 Issue 链接' };
  }
  if (!/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/|$)/.test(parsed.pathname)) {
    return { error: '请填写具体仓库、Issue 或 PR 的链接' };
  }

  parsed.hash = '';
  return { url: parsed.toString().replace(/\/$/, '') };
}
