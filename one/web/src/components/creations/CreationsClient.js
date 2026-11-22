'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AudioLines,
  Clapperboard,
  Copy,
  Download,
  Image as ImageIcon,
  MoreHorizontal,
  Play,
  Share2,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
  User,
} from 'lucide-react';
import Link from 'next/link';
import AuthModal from '@/components/AuthModal';
import ShareToCommunityModal from '@/components/community/ShareToCommunityModal';
import StudioHeader from '@/components/site/StudioHeader';
import { resolveClientLocale, getCommonCopy, localizeStudioPath, normalizeLocale } from '@/lib/locales';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const CREATIONS_I18N = {
  en: {
    catAll: 'All Creations',
    catImage: 'AI Images',
    catVideo: 'AI Videos',
    catAudio: 'AI Audio',
    catWorkflow: 'Design & Workflows',
    typeVideo: 'Video',
    typeAudio: 'Audio',
    typeWorkflow: 'Workflow',
    typeImage: 'Image',
    untitled: 'Untitled Creation',
    aiCreation: 'AI Creation',
    previewAria: (prompt) => `Preview creation: ${prompt}`,
    shared: 'Public',
    remix: 'Remix',
    shareToCommunity: 'Share to Community',
    copyPrompt: 'Copy Prompt',
    deleteAria: 'Delete creation',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this creation? If published to the community, it will also be removed.',
    deleteSuccess: 'Creation deleted',
    deleteFailed: 'Failed to delete',
    copySuccess: 'Prompt copied to clipboard',
    shareSuccess: 'Successfully published to Community Gallery',
    loginTitle: 'Log in to unlock cloud creations archive',
    loginDesc: 'Log in to manage all your AI images, videos, and audio assets in one place. Download anytime or share with the community.',
    loginAction: 'Sign In / Register',
    backToStudio: 'Return to Studio',
    defaultCreator: 'Creator',
    defaultBio: 'Expanding the boundaries of imagination with AI, exploring the next creation.',
    statTotal: 'Total Creations',
    statShared: 'In Community',
    statLikes: 'Total Likes',
    countSummary: (count) => `${count} creation assets in total`,
    emptyLoginTitle: 'Please log in to your creator account',
    emptyLoginDesc: 'Log in to view and manage your cloud-rendered images, videos, and audio history.',
    emptyLoginAction: 'Log In Now',
    emptyCatTitle: 'No creations in this category',
    emptyCatDesc: 'Start generating in Studio, and your creations will be safely archived here automatically.',
    startFirstCreation: 'Start First Creation',
    closePreview: 'Close preview',
    previewDetails: 'Creation Details',
    noPrompt: 'No detailed prompt',
    downloadOriginal: 'Download',
  },
  'zh-CN': {
    catAll: '全部作品',
    catImage: 'AI 生图',
    catVideo: 'AI 视频',
    catAudio: 'AI 音乐',
    catWorkflow: '设计与工作流',
    typeVideo: '视频',
    typeAudio: '音频',
    typeWorkflow: '工作流',
    typeImage: '图像',
    untitled: '未命名作品',
    aiCreation: 'AI 创作',
    previewAria: (prompt) => `预览作品：${prompt}`,
    shared: '已公开',
    remix: '做同款',
    shareToCommunity: '分享至社区',
    copyPrompt: '复制提示词',
    deleteAria: '删除作品',
    delete: '删除',
    deleteConfirm: '确定要删除这条作品记录吗？若已发布到社区也将一并下架。',
    deleteSuccess: '作品已删除',
    deleteFailed: '删除失败',
    copySuccess: '提示词已成功复制',
    shareSuccess: '作品已成功发布至社区画廊',
    loginTitle: '登录开启云端作品归档',
    loginDesc: '登录后即可集中管理你的所有 AI 生图、AI 视频与音频创作资产，随时下载或一键分享至创作者社区。',
    loginAction: '立即登录 / 注册',
    backToStudio: '返回创作工坊',
    defaultCreator: '创作者',
    defaultBio: '用 AI 拓展想象力的边界，探索下一次创作。',
    statTotal: '创作总计',
    statShared: '已发社区',
    statLikes: '累计获赞',
    countSummary: (count) => `共 ${count} 项创作素材`,
    emptyLoginTitle: '请先登录创作者账号',
    emptyLoginDesc: '登录后方可查询与管理你在云端渲染生成的图片、视频和音频历史作品。',
    emptyLoginAction: '立即登录',
    emptyCatTitle: '暂无此类创作',
    emptyCatDesc: '前往 Studio 开启一次生成，你的创作成果会自动安全归档到这里。',
    startFirstCreation: '开始第一次创作',
    closePreview: '关闭预览',
    previewDetails: '创作详情',
    noPrompt: '无详细提示词',
    downloadOriginal: '下载原画',
  },
  'ja-JP': {
    catAll: 'すべての作品',
    catImage: 'AI画像生成',
    catVideo: 'AI動画生成',
    catAudio: 'AI音楽生成',
    catWorkflow: 'デザイン＆ワークフロー',
    typeVideo: '動画',
    typeAudio: '音声',
    typeWorkflow: 'ワークフロー',
    typeImage: '画像',
    untitled: '名称未設定の作品',
    aiCreation: 'AI創作',
    previewAria: (prompt) => `作品をプレビュー：${prompt}`,
    shared: '公開中',
    remix: 'リミックス',
    shareToCommunity: 'コミュニティへ共有',
    copyPrompt: 'プロンプトをコピー',
    deleteAria: '作品を削除',
    delete: '削除',
    deleteConfirm: 'この作品記録を削除してもよろしいですか？コミュニティに公開済みの場合は非公開になります。',
    deleteSuccess: '作品を削除しました',
    deleteFailed: '削除に失敗しました',
    copySuccess: 'プロンプトをクリップボードにコピーしました',
    shareSuccess: '作品をコミュニティギャラリーに公開しました',
    loginTitle: 'ログインしてクラウドアーカイブを開始',
    loginDesc: 'ログインすると、AI生成画像・動画・音楽アセットを一元管理し、いつでもダウンロードやコミュニティ共有が可能です。',
    loginAction: '今すぐログイン / 新規登録',
    backToStudio: 'スタジオへ戻る',
    defaultCreator: 'クリエイター',
    defaultBio: 'AIで想像力の境界を広げ、次の創作へ。',
    statTotal: '作品合計',
    statShared: 'コミュニティ共有済',
    statLikes: '獲得いいね',
    countSummary: (count) => `合計 ${count} 件の創作素材`,
    emptyLoginTitle: 'クリエイターアカウントでログインしてください',
    emptyLoginDesc: 'ログインすると、クラウドでレンダリングされた画像、動画、音声の履歴を確認・管理できます。',
    emptyLoginAction: '今すぐログイン',
    emptyCatTitle: 'このカテゴリの作品はありません',
    emptyCatDesc: 'スタジオで新しい生成を開始すると、作品が自動的に安全に保存されます。',
    startFirstCreation: '最初の創作を始める',
    closePreview: 'プレビューを閉じる',
    previewDetails: '作品詳細',
    noPrompt: '詳細なプロンプトはありません',
    downloadOriginal: 'ダウンロード',
  },
  'ko-KR': {
    catAll: '모든 작품',
    catImage: 'AI 이미지 생성',
    catVideo: 'AI 비디오 생성',
    catAudio: 'AI 오디오 생성',
    catWorkflow: '디자인 및 워크플로',
    typeVideo: '비디오',
    typeAudio: '오디오',
    typeWorkflow: '워크플로',
    typeImage: '이미지',
    untitled: '제목 없는 작품',
    aiCreation: 'AI 창작',
    previewAria: (prompt) => `작품 미리보기: ${prompt}`,
    shared: '공개됨',
    remix: '유사 제작',
    shareToCommunity: '커뮤니티에 공유',
    copyPrompt: '프롬프트 복사',
    deleteAria: '작품 삭제',
    delete: '삭제',
    deleteConfirm: '이 작품을 삭제하시겠습니까? 커뮤니티에 게시된 경우 함께 삭제됩니다.',
    deleteSuccess: '작품이 삭제되었습니다',
    deleteFailed: '삭제 실패',
    copySuccess: '프롬프트가 복사되었습니다',
    shareSuccess: '커뮤니티 갤러리에 성공적으로 게시되었습니다',
    loginTitle: '로그인하여 클라우드 작품 보관 시작',
    loginDesc: '로그인하면 모든 AI 생성 이미지, 비디오 및 오디오를 한곳에서 관리하고 언제든지 다운로드하거나 커뮤니티에 공유할 수 있습니다.',
    loginAction: '지금 로그인 / 회원가입',
    backToStudio: '스튜디오로 돌아가기',
    defaultCreator: '크리에이터',
    defaultBio: 'AI로 상상력의 경계를 넓히고 다음 창작을 탐험하세요.',
    statTotal: '총 창작',
    statShared: '커뮤니티 게시',
    statLikes: '총 좋아요',
    countSummary: (count) => `총 ${count}개의 창작 자산`,
    emptyLoginTitle: '크리에이터 계정으로 로그인해 주세요',
    emptyLoginDesc: '로그인하면 클라우드에서 렌더링된 이미지, 비디오, 오디오 히스토리를 확인하고 관리할 수 있습니다.',
    emptyLoginAction: '지금 로그인',
    emptyCatTitle: '해당 유형의 창작물이 없습니다',
    emptyCatDesc: '스튜디오에서 생성을 시작하면 창작물이 여기에 안전하게 자동 보관됩니다.',
    startFirstCreation: '첫 번째 창작 시작하기',
    closePreview: '미리보기 닫기',
    previewDetails: '창작 상세',
    noPrompt: '상세 프롬프트 없음',
    downloadOriginal: '다운로드',
  },
  'zh-TW': {
    catAll: '全部作品',
    catImage: 'AI 生圖',
    catVideo: 'AI 視頻',
    catAudio: 'AI 音樂',
    catWorkflow: '設計與工作流',
    typeVideo: '視頻',
    typeAudio: '音訊',
    typeWorkflow: '工作流',
    typeImage: '圖像',
    untitled: '未命名作品',
    aiCreation: 'AI 創作',
    previewAria: (prompt) => `預覽作品：${prompt}`,
    shared: '已公開',
    remix: '做同款',
    shareToCommunity: '分享至社群',
    copyPrompt: '複製提示詞',
    deleteAria: '刪除作品',
    delete: '刪除',
    deleteConfirm: '確定要刪除這條作品記錄嗎？若已發布到社群也將一併下架。',
    deleteSuccess: '作品已刪除',
    deleteFailed: '刪除失敗',
    copySuccess: '提示詞已成功複製',
    shareSuccess: '作品已成功發布至社群畫廊',
    loginTitle: '登入開啟雲端作品歸檔',
    loginDesc: '登入後即可集中管理你的所有 AI 生圖、AI 視頻與音訊創作資產，隨時下載或一鍵分享至創作者社群。',
    loginAction: '立即登入 / 註冊',
    backToStudio: '返回創作工坊',
    defaultCreator: '創作者',
    defaultBio: '用 AI 拓展想像力的邊界，探索下一次創作。',
    statTotal: '創作總計',
    statShared: '已發社群',
    statLikes: '累計獲讚',
    countSummary: (count) => `共 ${count} 項創作素材`,
    emptyLoginTitle: '請先登入創作者帳號',
    emptyLoginDesc: '登入後方可查詢與管理你在雲端渲染生成的圖片、視頻和音訊歷史作品。',
    emptyLoginAction: '立即登入',
    emptyCatTitle: '暫無此類創作',
    emptyCatDesc: '前往 Studio 開啟一次生成，你的創作成果會自動安全歸檔到這裡。',
    startFirstCreation: '開始第一次創作',
    closePreview: '關閉預覽',
    previewDetails: '創作詳情',
    noPrompt: '無詳細提示詞',
    downloadOriginal: '下載原畫',
  },
  es: {
    catAll: 'Todas las creaciones',
    catImage: 'Imágenes IA',
    catVideo: 'Videos IA',
    catAudio: 'Audio IA',
    catWorkflow: 'Diseño y flujos',
    typeVideo: 'Video',
    typeAudio: 'Audio',
    typeWorkflow: 'Flujo',
    typeImage: 'Imagen',
    untitled: 'Creación sin título',
    aiCreation: 'Creación de IA',
    previewAria: (prompt) => `Vista previa: ${prompt}`,
    shared: 'Público',
    remix: 'Recrear',
    shareToCommunity: 'Compartir en comunidad',
    copyPrompt: 'Copiar prompt',
    deleteAria: 'Eliminar creación',
    delete: 'Eliminar',
    deleteConfirm: '¿Seguro que deseas eliminar esta creación? Si se publicó en la comunidad, también se retirará.',
    deleteSuccess: 'Creación eliminada',
    deleteFailed: 'Error al eliminar',
    copySuccess: 'Prompt copiado al portapapeles',
    shareSuccess: 'Publicado con éxito en la galería de la comunidad',
    loginTitle: 'Inicia sesión para archivar tus creaciones en la nube',
    loginDesc: 'Inicia sesión para administrar todas tus imágenes, videos y audios generados por IA en un solo lugar. Descárgalos o compártelos con la comunidad.',
    loginAction: 'Iniciar sesión / Registrarse',
    backToStudio: 'Volver al estudio',
    defaultCreator: 'Creador',
    defaultBio: 'Expandiendo los límites de la imaginación con IA, explorando la próxima creación.',
    statTotal: 'Total de creaciones',
    statShared: 'En comunidad',
    statLikes: 'Total de me gusta',
    countSummary: (count) => `${count} elementos de creación en total`,
    emptyLoginTitle: 'Por favor inicia sesión con tu cuenta de creador',
    emptyLoginDesc: 'Inicia sesión para ver y administrar tu historial de imágenes, videos y audios generados en la nube.',
    emptyLoginAction: 'Iniciar sesión ahora',
    emptyCatTitle: 'No hay creaciones en esta categoría',
    emptyCatDesc: 'Comienza a generar en Studio y tus creaciones se archivarán aquí automáticamente.',
    startFirstCreation: 'Iniciar primera creación',
    closePreview: 'Cerrar vista previa',
    previewDetails: 'Detalles de creación',
    noPrompt: 'Sin prompt detallado',
    downloadOriginal: 'Descargar',
  },
};

function getCreationsStrings(locale) {
  const norm = normalizeLocale(locale);
  return CREATIONS_I18N[norm] || CREATIONS_I18N.en;
}

function getCategories(strings) {
  return [
    { id: 'all', label: strings.catAll, icon: Sparkles },
    { id: 'image', label: strings.catImage, icon: ImageIcon },
    { id: 'video', label: strings.catVideo, icon: Clapperboard },
    { id: 'audio', label: strings.catAudio, icon: AudioLines },
    { id: 'workflow', label: strings.catWorkflow, icon: WandSparkles },
  ];
}

function getType(item) {
  const id = String(item.studio_id || '').toLowerCase();
  if (id.includes('video') || id.includes('motion') || id.includes('cinema') || id.includes('clip') || id.includes('lip')) return 'video';
  if (id.includes('audio') || id.includes('music') || id.includes('sound')) return 'audio';
  if (id.includes('workflow') || id.includes('agent') || id.includes('design')) return 'workflow';
  return 'image';
}

function getTypeMeta(type, strings) {
  return type === 'video'
    ? { label: strings.typeVideo, Icon: Clapperboard }
    : type === 'audio'
    ? { label: strings.typeAudio, Icon: AudioLines }
    : type === 'workflow'
    ? { label: strings.typeWorkflow, Icon: WandSparkles }
    : { label: strings.typeImage, Icon: ImageIcon };
}

function CreationSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#16171a] p-0 shadow-sm">
          <Skeleton className="aspect-square rounded-none bg-white/[0.04]" />
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-3/4 bg-white/[0.06]" />
            <Skeleton className="h-3 w-1/2 bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CreationCard({ item, onPreview, onRemix, onShare, onCopy, onDelete, strings }) {
  const type = getType(item);
  const { label, Icon } = getTypeMeta(type, strings);
  const meta = typeof item.metadata_json === 'object' ? item.metadata_json || {} : {};
  const prompt = item.label || meta.prompt || '';

  return (
    <div className="group overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#16171a] p-0 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:border-white/25 flex flex-col">
      <button
        type="button"
        className="relative block aspect-square w-full overflow-hidden bg-[#0c0d0f] text-left focus-visible:outline-none"
        onClick={() => onPreview(item)}
        aria-label={strings.previewAria(prompt || strings.untitled)}
      >
        {type === 'video' ? (
          <video
            src={item.result_url}
            muted
            loop
            playsInline
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : type === 'audio' ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 bg-[#131418] text-white">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <AudioLines className="size-7 text-white" />
            </span>
            <span className="text-xs tracking-wider text-gray-400 font-mono">AUDIO ASSET</span>
          </div>
        ) : (
          <img
            src={item.result_url}
            alt={prompt || strings.aiCreation}
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        )}

        <div className="absolute left-3 top-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
            <Icon className="size-3" />
            {label}
          </span>
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {item.is_shared && (
            <span className="rounded-full border border-white/15 bg-white/20 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-md">
              {strings.shared}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/70 backdrop-blur-md">
            <Sparkles className="size-2.5 text-brand" />
            SupDance AI
          </span>
        </div>

        {/* 悬浮遮罩操作条 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-2 items-center gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3.5 pb-3.5 pt-8 opacity-0 transition-[opacity,transform] duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 max-sm:pointer-events-auto max-sm:translate-y-0 max-sm:opacity-100">
          <button
            type="button"
            className="flex-1 h-8 rounded-full bg-white hover:bg-white/90 text-black text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              onRemix(item, event);
            }}
          >
            <WandSparkles className="size-3.5" />
            {strings.remix}
          </button>
          <button
            type="button"
            className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label={strings.shareToCommunity}
            onClick={(event) => {
              event.stopPropagation();
              onShare(item);
            }}
          >
            <Share2 className="size-3.5" />
          </button>
        </div>
      </button>

      <div className="flex items-center justify-between gap-3 p-3.5 border-t border-white/[0.05]">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">{prompt || strings.untitled}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-gray-500">
            {item.model || item.studio_id || 'AI Model'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={strings.copyPrompt}
            onClick={(event) => onCopy(prompt, event)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title={strings.copyPrompt}
          >
            <Copy className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={strings.deleteAria}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
            onClick={(event) => onDelete(item.id, event)}
            title={strings.delete}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreationsClient({ locale: localeProp = null }) {
  const activeLocale = resolveClientLocale({
    explicit: localeProp,
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    search: typeof window !== 'undefined' ? window.location.search : '',
    userLocale: typeof document !== 'undefined' ? document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/)?.[1] : null,
  });
  const strings = useMemo(() => getCreationsStrings(activeLocale), [activeLocale]);
  const categories = useMemo(() => getCategories(strings), [strings]);

  const [creations, setCreations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [shareTarget, setShareTarget] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [stats, setStats] = useState({ shared: 0, likes: 0 });

  const showToast = (message) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(''), 2800);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [userResponse, creationsResponse] = await Promise.all([
        fetch('/api/user/profile', { cache: 'no-store' }),
        fetch('/api/creations?limit=100', { cache: 'no-store' }),
      ]);
      const userData = userResponse.ok ? await userResponse.json().catch(() => ({})) : {};
      const creationData = creationsResponse.ok ? await creationsResponse.json().catch(() => ({})) : {};
      if (userData.user) {
        setUser(userData.user);
        setStats({
          shared: userData.user.stats?.publishedPosts || 0,
          likes: userData.user.stats?.totalLikes || 0,
        });
      } else {
        setUser(null);
      }
      if (Array.isArray(creationData.creations)) {
        setCreations(creationData.creations);
      } else {
        setCreations([]);
      }
    } catch {
      setUser(null);
      setCreations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!previewItem) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setPreviewItem(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewItem]);

  const handleDelete = async (id, event) => {
    event.stopPropagation();
    if (!window.confirm(strings.deleteConfirm)) return;
    try {
      const response = await fetch(`/api/creations?id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error || strings.deleteFailed);
      setCreations((current) => current.filter((item) => item.id !== id));
      if (previewItem?.id === id) setPreviewItem(null);
      showToast(strings.deleteSuccess);
    } catch (error) {
      showToast(error.message || strings.deleteFailed);
    }
  };

  const handleCopy = async (prompt, event) => {
    if (event) event.stopPropagation();
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    showToast(strings.copySuccess);
  };

  const handleRemix = (item, event) => {
    if (event) event.stopPropagation();
    const type = getType(item);
    const meta = typeof item.metadata_json === 'object' ? item.metadata_json || {} : {};
    const params = new URLSearchParams({
      remixPrompt: item.label || meta.prompt || '',
      remixModel: item.model || meta.model || '',
    });
    const studioUrl = localizeStudioPath(activeLocale, type === 'workflow' ? 'workflow' : type);
    window.location.href = `${studioUrl}?${params.toString()}`;
  };

  const filteredCreations = useMemo(
    () => creations.filter((item) => selectedCategory === 'all' || getType(item) === selectedCategory),
    [creations, selectedCategory]
  );

  return (
    <main className="min-h-screen bg-[#0e0f11] text-white flex flex-col selection:bg-white/20">
      <StudioHeader
        action="community"
        locale={activeLocale}
      />

      {toastMessage && (
        <div
          role="status"
          className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-[#1a1b1e]/95 px-5 py-2.5 text-xs font-medium text-white shadow-2xl backdrop-blur-xl animate-float-in"
        >
          {toastMessage}
        </div>
      )}

      {/* 居中主内容区，充满屏幕并带优雅呼吸感 */}
      <div className="flex-1 mx-auto w-full max-w-[1360px] px-6 sm:px-8 lg:px-12 py-8 sm:py-10 flex flex-col gap-8">
        {/* 未登录引导卡片 vs 创作者概览卡片 */}
        {!user ? (
          <div className="rounded-[24px] border border-white/[0.08] bg-[#16171a]/95 p-8 sm:p-12 backdrop-blur-md shadow-xl text-center flex flex-col items-center justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-400 mb-4 shadow-inner">
              <User className="size-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{strings.loginTitle}</h2>
            <p className="mt-2 text-sm text-gray-400 max-w-md leading-relaxed">
              {strings.loginDesc}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="h-10 px-6 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-all cursor-pointer shadow-lg"
              >
                {strings.loginAction}
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 px-6 rounded-full border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
              >
                <Link href={localizeStudioPath(activeLocale, 'image')}>{strings.backToStudio}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-white/[0.08] bg-[#16171a]/95 p-6 sm:p-8 backdrop-blur-md shadow-xl">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="flex size-14 sm:size-16 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#24262b] text-white shadow-inner">
                  <Sparkles className="size-6 text-white" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                      {user?.display_name || user?.displayName || user?.name || strings.defaultCreator}
                    </h1>
                    <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/90">
                      AI Creator
                    </span>
                  </div>
                  <p className="mt-1.5 max-w-xl text-xs sm:text-sm text-gray-400 leading-relaxed font-normal">
                    {user?.bio || strings.defaultBio}
                  </p>
                </div>
              </div>

              {/* 数据统计块 */}
              <div className="flex items-center gap-3">
                {[
                  [strings.statTotal, creations.length],
                  [strings.statShared, stats.shared],
                  [strings.statLikes, stats.likes],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="min-w-[96px] rounded-xl border border-white/[0.06] bg-[#1d1e21]/80 px-4 py-3 text-center shadow-sm"
                  >
                    <p className="text-[11px] text-gray-400 font-medium">{label}</p>
                    <p className="mt-1 text-lg font-bold font-mono text-white tabular-nums">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 分类过滤器与总计条 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.06] pb-5">
          <div className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#16171a] border border-white/[0.08]">
            {categories.map(({ id, label, icon: Icon }) => {
              const isSelected = selectedCategory === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedCategory(id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-white text-black shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-gray-400 font-normal">
            {strings.countSummary(filteredCreations.length)}
          </p>
        </div>

        {/* 创作网格展示区 / 空状态 */}
        <section className="flex-1 flex flex-col min-h-[420px]">
          {loading ? (
            <CreationSkeleton />
          ) : !user ? (
            <div className="flex-1 rounded-[28px] border border-white/[0.07] bg-[#16171a]/80 backdrop-blur-sm p-12 sm:p-20 text-center flex flex-col items-center justify-center shadow-xl">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-gray-500 shadow-inner">
                <User className="size-6 text-gray-400" />
              </div>
              <h3 className="mt-5 text-base font-bold text-white tracking-wide">{strings.emptyLoginTitle}</h3>
              <p className="mt-2 text-xs sm:text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                {strings.emptyLoginDesc}
              </p>
              <div className="mt-6">
                <Button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="rounded-full bg-white hover:bg-white/90 text-black px-6 py-2.5 text-xs sm:text-sm font-semibold shadow-lg transition-transform active:scale-95 cursor-pointer"
                >
                  {strings.emptyLoginAction}
                </Button>
              </div>
            </div>
          ) : filteredCreations.length === 0 ? (
            <div className="flex-1 rounded-[28px] border border-white/[0.07] bg-[#16171a]/80 backdrop-blur-sm p-12 sm:p-20 text-center flex flex-col items-center justify-center shadow-xl">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-white shadow-inner">
                <Sparkles className="size-6 text-white" />
              </div>
              <h3 className="mt-5 text-base font-bold text-white tracking-wide">{strings.emptyCatTitle}</h3>
              <p className="mt-2 text-xs sm:text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                {strings.emptyCatDesc}
              </p>
              <div className="mt-6">
                <Link
                  href={localizeStudioPath(activeLocale, 'image')}
                  className="inline-flex items-center gap-2 rounded-full bg-white hover:bg-white/90 text-black px-6 py-2.5 text-xs sm:text-sm font-semibold shadow-lg transition-transform active:scale-95"
                >
                  <Sparkles className="size-4" />
                  {strings.startFirstCreation}
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCreations.map((item) => (
                <CreationCard
                  key={item.id}
                  item={item}
                  strings={strings}
                  onPreview={setPreviewItem}
                  onRemix={handleRemix}
                  onShare={setShareTarget}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {shareTarget && (
        <ShareToCommunityModal
          creation={shareTarget}
          onClose={() => setShareTarget(null)}
          onSuccess={() => {
            showToast(strings.shareSuccess);
            loadData();
          }}
        />
      )}

      {/* 预览大图模态弹窗 */}
      {previewItem && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-scrim p-4 backdrop-blur-xl transition-opacity duration-modal ease-enter animate-fade-in"
          onClick={() => setPreviewItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line-strong bg-overlay shadow-elevation-4 md:flex-row backdrop-blur-xl animate-scale-in text-ink"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-wash hover:text-ink active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              onClick={() => setPreviewItem(null)}
              aria-label={strings.closePreview}
            >
              <X className="size-4" />
            </button>

            <div className="flex min-h-80 flex-1 items-center justify-center bg-[#0d0e10] p-4 md:min-h-[560px]">
              {getType(previewItem) === 'video' ? (
                <video
                  src={previewItem.result_url}
                  controls
                  autoPlay
                  className="max-h-[70vh] max-w-full rounded-xl"
                />
              ) : getType(previewItem) === 'audio' ? (
                <div className="flex w-full max-w-sm flex-col items-center gap-6">
                  <span className="flex size-20 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
                    <AudioLines className="size-10" />
                  </span>
                  <audio src={previewItem.result_url} controls autoPlay className="w-full" />
                </div>
              ) : (
                <img
                  src={previewItem.result_url}
                  alt={previewItem.label || strings.aiCreation}
                  className="max-h-[70vh] max-w-full object-contain rounded-xl"
                />
              )}
            </div>

            <div className="flex w-full flex-col justify-between gap-6 border-t border-white/[0.06] p-6 md:w-80 md:border-l md:border-t-0 bg-[#141517]">
              <div>
                <span className="inline-block rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs text-white font-medium">
                  {strings.previewDetails}
                </span>
                <h2 className="mt-3 text-base font-bold text-white">
                  {previewItem.label || strings.untitled}
                </h2>
                <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-white/[0.06] bg-[#0c0d0e] p-3 text-xs leading-relaxed text-gray-300 scrollbar-none [&::-webkit-scrollbar]:hidden">
                  {previewItem.metadata_json?.prompt || previewItem.label || strings.noPrompt}
                </div>
                {previewItem.model && (
                  <p className="mt-3 font-mono text-[11px] text-gray-400">
                    {previewItem.model}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-9 border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl gap-2 text-xs"
                  onClick={() => handleCopy(previewItem.metadata_json?.prompt || previewItem.label)}
                >
                  <Copy className="size-3.5" />
                  {strings.copyPrompt}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-9 border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl gap-2 text-xs"
                  onClick={() => window.open(previewItem.result_url, '_blank')}
                >
                  <Download className="size-3.5" />
                  {strings.downloadOriginal}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 登录/注册弹窗 */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          loadData();
        }}
      />
    </main>
  );
}
