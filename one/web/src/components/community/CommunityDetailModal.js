'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AudioLines, Check, Clapperboard, Copy, Heart, Image as ImageIcon, MessageCircle, Send, Share2, WandSparkles, Workflow, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import UserAvatar from '@/components/ui/UserAvatar';

import { normalizeLocale, localizeStudioPath } from '@/lib/locales';

const MODAL_COPY = {
  'zh-CN': {
    loading: '正在加载作品详情',
    promptLabel: '提示词 Prompt',
    copy: '复制',
    copied: '已复制',
    noPrompt: '未提供提示词',
    modelLabel: '使用模型',
    commentsTitle: '评论',
    noComments: '还没有评论，来留下第一句反馈。',
    commentPlaceholder: '写一句评论',
    postComment: '发布评论',
    closeAria: '关闭',
    dialogAria: '作品详情',
    anonymousCreator: '社区创作者',
    justNow: '刚刚发布',
    typeVideo: 'AI 视频',
    typeAudio: 'AI 音乐',
    typeWorkflow: '工作流',
    typeImage: 'AI 图像',
    cannotTipOwn: '不可给自己的作品投币',
    tippedMax: '已为该作品投满 2 币',
    tipPrompt: (tipped) => `给作品投币 (已投 ${tipped}/2)`,
    tip1: '🪙 1 币',
    tip1Sub: '心意支持',
    tip2: '🪙 2 币',
    tip2Sub: '双倍力挺',
    tipSuccess: (amt) => `🪙 成功为作品投出 ${amt} 枚 K 币！`,
    tipFail: '投币失败',
    share: '分享',
    remix: '同款',
    promptCopiedToast: '提示词已复制',
    shareCopiedToast: '分享链接已复制',
    commentSuccessToast: '评论发布成功',
    commentFailToast: '评论失败，请先登录',
    loadDetailFailToast: '加载详情失败',
    networkError: '网络错误，请稍后重试',
    loginFirst: '请先登录',
  },
  'zh-TW': {
    loading: '正在加載作品詳情',
    promptLabel: '提示詞 Prompt',
    copy: '複製',
    copied: '已複製',
    noPrompt: '未提供提示詞',
    modelLabel: '使用模型',
    commentsTitle: '評論',
    noComments: '還沒有評論，來留下第一句反饋。',
    commentPlaceholder: '寫一句評論',
    postComment: '發布評論',
    closeAria: '關閉',
    dialogAria: '作品詳情',
    anonymousCreator: '社區創作者',
    justNow: '剛剛發布',
    typeVideo: 'AI 影片',
    typeAudio: 'AI 音訊',
    typeWorkflow: '工作流',
    typeImage: 'AI 圖像',
    cannotTipOwn: '不可給自己的作品投幣',
    tippedMax: '已為該作品投滿 2 幣',
    tipPrompt: (tipped) => `給作品投幣 (已投 ${tipped}/2)`,
    tip1: '🪙 1 幣',
    tip1Sub: '心意支持',
    tip2: '🪙 2 幣',
    tip2Sub: '雙倍力挺',
    tipSuccess: (amt) => `🪙 成功為作品投出 ${amt} 枚 K 幣！`,
    tipFail: '投幣失敗',
    share: '分享',
    remix: '同款',
    promptCopiedToast: '提示詞已複製',
    shareCopiedToast: '分享鏈接已複製',
    commentSuccessToast: '評論發布成功',
    commentFailToast: '評論失敗，請先登入',
    loadDetailFailToast: '加載詳情失敗',
    networkError: '網絡錯誤，請稍後重試',
    loginFirst: '請先登入',
  },
  'ja-JP': {
    loading: '作品詳細を読み込み中',
    promptLabel: 'プロンプト Prompt',
    copy: 'コピー',
    copied: 'コピー済み',
    noPrompt: 'プロンプト未指定',
    modelLabel: '使用モデル',
    commentsTitle: 'コメント',
    noComments: 'コメントはまだありません。最初のフィードバックを残しましょう。',
    commentPlaceholder: 'コメントを書く',
    postComment: 'コメント投稿',
    closeAria: '閉じる',
    dialogAria: '作品詳細',
    anonymousCreator: 'クリエイター',
    justNow: '今投稿',
    typeVideo: 'AI 動画',
    typeAudio: 'AI 音楽',
    typeWorkflow: 'ワークフロー',
    typeImage: 'AI 画像',
    cannotTipOwn: '自分の作品には投げ銭できません',
    tippedMax: 'この作品にはすでに上限2コイン投入済みです',
    tipPrompt: (tipped) => `作品にコインを投入 (投入済 ${tipped}/2)`,
    tip1: '🪙 1 コイン',
    tip1Sub: '応援',
    tip2: '🪙 2 コイン',
    tip2Sub: '強力サポート',
    tipSuccess: (amt) => `🪙 ${amt} コインを投入しました！`,
    tipFail: 'コイン投入失敗',
    share: 'シェア',
    remix: '同作を作成',
    promptCopiedToast: 'プロンプトをコピーしました',
    shareCopiedToast: '共有リンクをコピーしました',
    commentSuccessToast: 'コメントを投稿しました',
    commentFailToast: 'コメント投稿に失敗しました。ログインしてください',
    loadDetailFailToast: '詳細の読み込みに失敗しました',
    networkError: 'ネットワークエラーが発生しました',
    loginFirst: 'ログインしてください',
  },
  'ko-KR': {
    loading: '작품 상세 정보를 불러오는 중',
    promptLabel: '프롬프트 Prompt',
    copy: '복사',
    copied: '복사됨',
    noPrompt: '제공된 프롬프트 없음',
    modelLabel: '사용 모델',
    commentsTitle: '댓글',
    noComments: '아직 댓글이 없습니다. 첫 의견을 남겨보세요.',
    commentPlaceholder: '댓글 작성',
    postComment: '댓글 게시',
    closeAria: '닫기',
    dialogAria: '작품 상세',
    anonymousCreator: '커뮤니티 크리에이터',
    justNow: '방금 전',
    typeVideo: 'AI 비디오',
    typeAudio: 'AI 음악',
    typeWorkflow: '워크플로',
    typeImage: 'AI 이미지',
    cannotTipOwn: '자신의 작품에는 코인을 후원할 수 없습니다',
    tippedMax: '이 작품에 이미 최대 2코인을 후원했습니다',
    tipPrompt: (tipped) => `작품에 코인 후원 (후원 완료 ${tipped}/2)`,
    tip1: '🪙 1 코인',
    tip1Sub: '응원하기',
    tip2: '🪙 2 코인',
    tip2Sub: '강력 지지',
    tipSuccess: (amt) => `🪙 ${amt} 코인을 성공적으로 후원했습니다!`,
    tipFail: '코인 후원 실패',
    share: '공유',
    remix: '리믹스',
    promptCopiedToast: '프롬프트가 복사되었습니다',
    shareCopiedToast: '공유 링크가 복사되었습니다',
    commentSuccessToast: '댓글이 등록되었습니다',
    commentFailToast: '댓글 등록 실패, 먼저 로그인해 주세요',
    loadDetailFailToast: '상세 정보를 불러오지 못했습니다',
    networkError: '네트워크 오류, 잠시 후 다시 시도해 주세요',
    loginFirst: '먼저 로그인해 주세요',
  },
  es: {
    loading: 'Cargando detalles de la creación...',
    promptLabel: 'Prompt',
    copy: 'Copiar',
    copied: 'Copiado',
    noPrompt: 'Sin prompt proporcionado',
    modelLabel: 'Modelo utilizado',
    commentsTitle: 'Comentarios',
    noComments: 'No hay comentarios aún. Deja el primero.',
    commentPlaceholder: 'Escribe un comentario...',
    postComment: 'Publicar comentario',
    closeAria: 'Cerrar',
    dialogAria: 'Detalles de la creación',
    anonymousCreator: 'Creador de la comunidad',
    justNow: 'Recién publicado',
    typeVideo: 'AI Vídeo',
    typeAudio: 'AI Música',
    typeWorkflow: 'Flujo de trabajo',
    typeImage: 'AI Imagen',
    cannotTipOwn: 'No puedes donar monedas a tu propia obra',
    tippedMax: 'Ya donaste el máximo de 2 monedas a esta obra',
    tipPrompt: (tipped) => `Donar monedas (donadas ${tipped}/2)`,
    tip1: '🪙 1 Moneda',
    tip1Sub: 'Apoyo',
    tip2: '🪙 2 Monedas',
    tip2Sub: 'Doble apoyo',
    tipSuccess: (amt) => `🪙 ¡Se donaron ${amt} monedas con éxito!`,
    tipFail: 'Error al donar monedas',
    share: 'Compartir',
    remix: 'Remezclar',
    promptCopiedToast: 'Prompt copiado',
    shareCopiedToast: 'Enlace de compartir copiado',
    commentSuccessToast: 'Comentario publicado',
    commentFailToast: 'Error al comentar. Inicia sesión primero',
    loadDetailFailToast: 'Error al cargar detalles',
    networkError: 'Error de red, intenta nuevamente',
    loginFirst: 'Inicia sesión primero',
  },
  en: {
    loading: 'Loading creation details...',
    promptLabel: 'Prompt',
    copy: 'Copy',
    copied: 'Copied',
    noPrompt: 'No prompt provided',
    modelLabel: 'Model Used',
    commentsTitle: 'Comments',
    noComments: 'No comments yet. Be the first to leave feedback.',
    commentPlaceholder: 'Write a comment...',
    postComment: 'Post comment',
    closeAria: 'Close',
    dialogAria: 'Creation Details',
    anonymousCreator: 'Community Creator',
    justNow: 'Just now',
    typeVideo: 'AI Video',
    typeAudio: 'AI Music',
    typeWorkflow: 'Workflow',
    typeImage: 'AI Image',
    cannotTipOwn: 'Cannot tip your own creation',
    tippedMax: 'Max 2 coins already tipped for this creation',
    tipPrompt: (tipped) => `Tip creation (${tipped}/2 tipped)`,
    tip1: '🪙 1 Coin',
    tip1Sub: 'Appreciation',
    tip2: '🪙 2 Coins',
    tip2Sub: 'Double Support',
    tipSuccess: (amt) => `🪙 Successfully tipped ${amt} coins!`,
    tipFail: 'Failed to tip coins',
    share: 'Share',
    remix: 'Remix',
    promptCopiedToast: 'Prompt copied',
    shareCopiedToast: 'Share link copied',
    commentSuccessToast: 'Comment posted successfully',
    commentFailToast: 'Failed to post comment. Please log in first',
    loadDetailFailToast: 'Failed to load details',
    networkError: 'Network error, please try again later',
    loginFirst: 'Please log in first',
  },
};

export default function CommunityDetailModal({ postId, initialPost = null, onClose, onLikeChange, locale = null }) {
  const norm = normalizeLocale(locale || (typeof window !== 'undefined' && window.location.pathname.startsWith('/zh') ? 'zh-CN' : 'en'));
  const t = MODAL_COPY[norm] || MODAL_COPY.en;

  const [post, setPost] = useState(initialPost);
  const [loading, setLoading] = useState(!initialPost);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [coinInfo, setCoinInfo] = useState({ totalCoins: initialPost?.coins_count || 0, userTipped: 0, isAuthor: false });
  const [tipping, setTipping] = useState(false);
  const [showTipMenu, setShowTipMenu] = useState(false);

  const toast = (message) => { setToastMsg(message); window.setTimeout(() => setToastMsg(''), 2300); };

  useEffect(() => {
    if (!postId) return;
    let mounted = true;
    Promise.all([
      fetch(`/api/community/posts/${postId}`),
      fetch(`/api/community/posts/${postId}/comments`),
      fetch(`/api/community/posts/${postId}/coin`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(async ([postResponse, commentsResponse, coinData]) => {
      const postData = await postResponse.json();
      const commentData = await commentsResponse.json();
      if (mounted) {
        if (postData.post) setPost(postData.post);
        if (Array.isArray(commentData.comments)) setComments(commentData.comments);
        if (coinData) setCoinInfo(coinData);
      }
    }).catch(() => toast(t.loadDetailFailToast)).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [postId, t.loadDetailFailToast]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showTipMenu) {
          setShowTipMenu(false);
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showTipMenu]);

  if (!postId) return null;
  const type = post?.media_type || 'image';
  const TypeIcon = type === 'video' ? Clapperboard : type === 'audio' ? AudioLines : type === 'workflow' ? Workflow : ImageIcon;
  const typeLabel = type === 'video' ? t.typeVideo : type === 'audio' ? t.typeAudio : type === 'workflow' ? t.typeWorkflow : t.typeImage;

  const toggleLike = async () => {
    if (!post || likeBusy) return;
    setLikeBusy(true);
    try {
      const response = await fetch(`/api/community/posts/${post.id}/like`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        toast(data.error || t.loginFirst);
        return;
      }
      setPost((prev) => prev ? { ...prev, is_liked: data.isLiked, likes_count: data.likesCount } : prev);
      onLikeChange?.(post.id, data.isLiked, data.likesCount);
    } catch {
      toast(t.networkError);
    } finally {
      setLikeBusy(false);
    }
  };

  const handleTipCoin = async (amount) => {
    if (tipping || !post) return;
    setTipping(true);
    try {
      const response = await fetch(`/api/community/posts/${post.id}/coin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast(data.error || t.tipFail);
        return;
      }
      setCoinInfo((prev) => ({
        ...prev,
        totalCoins: data.totalCoins,
        userTipped: data.userTippedTotal,
      }));
      setPost((prev) => prev ? { ...prev, coins_count: data.totalCoins } : prev);
      toast(t.tipSuccess(amount));
      setShowTipMenu(false);
    } catch {
      toast(t.networkError);
    } finally {
      setTipping(false);
    }
  };

  const remix = () => {
    const target = type === 'video' ? 'video' : type === 'audio' ? 'audio' : type === 'workflow' ? 'workflow' : 'image';
    const params = new URLSearchParams();
    if (post?.prompt) params.set('remixPrompt', post.prompt);
    if (target === 'video') {
      params.set('model', 'kling-v2.6-pro-t2v');
    } else if (target === 'image') {
      params.set('model', 'gpt-image-2.5-flash');
    }
    const studioUrl = localizeStudioPath(norm, target);
    window.location.href = `${studioUrl}?${params.toString()}`;
  };

  const copyPrompt = async () => {
    if (!post?.prompt) return;
    await navigator.clipboard.writeText(post.prompt);
    setCopied(true);
    toast(t.promptCopiedToast);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const share = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/community/${post.id}`);
    toast(t.shareCopiedToast);
  };

  const addComment = async (event) => {
    event.preventDefault();
    if (!newComment.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const response = await fetch(`/api/community/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      const data = await response.json();
      if (!response.ok) return toast(data.error || t.commentFailToast);
      setComments((current) => [...current, data.comment]);
      setNewComment('');
      toast(t.commentSuccessToast);
    } catch {
      toast(t.networkError);
    } finally {
      setSubmittingComment(false);
    }
  };

  const dateLocaleMap = {
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
    'ja-JP': 'ja-JP',
    'ko-KR': 'ko-KR',
    es: 'es-ES',
    en: 'en-US',
  };
  const dateLocale = dateLocaleMap[norm] || 'en-US';

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-scrim p-3 backdrop-blur-xl animate-in fade-in duration-modal ease-enter" onClick={onClose}>
      {toastMsg && (
        <div role="status" className="fixed top-6 z-toast rounded-full border border-brand-line bg-overlay px-4 py-2 text-xs text-brand shadow-elevation-4">
          {toastMsg}
        </div>
      )}
      <div role="dialog" aria-modal="true" aria-label={t.dialogAria} className="relative flex h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-line bg-overlay shadow-elevation-4 py-0 text-ink md:flex-row" onClick={(event) => event.stopPropagation()}>
        <Button type="button" variant="secondary" size="icon" className="absolute right-4 top-4 z-10" onClick={onClose} aria-label={t.closeAria}>
          <X />
        </Button>
        {loading || !post ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              {t.loading}
            </span>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center justify-center bg-background p-6">
              {type === 'video' ? (
                <video src={post.media_url} controls autoPlay loop className="max-h-full max-w-full rounded-xl object-contain" />
              ) : type === 'audio' ? (
                <div className="flex w-full max-w-sm flex-col items-center gap-6">
                  <span className="flex size-28 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-[0_0_50px_hsl(var(--primary)/0.2)]">
                    <AudioLines className="size-10" />
                  </span>
                  <audio src={post.media_url} controls autoPlay className="w-full" />
                </div>
              ) : (
                <img src={post.media_url} alt={post.title} className="max-h-full max-w-full rounded-xl object-contain" />
              )}
              <Badge variant="secondary" className="absolute bottom-5 left-5 border border-border bg-card/80 backdrop-blur">
                <TypeIcon />{typeLabel}
              </Badge>
            </div>
            <div className="flex w-full shrink-0 flex-col border-t border-border md:w-[390px] md:border-l md:border-t-0">
              <div className="border-b border-border p-5">
                <Link
                  href={`/u/${post.author_user_number || post.user_id || ''}`}
                  onClick={onClose}
                  className="group flex items-center gap-3 transition-opacity hover:opacity-90"
                >
                  <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary ring-2 ring-transparent transition group-hover:ring-primary/40">
                    <UserAvatar
                      src={post.author_avatar}
                      name={post.author_name || post.author_username || '创'}
                      className="size-full object-cover"
                      fallbackClassName="font-bold text-sm"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                      {post.author_name || post.author_username || t.anonymousCreator}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {post.author_user_number ? `UID: ${post.author_user_number} · ` : ''}
                      {post.created_at ? new Date(post.created_at).toLocaleDateString(dateLocale) : t.justNow}
                    </p>
                  </div>
                </Link>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto p-5 custom-scrollbar">
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.03em]">{post.title}</h2>
                  {post.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{post.description}</p>}
                  {post.tags?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="border-primary/25 text-primary">#{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">{t.promptLabel}</p>
                    <Button type="button" variant="ghost" size="xs" className="text-primary" onClick={copyPrompt}>
                      {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                      {copied ? t.copied : t.copy}
                    </Button>
                  </div>
                  <p className="max-h-40 overflow-y-auto text-sm leading-6 text-foreground/85 custom-scrollbar">{post.prompt || t.noPrompt}</p>
                </div>
                {post.model_name && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t.modelLabel}</p>
                    <p className="mt-1 font-mono text-sm text-primary">{post.model_name}</p>
                  </div>
                )}
                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <MessageCircle />{t.commentsTitle} <span className="text-muted-foreground">{comments.length}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {comments.map((comment) => (
                      <div key={comment.id} className="rounded-xl bg-muted/45 p-3">
                        <div className="flex items-center justify-between">
                          <Link
                            href={`/u/${comment.author_user_number || comment.user_id || ''}`}
                            onClick={onClose}
                            className="text-xs font-medium text-foreground transition-colors hover:text-primary"
                          >
                            {comment.author_name || t.anonymousCreator}
                          </Link>
                          {comment.created_at && (
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(comment.created_at).toLocaleDateString(dateLocale)}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{comment.content}</p>
                      </div>
                    ))}
                    {comments.length === 0 && <p className="text-xs text-muted-foreground">{t.noComments}</p>}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t border-border p-5">
                <form onSubmit={addComment} className="flex gap-2">
                  <Input value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder={t.commentPlaceholder} />
                  <Button type="submit" size="icon" disabled={submittingComment} aria-label={t.postComment}>
                    <Send />
                  </Button>
                </form>
                <div className="grid grid-cols-4 gap-2">
                  <Button type="button" variant={post.is_liked ? 'default' : 'outline'} onClick={toggleLike} className="px-2">
                    <Heart className={post.is_liked ? 'fill-current' : ''} data-icon="inline-start" />{post.likes_count || 0}
                  </Button>

                  {/* 🪙 投币交互按钮 (支持投 1 或 2 币) */}
                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      className={`w-full px-2 border-amber-500/30 text-amber-300 hover:border-amber-400 hover:bg-amber-500/10 ${
                        coinInfo.userTipped >= 2 ? 'border-amber-500/60 bg-amber-500/15 font-bold shadow-sm' : ''
                      }`}
                      onClick={() => setShowTipMenu((v) => !v)}
                      title={coinInfo.isAuthor ? t.cannotTipOwn : t.tipPrompt(coinInfo.userTipped)}
                    >
                      <span className="text-xs mr-0.5">🪙</span>
                      <span className="text-xs font-mono">{coinInfo.totalCoins || post.coins_count || 0}</span>
                    </Button>

                    {/* 投币气泡选择菜单 */}
                    {showTipMenu && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-2xl border border-line bg-overlay p-3 text-ink shadow-elevation-4 backdrop-blur-xl z-30 animate-in fade-in-0 zoom-in-95 duration-fast">
                        <div className="text-[11px] text-ink-muted text-center mb-2 font-medium">
                          {coinInfo.isAuthor ? (
                            t.cannotTipOwn
                          ) : coinInfo.userTipped >= 2 ? (
                            <span className="text-amber-400 font-bold">{t.tippedMax}</span>
                          ) : (
                            <>{t.tipToWork} (<span className="text-brand font-bold">{coinInfo.userTipped}/2</span>)</>
                          )}
                        </div>
                        {!coinInfo.isAuthor && coinInfo.userTipped < 2 && (
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              disabled={tipping}
                              onClick={() => handleTipCoin(1)}
                              className="flex flex-col items-center justify-center rounded-xl border border-brand-line bg-brand-soft py-1.5 text-xs font-bold text-brand hover:bg-brand-pressed active:scale-[0.98] active:duration-instant disabled:opacity-50 transition-[background-color,color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                            >
                              <span>{t.tip1}</span>
                              <span className="text-[9px] text-brand/70 font-normal">{t.tip1Sub}</span>
                            </button>
                            <button
                              type="button"
                              disabled={tipping || coinInfo.userTipped >= 1}
                              onClick={() => handleTipCoin(2)}
                              className="flex flex-col items-center justify-center rounded-xl border border-brand bg-brand py-1.5 text-xs font-bold text-ink-on-accent hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] active:duration-instant disabled:opacity-50 transition-[background-color,color,transform] duration-fast ease-standard cursor-pointer shadow-elevation-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                            >
                              <span>{t.tip2}</span>
                              <span className="text-[9px] text-ink-on-accent/80 font-normal">{t.tip2Sub}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Button type="button" variant="outline" onClick={share} className="px-2">
                    <Share2 data-icon="inline-start" />{t.share}
                  </Button>
                  <Button type="button" variant="outline" onClick={remix} className="px-2">
                    <WandSparkles data-icon="inline-start" />{t.remix}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
