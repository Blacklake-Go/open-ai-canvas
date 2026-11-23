import { useEffect, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Navigate, useLocation, useParams } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Cpu,
  Shield,
  Check,
  Copy,
  Terminal,
  Key,
  Zap,
  Layers,
  Server,
} from 'lucide-react';
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
import PricingClient from '@/components/pricing/PricingClient';
import AccountCenterView from '@/components/account/AccountCenterView';
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
    isChinese ? '开发者开放平台 API — SupDance' : 'Developer API Platform — SupDance'
  );

  const [codeTab, setCodeTab] = useState<'curl' | 'python' | 'ts'>('curl');
  const [copied, setCopied] = useState(false);

  const curlSnippet = `curl -X POST "https://one.supdance.com/api/generations" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "seedream-4.5",
    "prompt": "Cinematic 8k portrait of cyber character in neon lighting, highly detailed",
    "aspectRatio": "16:9",
    "params": {
      "steps": 30,
      "cfgScale": 7.5
    }
  }'`;

  const pythonSnippet = `import requests

API_KEY = "YOUR_API_KEY"
BASE_URL = "https://one.supdance.com/api"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "model": "seedream-4.5",
    "prompt": "Cinematic 8k portrait of cyber character in neon lighting, highly detailed",
    "aspectRatio": "16:9",
    "params": {
        "steps": 30,
        "cfgScale": 7.5
    }
}

# 1. 提交生成任务
res = requests.post(f"{BASE_URL}/generations", json=payload, headers=headers)
data = res.json()
print("Task Created:", data)
task_id = data.get("data", {}).get("creationId")

# 2. 查询任务状态
status_res = requests.get(f"{BASE_URL}/tasks/{task_id}", headers=headers)
print("Status:", status_res.json())`;

  const tsSnippet = `import axios from 'axios';

const client = axios.create({
  baseURL: 'https://one.supdance.com/api',
  headers: {
    Authorization: \`Bearer \${process.env.SUPDANCE_API_KEY}\`,
    'Content-Type': 'application/json'
  }
});

async function generateVisual() {
  // 1. 提交异步生成
  const { data } = await client.post('/generations', {
    model: 'seedream-4.5',
    prompt: 'Cinematic 8k portrait of cyber character in neon lighting, highly detailed',
    aspectRatio: '16:9',
    params: { steps: 30, cfgScale: 7.5 }
  });

  const taskId = data.data?.creationId;
  console.log('Task submitted:', taskId);

  // 2. 轮询获取任务产物
  const result = await client.get(\`/tasks/\${taskId}\`);
  console.log('Result URL:', result.data.data?.outputUrl);
}

generateVisual();`;

  const currentSnippet =
    codeTab === 'curl' ? curlSnippet : codeTab === 'python' ? pythonSnippet : tsSnippet;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const studioHref = isChinese ? '/zh/studio' : '/studio';
  const modelsHref = isChinese ? '/zh/models' : '/models';
  const accountHref = isChinese ? '/account?action=settings' : '/account?action=settings';

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#07080c] font-sans text-white">
      <StudioHeader locale={locale} activeTab="call-api" className="relative z-40" />
      <SpatialBackground />

      <main className="relative z-10 mx-auto flex max-w-[1200px] flex-col px-4 pb-24 pt-12 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 font-mono text-xs text-white/40">
          <Link href={isChinese ? '/zh' : '/'} className="flex items-center gap-1.5 transition hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            {isChinese ? '返回首页' : 'Back home'}
          </Link>
          <span>/</span>
          <span className="text-white/80">{isChinese ? '开发者开放平台' : 'Developer API Platform'}</span>
        </div>

        {/* Hero Section */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {isChinese ? 'API v1.0 · 全球服务在线 (99.98% 可用率)' : 'API v1.0 · Live & Operational (99.98% SLA)'}
            </div>

            <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              {isChinese ? 'SupDance ONE 开发者开放平台' : 'SupDance ONE Developer API Platform'}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/60 sm:text-base">
              {isChinese
                ? '面向影视工业、短剧工坊与生成式 AI 应用的统一算力调度平台。通过标准化 RESTful 协议，快速接入 Seedance、Flux、Kling、Veo 等 200+ 顶尖 AI 影像模型及全套画布工具。'
                : 'Unified generative AI infrastructure for cinema, drama workshops, and enterprise creators. Programmatically access Seedance, Flux, Kling, Veo, and 200+ top-tier models with full canvas tools via clean REST APIs.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={accountHref}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-elevation-2 transition hover:opacity-95"
            >
              <Key className="h-4 w-4" />
              {isChinese ? '管理 API Key' : 'Manage API Keys'}
            </Link>
            <Link
              href={modelsHref}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 hover:border-white/20"
            >
              <Boxes className="h-4 w-4 text-brand" />
              {isChinese ? '查看模型费率' : 'Model Rates'}
            </Link>
            <Link
              href={studioHref}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 hover:border-white/20"
            >
              <Cpu className="h-4 w-4 text-emerald-400" />
              {isChinese ? 'Studio 在线测试' : 'Live Studio'}
            </Link>
          </div>
        </div>

        {/* API Authentication & Base URL */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#101216] p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Server className="h-4 w-4" />
              {isChinese ? 'Base URL 根地址' : 'Base Endpoint'}
            </div>
            <div className="mt-3 font-mono text-sm text-white/90 break-all select-all rounded-lg bg-black/50 p-2.5 border border-white/5">
              https://one.supdance.com/api
            </div>
            <p className="mt-2 text-xs text-white/40">
              {isChinese ? '支持 HTTPS / HTTP/2 协议，全球 CDN 智能就近路由。' : 'HTTPS and HTTP/2 supported worldwide with smart CDN edge routing.'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#101216] p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
              <Key className="h-4 w-4" />
              {isChinese ? '认证方式 (Authentication)' : 'Authentication'}
            </div>
            <div className="mt-3 font-mono text-sm text-white/90 break-all select-all rounded-lg bg-black/50 p-2.5 border border-white/5">
              Authorization: Bearer &lt;TOKEN&gt;
            </div>
            <p className="mt-2 text-xs text-white/40">
              {isChinese ? '亦支持在 Header 中附带 X-API-Key: <TOKEN>。' : 'Header X-API-Key: <TOKEN> is also accepted.'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#101216] p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
              <Zap className="h-4 w-4" />
              {isChinese ? '响应协议 (Response Format)' : 'Response Protocol'}
            </div>
            <div className="mt-3 font-mono text-sm text-white/90 break-all select-all rounded-lg bg-black/50 p-2.5 border border-white/5">
              {`{ "code": 0, "data": ..., "msg": "ok" }`}
            </div>
            <p className="mt-2 text-xs text-white/40">
              {isChinese ? '标准 JSON 信封封装，code === 0 为成功。' : 'Standard JSON envelope unwrap; code === 0 indicates success.'}
            </p>
          </div>
        </div>

        {/* Code Snippets Section */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-[#101216] shadow-elevation-3">
          <div className="flex flex-wrap items-center justify-between border-b border-white/10 px-4 py-3 bg-black/40">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-brand" />
              <span className="text-xs font-bold text-white/80">
                {isChinese ? '任务创建与状态轮询代码示例' : 'Quickstart Task Invocation'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-white/5 p-1 border border-white/5">
                <button
                  type="button"
                  onClick={() => setCodeTab('curl')}
                  className={`rounded px-3 py-1 text-xs font-semibold transition ${
                    codeTab === 'curl' ? 'bg-brand text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  cURL
                </button>
                <button
                  type="button"
                  onClick={() => setCodeTab('python')}
                  className={`rounded px-3 py-1 text-xs font-semibold transition ${
                    codeTab === 'python' ? 'bg-brand text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Python
                </button>
                <button
                  type="button"
                  onClick={() => setCodeTab('ts')}
                  className={`rounded px-3 py-1 text-xs font-semibold transition ${
                    codeTab === 'ts' ? 'bg-brand text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Node / TS
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? (isChinese ? '已复制' : 'Copied!') : (isChinese ? '复制代码' : 'Copy')}
              </button>
            </div>
          </div>

          <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-emerald-300/90 bg-[#090b0e]">
            <code>{currentSnippet}</code>
          </pre>
        </div>

        {/* REST API Endpoints Table */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-brand" />
              {isChinese ? '核心 REST API 开放接口列表' : 'Core REST API Endpoints'}
            </h2>
            <span className="text-xs text-white/40 font-mono">5 Endpoints Active</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101216]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-white/50 font-mono">
                  <th className="p-4 w-28">Method</th>
                  <th className="p-4 w-60">Endpoint</th>
                  <th className="p-4">描述说明</th>
                  <th className="p-4 w-32">算力费率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80 font-mono">
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4"><span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-400 font-bold">POST</span></td>
                  <td className="p-4 text-white font-bold">/api/generations</td>
                  <td className="p-4 text-white/60 font-sans">
                    {isChinese ? '提交文生图、图生图、文生视频、图生视频或音乐生成异步任务。返回 creationId 供轮询。' : 'Submit async text/image-to-image, video, or audio tasks. Returns creationId for polling.'}
                  </td>
                  <td className="p-4 text-amber-400 font-sans">按模型单价扣减</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4"><span className="rounded bg-blue-500/20 px-2 py-0.5 text-blue-400 font-bold">GET</span></td>
                  <td className="p-4 text-white font-bold">/api/tasks/:id</td>
                  <td className="p-4 text-white/60 font-sans">
                    {isChinese ? '轮询任务生成状态（queued / running / succeeded / failed），产物包含 CDN 高清直链。' : 'Poll generation task status and retrieve CDN signed output URLs.'}
                  </td>
                  <td className="p-4 text-emerald-400 font-sans">免费轮询</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4"><span className="rounded bg-blue-500/20 px-2 py-0.5 text-blue-400 font-bold">GET</span></td>
                  <td className="p-4 text-white font-bold">/api/models</td>
                  <td className="p-4 text-white/60 font-sans">
                    {isChinese ? '获取全平台已上架可用模型列表，包含支持的画幅比、参数区间及单张/单秒积分定价。' : 'Retrieve listed active models, supported aspect ratios, parameters and pricing.'}
                  </td>
                  <td className="p-4 text-emerald-400 font-sans">免费查询</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4"><span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-400 font-bold">POST</span></td>
                  <td className="p-4 text-white font-bold">/api/canvas-tools/plan</td>
                  <td className="p-4 text-white/60 font-sans">
                    {isChinese ? '执行画布 AI 算法处理：智能扩图 (outpaint)、2K/4K 智能超清 (upscale)、主体抠图 (cutout)、角色三视图与九宫格故事板。' : 'Execute Canvas AI tasks: outpaint, 2K/4K upscale, cutout, 3-view character, and storyboards.'}
                  </td>
                  <td className="p-4 text-amber-400 font-sans">按工具规格扣减</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="p-4"><span className="rounded bg-blue-500/20 px-2 py-0.5 text-blue-400 font-bold">GET</span></td>
                  <td className="p-4 text-white font-bold">/api/financial/currency/wallet</td>
                  <td className="p-4 text-white/60 font-sans">
                    {isChinese ? '获取当前账号可用算力额度、K 币余额及最近 50 条账单流水记录。' : 'Check available credits, wallet balance and recent billing transactions.'}
                  </td>
                  <td className="p-4 text-emerald-400 font-sans">免费查询</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Security & Token Management Guide */}
        <div className="mt-12 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-400" />
              {isChinese ? '如何创建和保管我的 API 密钥？' : 'How to create and secure your API Key'}
            </h3>
            <p className="text-xs text-white/60 leading-relaxed max-w-2xl">
              {isChinese
                ? '前往「账户与设置」->「API 密钥」，一键生成属于您的长效访问令牌。请勿在客户端明文硬编码密钥，推荐通过环境变量或后端网关代理转发。'
                : 'Visit "Account & Settings" -> "API Keys" to generate your personal secret token. Keep it safe and never expose keys in client-side bundles.'}
            </p>
          </div>
          <Link
            href={accountHref}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-elevation-2 hover:bg-brand-hover transition"
          >
            {isChinese ? '立即去获取 API Key' : 'Generate Key'}
            <ArrowRight className="h-4 w-4" />
          </Link>
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

export function AccountPage() {
  useDocumentTitle('账户与订阅 | SupDance AI Studio');
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  const action = sp.get('action') || 'activity';

  return (
    <div className="relative min-h-screen bg-canvas font-sans text-ink">
      <StudioHeader locale="zh" activeTab="account" className="relative z-40" />
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <AccountCenterView isModal={false} initialTabProp={action} />
      </main>
    </div>
  );
}
export const AccountRedirectPage = AccountPage;

export function PricingPage({ locale = 'en' }: { locale?: string }) {
  const isChinese = Boolean(locale?.includes('zh'));
  useDocumentTitle(
    isChinese ? '订阅与算力定价 — SupDance' : 'Pricing & Subscription Plans — SupDance'
  );
  return (
    <div className="relative min-h-screen bg-canvas font-sans text-ink">
      <StudioHeader locale={isChinese ? 'zh' : 'en'} activeTab="pricing" className="relative z-40" />
      <PricingClient />
    </div>
  );
}
export const PricingRedirectPage = PricingPage;

export function AssistantPage({ locale = 'en' }: { locale?: string }) {
  const isChinese = Boolean(locale?.includes('zh'));
  useDocumentTitle(isChinese ? 'AI 创作助手 — SupDance' : 'AI Assistant — SupDance');
  return <StandaloneShell locale={isChinese ? 'zh-CN' : 'en'} initialTab="agents" />;
}
export const AssistantRedirectPage = AssistantPage;

export function WorkflowIndexPage({ locale = 'en' }: { locale?: string }) {
  const isChinese = Boolean(locale?.includes('zh'));
  useDocumentTitle(isChinese ? 'AI 工作流工坊 — SupDance' : 'AI Workflows — SupDance');
  return <StandaloneShell locale={isChinese ? 'zh-CN' : 'en'} initialTab="workflows" />;
}
export const WorkflowIndexRedirectPage = WorkflowIndexPage;

export function AgentsIndexPage() {
  useDocumentTitle('AI 智能体广场 — SupDance');
  const locale = resolveEffectiveLocaleClient();
  return <StandaloneShell locale={locale} initialTab="agents" />;
}
export const AgentsIndexRedirectPage = AgentsIndexPage;

export function AgentsCreatePage() {
  useDocumentTitle('创建 AI 智能体 — SupDance');
  const locale = resolveEffectiveLocaleClient();
  return <StandaloneShell locale={locale} initialTab="agents" />;
}
export const AgentsCreateRedirectPage = AgentsCreatePage;

export function AgentDetailPage() {
  useDocumentTitle('AI 智能体详情 — SupDance');
  const locale = resolveEffectiveLocaleClient();
  return <StandaloneShell locale={locale} initialTab="agents" />;
}
export const AgentDetailRedirectPage = AgentDetailPage;

export function AgentConversationPage() {
  useDocumentTitle('AI 智能体对话 — SupDance');
  const locale = resolveEffectiveLocaleClient();
  return <StandaloneShell locale={locale} initialTab="agents" />;
}
export const AgentConversationRedirectPage = AgentConversationPage;

export function AgentEditPage() {
  useDocumentTitle('编辑 AI 智能体 — SupDance');
  const locale = resolveEffectiveLocaleClient();
  return <StandaloneShell locale={locale} initialTab="agents" />;
}
export const AgentEditRedirectPage = AgentEditPage;

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
