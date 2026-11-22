import { useEffect, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Navigate, useLocation, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, Boxes, Code2, Compass, Cpu, Shield } from 'lucide-react';
import ModelsScreenerPageClient from '@/components/models/ModelsScreenerPageClient';
import ModelDetailPageClient from '@/components/models/ModelDetailPageClient';
import CommunityClient from '@/components/community/CommunityClient';
import CreationsClient from '@/components/creations/CreationsClient';
import CoinExchangeClient from '@/components/coins/CoinExchangeClient';
import CreditsClient from '@/components/credits/CreditsClient';
import BenefitsClient from '@/components/benefits/BenefitsClient';
import AboutPageClient from '@/components/about/AboutPageClient';
import FeedbackPageClient from '@/components/feedback/FeedbackPageClient';
import UserProfileClient from '@/components/profile/UserProfileClient';
import UserProfileView from '@/components/profile/UserProfileView';
import NewcomerOnboardingModal from '@/components/onboarding/NewcomerOnboardingModal';
import StandaloneShell from '@/components/StandaloneShell';
import StudioHeader from '@/components/site/StudioHeader';
import { SpatialBackground } from '@/components/spatial';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  PromptComposer,
  PromptTextarea,
  PromptFooter,
  PromptControls,
  PromptAction,
  promptControlClassName,
  promptMediaButtonClassName,
  PromptChevronIcon,
  PromptAspectRatioIcon,
} from '@/packages/studio/src/components/prompt/PromptComposer';
import { getModelById } from '@/lib/modelCenter/modelScreenerData';
import { DEFAULT_FEEDBACK_SUPPORT_EMAIL } from '@/lib/feedback/catalog';
import { getLocaleConfig, isSupportedLocale, normalizeLocale } from '@/lib/locales';
import { LOCALIZED_PATHS, UNPREFIXED_TOP_SEGMENTS } from '@/lib/routePolicy';
import { oneApi } from '@/services/api/http';
import {
  getCookieLocaleClient,
  resolveEffectiveLocaleClient,
  useDocumentTitle,
} from '@/pages/helpers/pageHelpers';
import RootNotFound from '@/pages/boundaries/RootNotFound';

export function ModelsPage({ forcedLocale }: { forcedLocale?: string }) {
  const locale = forcedLocale || resolveEffectiveLocaleClient();
  useDocumentTitle(
    forcedLocale === 'zh-CN'
      ? '模型目录 — 已上架模型与 24h 真实调用统计 | SupDance'
      : 'Model Directory — Actual 24h Usage & Pricing | SupDance'
  );
  return <ModelsScreenerPageClient locale={locale} />;
}

export function ModelDetailPage({ forcedLocale = 'en' }: { forcedLocale?: string }) {
  const { id = 'flux-dev' } = useParams<{ id?: string }>();
  const model = getModelById(id);
  const isZh = forcedLocale === 'zh-CN';
  useDocumentTitle(
    model
      ? isZh
        ? `${model.name} — 模型详情 | SupDance`
        : `${model.name} — Model Overview | SupDance`
      : isZh
        ? '模型详情 — SupDance'
        : 'Model Overview — SupDance'
  );
  return <ModelDetailPageClient modelId={id} locale={forcedLocale} />;
}

export function CommunityPage({ forcedLocale }: { forcedLocale?: string }) {
  const locale = forcedLocale || resolveEffectiveLocaleClient();
  useDocumentTitle(
    forcedLocale === 'zh-CN'
      ? '社区 — 探索 AI 艺术灵感与一键做同款 | SupDance AI Studio'
      : 'Community — AI Art Inspiration & Creative Workflows | SupDance'
  );
  return <CommunityClient locale={locale} />;
}

export function CommunityDetailPage() {
  const { id } = useParams<{ id?: string }>();
  useDocumentTitle(`作品详情 #${id || ''} — SupDance 社区`);
  return <CommunityClient initialPostId={id} />;
}

export function CreationsPage() {
  const locale = resolveEffectiveLocaleClient();
  useDocumentTitle('Creations & Asset Library — SupDance AI Studio');
  return <CreationsClient locale={locale} />;
}

export function CoinsPage() {
  useDocumentTitle('K 币兑换中心 — SupDance AI Studio');
  return <CoinExchangeClient />;
}

export function CreditsPage() {
  useDocumentTitle('算力资产与积分中心 — SupDance AI Studio');
  return <CreditsClient />;
}

export function BenefitsPage({ forcedLocale }: { forcedLocale?: string }) {
  const locale = forcedLocale || resolveEffectiveLocaleClient();
  useDocumentTitle(
    forcedLocale === 'zh-CN'
      ? '硬币小铺 — SupDance AI Studio'
      : 'Coin Shop — SupDance AI Studio'
  );
  return <BenefitsClient locale={forcedLocale ? undefined : locale} />;
}

export function AboutPage({ forcedLocale = 'en' }: { forcedLocale?: string }) {
  useDocumentTitle(
    forcedLocale === 'zh-CN'
      ? '关于我们 — 专业 · 可信赖的生成式 AI 生产力基础设施 | SupDance'
      : 'About Us — Trusted & Secure Creative AI Infrastructure | SupDance'
  );
  return <AboutPageClient locale={forcedLocale} />;
}

export function CallApiPage({ locale = 'en' }: { locale?: string }) {
  const isChinese = Boolean(locale?.includes('zh'));
  useDocumentTitle(
    isChinese ? '开发者 API — 筹备中 | SupDance' : 'Developer API — Coming Soon | SupDance'
  );

  const studioHref = isChinese ? '/zh/studio' : '/studio';
  const modelsHref = isChinese ? '/zh/models' : '/models';
  const communityHref = isChinese ? '/zh/community' : '/community';

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#07080c] font-sans text-white">
      <StudioHeader locale={locale} activeTab="call-api" className="relative z-40" />
      <SpatialBackground />

      <main className="relative z-10 mx-auto flex max-w-[1100px] flex-col px-4 pb-24 pt-16 sm:px-6 lg:px-12">
        <div className="mb-8 flex items-center gap-2 font-mono text-xs text-white/40">
          <Link href={isChinese ? '/zh' : '/'} className="flex items-center gap-1.5 transition hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            {isChinese ? '返回首页' : 'Back home'}
          </Link>
          <span>/</span>
          <span>{isChinese ? '开放平台' : 'Developer API'}</span>
        </div>

        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-mono text-[#00f5d4]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00f5d4]" />
            {isChinese ? '开发者 API · 筹备中' : 'Developer API · In preparation'}
          </div>

          <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            {isChinese ? '公开 API 尚未开放' : 'Public API access is not available yet'}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/60 sm:text-base">
            {isChinese
              ? '我们正在准备正式的开发者 API、API Key 管理与 SDK 接入能力。当前页面不提供申请入口，也没有可用的接口密钥或调用额度。'
              : 'We are preparing the developer API, API key management, and SDK access. There is no application form, API key, or quota available on this page yet.'}
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href={modelsHref}
            className="group rounded-2xl border border-white/10 bg-[#101216] p-5 transition hover:border-white/25"
          >
            <Boxes className="h-5 w-5 text-[#00f5d4]" />
            <h2 className="mt-4 text-sm font-bold">{isChinese ? '模型目录' : 'Model directory'}</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              {isChinese ? '查看已上架模型与真实 24h 调用统计。' : 'Browse listed models with actual 24-hour usage.'}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#3772FF]">
              {isChinese ? '前往模型目录' : 'View models'}
              <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            href={studioHref}
            className="group rounded-2xl border border-white/10 bg-[#101216] p-5 transition hover:border-white/25"
          >
            <Cpu className="h-5 w-5 text-[#3772FF]" />
            <h2 className="mt-4 text-sm font-bold">{isChinese ? 'Studio 工作台' : 'Studio workspace'}</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              {isChinese ? '通过网页工作台直接使用已上架模型。' : 'Use listed models directly in the web workspace.'}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#3772FF]">
              {isChinese ? '进入 Studio' : 'Open Studio'}
              <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            href={communityHref}
            className="group rounded-2xl border border-white/10 bg-[#101216] p-5 transition hover:border-white/25"
          >
            <Compass className="h-5 w-5 text-[#e11d74]" />
            <h2 className="mt-4 text-sm font-bold">{isChinese ? '社区与公告' : 'Community & updates'}</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              {isChinese ? 'API 开放时会在社区与站内公告同步。' : 'API availability will be announced in the community.'}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#3772FF]">
              {isChinese ? '前往社区' : 'Visit community'}
              <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <Shield className="h-5 w-5 text-[#00f5d4]" />
          <p className="flex-1 text-xs leading-relaxed text-white/50">
            {isChinese
              ? '在正式开放前，请勿通过非官方渠道购买或提交 API Key。'
              : 'Until the official launch, please do not buy or submit API keys through unofficial channels.'}
          </p>
          <a
            href={studioHref}
            className="btn-spatial-glow inline-flex items-center gap-2 rounded-full bg-[#3772FF] px-5 py-2.5 text-xs font-bold text-white"
          >
            {isChinese ? '先去 Studio 创作' : 'Create in Studio'}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="mt-8 flex items-center gap-2 text-[11px] text-white/30">
          <Code2 className="h-3.5 w-3.5" />
          {isChinese ? '此页面不提供 API 文档或代码示例。' : 'This page does not provide API documentation or code samples.'}
        </div>
      </main>
    </div>
  );
}

export function FeedbackPage() {
  useDocumentTitle('建议与需求 — SupDance');
  const [supportEmail, setSupportEmail] = useState(DEFAULT_FEEDBACK_SUPPORT_EMAIL);

  useEffect(() => {
    let cancelled = false;
    oneApi
      .getSubscriptionFAQ()
      .then((res: any) => {
        if (!cancelled && res?.supportEmail) {
          setSupportEmail(res.supportEmail);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <FeedbackPageClient supportEmail={supportEmail} />;
}

export function ProfilePage({ forcedLocale }: { forcedLocale?: string }) {
  const isZh = forcedLocale === 'zh-CN';
  useDocumentTitle(isZh ? '创作者主页 — SupDance AI Studio' : 'Creator Profile — supdance');

  const [state, setState] = useState<{ loading: boolean; user: any }>({
    loading: true,
    user: null,
  });

  useEffect(() => {
    let cancelled = false;
    oneApi
      .getAuthMe()
      .then((res) => {
        if (!cancelled) setState({ loading: false, user: res?.user || null });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, user: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
      </div>
    );
  }

  if (!state.user) {
    return <Navigate to={isZh ? '/zh/login?redirect=/zh/profile' : '/login?redirect=/profile'} replace />;
  }

  const user = state.user;
  const canonicalNumber = user.userNumber || user.user_number || String(user.id);
  const creator = {
    id: user.id,
    userNumber: canonicalNumber,
    displayName:
      user.displayName ||
      user.display_name ||
      (isZh ? `创作者#${canonicalNumber}` : `Creator#${canonicalNumber}`),
    avatarUrl: user.avatar_url || user.avatarUrl || user.avatar,
    bio: user.bio || '',
    followersCount: Number(user.followers_count || user.followersCount || 0),
    followingCount: Number(user.following_count || user.followingCount || 0),
    isActivityPublic: user.is_activity_public !== false,
    createdAt: user.created_at || user.createdAt,
  };

  return <UserProfileClient creator={creator} />;
}

export function PublicCreatorProfilePage() {
  const { id } = useParams<{ id?: string }>();
  useDocumentTitle('创作者主页 — supdance');
  if (!id) return <RootNotFound />;
  return <UserProfileView userId={id} showHeader={true} showBackLink={true} embedded={false} />;
}

export function OnboardingPage() {
  useDocumentTitle('新人创作引导 — SupDance');
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  const isPreview = sp.get('preview') === 'true' || sp.get('preview') === '1';
  const initialStep = parseInt(sp.get('step') || '1', 10) === 2 ? 2 : 1;

  const [state, setState] = useState<{ loading: boolean; user: any }>({
    loading: !isPreview,
    user: null,
  });

  useEffect(() => {
    let cancelled = false;
    oneApi
      .getAuthMe()
      .then((res) => {
        if (!cancelled) setState({ loading: false, user: res?.user || null });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, user: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
      </div>
    );
  }

  if (!state.user && !isPreview) {
    return <Navigate to="/" replace />;
  }

  const user = state.user || {
    id: '888888',
    userNumber: '888888',
    displayName: '新锐创作者',
    locale: 'zh',
    onboardingCompleted: false,
    onboardingStep: initialStep,
  };

  const locale = state.user
    ? normalizeLocale(getCookieLocaleClient() || state.user.locale || 'en')
    : 'zh-CN';
  const config = getLocaleConfig(locale);
  const studioHref = config.rootPath ? `${config.rootPath}/studio` : '/studio';

  if (user.onboardingCompleted && !isPreview) {
    return <Navigate to={studioHref} replace />;
  }

  return (
    <NewcomerOnboardingModal
      user={user}
      locale={locale}
      studioHref={studioHref}
      isPageMode={true}
      initialStep={initialStep}
    />
  );
}

export function DesignSystemPage() {
  const [prompt, setPrompt] = useState(
    'A cinematic portrait of an AI creator in a minimal technical studio, soft directional lighting, 8k'
  );
  const [selectedRatio] = useState('16:9');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas text-gray-100 p-6 md:p-12 space-y-16 custom-scrollbar selection:bg-cyan-500/30 selection:text-white">
      <header className="border-b border-white/[0.08] pb-8 space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-cyan-400" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            SupDance Design System
          </h1>
          <Badge variant="accent">v2.0 Premium</Badge>
        </div>
        <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
          Design Direction: <strong className="text-gray-200">“Premium AI Creative Workspace”</strong>. Professional, Cinematic, Minimal, Dense but breathable, Quiet, Technical, Creator-first, Dark-first.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
          <span>01. Semantic Color Tokens</span>
        </h2>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Surface Elevation Levels</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { name: 'Canvas', token: '--bg-canvas', hex: '#07080b', class: 'bg-canvas border border-white/[0.12]' },
              { name: 'Base', token: '--bg-base', hex: '#0c0e14', class: 'bg-base border border-white/[0.10]' },
              { name: 'Surface', token: '--bg-surface', hex: '#12151e', class: 'bg-surface border border-white/[0.10]' },
              { name: 'Raised', token: '--bg-surface-raised', hex: '#181d2a', class: 'bg-surface-raised border border-white/[0.10]' },
              { name: 'Overlay', token: '--bg-overlay', hex: '#1f2536', class: 'bg-surface-overlay border border-white/[0.12]' },
            ].map((item) => (
              <div key={item.name} className={`p-4 rounded-xl ${item.class} flex flex-col justify-between h-24`}>
                <span className="text-xs font-semibold text-white">{item.name}</span>
                <div className="text-[11px] text-gray-400 font-mono">
                  <span>{item.hex}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Brand & Feedback</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { name: 'Accent Primary', hex: '#e11d74', class: 'bg-brand text-white' },
              { name: 'Success', hex: '#10b981', class: 'bg-emerald-500 text-black' },
              { name: 'Warning', hex: '#f59e0b', class: 'bg-amber-500 text-black' },
              { name: 'Danger', hex: '#ef4444', class: 'bg-red-500 text-white' },
              { name: 'Info', hex: '#3b82f6', class: 'bg-blue-500 text-white' },
            ].map((item) => (
              <div key={item.name} className={`p-4 rounded-xl ${item.class} flex flex-col justify-between h-20 shadow-sm font-medium`}>
                <span className="text-xs">{item.name}</span>
                <span className="text-[11px] font-mono">{item.hex}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-white tracking-tight">02. Button Primitive Family</h2>
        <div className="p-6 rounded-xl bg-surface border border-white/[0.08] space-y-6">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Variants</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary Action</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Height Contracts (sm: 32px, md: 38px, lg: 44px)</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm">Small (32px)</Button>
              <Button variant="secondary" size="md">Medium (38px)</Button>
              <Button variant="secondary" size="lg">Large (44px)</Button>
              <Button variant="secondary" size="icon-sm" aria-label="Settings">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </Button>
              <Button variant="secondary" size="icon-md" aria-label="Settings">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">States (Loading, Disabled)</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" loading>Generating...</Button>
              <Button variant="secondary" loading>Processing...</Button>
              <Button variant="primary" disabled>Disabled Primary</Button>
              <Button variant="secondary" disabled>Disabled Secondary</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-white tracking-tight">03. Inputs & Select Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl bg-surface border border-white/[0.08] space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Text Inputs</h3>
            <Input placeholder="Standard Input (38px)..." />
            <Input placeholder="Small Input (32px)..." size="sm" />
            <Input placeholder="Error State Input..." error defaultValue="Invalid API Token" />
            <Input placeholder="Disabled Input..." disabled defaultValue="Disabled by system" />
          </div>

          <div className="p-6 rounded-xl bg-surface border border-white/[0.08] space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Select & Dropdown</h3>
            <Select defaultValue="flux-pro">
              <SelectTrigger>
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flux-pro">FLUX.1 Pro Ultra</SelectItem>
                <SelectItem value="flux-dev">FLUX.1 Dev</SelectItem>
                <SelectItem value="sd-35">Stable Diffusion 3.5 Large</SelectItem>
                <SelectItem value="recraft">Recraft V3 Vector</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Multi-line Prompt or script textarea with quiet custom scrollbar..." rows={3} />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-white tracking-tight">04. Badges & Card System</h2>
        <div className="p-6 rounded-xl bg-surface border border-white/[0.08] space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Default</Badge>
            <Badge variant="accent">Generating</Badge>
            <Badge variant="success">Completed</Badge>
            <Badge variant="warning">Queued</Badge>
            <Badge variant="danger">Failed</Badge>
            <Badge variant="info">Syncing</Badge>
            <Badge variant="outline">Outline Pill</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Base Studio Card</CardTitle>
                <CardDescription>Default surface elevation for parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Quiet borders, zero noisy glow. Ensures AI artwork remains the sole hero.
                </p>
              </CardContent>
            </Card>

            <Card interactive>
              <CardHeader>
                <CardTitle>Interactive Model Card</CardTitle>
                <CardDescription>Subtle hover brightness elevation</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Hovering elevates surface-raised background and sharpens border contrast.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Modal Primitive</CardTitle>
                <CardDescription>Standard Dialog / Drawer</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" size="sm" onClick={() => setIsDialogOpen(true)}>
                  Open Standard Dialog
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-white tracking-tight">
          05. Prompt Composer (Tier-1 Core Component)
        </h2>

        <div className="relative min-h-[300px] rounded-2xl bg-base border border-white/[0.08] p-6 flex flex-col justify-end items-center overflow-hidden">
          <div className="text-center text-gray-500 text-xs mb-8">
            Canvas Workspace Preview — Prompt Composer Anchored at Bottom
          </div>

          <div className="w-full max-w-3xl">
            <PromptComposer positionClassName="relative w-full">
              <PromptTextarea
                value={prompt}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                placeholder="Describe your creation prompt..."
              />
              <PromptFooter>
                <PromptControls>
                  <button type="button" className={promptControlClassName({ active: false })}>
                    <PromptAspectRatioIcon />
                    <span>{selectedRatio}</span>
                    <PromptChevronIcon />
                  </button>

                  <button type="button" className={promptControlClassName({ active: true })}>
                    <span>FLUX.1 Pro</span>
                    <PromptChevronIcon />
                  </button>

                  <button type="button" className={promptMediaButtonClassName({ active: false })} aria-label="Upload Reference Image">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </button>
                </PromptControls>

                <PromptAction>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  <span>Generate</span>
                </PromptAction>
              </PromptFooter>
            </PromptComposer>
          </div>
        </div>
      </section>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Standard Workspace Modal</DialogTitle>
            <DialogDescription>
              This dialog inherits Design Tokens (--bg-overlay, radius-xl, border-strong).
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-300">
            Esc closes the dialog. Tab navigation is trapped naturally within the modal container.
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setIsDialogOpen(false)}>Confirm Action</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function WorkflowAliasPage() {
  useDocumentTitle('Workflow — SupDance');
  const locale = resolveEffectiveLocaleClient();
  return <StandaloneShell locale={locale} />;
}

export function AccountRedirectPage() {
  useDocumentTitle('账户与订阅 | SupDance AI Studio');
  const location = useLocation();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    oneApi
      .getAuthMe()
      .catch(() => null)
      .then((res) => {
        if (cancelled) return;
        const userLocale = (res?.user as { locale?: string } | undefined)?.locale;
        const targetLocale = resolveEffectiveLocaleClient(userLocale);
        const config = getLocaleConfig(targetLocale);
        const studioRoot = config.rootPath ? `${config.rootPath}/studio` : '/studio';
        const sp = new URLSearchParams(location.search);
        const action = sp.get('action') ? `&action=${encodeURIComponent(sp.get('action')!)}` : '';
        setTarget(`${studioRoot}?account=open${action}`);
      });
    return () => {
      cancelled = true;
    };
  }, [location.search]);

  if (!target) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
      </div>
    );
  }
  return <Navigate to={target} replace />;
}

export function PricingRedirectPage({ locale = 'en' }: { locale?: string }) {
  return <Navigate to={locale === 'zh-CN' ? '/zh/studio?subscription=open' : '/studio?subscription=open'} replace />;
}

export function AssistantRedirectPage({ locale = 'en' }: { locale?: string }) {
  return <Navigate to={locale === 'zh-CN' ? '/zh/studio' : '/studio'} replace />;
}

export function WorkflowIndexRedirectPage({ locale = 'en' }: { locale?: string }) {
  return <Navigate to={locale === 'zh-CN' ? '/zh/studio/workflows' : '/studio/workflows'} replace />;
}

export function AgentsIndexRedirectPage() {
  return <Navigate to="/studio/agents" replace />;
}

export function AgentsCreateRedirectPage() {
  return <Navigate to="/studio/agents/create" replace />;
}

export function AgentDetailRedirectPage() {
  const { agent_id = '' } = useParams<{ agent_id?: string }>();
  return <Navigate to={`/studio/agents/${encodeURIComponent(agent_id)}`} replace />;
}

export function AgentConversationRedirectPage() {
  const { agent_id = '', conversation_id = '' } = useParams<{
    agent_id?: string;
    conversation_id?: string;
  }>();
  return (
    <Navigate
      to={`/studio/agents/${encodeURIComponent(agent_id)}/${encodeURIComponent(conversation_id)}`}
      replace
    />
  );
}

export function AgentEditRedirectPage() {
  const { id = '' } = useParams<{ id?: string }>();
  return <Navigate to={`/studio/agents/edit/${encodeURIComponent(id)}`} replace />;
}

export function LocalizedFallbackPage() {
  const params = useParams();
  const location = useLocation();
  const locale = params.locale;
  const rawSplat = params['*'] || '';
  const rest = rawSplat.split('/').filter(Boolean);
  const path = rest.join('/');
  const suffix = location.search || '';

  if (!locale || !isSupportedLocale(locale)) {
    return <RootNotFound />;
  }

  const config = getLocaleConfig(locale);
  if (locale !== config.rootPath.slice(1)) {
    return <Navigate to={`${config.rootPath}/${path}${suffix}`} replace />;
  }

  if (((LOCALIZED_PATHS as Record<string, string[]>)[config.rootPath] || []).includes(rest[0])) {
    return <RootNotFound />;
  }

  if (UNPREFIXED_TOP_SEGMENTS.includes(rest[0])) {
    return <Navigate to={`/${path}${suffix}`} replace />;
  }

  return <RootNotFound />;
}
