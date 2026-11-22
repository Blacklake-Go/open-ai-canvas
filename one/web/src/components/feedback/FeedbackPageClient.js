'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertCircle,
  ArrowUpRight,
  Bug,
  CheckCircle2,
  Clock3,
  Coins,
  FileText,
  Film,
  ImageIcon,
  Lightbulb,
  LockKeyhole,
  Mail,
  MessageSquarePlus,
  Music,
  Paperclip,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import StudioHeader from '@/components/site/StudioHeader';
import { SpatialBackground } from '@/components/spatial';
import AboutFooter from '@/components/about/AboutFooter';
import AuthModal from '@/components/AuthModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUserSession } from '@/lib/hooks/useUserSession';
import { normalizeLocale, matchPathLocale } from '@/lib/locales';
import {
  DEFAULT_FEEDBACK_SUPPORT_EMAIL,
  FEEDBACK_KINDS,
  FEEDBACK_STATUS_LABELS,
  findFeedbackKind,
} from '@/lib/feedback/catalog';
import {
  FEEDBACK_ATTACHMENT_ACCEPT,
  FEEDBACK_ATTACHMENT_MAX_FILES,
  FEEDBACK_ATTACHMENT_MAX_TOTAL_BYTES,
  formatFeedbackBytes,
  getFeedbackAttachmentKind,
  validateFeedbackAttachments,
} from '@/lib/feedback/attachments';

const KIND_ICONS = {
  bug_report: Bug,
  improvement: Lightbulb,
  security: ShieldAlert,
};

const STATUS_STYLES = {
  pending: { className: 'border-warning-line bg-warning-soft text-warning', Icon: Clock3 },
  accepted: { className: 'border-success-line bg-success-soft text-success', Icon: CheckCircle2 },
  rejected: { className: 'border-danger-line bg-danger-soft text-danger', Icon: AlertCircle },
};

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN');
}

function AttachmentIcon({ kind }) {
  if (kind === 'image') return <ImageIcon className="size-4 text-brand" />;
  if (kind === 'video') return <Film className="size-4 text-brand" />;
  if (kind === 'audio') return <Music className="size-4 text-brand" />;
  return <FileText className="size-4 text-brand" />;
}

export default function FeedbackPageClient({ supportEmail = DEFAULT_FEEDBACK_SUPPORT_EMAIL }) {
  const pathname = usePathname();
  const { user, mutate } = useUserSession();
  const activeLocale = normalizeLocale(matchPathLocale(pathname) || user?.locale || 'zh');

  const [kind, setKind] = useState(FEEDBACK_KINDS[0].id);
  const [title, setTitle] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [detail, setDetail] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const inputRef = useRef(null);
  const attachmentsRef = useRef([]);
  const fileIdRef = useRef(0);

  const loadMine = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setItemsLoading(true);
    try {
      const res = await fetch('/api/feedback', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch {
      // 保持静默
    } finally {
      setItemsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadMine();
    }
  }, [user, loadMine]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(
    () => () => {
      attachmentsRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    [],
  );

  function addFiles(incoming) {
    const list = Array.from(incoming || []);
    if (list.length === 0) return;

    const combined = [...attachments.map((item) => item.file), ...list];
    const check = validateFeedbackAttachments(combined);
    if (check.error) {
      setFieldErrors((prev) => ({ ...prev, attachments: check.error }));
      return;
    }

    const next = list.map((file) => ({
      id: `attachment-${Date.now()}-${fileIdRef.current++}`,
      file,
      kind: getFeedbackAttachmentKind(file.name, file.type),
      previewUrl: String(file.type || '').startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
    setAttachments((prev) => [...prev, ...next]);
    setFieldErrors((prev) => ({ ...prev, attachments: undefined }));
    setMessage(null);
  }

  function removeAttachment(id) {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
    setFieldErrors((prev) => ({ ...prev, attachments: undefined }));
  }

  function clearAttachments() {
    attachments.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setAttachments([]);
  }

  function validateForm() {
    const errors = {};
    if (title.trim().length < 5) errors.title = '标题不少于 5 个字，方便定位问题';
    if (detail.trim().length < 20) errors.detail = '详细说明不少于 20 个字，请写清复现步骤或改进理由';
    const files = validateFeedbackAttachments(attachments.map((item) => item.file));
    if (files.error) errors.attachments = files.error;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);

    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('kind', kind);
      formData.append('title', title.trim());
      formData.append('pageUrl', pageUrl.trim());
      formData.append('detail', detail.trim());
      attachments.forEach((item) => formData.append('attachments', item.file, item.file.name));

      const res = await fetch('/api/feedback', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: 'error', text: data.error || '提交失败，请稍后重试' });
        return;
      }

      setMessage({
        tone: 'success',
        text: data.message || '提交成功，审核通过后硬币会自动到账。',
      });
      setTitle('');
      setPageUrl('');
      setDetail('');
      clearAttachments();
      setFieldErrors({});
      await loadMine();
    } catch {
      setMessage({ tone: 'error', text: '网络异常，提交未送达。请检查网络后重试。' });
    } finally {
      setSubmitting(false);
    }
  }

  const totalAttachmentBytes = attachments.reduce((sum, item) => sum + Number(item.file.size || 0), 0);

  return (
    <div className="relative min-h-screen bg-canvas text-ink selection:bg-brand selection:text-white flex flex-col justify-between overflow-x-hidden">
      {/* 空间极光背景与点阵微光（与首页视觉一致） */}
      <SpatialBackground variant="studio" />
      <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none z-0" />

      {/* 统一顶栏 */}
      <StudioHeader activeTab={null} className="relative z-40" />

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* 顶部精简 Hero 卡片 */}
        <section className="relative overflow-hidden rounded-2xl border border-line-subtle bg-surface/80 backdrop-blur-md p-6 shadow-elevation-1 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-brand-soft blur-3xl opacity-60" aria-hidden="true" />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft px-3 py-1 text-caption font-semibold text-brand">
              <MessageSquarePlus className="size-3.5" />
              建议与需求
            </span>
            <h1 className="mt-4 text-page-title font-bold tracking-tight text-ink sm:text-display">
              把问题留在这里，我们逐条看
            </h1>
            <p className="mt-2 text-body-sm text-ink-muted leading-relaxed">
              报错、体验建议或安全漏洞均可提交。有效采纳后发放硬币奖励。
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-caption text-ink-muted">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-wash px-3 py-1">
                <Paperclip className="size-3.5 text-brand" />
                附件合计 ≤ 30MB
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-wash px-3 py-1">
                <FileText className="size-3.5 text-brand" />
                最多 5 个文件
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-wash px-3 py-1">
                <Coins className="size-3.5 text-brand" />
                采纳即送硬币
              </span>
            </div>
          </div>
        </section>

        {/* 双列布局：左侧表单，右侧渠道 */}
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-line-subtle bg-surface/80 backdrop-blur-md shadow-elevation-1 lg:col-span-2">
            <div className="border-b border-line-subtle px-5 py-4 sm:px-6">
              <h2 className="text-section-title font-semibold text-ink">提交内容</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6" noValidate>
              {!user && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-line bg-brand-soft px-4 py-3">
                  <p className="flex items-center gap-2 text-body-sm text-ink font-medium">
                    <LockKeyhole className="size-4 text-brand" />
                    提交需要登录，硬币奖励会发放到你的账号。
                  </p>
                  <Button type="button" size="sm" variant="primary" onClick={() => setShowAuthModal(true)}>
                    登录 / 注册
                  </Button>
                </div>
              )}

              {/* 反馈类型 */}
              <fieldset>
                <legend className="text-label font-medium text-ink">
                  反馈类型 <span className="text-danger">*</span>
                </legend>
                <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
                  {FEEDBACK_KINDS.map((item) => {
                    const Icon = KIND_ICONS[item.id] || Sparkles;
                    const selected = kind === item.id;
                    return (
                      <label key={item.id} className="cursor-pointer">
                        <input
                          type="radio"
                          name="feedback-kind"
                          value={item.id}
                          checked={selected}
                          onChange={() => {
                            setKind(item.id);
                            setMessage(null);
                          }}
                          className="peer sr-only"
                        />
                        <span
                          className={`flex h-full flex-col rounded-xl border p-3.5 transition-all duration-fast peer-focus-visible:ring-2 peer-focus-visible:ring-brand-ring ${
                            selected
                              ? 'border-brand-ring bg-brand-soft shadow-elevation-1'
                              : 'border-line bg-well/70 hover:border-line-strong hover:bg-wash'
                          }`}
                        >
                          <span className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-body-sm font-semibold text-ink">
                              <Icon className={`size-4 ${selected ? 'text-brand' : 'text-ink-muted'}`} />
                              {item.label}
                            </span>
                            <span className="inline-flex items-center gap-1 text-micro font-semibold text-brand">
                              <Coins className="size-3" />
                              +{item.rewardDefault} 币
                            </span>
                          </span>
                          <span className="mt-1.5 text-caption leading-relaxed text-ink-muted">{item.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {/* 标题 */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="feedback-title" className="text-label font-medium text-ink">
                  标题 <span className="text-danger">*</span>
                </label>
                <Input
                  id="feedback-title"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  maxLength={200}
                  placeholder="一句话说明问题或建议"
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.title)}
                  error={Boolean(fieldErrors.title)}
                  className="rounded-xl bg-well/70 border-line hover:border-line-strong focus:border-brand-line"
                />
                {fieldErrors.title && (
                  <p id="feedback-title-error" className="text-caption text-danger flex items-center gap-1" role="alert">
                    <AlertCircle className="size-3.5" />
                    {fieldErrors.title}
                  </p>
                )}
              </div>

              {/* 涉及页面 */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="feedback-page" className="text-label font-medium text-ink">涉及页面（选填）</label>
                <Input
                  id="feedback-page"
                  value={pageUrl}
                  onChange={(event) => setPageUrl(event.target.value)}
                  maxLength={500}
                  placeholder="/studio 或具体地址"
                  className="rounded-xl bg-well/70 font-mono text-body-sm border-line hover:border-line-strong focus:border-brand-line"
                />
              </div>

              {/* 详细说明 */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="feedback-detail" className="text-label font-medium text-ink">
                  详细说明 <span className="text-danger">*</span>
                </label>
                <Textarea
                  id="feedback-detail"
                  value={detail}
                  onChange={(event) => {
                    setDetail(event.target.value);
                    if (fieldErrors.detail) setFieldErrors((prev) => ({ ...prev, detail: undefined }));
                  }}
                  maxLength={4000}
                  rows={6}
                  placeholder="复现步骤、期望结果与实际结果；建议类请说明它解决了什么问题。"
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.detail)}
                  error={Boolean(fieldErrors.detail)}
                  className="rounded-xl bg-well/70 border-line hover:border-line-strong focus:border-brand-line"
                />
                <div className="flex items-center justify-between text-caption text-ink-muted">
                  {fieldErrors.detail ? (
                    <p id="feedback-detail-error" className="text-caption text-danger flex items-center gap-1" role="alert">
                      <AlertCircle className="size-3.5" />
                      {fieldErrors.detail}
                    </p>
                  ) : (
                    <span className="text-micro text-ink-muted">建议附上复现步骤与预期结果</span>
                  )}
                  <span className="tabular-nums text-micro">{detail.length} / 4000</span>
                </div>
              </div>

              {/* 截图与附件 */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-label font-medium text-ink">截图与媒体（选填）</span>
                  <span className="text-micro text-ink-muted">最多 5 个，合计 ≤ 30MB</span>
                </div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    addFiles(event.dataTransfer?.files);
                  }}
                  className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-6 px-4 text-center transition-colors duration-fast cursor-pointer ${
                    dragging
                      ? 'border-brand-ring bg-brand-soft'
                      : 'border-line bg-well/50 hover:border-line-strong hover:bg-wash'
                  }`}
                >
                  <span className="flex size-10 items-center justify-center rounded-xl border border-line bg-scrim text-brand">
                    <UploadCloud className="size-5" />
                  </span>
                  <span className="text-body-sm font-medium text-ink">把截图、录屏或日志拖到这里，或点击选择文件</span>
                  <span className="text-caption text-ink-muted">
                    支持常见图片、音视频及文本日志
                  </span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={FEEDBACK_ATTACHMENT_ACCEPT}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="sr-only"
                  onChange={(event) => {
                    addFiles(event.target.files);
                    event.target.value = '';
                  }}
                />

                {fieldErrors.attachments && (
                  <p className="text-caption text-danger flex items-center gap-1" role="alert">
                    <AlertCircle className="size-3.5" />
                    {fieldErrors.attachments}
                  </p>
                )}

                {attachments.length > 0 && (
                  <ul className="mt-1 grid gap-2 sm:grid-cols-2">
                    {attachments.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 rounded-xl border border-line bg-well p-2.5">
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-scrim">
                          {item.previewUrl ? (
                            <img src={item.previewUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <AttachmentIcon kind={item.kind} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-sm font-medium text-ink">{item.file.name}</span>
                          <span className="block text-caption text-ink-muted">{formatFeedbackBytes(item.file.size)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(item.id)}
                          aria-label={`移除附件 ${item.file.name}`}
                          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-wash hover:text-ink transition-colors"
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {attachments.length > 0 && (
                  <p className="text-caption text-ink-muted text-end tabular-nums">
                    已选 {attachments.length} 个 · {formatFeedbackBytes(totalAttachmentBytes)} / {formatFeedbackBytes(FEEDBACK_ATTACHMENT_MAX_TOTAL_BYTES)}
                  </p>
                )}
              </div>

              {/* 提交操作栏 */}
              <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-5">
                <Button type="submit" variant="primary" size="md" loading={submitting} className="rounded-xl font-semibold gap-2 shadow-elevation-1">
                  {!submitting && <Send className="size-4" />}
                  <span>{submitting ? '提交中…' : user ? '提交审核' : '登录后提交'}</span>
                </Button>
                {message && (
                  <p
                    role={message.tone === 'error' ? 'alert' : 'status'}
                    className={`text-body-sm flex items-center gap-1.5 ${
                      message.tone === 'error' ? 'text-danger' : 'text-success'
                    }`}
                  >
                    {message.tone === 'error' ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
                    <span>{message.text}</span>
                  </p>
                )}
              </div>
            </form>
          </section>

          {/* 右侧精简渠道面板 */}
          <aside className="space-y-4">
            <section className="rounded-2xl border border-line-subtle bg-surface/80 backdrop-blur-md p-5 shadow-elevation-1">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl border border-brand-line bg-brand-soft text-brand">
                  <Mail className="size-4" />
                </span>
                <div>
                  <h2 className="text-card-title font-semibold text-ink">需要人工沟通？</h2>
                  <p className="text-caption text-ink-muted">直接发邮件给客服邮箱</p>
                </div>
              </div>
              <a
                href={`mailto:${supportEmail}`}
                className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-line bg-well/70 px-3.5 py-2.5 text-body-sm font-semibold text-ink transition-colors hover:border-line-strong hover:bg-wash"
              >
                <span className="truncate">{supportEmail}</span>
                <ArrowUpRight className="size-4 shrink-0 text-brand" />
              </a>
            </section>

            <section className="rounded-2xl border border-line-subtle bg-surface/80 backdrop-blur-md p-5 shadow-elevation-1">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl border border-brand-line bg-brand-soft text-brand">
                  <Coins className="size-4" />
                </span>
                <h2 className="text-card-title font-semibold text-ink">审核与奖励</h2>
              </div>
              <ul className="mt-3 space-y-2">
                {FEEDBACK_KINDS.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 text-body-sm">
                    <span className="text-ink-muted">{item.label}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand">
                      <Coins className="size-3" />
                      +{item.rewardDefault} 币起
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-line-subtle pt-3">
                <Link href="/benefits" className="text-caption text-brand hover:text-brand-hover inline-flex items-center gap-1">
                  <span>查看硬币权益详情</span>
                  <ArrowUpRight className="size-3" />
                </Link>
              </div>
            </section>
          </aside>
        </div>

        {/* 底部我的提交历史 */}
        <section className="rounded-2xl border border-line-subtle bg-surface/80 backdrop-blur-md shadow-elevation-1">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-section-title font-semibold text-ink">我的提交</h2>
              <p className="mt-1 text-body-sm text-ink-muted">最近 20 条提交与审核结果。</p>
            </div>
            {user && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={loadMine}
                loading={itemsLoading}
                className="rounded-full gap-1 text-ink-muted hover:text-ink"
              >
                <RefreshCw className="size-3.5" />
                <span>刷新</span>
              </Button>
            )}
          </div>

          {!user ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-8 sm:px-6">
              <p className="text-body-sm text-ink-muted">登录后可以在这里查看自己的提交记录与审核回复。</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAuthModal(true)} className="rounded-xl">
                登录查看
              </Button>
            </div>
          ) : itemsLoading && items.length === 0 ? (
            <div className="py-10 text-center text-body-sm text-ink-muted flex items-center justify-center gap-2">
              <RefreshCw className="size-4 animate-spin text-brand" />
              <span>正在加载提交记录…</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-well text-ink-muted">
                <MessageSquarePlus className="size-5" />
              </span>
              <p className="mt-3 text-body-sm font-semibold text-ink">还没有提交记录</p>
              <p className="mt-1 text-caption text-ink-muted">从上面的表单提交一条，采纳后硬币会出现在你的账号里。</p>
            </div>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {items.map((item) => {
                const status = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
                const StatusIcon = status.Icon;
                return (
                  <li key={item.id} className="px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body-sm font-semibold text-ink">{item.title}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-micro font-semibold ${status.className}`}>
                        <StatusIcon className="size-3" />
                        {FEEDBACK_STATUS_LABELS[item.status] || item.status}
                      </span>
                      {item.rewardCoins > 0 && (
                        <span className="inline-flex items-center gap-1 text-micro font-semibold text-brand">
                          <Coins className="size-3" />
                          +{item.rewardCoins} 枚硬币
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-ink-muted">
                      <span>{findFeedbackKind(item.kind)?.label || item.kind}</span>
                      {item.pageUrl && <span className="truncate">· {item.pageUrl}</span>}
                      {item.attachmentCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          · <Paperclip className="size-3" /> {item.attachmentCount} 个附件
                        </span>
                      )}
                      <span>· {formatTime(item.createdAt)}</span>
                    </p>
                    {item.reviewNote && (
                      <p className="mt-2 rounded-xl border border-line bg-well px-3 py-2 text-caption leading-relaxed text-ink-muted">
                        审核回复：{item.reviewNote}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      {/* 底部关于页面统一页脚 */}
      <AboutFooter locale={activeLocale} />

      {/* 登录弹窗 */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={async () => {
            setShowAuthModal(false);
            if (mutate) await mutate();
            await loadMine();
          }}
        />
      )}
    </div>
  );
}
