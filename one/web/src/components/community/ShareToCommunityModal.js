'use client';

import { useState, useEffect } from 'react';
import { AudioLines, Clapperboard, Image as ImageIcon, Send, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const PRESET_TAGS = ['赛博朋克', '动漫二次元', '超写实', '电影光影', '概念设计', '国风古韵', '未来科技', '复古胶片', '治愈系', '史诗大片', '迷幻电子', '超高清壁纸'];

export default function ShareToCommunityModal({ creation, onClose, onSuccess }) {
  const source = creation || {};
  const id = String(source.studio_id || source.studioId || '').toLowerCase();
  const type = id.includes('video') || id.includes('motion') || id.includes('cinema') || id.includes('lip') ? 'video' : id.includes('audio') || id.includes('music') || id.includes('sound') ? 'audio' : 'image';
  const TypeIcon = type === 'video' ? Clapperboard : type === 'audio' ? AudioLines : ImageIcon;
  const metadata = typeof source.metadata_json === 'object' ? (source.metadata_json || {}) : {};
  const prompt = source.label || metadata.prompt || '';
  const [title, setTitle] = useState(source.label ? source.label.slice(0, 40) : '我的 AI 创意作品');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState(['超写实']);
  const [customTag, setCustomTag] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!creation) return null;
  const toggleTag = (tag) => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : current.length < 6 ? [...current, tag] : current);
  const addCustomTag = (event) => { if (event.key !== 'Enter') return; event.preventDefault(); const value = customTag.trim(); if (value && !tags.includes(value) && tags.length < 6) { setTags((current) => [...current, value]); setCustomTag(''); } };
  const submit = async (event) => { event.preventDefault(); setError(''); setSubmitting(true); try { const response = await fetch('/api/community/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creationId: creation.id, title: title.trim(), description: description.trim(), mediaType: type, mediaUrl: creation.result_url || creation.resultUrl, coverUrl: creation.result_url || creation.resultUrl, prompt, modelName: source.model || metadata.model || '', parameters: metadata, tags }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || '发布失败，请稍后重试'); onSuccess?.(data.post); onClose?.(); } catch (submitError) { setError(submitError.message); } finally { setSubmitting(false); } };
  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-scrim p-4 backdrop-blur-xl animate-in fade-in duration-modal ease-enter"
      onClick={onClose}
    >
      <Card
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-overlay shadow-elevation-4"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 rounded-full active:scale-[0.98] active:duration-instant"
          onClick={onClose}
          aria-label="关闭"
        >
          <X />
        </Button>
        <CardHeader className="p-6">
          <Badge variant="outline" className="w-fit border-brand-line bg-brand-soft text-brand">
            社区展示
          </Badge>
          <CardTitle className="mt-3 text-xl font-bold text-ink">分享作品到社区</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="flex items-center gap-3 rounded-xl border border-line-subtle bg-well p-3">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface text-brand">
              {type === 'video' ? (
                <video src={source.result_url || source.resultUrl} muted className="size-full object-cover" />
              ) : type === 'audio' ? (
                <AudioLines />
              ) : (
                <img src={source.result_url || source.resultUrl} alt="作品预览" className="size-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-semibold text-brand">
                <TypeIcon />
                {type === 'video' ? 'AI 视频作品' : type === 'audio' ? 'AI 音乐作品' : 'AI 图像作品'}
              </p>
              <p className="mt-1 truncate text-xs text-ink-muted">{prompt || '未指定提示词'}</p>
            </div>
          </div>
          {error && (
            <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
          <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-ink">
              作品标题
              <Input
                required
                maxLength={60}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="给作品起一个标题"
                className="rounded-xl border-line bg-well text-ink"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-ink">
              创作描述（选填）
              <Textarea
                rows={3}
                maxLength={300}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="分享灵感来源、构图技巧或参数心得"
                className="rounded-xl border-line bg-well text-ink"
              />
            </label>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm font-medium text-ink">
                <span>精选标签</span>
                <span className="text-xs text-ink-muted">{tags.length}/6</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_TAGS.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    size="xs"
                    variant={tags.includes(tag) ? 'default' : 'secondary'}
                    onClick={() => toggleTag(tag)}
                    className="rounded-full"
                  >
                    #{tag}
                  </Button>
                ))}
              </div>
              <Input
                className="mt-3 rounded-xl border-line bg-well text-ink"
                value={customTag}
                onChange={(event) => setCustomTag(event.target.value)}
                onKeyDown={addCustomTag}
                placeholder="输入后按 Enter 添加自定义标签"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-line-subtle pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '正在发布…' : '立即公开发布'}
                <Send data-icon="inline-end" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
