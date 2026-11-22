'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  KeyRound,
  Image as ImageIcon,
  Video,
  Music,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Heart,
  Calendar,
} from 'lucide-react';
import { PageHeader, StatusBadge, AdminSettingRow } from '@/components/admin/AdminUi';

export default function XPromptsConsoleClient({ initialData, initialConfig }) {
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'console'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'image' | 'video' | 'music' | 'adopted'
  const [authorFilter, setAuthorFilter] = useState('all');
  const [authorsList, setAuthorsList] = useState(initialData?.authors || []);
  const [searchQuery, setSearchQuery] = useState('');

  const [prompts, setPrompts] = useState(initialData?.items || []);
  const [counts, setCounts] = useState(initialData?.counts || { all: 0, image: 0, video: 0, music: 0, adopted: 0 });
  const [config, setConfig] = useState(initialConfig);

  const [copiedId, setCopiedId] = useState(null);
  const [adoptingId, setAdoptingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // 弹窗状态
  const [crawlModalOpen, setCrawlModalOpen] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [crawlCategory, setCrawlCategory] = useState('all');
  const [crawlLimit, setCrawlLimit] = useState(15);
  const [crawlTargetAuthor, setCrawlTargetAuthor] = useState('');
  const [crawlFeedback, setCrawlFeedback] = useState(null);

  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [cookieForm, setCookieForm] = useState({
    authToken: '',
    ct0: '',
  });

  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rulesForm, setRulesForm] = useState(config?.rules || {});

  const [previewMediaUrl, setPreviewMediaUrl] = useState(null);

  // 复制提示词
  const handleCopyPrompt = (item) => {
    const textToCopy = item.prompt + (item.parameters ? ` ${item.parameters}` : '');
    navigator.clipboard?.writeText(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // 采纳到社区作品
  const handleAdopt = async (item) => {
    if (item.status === 'adopted') return;
    setAdoptingId(item.id);
    try {
      const res = await fetch('/api/admin/content/x-prompts/adopt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId: item.id }),
      });
      const data = await res.json();
      if (data.ok && data.data?.promptItem) {
        setPrompts((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, status: 'adopted', adoptedPostId: data.data.post?.id } : p))
        );
        setCounts((prev) => ({ ...prev, adopted: prev.adopted + 1 }));
      } else {
        alert(data.error?.message || '采纳失败，请稍后重试');
      }
    } catch (err) {
      alert(err.message || '网络请求错误');
    } finally {
      setAdoptingId(null);
    }
  };

  // 删除某条记录
  const handleDelete = async (id) => {
    if (!confirm('确定要从素材库中移除这条推文吗？')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/content/x-prompts?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.ok) {
        setPrompts((prev) => prev.filter((p) => p.id !== id));
        setCounts((prev) => ({ ...prev, all: Math.max(0, prev.all - 1) }));
      }
    } catch (err) {
      alert(err.message || '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  // 执行实时抓取
  const handleRunCrawl = async () => {
    setCrawling(true);
    setCrawlFeedback(null);
    try {
      const res = await fetch('/api/admin/content/x-prompts/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: crawlCategory,
          limit: crawlLimit,
          targetAuthor: crawlTargetAuthor.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        const authorMsg = crawlTargetAuthor.trim() ? `（定向作者 @${crawlTargetAuthor.trim().replace(/^@/, '')}）` : '';
        setCrawlFeedback({
          type: 'success',
          message: `抓取成功！新增 ${data.data.newAdded || 0} 条高赞案例${authorMsg}（共拉取 ${data.data.totalFetched || 0} 条）。`,
        });
        // 重新拉取素材列表
        const listRes = await fetch('/api/admin/content/x-prompts');
        const listData = await listRes.json();
        if (listData.ok && listData.data) {
          setPrompts(listData.data.items || []);
          setCounts(listData.data.counts || { all: 0, image: 0, video: 0, music: 0, adopted: 0 });
          if (listData.data.authors) {
            setAuthorsList(listData.data.authors);
          }
        }
      } else {
        setCrawlFeedback({
          type: 'error',
          message: data.error?.message || '抓取失败，请检查账号 Cookie 凭证或网络连通性。',
        });
      }
    } catch (err) {
      setCrawlFeedback({
        type: 'error',
        message: err.message || '网络请求异常',
      });
    } finally {
      setCrawling(false);
    }
  };

  // 保存 Cookie 凭据
  const handleSaveCookies = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch('/api/admin/content/x-prompts/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookies: {
            authToken: cookieForm.authToken,
            ct0: cookieForm.ct0,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfig(data.data);
        setCookieModalOpen(false);
        setCookieForm({ authToken: '', ct0: '' });
      } else {
        alert(data.error?.message || '保存凭据失败');
      }
    } catch (err) {
      alert(err.message || '网络异常');
    } finally {
      setSavingConfig(false);
    }
  };

  // 保存抓取规则
  const handleSaveRules = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch('/api/admin/content/x-prompts/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: rulesForm,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfig(data.data);
        setRulesModalOpen(false);
      } else {
        alert(data.error?.message || '保存规则失败');
      }
    } catch (err) {
      alert(err.message || '网络异常');
    } finally {
      setSavingConfig(false);
    }
  };

  // 客户端筛选
  const filteredPrompts = prompts.filter((p) => {
    if (categoryFilter === 'adopted' && p.status !== 'adopted') return false;
    if (categoryFilter !== 'all' && categoryFilter !== 'adopted' && p.category !== categoryFilter) return false;
    if (authorFilter !== 'all') {
      const cleanFilter = authorFilter.toLowerCase().replace(/^@/, '');
      if (p.author?.toLowerCase() !== cleanFilter) return false;
    }
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      const match =
        (p.prompt && p.prompt.toLowerCase().includes(term)) ||
        (p.model && p.model.toLowerCase().includes(term)) ||
        (p.author && p.author.toLowerCase().includes(term)) ||
        (p.parameters && p.parameters.toLowerCase().includes(term));
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* 顶栏标题与说明 */}
      <PageHeader
        eyebrow="内容与前台"
        title="X 灵感与提示词抓取"
        description="基于 agent-twitter-client 逆向读取 X (Twitter) 优质创作者发布的生图、生视频、生音乐案例，一键提取结构化提示词并同步沉淀到社区作品库。"
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setCrawlFeedback(null);
              setCrawlModalOpen(true);
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-brand-hover active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="size-3.5" />
            <span>⚡ 增量抓取最新</span>
          </button>
        </div>
      </PageHeader>

      {/* 微信后台规范：极简下划标尺选项卡 (WeChat Underline Tabs) */}
      <div className="flex items-center justify-between border-b border-line-subtle h-12">
        <nav className="flex items-center gap-8 h-full overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`relative h-full inline-flex items-center gap-2 text-sm transition-colors cursor-pointer ${
              activeTab === 'feed' ? 'font-semibold text-brand' : 'font-medium text-ink-muted hover:text-ink'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-4" />
              灵感素材池
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-mono font-bold ${
                activeTab === 'feed' ? 'bg-brand/15 text-brand' : 'bg-white/10 text-ink-subtle'
              }`}
            >
              {counts.all}
            </span>
            {activeTab === 'feed' && <span className="absolute bottom-0 inset-x-0 h-[2px] bg-brand rounded-full" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('console')}
            className={`relative h-full inline-flex items-center gap-2 text-sm transition-colors cursor-pointer ${
              activeTab === 'console' ? 'font-semibold text-brand' : 'font-medium text-ink-muted hover:text-ink'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="size-4" />
              抓取控制台与凭据
            </span>
            {config.cookies?.hasAuthToken ? (
              <span className="size-2 rounded-full bg-emerald-400" title="凭据已就绪" />
            ) : (
              <span className="size-2 rounded-full bg-amber-400 animate-pulse" title="未配置 Cookie" />
            )}
            {activeTab === 'console' && <span className="absolute bottom-0 inset-x-0 h-[2px] bg-brand rounded-full" />}
          </button>
        </nav>

        <div className="shrink-0 flex items-center gap-2 text-xs text-ink-subtle">
          {config.cookies?.hasAuthToken ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-emerald-400 font-mono text-[11px]">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Cookie 活跃 ({config.cookies?.authTokenMasked || '已配置'})
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-amber-400 text-[11px]">
              <span className="size-1.5 rounded-full bg-amber-400" />
              未录入 X 凭据
            </span>
          )}
        </div>
      </div>

      {/* ─── TAB 1: 灵感素材池 ─── */}
      {activeTab === 'feed' && (
        <div className="space-y-5">
          {/* 筛选与搜索工具栏 */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* 分类胶囊按钮 */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {[
                { id: 'all', label: '全部', count: counts.all, icon: null },
                { id: 'image', label: '生图', count: counts.image, icon: ImageIcon },
                { id: 'video', label: '生视频', count: counts.video, icon: Video },
                { id: 'music', label: '生音乐', count: counts.music, icon: Music },
                { id: 'adopted', label: '已采纳入库', count: counts.adopted, icon: CheckCircle2 },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = categoryFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategoryFilter(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                      isSelected
                        ? 'bg-brand/15 text-brand border border-brand/30 font-semibold'
                        : 'border border-line-subtle bg-white/[0.02] text-ink-muted hover:bg-white/[0.05] hover:text-ink'
                    }`}
                  >
                    {Icon && <Icon className="size-3.5" />}
                    <span>{item.label}</span>
                    <span className="text-[10px] opacity-75 font-mono">({item.count})</span>
                  </button>
                );
              })}
            </div>

            {/* 右侧：作者定向筛选 + 关键字搜索框 */}
            <div className="flex items-center gap-2">
              {/* 指定作者筛选下拉 */}
              <div className="relative min-w-[130px] max-w-[190px]">
                <select
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                  className="w-full h-8 pl-2.5 pr-6 text-xs rounded-lg border border-line-subtle bg-surface/80 text-ink focus:outline-none focus:border-brand/50 transition-colors cursor-pointer appearance-none truncate"
                  title="按创作者筛选"
                >
                  <option value="all">全部创作者</option>
                  {authorsList.map((a) => {
                    const handle = a.author || a.username;
                    return (
                      <option key={handle} value={handle}>
                        @{handle} ({a.count})
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-2 top-2.5 pointer-events-none text-ink-subtle text-[9px]">
                  ▼
                </div>
              </div>

              {/* 搜索框 */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-ink-subtle pointer-events-none" />
                <input
                  type="text"
                  placeholder="搜索提示词、模型、作者..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-line-subtle bg-surface/80 text-ink placeholder:text-ink-subtle focus:outline-none focus:border-brand/50 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-ink-subtle hover:text-ink"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 当指定了作者筛选时，展示高亮横幅与快速还原 */}
          {authorFilter !== 'all' && (
            <div className="flex items-center justify-between rounded-lg border border-brand/25 bg-brand/10 px-3 py-1.5 text-xs text-brand">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="size-3.5" />
                正在查看指定创作者 <strong>@{authorFilter}</strong> 的生图作品与提示词 ({filteredPrompts.length} 条)
              </span>
              <button
                type="button"
                onClick={() => setAuthorFilter('all')}
                className="inline-flex items-center gap-1 text-[11px] font-semibold underline hover:text-brand-hover cursor-pointer"
              >
                清除作者筛选
              </button>
            </div>
          )}

          {/* 素材卡片瀑布网格 (3 列) */}
          {filteredPrompts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-12 text-center backdrop-blur-sm">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-line-subtle bg-white/[0.04] text-ink-muted">
                <Sparkles className="size-6 text-brand" />
              </div>
              <p className="mt-4 font-semibold text-ink text-sm">暂未找到匹配的提示词案例</p>
              <p className="mt-1 text-xs text-ink-muted max-w-sm mx-auto">
                可尝试清空搜索词，或点击右上角「⚡ 增量抓取最新」从 X 抓取最新案例。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
              {filteredPrompts.map((item) => {
                const isCopied = copiedId === item.id;
                const isAdopting = adoptingId === item.id;
                const isAdopted = item.status === 'adopted';

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-xl border border-line-subtle bg-surface/90 p-4 transition-all duration-200 hover:border-line hover:shadow-elevation-1 group"
                  >
                    {/* 卡片头部：作者信息 + 来源链接 */}
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-line-subtle/60">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={item.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                            alt={item.author}
                            className="size-7 rounded-full border border-line-subtle object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setAuthorFilter(item.author)}
                              className="text-xs font-semibold text-ink truncate leading-tight hover:text-brand cursor-pointer text-left block"
                              title="点击筛选该创作者的所有生图作品"
                            >
                              {item.authorName || item.author}
                            </button>
                            <a
                              href={item.tweetUrl ? `https://x.com/${item.author}` : '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-ink-subtle font-mono truncate hover:text-brand block"
                              title="在 X 上查看作者主页"
                            >
                              @{item.author}
                            </a>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-subtle">
                            <Heart className="size-3 text-red-400/80 fill-red-400/20" />
                            {item.likes}
                          </span>
                          <a
                            href={item.tweetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded text-ink-subtle hover:text-brand hover:bg-white/[0.05] transition-colors"
                            title="打开原始推文"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        </div>
                      </div>

                      {/* 媒体缩略图 */}
                      {item.mediaUrls && item.mediaUrls.length > 0 && (
                        <div
                          onClick={() => setPreviewMediaUrl(item.mediaUrls[0])}
                          className="relative mt-3 h-48 w-full rounded-lg overflow-hidden bg-black/40 border border-line-subtle cursor-zoom-in group/media"
                        >
                          <img
                            src={item.mediaUrls[0]}
                            alt="Media Preview"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover/media:scale-[1.03]"
                          />
                          <div className="absolute top-2 left-2 flex items-center gap-1.5">
                            <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md border border-white/10">
                              {item.model}
                            </span>
                            {item.category === 'video' && (
                              <span className="rounded-md bg-indigo-500/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md flex items-center gap-1">
                                <Video className="size-2.5" /> 视频
                              </span>
                            )}
                            {item.category === 'music' && (
                              <span className="rounded-md bg-emerald-500/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md flex items-center gap-1">
                                <Music className="size-2.5" /> 音频
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 纯净提示词正文 */}
                      <div className="mt-3">
                        <div className="rounded-lg bg-well p-3 border border-line-subtle/80 max-h-36 overflow-y-auto scrollbar-none">
                          <p className="text-xs text-ink/90 font-mono leading-relaxed select-all">
                            {item.prompt}
                          </p>
                        </div>
                      </div>

                      {/* 参数与负面提示词标签 */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {item.parameters && (
                          <span className="rounded bg-white/[0.05] px-2 py-0.5 font-mono text-ink-muted border border-line-subtle">
                            {item.parameters}
                          </span>
                        )}
                        {item.negativePrompt && (
                          <span
                            className="rounded bg-red-500/10 px-2 py-0.5 font-mono text-red-300/80 border border-red-500/20 truncate max-w-[200px]"
                            title={`Negative: ${item.negativePrompt}`}
                          >
                            Neg: {item.negativePrompt}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 卡片底栏操作 */}
                    <div className="mt-4 pt-3 border-t border-line-subtle flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {/* 一键复制提示词 */}
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(item)}
                          className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-all cursor-pointer active:scale-[0.98] ${
                            isCopied
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 hover:text-brand-hover'
                          }`}
                        >
                          {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                          <span>{isCopied ? '已复制 ✓' : '复制提示词'}</span>
                        </button>

                        {/* 采纳到社区作品 */}
                        <button
                          type="button"
                          onClick={() => handleAdopt(item)}
                          disabled={isAdopted || isAdopting}
                          className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            isAdopted
                              ? 'bg-white/[0.04] text-emerald-400 border border-emerald-500/20'
                              : 'bg-white/[0.04] text-ink-muted border border-line-subtle hover:bg-white/[0.08] hover:text-ink'
                          }`}
                        >
                          <Send className="size-3" />
                          <span>{isAdopted ? '已入库社区' : isAdopting ? '采纳中...' : '采纳为社区案例'}</span>
                        </button>
                      </div>

                      {/* 移除卡片 */}
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-md text-ink-subtle hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="从素材库中删除"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: 抓取控制台与凭据 ─── */}
      {activeTab === 'console' && (
        <div className="space-y-6">
          {/* 状态引导横幅 */}
          <div className="rounded-xl border border-line-subtle bg-surface/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${
                  config.cookies?.hasAuthToken
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                }`}
              >
                {config.cookies?.hasAuthToken ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink leading-tight">
                  {config.cookies?.hasAuthToken
                    ? 'X (Twitter) 抓取服务已就绪'
                    : '尚未录入 X 账号 Cookie 凭据'}
                </h3>
                <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                  {config.cookies?.hasAuthToken
                    ? `当前已绑定有效凭证 (${config.cookies.authTokenMasked})，最后检查时间：${config.lastCheckAt ? new Date(config.lastCheckAt).toLocaleString() : '最近'}`
                    : 'X 自 2024 年起彻底封禁了匿名抓取，必须录入一个小号的 auth_token 与 ct0 Cookie 即可完全免除官方昂贵 API 限制。'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCookieForm({ authToken: '', ct0: '' });
                setCookieModalOpen(true);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-hover shrink-0 cursor-pointer"
            >
              <KeyRound className="size-3.5" />
              <span>{config.cookies?.hasAuthToken ? '更新 Cookie 凭证' : '录入小号凭据'}</span>
            </button>
          </div>

          {/* 4 列设置表格 (AdminSettingRow 规范) */}
          <div className="rounded-xl border border-line-subtle bg-surface/90 px-5 divide-y divide-line-subtle">
            <AdminSettingRow
              label="X 账号凭据 (Cookie)"
              value={
                config.cookies?.hasAuthToken ? (
                  <span className="text-emerald-400 font-mono text-xs flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    已绑定 (auth_token & ct0)
                  </span>
                ) : (
                  <span className="text-amber-400 text-xs">未配置</span>
                )
              }
              context="在浏览器登录 X 小号后，F12 -> Application -> Cookies 中复制 auth_token 与 ct0"
              action="修改凭证"
              onClickAction={() => setCookieModalOpen(true)}
            />

            <AdminSettingRow
              label="生图提示词规则"
              value="Flux.1 / Midjourney / SD"
              context={`搜索 Query: ${config.rules?.imageQuery?.slice(0, 50)}...`}
              action="配置规则"
              onClickAction={() => {
                setRulesForm(config.rules || {});
                setRulesModalOpen(true);
              }}
            />

            <AdminSettingRow
              label="生视频提示词规则"
              value="Kling / Runway / Luma / Hailuo"
              context={`搜索 Query: ${config.rules?.videoQuery?.slice(0, 50)}...`}
              action="配置规则"
              onClickAction={() => {
                setRulesForm(config.rules || {});
                setRulesModalOpen(true);
              }}
            />

            <AdminSettingRow
              label="生音乐提示词规则"
              value="Suno v3.5 / Udio"
              context={`搜索 Query: ${config.rules?.musicQuery?.slice(0, 50)}...`}
              action="配置规则"
              onClickAction={() => {
                setRulesForm(config.rules || {});
                setRulesModalOpen(true);
              }}
            />

            <AdminSettingRow
              label="指定监控博主与检索模式"
              value={
                config.rules?.targetAuthorMode === 'specified' ? (
                  <span className="text-amber-400 font-semibold text-xs flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-amber-400" />
                    定向模式：仅抓取监控博主 ({config.rules?.targetAuthors?.length || 0} 位)
                  </span>
                ) : (
                  <span className="text-emerald-400 text-xs flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    全网模式：全网高赞 + 兼顾 {config.rules?.targetAuthors?.length || 0} 位重点博主
                  </span>
                )
              }
              context={config.rules?.targetAuthors?.map((a) => `@${a}`).join(', ')}
              action="配置名单与规则"
              onClickAction={() => {
                setRulesForm(config.rules || {});
                setRulesModalOpen(true);
              }}
            />

            <AdminSettingRow
              label="自动调度定时抓取"
              value={
                config.rules?.autoSchedule ? (
                  <span className="text-emerald-400 text-xs font-semibold">● 已开启 (每 {config.rules.intervalHours} 小时)</span>
                ) : (
                  <span className="text-ink-muted text-xs">● 未开启 (建议手动或系统 cron 触发)</span>
                )
              }
              context="开启后后台将按配置周期自动增量抓取最新高赞提示词，并加入随机扰动延时"
              action={config.rules?.autoSchedule ? '关闭' : '开启'}
              onClickAction={async () => {
                const nextVal = !config.rules?.autoSchedule;
                const nextRules = { ...config.rules, autoSchedule: nextVal };
                await fetch('/api/admin/content/x-prompts/config', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ rules: nextRules }),
                });
                setConfig((prev) => ({ ...prev, rules: nextRules }));
              }}
            />
          </div>
        </div>
      )}

      {/* ─── 弹窗 1：增量抓取启动弹窗 ─── */}
      {crawlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setCrawlModalOpen(false)}
              className="absolute right-4 top-4 text-ink-subtle hover:text-ink"
            >
              <X className="size-4" />
            </button>

            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <Sparkles className="size-4 text-brand" />
              启动 X 提示词抓取
            </h3>
            <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
              系统将调用 agent-twitter-client 搜索 X 平台上最新的高赞案例并清洗提取纯净 Prompt。
            </p>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">抓取目标分类</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'all', label: '全部' },
                    { id: 'image', label: '生图' },
                    { id: 'video', label: '视频' },
                    { id: 'music', label: '音乐' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCrawlCategory(cat.id)}
                      className={`h-8 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        crawlCategory === cat.id
                          ? 'border-brand bg-brand/10 text-brand font-semibold'
                          : 'border-line-subtle bg-white/[0.02] text-ink-muted hover:text-ink'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 定向指定博主选项 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink-muted">
                    指定博主定向抓取 (可选)
                  </label>
                  {crawlTargetAuthor && (
                    <button
                      type="button"
                      onClick={() => setCrawlTargetAuthor('')}
                      className="text-[11px] text-brand hover:underline cursor-pointer"
                    >
                      清空指定
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="输入 X 账号例如 properprompter (留空则全网检索)"
                  value={crawlTargetAuthor}
                  onChange={(e) => setCrawlTargetAuthor(e.target.value.replace(/^@/, ''))}
                  className="w-full h-8 px-3 text-xs font-mono rounded-lg border border-line-subtle bg-well text-ink focus:outline-none focus:border-brand/50 placeholder:text-ink-subtle"
                />
                {config.rules?.targetAuthors && config.rules.targetAuthors.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-ink-subtle">监控博主：</span>
                    {config.rules.targetAuthors.map((author) => {
                      const clean = author.replace(/^@/, '');
                      const isSelected = crawlTargetAuthor.toLowerCase() === clean.toLowerCase();
                      return (
                        <button
                          key={clean}
                          type="button"
                          onClick={() => setCrawlTargetAuthor(isSelected ? '' : clean)}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-brand/20 text-brand border border-brand/40 font-semibold'
                              : 'bg-white/[0.04] text-ink-muted hover:text-ink border border-line-subtle'
                          }`}
                        >
                          @{clean}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-ink-subtle">
                  指定博主后，系统将定向识别该用户推文中的生图及其提示词、模型与参数。
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">
                  单次最大抓取推文数：<span className="font-mono text-brand font-bold">{crawlLimit} 条</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={crawlLimit}
                  onChange={(e) => setCrawlLimit(parseInt(e.target.value, 10))}
                  className="w-full accent-brand cursor-pointer"
                />
                <p className="mt-1 text-[11px] text-ink-subtle">
                  注：单次建议在 10~20 条以内，配合随机时间间隔防封限流。
                </p>
              </div>

              {crawlFeedback && (
                <div
                  className={`rounded-lg p-3 text-xs border ${
                    crawlFeedback.type === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-red-500/30 bg-red-500/10 text-red-300'
                  }`}
                >
                  {crawlFeedback.message}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCrawlModalOpen(false)}
                className="h-8 px-3.5 rounded-lg border border-line-subtle bg-white/[0.04] text-xs font-medium text-ink-muted hover:text-ink"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleRunCrawl}
                disabled={crawling}
                className="inline-flex h-8 items-center gap-1.5 px-4 rounded-lg bg-brand text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50 cursor-pointer"
              >
                {crawling ? <RefreshCw className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                <span>{crawling ? '正在抓取中...' : '开始抓取'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 弹窗 2：Cookie 凭据录入弹窗 ─── */}
      {cookieModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleSaveCookies}
            className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setCookieModalOpen(false)}
              className="absolute right-4 top-4 text-ink-subtle hover:text-ink"
            >
              <X className="size-4" />
            </button>

            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <KeyRound className="size-4 text-brand" />
              配置 X 账号 Cookie 凭据
            </h3>
            <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
              请在已登录 X 的浏览器中按 <code className="bg-white/10 px-1 rounded">F12</code> 打开控制台，在{' '}
              <span className="text-ink">Application &gt; Cookies &gt; https://x.com</span> 查找并复制以下两项值：
            </p>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  auth_token <span className="text-brand">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder={config.cookies?.hasAuthToken ? '如不修改请留空，或粘贴新 token' : '例如: 4a98f12...'}
                  value={cookieForm.authToken}
                  onChange={(e) => setCookieForm({ ...cookieForm, authToken: e.target.value })}
                  className="w-full h-9 px-3 text-xs font-mono rounded-lg border border-line-subtle bg-well text-ink focus:outline-none focus:border-brand/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  ct0 (CSRF Token) <span className="text-brand">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder={config.cookies?.hasCt0 ? '如不修改请留空，或粘贴新 ct0' : '例如: 7bc92e...'}
                  value={cookieForm.ct0}
                  onChange={(e) => setCookieForm({ ...cookieForm, ct0: e.target.value })}
                  className="w-full h-9 px-3 text-xs font-mono rounded-lg border border-line-subtle bg-well text-ink focus:outline-none focus:border-brand/50"
                />
              </div>

              <div className="rounded-lg bg-well p-3 border border-line-subtle text-[11px] text-ink-subtle leading-relaxed">
                💡 <strong className="text-ink-muted">安全提示：</strong>
                Cookie 仅保存在你的私有服务器数据库中用于发起请求，密码学掩码脱敏显示。强烈建议使用专用的 X 测试小号，切勿使用个人核心主号。
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCookieModalOpen(false)}
                className="h-8 px-3.5 rounded-lg border border-line-subtle bg-white/[0.04] text-xs font-medium text-ink-muted hover:text-ink"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={savingConfig}
                className="h-8 px-4 rounded-lg bg-brand text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50 cursor-pointer"
              >
                {savingConfig ? '正在保存...' : '确认保存凭据'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── 弹窗 3：抓取规则配置弹窗 ─── */}
      {rulesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleSaveRules}
            className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setRulesModalOpen(false)}
              className="absolute right-4 top-4 text-ink-subtle hover:text-ink"
            >
              <X className="size-4" />
            </button>

            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-brand" />
              自定义监控与检索规则
            </h3>
            <p className="mt-1 text-xs text-ink-muted">支持利用 X 高级搜索语法（OR、has:images、min_faves 等）。</p>

            <div className="mt-4 space-y-3.5">
              {/* 指定用户模式与定向检索范围 */}
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">
                  定向检索范围模式 (指定用户选项)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRulesForm({ ...rulesForm, targetAuthorMode: 'all' })}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      rulesForm.targetAuthorMode !== 'specified'
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-line-subtle bg-well text-ink-muted hover:text-ink'
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center justify-between">
                      <span>全网关键词检索</span>
                      {rulesForm.targetAuthorMode !== 'specified' && <Check className="size-3.5" />}
                    </div>
                    <p className="mt-1 text-[11px] opacity-80 leading-normal">
                      全网检索最新高赞生图推文，兼顾重点博主
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRulesForm({ ...rulesForm, targetAuthorMode: 'specified' })}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      rulesForm.targetAuthorMode === 'specified'
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-line-subtle bg-well text-ink-muted hover:text-ink'
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center justify-between">
                      <span>仅限指定博主定向检索</span>
                      {rulesForm.targetAuthorMode === 'specified' && <Check className="size-3.5" />}
                    </div>
                    <p className="mt-1 text-[11px] opacity-80 leading-normal">
                      锁定监控博主，识别其生图作品与对应提示词
                    </p>
                  </button>
                </div>
              </div>

              {/* 重点监控与检索博主名单 */}
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">
                  指定监控博主名单 ({rulesForm.targetAuthors?.length || 0} 位)
                </label>

                {/* 现有博主标签 */}
                {rulesForm.targetAuthors && rulesForm.targetAuthors.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {rulesForm.targetAuthors.map((author) => {
                      const clean = author.replace(/^@/, '');
                      return (
                        <span
                          key={clean}
                          className="inline-flex items-center gap-1 rounded-md bg-brand/10 border border-brand/25 px-2 py-0.5 text-xs font-mono text-brand font-medium"
                        >
                          @{clean}
                          <button
                            type="button"
                            onClick={() =>
                              setRulesForm({
                                ...rulesForm,
                                targetAuthors: (rulesForm.targetAuthors || []).filter(
                                  (a) => a.replace(/^@/, '') !== clean
                                ),
                              })
                            }
                            className="text-brand/70 hover:text-red-400 cursor-pointer ml-0.5"
                            title={`移除 @${clean}`}
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="输入博主 X 账号例如 properprompter，以逗号分隔"
                  value={Array.isArray(rulesForm.targetAuthors) ? rulesForm.targetAuthors.join(', ') : rulesForm.targetAuthors || ''}
                  onChange={(e) =>
                    setRulesForm({
                      ...rulesForm,
                      targetAuthors: e.target.value
                        .split(',')
                        .map((s) => s.trim().replace(/^@/, ''))
                        .filter(Boolean),
                    })
                  }
                  className="w-full h-8 px-3 text-xs font-mono rounded-lg border border-line-subtle bg-well text-ink focus:outline-none focus:border-brand/50"
                />

                {/* 推荐优质博主 */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-ink-subtle">推荐优质 AI 创作者：</span>
                  {[
                    { handle: 'properprompter', desc: 'Midjourney/Flux大师' },
                    { handle: 'fofrAI', desc: 'Flux专家' },
                    { handle: 'icreatelife', desc: '视觉艺术家' },
                    { handle: 'LinusEkenstam', desc: 'AI创作者' },
                  ].map((rec) => {
                    const hasAuthor = (rulesForm.targetAuthors || []).some(
                      (a) => a.replace(/^@/, '').toLowerCase() === rec.handle.toLowerCase()
                    );
                    if (hasAuthor) return null;
                    return (
                      <button
                        key={rec.handle}
                        type="button"
                        onClick={() => {
                          const current = rulesForm.targetAuthors || [];
                          setRulesForm({
                            ...rulesForm,
                            targetAuthors: [...current, rec.handle],
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded bg-white/[0.04] hover:bg-brand/10 hover:text-brand hover:border-brand/30 border border-line-subtle px-1.5 py-0.5 text-[11px] text-ink-muted transition-colors cursor-pointer"
                        title={`添加 @${rec.handle} (${rec.desc})`}
                      >
                        <span>+ @{rec.handle}</span>
                        <span className="text-[9px] opacity-70">({rec.desc})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 生图与提示词精准识别机制说明 */}
              <div className="rounded-lg bg-well p-3 border border-line-subtle text-[11px] text-ink-muted leading-relaxed">
                <div className="font-semibold text-ink flex items-center gap-1 mb-1">
                  <Sparkles className="size-3 text-brand" />
                  生图与对应提示词识别说明
                </div>
                <p>
                  系统抓取目标推文时，将优先提取推文所带的高清配图（生图），并深度解析推文正文或图片自带的 ALT 描述，智能提取 Midjourney / Flux / SD 模型标签与 <code className="bg-white/10 px-1 rounded text-ink font-mono">--ar</code> 等关键参数，一键规整为纯净结构化卡片。
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">生图关键词检索 Query</label>
                <textarea
                  rows={2}
                  value={rulesForm.imageQuery || ''}
                  onChange={(e) => setRulesForm({ ...rulesForm, imageQuery: e.target.value })}
                  className="w-full p-2.5 text-xs font-mono rounded-lg border border-line-subtle bg-well text-ink focus:outline-none focus:border-brand/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">生视频关键词检索 Query</label>
                <textarea
                  rows={2}
                  value={rulesForm.videoQuery || ''}
                  onChange={(e) => setRulesForm({ ...rulesForm, videoQuery: e.target.value })}
                  className="w-full p-2.5 text-xs font-mono rounded-lg border border-line-subtle bg-well text-ink focus:outline-none focus:border-brand/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">生音乐关键词检索 Query</label>
                <textarea
                  rows={2}
                  value={rulesForm.musicQuery || ''}
                  onChange={(e) => setRulesForm({ ...rulesForm, musicQuery: e.target.value })}
                  className="w-full p-2.5 text-xs font-mono rounded-lg border border-line-subtle bg-well text-ink focus:outline-none focus:border-brand/50"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRulesModalOpen(false)}
                className="h-8 px-3.5 rounded-lg border border-line-subtle bg-white/[0.04] text-xs font-medium text-ink-muted hover:text-ink"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={savingConfig}
                className="h-8 px-4 rounded-lg bg-brand text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50 cursor-pointer"
              >
                {savingConfig ? '保存中...' : '保存规则'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── 图片全屏预览 Lightbox ─── */}
      {previewMediaUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
          onClick={() => setPreviewMediaUrl(null)}
        >
          <img
            src={previewMediaUrl}
            alt="Full Preview"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl border border-white/10"
          />
        </div>
      )}
    </div>
  );
}
