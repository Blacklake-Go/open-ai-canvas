'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AudioLines,
  Clapperboard,
  Compass,
  Copy,
  Flame,
  Heart,
  Image as ImageIcon,
  LoaderCircle,
  MessageCircle,
  Music2,
  Search,
  Share2,
  Sparkles,
  WandSparkles,
  Workflow,
} from 'lucide-react';
import CommunityDetailModal from './CommunityDetailModal';
import StudioHeader from '@/components/site/StudioHeader';
import { resolveClientLocale, getCommonCopy, localizeStudioPath } from '@/lib/locales';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { normalizeLocale } from '@/lib/locales';

const COMMUNITY_COPY = {
  'zh-CN': {
    featuredBadge: '精选案例',
    featuredTitle: '从灵感到成片，看看创作者怎么做',
    featuredSubtitle: '精选真实社区作品，保留提示词、模型和创作方法，方便你直接拆解并做同款。',
    shareMyCase: '分享我的案例 →',
    remix: '做同款',
    unnamedCase: '未命名案例',
    defaultDesc: '查看这个案例的提示词与参数，快速复用创作方法。',
    communityCreator: '社区创作者',
    featuredVideoTag: 'AI 视频案例',
    featuredImageTag: 'AI 图像案例',
    audioCreation: '音频创作',
    unnamedPost: '未命名作品',
    likesCount: '个赞',
    likeUnit: '赞',
    coinUnit: '币',
    badgeCommunity: '灵感社区',
    heroTitle: '把灵感变成下一次创作',
    heroDesc: '探索生图、视频、音乐与工作流作品，查看提示词和参数，带着方法直接开始。',
    searchPlaceholder: '搜索提示词、风格或模型',
    searchBtn: '搜索',
    tabCategories: '作品分类',
    tabSorts: '排序规则',
    emptyTitle: '还没有匹配的灵感',
    emptyDesc: '换个关键词，或成为第一个在此频道发布创作成果的创作者。',
    shareFromMyCreations: '从我的作品分享',
    loadFailed: '加载失败，请稍后重试',
    pleaseLogin: '请先登录',
    networkError: '网络连接失败',
  },
  'zh-TW': {
    featuredBadge: '精選案例',
    featuredTitle: '從靈感到成片，看看創作者怎麼做',
    featuredSubtitle: '精選真實社區作品，保留提示詞、模型和創作方法，方便你直接拆解並做同款。',
    shareMyCase: '分享我的案例 →',
    remix: '做同款',
    unnamedCase: '未命名案例',
    defaultDesc: '查看這個案例的提示詞與參數，快速複用創作方法。',
    communityCreator: '社區創作者',
    featuredVideoTag: 'AI 影片案例',
    featuredImageTag: 'AI 圖像案例',
    audioCreation: '音訊創作',
    unnamedPost: '未命名作品',
    likesCount: '個讚',
    likeUnit: '讚',
    coinUnit: '幣',
    badgeCommunity: '靈感社區',
    heroTitle: '把靈感變成下一次創作',
    heroDesc: '探索生圖、影片、音樂與工作流作品，查看提示詞和參數，帶著方法直接開始。',
    searchPlaceholder: '搜尋提示詞、風格或模型',
    searchBtn: '搜尋',
    tabCategories: '作品分類',
    tabSorts: '排序規則',
    emptyTitle: '還沒有匹配的靈感',
    emptyDesc: '換個關鍵詞，或成為第一個在此頻道發布創作成果的創作者。',
    shareFromMyCreations: '從我的作品分享',
    loadFailed: '加載失敗，請稍後重試',
    pleaseLogin: '請先登入',
    networkError: '網絡連接失敗',
  },
  'ja-JP': {
    featuredBadge: 'おすすめ事例',
    featuredTitle: 'インスピレーションから完成まで、クリエイターの制作手法',
    featuredSubtitle: 'プロンプトやモデル、パラメータをそのまま再現・リミックスできる注目の作品。',
    shareMyCase: '自分の作品をシェア →',
    remix: '同作を作成',
    unnamedCase: '無題の事例',
    defaultDesc: 'プロンプトとパラメータを確認して制作手法を再利用。',
    communityCreator: 'クリエイター',
    featuredVideoTag: 'AI 動画事例',
    featuredImageTag: 'AI 画像事例',
    audioCreation: '音声作品',
    unnamedPost: '無題の作品',
    likesCount: 'いいね',
    likeUnit: 'いいね',
    coinUnit: 'コイン',
    badgeCommunity: 'インスピレーション',
    heroTitle: 'インスピレーションを次の創作へ',
    heroDesc: '画像、動画、音楽、ワークフローを探索し、プロンプトと設定から今すぐ制作。',
    searchPlaceholder: 'プロンプト、スタイル、モデルを検索',
    searchBtn: '検索',
    tabCategories: '作品カテゴリ',
    tabSorts: '並び順',
    emptyTitle: '一致する作品がありません',
    emptyDesc: '別のキーワードで検索するか、このチャンネルで最初に作品を公開してみましょう。',
    shareFromMyCreations: 'マイ作品からシェア',
    loadFailed: '読み込みに失敗しました。後でもう一度お試しください',
    pleaseLogin: 'ログインしてください',
    networkError: 'ネットワーク接続エラー',
  },
  'ko-KR': {
    featuredBadge: '추천 사례',
    featuredTitle: '영감에서 완성까지, 크리에이터의 제작 방식',
    featuredSubtitle: '프롬프트와 모델, 제작 설정이 포함된 커뮤니티 대표 작품을 직접 리믹스해보세요.',
    shareMyCase: '내 작품 공유하기 →',
    remix: '리믹스',
    unnamedCase: '이름 없는 사례',
    defaultDesc: '프롬프트와 파라미터를 확인하고 제작 방식을 활용해 보세요.',
    communityCreator: '커뮤니티 크리에이터',
    featuredVideoTag: 'AI 비디오 사례',
    featuredImageTag: 'AI 이미지 사례',
    audioCreation: '오디오 창작',
    unnamedPost: '이름 없는 작품',
    likesCount: '개 좋아요',
    likeUnit: '추천',
    coinUnit: '코인',
    badgeCommunity: '영감 커뮤니티',
    heroTitle: '영감을 다음 창작으로',
    heroDesc: '이미지, 비디오, 음악 및 워크플로를 탐색하고 프롬프트와 파라미터로 바로 시작하세요.',
    searchPlaceholder: '프롬프트, 스타일 또는 모델 검색',
    searchBtn: '검색',
    tabCategories: '작품 카테고리',
    tabSorts: '정렬 기준',
    emptyTitle: '일치하는 영감이 없습니다',
    emptyDesc: '다른 키워드로 검색하거나 이 채널에 첫 작품을 공유해 보세요.',
    shareFromMyCreations: '내 작품에서 공유하기',
    loadFailed: '불러오기에 실패했습니다. 잠시 후 다시 시도해 주세요',
    pleaseLogin: '먼저 로그인해 주세요',
    networkError: '네트워크 연결 실패',
  },
  es: {
    featuredBadge: 'Casos destacados',
    featuredTitle: 'De la idea a la creación: cómo lo hacen los creadores',
    featuredSubtitle: 'Obras de la comunidad con sus prompts y parámetros listos para remezclar y aprender el método creativo.',
    shareMyCase: 'Compartir mi creación →',
    remix: 'Remezclar',
    unnamedCase: 'Creación sin título',
    defaultDesc: 'Revisa los prompts y parámetros para reutilizar este método creativo.',
    communityCreator: 'Creador de la comunidad',
    featuredVideoTag: 'Caso de vídeo AI',
    featuredImageTag: 'Caso de imagen AI',
    audioCreation: 'Pista de audio',
    unnamedPost: 'Obra sin título',
    likesCount: 'me gusta',
    likeUnit: 'Me gusta',
    coinUnit: 'monedas',
    badgeCommunity: 'Comunidad de inspiración',
    heroTitle: 'Convierte la inspiración en tu próxima creación',
    heroDesc: 'Explora imágenes, vídeos, música y flujos de trabajo; examina prompts y parámetros para crear al instante.',
    searchPlaceholder: 'Buscar prompts, estilos o modelos',
    searchBtn: 'Buscar',
    tabCategories: 'Categorías',
    tabSorts: 'Ordenar por',
    emptyTitle: 'No hay inspiraciones coincidentes',
    emptyDesc: 'Prueba con otra palabra clave o sé el primero en compartir en este canal.',
    shareFromMyCreations: 'Compartir desde mis creaciones',
    loadFailed: 'Error al cargar, intenta nuevamente',
    pleaseLogin: 'Inicia sesión primero',
    networkError: 'Error de conexión de red',
  },
  en: {
    featuredBadge: 'Featured Cases',
    featuredTitle: 'From Inspiration to Creation: See How Creators Work',
    featuredSubtitle: 'Selected community creations with prompts and parameters ready for you to inspect and remix.',
    shareMyCase: 'Share my creation →',
    remix: 'Remix',
    unnamedCase: 'Untitled Creation',
    defaultDesc: 'Inspect prompts and parameters to reuse this creative method.',
    communityCreator: 'Community Creator',
    featuredVideoTag: 'AI Video Case',
    featuredImageTag: 'AI Image Case',
    audioCreation: 'Audio Track',
    unnamedPost: 'Untitled',
    likesCount: 'likes',
    likeUnit: 'Likes',
    coinUnit: 'coins',
    badgeCommunity: 'Inspiration Hub',
    heroTitle: 'Turn Inspiration into Your Next Creation',
    heroDesc: 'Explore images, videos, audio, and workflows. Inspect prompts and parameters to start creating immediately.',
    searchPlaceholder: 'Search prompts, styles, or models',
    searchBtn: 'Search',
    tabCategories: 'Categories',
    tabSorts: 'Sort Order',
    emptyTitle: 'No matching creations yet',
    emptyDesc: 'Try another keyword or be the first creator to share in this category.',
    shareFromMyCreations: 'Share from my creations',
    loadFailed: 'Failed to load, please try again later',
    pleaseLogin: 'Please log in first',
    networkError: 'Network connection failed',
  },
};

function getCategories(locale) {
  const norm = normalizeLocale(locale);
  const labels = {
    'zh-CN': { all: '探索发现', image: 'AI 绘画', video: 'AI 视频', audio: 'AI 音乐', workflow: '设计工作流' },
    'zh-TW': { all: '探索發現', image: 'AI 繪畫', video: 'AI 影片', audio: 'AI 音訊', workflow: '設計工作流' },
    'ja-JP': { all: '見つける', image: 'AI 画像', video: 'AI 動画', audio: 'AI 音楽', workflow: 'ワークフロー' },
    'ko-KR': { all: '탐색하기', image: 'AI 그림', video: 'AI 비디오', audio: 'AI 음악', workflow: '워크플로' },
    es: { all: 'Explorar', image: 'Pintura AI', video: 'Vídeo AI', audio: 'Música AI', workflow: 'Flujos de trabajo' },
    en: { all: 'Explore', image: 'AI Image', video: 'AI Video', audio: 'AI Music', workflow: 'Workflows' },
  };
  const d = labels[norm] || labels.en;
  return [
    { id: 'all', label: d.all, icon: Compass },
    { id: 'image', label: d.image, icon: ImageIcon },
    { id: 'video', label: d.video, icon: Clapperboard },
    { id: 'audio', label: d.audio, icon: Music2 },
    { id: 'workflow', label: d.workflow, icon: Workflow },
  ];
}

function getSorts(locale) {
  const norm = normalizeLocale(locale);
  const labels = {
    'zh-CN': { trending: '热门趋势', newest: '最新发布', likes: '最多赞赏' },
    'zh-TW': { trending: '熱門趨勢', newest: '最新發布', likes: '最多讚賞' },
    'ja-JP': { trending: 'トレンド', newest: '新着順', likes: '高評価順' },
    'ko-KR': { trending: '인기 트렌드', newest: '최신순', likes: '최다 추천순' },
    es: { trending: 'Tendencias', newest: 'Más recientes', likes: 'Más gustados' },
    en: { trending: 'Trending', newest: 'Newest', likes: 'Most Liked' },
  };
  const d = labels[norm] || labels.en;
  return [
    { id: 'trending', label: d.trending, icon: Flame },
    { id: 'newest', label: d.newest, icon: Sparkles },
    { id: 'likes', label: d.likes, icon: Heart },
  ];
}

function mediaMeta(type, locale) {
  const norm = normalizeLocale(locale);
  if (type === 'video') {
    const labels = { 'zh-CN': 'AI 视频', 'zh-TW': 'AI 影片', 'ja-JP': 'AI 動画', 'ko-KR': 'AI 비디오', es: 'AI Vídeo', en: 'AI Video' };
    return { label: labels[norm] || labels.en, Icon: Clapperboard };
  }
  if (type === 'audio') {
    const labels = { 'zh-CN': 'AI 音乐', 'zh-TW': 'AI 音樂', 'ja-JP': 'AI 音楽', 'ko-KR': 'AI 음악', es: 'AI Música', en: 'AI Music' };
    return { label: labels[norm] || labels.en, Icon: AudioLines };
  }
  if (type === 'workflow') {
    const labels = { 'zh-CN': '工作流', 'zh-TW': '工作流', 'ja-JP': 'ワークフロー', 'ko-KR': '워크플로', es: 'Flujo de trabajo', en: 'Workflow' };
    return { label: labels[norm] || labels.en, Icon: Workflow };
  }
  const labels = { 'zh-CN': 'AI 图像', 'zh-TW': 'AI 圖像', 'ja-JP': 'AI 画像', 'ko-KR': 'AI 이미지', es: 'AI Imagen', en: 'AI Image' };
  return { label: labels[norm] || labels.en, Icon: ImageIcon };
}

function FeedSkeleton() {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-border/70 bg-card/60">
          <Skeleton className={`w-full rounded-none ${index % 3 === 0 ? 'h-72' : index % 3 === 1 ? 'h-56' : 'h-80'}`} />
          <div className="flex flex-col gap-3 p-4"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
        </div>
      ))}
    </div>
  );
}

function FeaturedCaseShowcase({ posts, onOpen, onRemix, t, locale }) {
  if (!posts?.length) return null;

  const [hero, ...supporting] = posts;
  const heroMedia = hero.media_type === 'video' ? (hero.cover_url || hero.media_url) : (hero.cover_url || hero.media_url);

  return (
    <section aria-labelledby="featured-cases-title" className="relative overflow-hidden rounded-[28px] border border-white/[0.10] bg-[#121419] shadow-2xl shadow-black/25">
      <div className="pointer-events-none absolute -left-24 -top-32 size-96 rounded-full bg-cyan-500/[0.10] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 size-[28rem] rounded-full bg-violet-500/[0.10] blur-3xl" />
      <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              <Sparkles className="size-4" />
              {t.featuredBadge}
            </div>
            <h2 id="featured-cases-title" className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{t.featuredTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">{t.featuredSubtitle}</p>
          </div>
          <Link href="/creations" className="text-xs font-semibold text-cyan-300 transition-colors hover:text-cyan-200">{t.shareMyCase}</Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
          <article className="group relative min-h-[360px] overflow-hidden rounded-2xl border border-white/[0.10] bg-black/30">
            <button type="button" onClick={() => onOpen(hero.id)} className="absolute inset-0 text-left" aria-label={`案例：${hero.title || t.unnamedCase}`}>
              <img src={heroMedia} alt={hero.title || t.unnamedCase} className="h-full min-h-[360px] w-full object-cover transition duration-700 group-hover:scale-[1.035]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <div className="mb-3 flex flex-wrap gap-2">
                  {(hero.tags || []).slice(0, 3).map((tag) => <span key={tag} className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur">#{tag}</span>)}
                </div>
                <h3 className="max-w-xl text-xl font-bold tracking-tight text-white sm:text-2xl">{hero.title || t.unnamedCase}</h3>
                <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-white/70">{hero.description || hero.prompt || t.defaultDesc}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-white/65">
                  <span>{hero.author_name || hero.author_username || t.communityCreator}</span>
                  <span>♥ {hero.likes_count || 0}</span>
                  <span>◉ {hero.views_count || 0}</span>
                </div>
              </div>
            </button>
            <button type="button" onClick={(event) => onRemix(hero, event)} className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-black shadow-xl transition hover:bg-cyan-100">
              <WandSparkles className="size-3.5" />{t.remix}
            </button>
          </article>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {supporting.slice(0, 2).map((post) => (
              <button key={post.id} type="button" onClick={() => onOpen(post.id)} className="group flex min-h-[172px] gap-4 overflow-hidden rounded-2xl border border-white/[0.10] bg-black/20 p-3 text-left transition hover:border-cyan-300/35 hover:bg-white/[0.04]">
                <img src={post.cover_url || post.media_url} alt={post.title || t.unnamedCase} className="h-[146px] w-[116px] shrink-0 rounded-xl object-cover transition duration-500 group-hover:scale-[1.03]" />
                <span className="flex min-w-0 flex-1 flex-col justify-center">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">{post.media_type === 'video' ? t.featuredVideoTag : t.featuredImageTag}</span>
                  <span className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-white">{post.title || t.unnamedCase}</span>
                  <span className="mt-2 line-clamp-2 text-xs leading-5 text-gray-400">{post.description || post.prompt || t.defaultDesc}</span>
                  <span className="mt-auto pt-3 text-[11px] text-gray-500">♥ {post.likes_count || 0} · {post.author_name || post.author_username || t.communityCreator}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PostCard({ post, onOpen, onLike, onRemix, t, locale }) {
  const { label, Icon } = mediaMeta(post.media_type, locale);
  const isVideo = post.media_type === 'video';
  const isAudio = post.media_type === 'audio';

  return (
    <Card className="group mb-4 break-inside-avoid overflow-hidden border-border/75 bg-card/65 py-0 shadow-none transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_22px_70px_-30px_hsl(var(--primary)/0.55)]">
      <button type="button" className="block w-full text-left" onClick={() => onOpen(post.id)} aria-label={`作品：${post.title || t.unnamedPost}`}>
        <div className="relative overflow-hidden bg-muted/40">
          {isVideo ? (
            <video src={post.cover_url || post.media_url} muted loop playsInline className="block max-h-[30rem] min-h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          ) : isAudio ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-4 bg-gradient-to-br from-primary/15 via-card to-accent/15 p-6 text-primary">
              <span className="flex size-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_36px_hsl(var(--primary)/0.22)]"><AudioLines className="size-7" /></span>
              <span className="text-xs font-medium tracking-wide">{t.audioCreation}</span>
            </div>
          ) : (
            <img src={post.cover_url || post.media_url} alt={post.title} loading="lazy" className="block max-h-[32rem] min-h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background/85 to-transparent" />
          <Badge variant="secondary" className="absolute left-3 top-3 border border-white/10 bg-background/75 text-foreground backdrop-blur-md"><Icon />{label}</Badge>
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="line-clamp-2 text-xs font-medium text-foreground">{post.title}</span>
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur"><MessageCircle />{post.comments_count || 0}</span>
          </div>
        </div>
      </button>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{post.title || t.unnamedPost}</h3>
            <Link
              href={`/u/${post.author_user_number || post.user_id || ''}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 block truncate text-xs text-muted-foreground transition-colors hover:text-primary hover:underline"
            >
              {post.author_name || post.author_username || t.communityCreator}
            </Link>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Like" className={post.is_liked ? 'text-primary' : 'text-muted-foreground'} onClick={(event) => onLike(post, event)}>
            <Heart className={post.is_liked ? 'fill-current' : ''} />
            <span className="sr-only">{post.likes_count || 0} {t.likesCount}</span>
          </Button>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span>{post.likes_count || 0} {t.likeUnit}</span>
            <span>·</span>
            <span className="text-amber-400/90 font-medium">🪙 {post.coins_count || 0} {t.coinUnit}</span>
          </div>
          <Button type="button" variant="ghost" size="xs" className="text-primary hover:bg-primary/10" onClick={(event) => onRemix(post, event)}>
            <WandSparkles data-icon="inline-start" />{t.remix}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommunityClient({ initialPostId = null, locale: localeProp = null }) {
  const [posts, setPosts] = useState([]);
  const [featuredPosts, setFeaturedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePostId, setActivePostId] = useState(initialPostId);
  const [toastMsg, setToastMsg] = useState('');

  const activeLocale = resolveClientLocale({
    explicit: localeProp,
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    search: typeof window !== 'undefined' ? window.location.search : '',
    userLocale: typeof document !== 'undefined' ? document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/)?.[1] : null,
  });
  const norm = normalizeLocale(activeLocale);
  const copy = getCommonCopy(norm);
  const t = COMMUNITY_COPY[norm] || COMMUNITY_COPY.en;
  const categories = getCategories(norm);
  const sorts = getSorts(norm);

  const triggerToast = (message) => {
    setToastMsg(message);
    window.setTimeout(() => setToastMsg(''), 2500);
  };

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '36', sort });
      if (category !== 'all') params.set('category', category);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const response = await fetch(`/api/community/posts?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (Array.isArray(data.posts)) setPosts(data.posts);
    } catch (error) {
      console.error('Failed to load community creations', error);
      triggerToast(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [category, searchQuery, sort, t.loadFailed]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/community/posts?limit=3&sort=featured&featured=true', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (mounted && Array.isArray(data?.posts)) setFeaturedPosts(data.posts);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('tab') === 'remix') {
        const timer = setTimeout(() => {
          const featuredSection = document.getElementById('featured-cases-title');
          if (featuredSection) {
            featuredSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleLike = async (post, event) => {
    event.stopPropagation();
    try {
      const response = await fetch(`/api/community/posts/${post.id}/like`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) return triggerToast(data.error || t.pleaseLogin);
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, is_liked: data.isLiked, likes_count: data.likesCount } : item));
    } catch { triggerToast(t.networkError); }
  };

  const handleRemix = (post, event) => {
    event.stopPropagation();
    fetch(`/api/community/posts/${post.id}/remix`, { method: 'POST' }).catch(() => {});
    const target = post.media_type === 'video' ? 'video' : post.media_type === 'audio' ? 'audio' : post.media_type === 'workflow' ? 'workflow' : 'image';
    const params = new URLSearchParams();
    if (post.prompt) params.set('remixPrompt', post.prompt);
    if (target === 'video') {
      params.set('model', 'kling-v2.6-pro-t2v');
    } else if (target === 'image') {
      params.set('model', 'gpt-image-2.5-flash');
    }
    const studioUrl = localizeStudioPath(norm, target);
    window.location.href = `${studioUrl}?${params.toString()}`;
  };

  return (
    <main className="min-h-screen bg-[#0e0f11] text-foreground flex flex-col selection:bg-white/20">
      <StudioHeader
        action="creations"
        showBrand
        locale={norm}
        title={copy.shell?.community?.replace(/^🔥\s*/, '') || 'Community'}
        subtitle={copy.shell?.communityTitle || 'Discover inspiration, remix creative workflows'}
      />
      {toastMsg && <div role="status" className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full border border-primary/30 bg-popover/95 px-4 py-2 text-xs font-medium text-primary shadow-2xl backdrop-blur-xl animate-float-in">{toastMsg}</div>}
      
      {/* 居中主内容区：严格对齐个人中心的 1360px 版心与自适应留白 */}
      <div className="flex-1 mx-auto w-full max-w-[1360px] px-6 sm:px-8 lg:px-12 py-8 sm:py-10 flex flex-col gap-8">
        <FeaturedCaseShowcase posts={featuredPosts} onOpen={setActivePostId} onRemix={handleRemix} t={t} locale={norm} />
        <section className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#16171a]/95 px-6 py-10 text-center shadow-xl backdrop-blur-md sm:px-12 sm:py-14">
          <div className="pointer-events-none absolute -left-16 -top-20 size-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 size-80 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative mx-auto max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              <Sparkles className="size-3.5" />
              {t.badgeCommunity}
            </span>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-5xl">{t.heroTitle}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-xs sm:text-sm leading-relaxed text-gray-400 font-normal">{t.heroDesc}</p>
            <form onSubmit={(event) => { event.preventDefault(); loadPosts(); }} className="mx-auto mt-8 flex max-w-2xl items-center gap-2 rounded-full border border-white/[0.10] bg-[#121316] p-1.5 shadow-elevation-2 transition focus-within:border-brand-line focus-within:ring-2 focus-within:ring-brand/20">
              <Search className="ml-3.5 size-4 shrink-0 text-ink-muted" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t.searchPlaceholder} className="h-10 sm:h-11 flex-1 border-0 bg-transparent px-2.5 text-sm text-white placeholder:text-ink-subtle focus:outline-none rounded-xl" />
              <button type="submit" className="h-10 sm:h-11 rounded-full bg-white px-6 text-xs sm:text-sm font-semibold text-black shadow-elevation-1 transition-all hover:bg-white/90 active:scale-95 cursor-pointer">{t.searchBtn}</button>
            </form>
          </div>
        </section>

        {/* 分类过滤器与排序切换栏（严格遵循连续胶囊 UI 规范） */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.06] pb-5">
          <div className="inline-flex max-w-full overflow-x-auto items-center gap-1.5 p-1 rounded-full bg-surface-raised border border-line-subtle no-scrollbar" role="tablist" aria-label={t.tabCategories}>
            {categories.map(({ id, label, icon: Icon }) => {
              const isSelected = category === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setCategory(id)}
                  className={`flex shrink-0 items-center gap-2 h-8 px-4 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white text-black shadow-elevation-1'
                      : 'text-ink-muted hover:text-white hover:bg-wash'
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface-raised border border-line-subtle self-start sm:self-auto" role="tablist" aria-label={t.tabSorts}>
            {sorts.map(({ id, label, icon: Icon }) => {
              const isSelected = sort === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSort(id)}
                  className={`flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white/15 text-white font-semibold shadow-elevation-1'
                      : 'text-ink-muted hover:text-white hover:bg-wash'
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 内容网格与大卡片空状态（对齐个人中心） */}
        <section className="flex-1 flex flex-col min-h-[420px]" aria-live="polite">
          {loading ? (
            <FeedSkeleton />
          ) : posts.length === 0 ? (
            <div className="flex-1 rounded-[28px] border border-white/[0.07] bg-[#16171a]/80 backdrop-blur-sm p-12 sm:p-20 text-center flex flex-col items-center justify-center shadow-xl">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-white shadow-inner">
                <Compass className="size-6 text-white" />
              </div>
              <h3 className="mt-5 text-base font-bold text-white tracking-wide">{t.emptyTitle}</h3>
              <p className="mt-2 text-xs sm:text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                {t.emptyDesc}
              </p>
              <div className="mt-6">
                <Link
                  href="/creations"
                  className="inline-flex items-center gap-2 rounded-full bg-white hover:bg-white/90 text-black px-6 py-2.5 text-xs sm:text-sm font-semibold shadow-lg transition-transform active:scale-95"
                >
                  <Share2 className="size-4" />
                  {t.shareFromMyCreations}
                </Link>
              </div>
            </div>
          ) : (
            <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} onOpen={setActivePostId} onLike={handleLike} onRemix={handleRemix} t={t} locale={norm} />
              ))}
            </div>
          )}
        </section>
      </div>
      {activePostId && (
        <CommunityDetailModal
          postId={activePostId}
          locale={norm}
          initialPost={posts.find((post) => post.id === activePostId)}
          onClose={() => setActivePostId(null)}
          onLikeChange={(id, liked, count) => setPosts((current) => current.map((post) => post.id === id ? { ...post, is_liked: liked, likes_count: count } : post))}
        />
      )}
    </main>
  );
}
