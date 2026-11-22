'use client';

import React from 'react';
import Link from 'next/link';
import {
  Shield,
  Zap,
  Cpu,
  Search,
  ArrowRight,
  ChevronRight,
  Boxes,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';
import StudioHeader from '@/components/site/StudioHeader';
import { SpatialBackground } from '@/components/spatial';
import FigmaBrandSlider from './FigmaBrandSlider';
import ModelScreenerTable from '@/components/models/ModelScreenerTable';
import ModelBrandLogo from '@/components/models/ModelBrandLogo';
import AboutFooter from './AboutFooter';
import { normalizeLocale, localizeStudioPath } from '@/lib/locales';

// 使用流程 4 步 (极简有力)
const HOW_IT_WORKS_STEPS = [
  {
    step: 'Step 1',
    icon: Search,
    title: {
      en: 'Model Discovery',
      'zh-CN': '全景选型',
      'zh-TW': '全景選型',
      'ja-JP': 'モデル選定',
      'ko-KR': '모델 선택',
      es: 'Descubrimiento de Modelos',
    },
    desc: {
      en: 'Compare listed models by actual usage, latency, and pricing.',
      'zh-CN': '按真实调用量、时延与价格对比已上架模型。',
      'zh-TW': '按真實調用量、時延與價格對比已上架模型。',
      'ja-JP': '掲載モデルを実際の利用量、遅延、料金で比較。',
      'ko-KR': '실제 사용량, 지연 시간 및 가격별로 모델을 비교합니다.',
      es: 'Compara modelos listados por uso real, latencia y precio.',
    },
  },
  {
    step: 'Step 2',
    icon: SlidersHorizontal,
    title: {
      en: 'Studio Tuning',
      'zh-CN': '创意微调',
      'zh-TW': '創意微調',
      'ja-JP': 'スタジオ微調整',
      'ko-KR': '스튜디오 튜닝',
      es: 'Ajuste en Estudio',
    },
    desc: {
      en: 'Adjust prompts, ratios, motion paths, and multimodal references.',
      'zh-CN': '在 Studio 控制台精细调校提示词、长宽比与运镜轨迹。',
      'zh-TW': '在 Studio 控制台精細調校提示詞、長寬比與運鏡軌跡。',
      'ja-JP': 'プロンプト、アスペクト比、カメラワーク、参照を細かく調整。',
      'ko-KR': '프롬프트, 가로세로 비율, 카메라 경로 및 다중 모달 참조를 세밀하게 조정합니다.',
      es: 'Ajusta prompts, proporciones, trayectorias de cámara y referencias.',
    },
  },
  {
    step: 'Step 3',
    icon: Zap,
    title: {
      en: 'Instant Inference',
      'zh-CN': '极速推理',
      'zh-TW': '極速推理',
      'ja-JP': '高速推論',
      'ko-KR': '초고속 추론',
      es: 'Inferencia Instantánea',
    },
    desc: {
      en: 'Run the selected model in the Studio with the parameters you choose.',
      'zh-CN': '在 Studio 中按所选参数发起生成任务。',
      'zh-TW': '在 Studio 中按所選參數發起生成任務。',
      'ja-JP': '選択したパラメータでスタジオ内から生成タスクを実行。',
      'ko-KR': '선택한 매개변수로 스튜디오에서 모델 생성을 실행합니다.',
      es: 'Ejecuta el modelo seleccionado en el Studio con tus parámetros.',
    },
  },
  {
    step: 'Step 4',
    icon: Boxes,
    title: {
      en: 'Pipeline Export',
      'zh-CN': '资产交付',
      'zh-TW': '資產交付',
      'ja-JP': 'パイプライン出力',
      'ko-KR': '파이프라인 내보내기',
      es: 'Exportación de Pipeline',
    },
    desc: {
      en: 'Download the generated media or continue iterating in the Studio.',
      'zh-CN': '下载生成结果，或继续在 Studio 中迭代。',
      'zh-TW': '下載生成結果，或繼續在 Studio 中迭代。',
      'ja-JP': '生成されたメディアをダウンロード、またはスタジオで制作を継続。',
      'ko-KR': '생성된 미디어를 다운로드하거나 스튜디오에서 계속 작업하세요.',
      es: 'Descarga el contenido generado o sigue iterando en el Studio.',
    },
  },
];

const ABOUT_COPY = {
  en: {
    heroTitle1: 'Frontier Multimodal Visual Models',
    heroTitle2: 'Enterprise Compute Scenarios & Panoramic Telemetry',
    heroDesc: 'Aggregating foundation models such as FLUX, Kling, Suno, and DeepSeek, with listed models and actual 24-hour usage data.',
    exploreScreener: 'Explore Screener',
    openStudio: 'Open Studio',
    listedModelsBadge: 'Listed Models · Actual Usage',
    viewModel: 'View model',
    actualUsageData: 'Actual Usage Data',
    screenerTitle: 'Foundation Model Screener',
    screenerDesc: 'Compare listed models by actual call volume, success rate, and average latency.',
    launchAllInStudio: 'Launch All in Studio',
    infraBadge: 'Multi-region infrastructure',
    usageBadge: 'Actual 24h usage',
    listedBadge: 'Listed model directory',
    missionTitle1: 'The Trusted Compute Foundation',
    missionTitle2: 'for Creators Worldwide.',
    missionDesc: 'Determinism and low latency are the bedrock of generative AI industrialization.',
    clarityTitle: 'Clarity',
    clarityDesc: 'Transparent compute pricing with zero hidden fees and clear records.',
    reliabilityTitle: 'Reliability',
    reliabilityDesc: 'Availability monitoring and fault isolation for production continuity.',
    ecosystemTitle: 'Ecosystem',
    ecosystemDesc: 'Unifying Studio canvases, visual workflows, and model access.',
    howItWorksTitle: 'How It Works',
    howItWorksDesc: 'Simple 4 steps to discover, tune, infer, and export.',
    guidesTitle: 'Research & Model Guides',
    guidesDesc: 'Structured model guides and practical articles are still being prepared. Join the community for model updates and product announcements.',
    visitCommunity: 'Visit community',
  },
  'zh-CN': {
    heroTitle1: '全球前沿多模态视觉大模型',
    heroTitle2: '应用场景算力场景与全景数据算力调度与全景遥测',
    heroDesc: '聚合 FLUX、可灵、Suno、DeepSeek 等基础模型，提供已上架模型清单与过去 24 小时的真实调用统计。',
    exploreScreener: '探索模型看板',
    openStudio: '进入 Studio 工作台',
    listedModelsBadge: '已上架模型 · 真实调用数据',
    viewModel: '查看模型',
    actualUsageData: '真实调用数据',
    screenerTitle: '模型总揽看板 (Model Screener)',
    screenerDesc: '按实际调用量、成功率与平均耗时对比已上架模型。',
    launchAllInStudio: '在 Studio 工作台中全部体验',
    infraBadge: '多区域基础设施',
    usageBadge: '24h 真实调用统计',
    listedBadge: '已上架模型目录',
    missionTitle1: '全球顶尖创作者的',
    missionTitle2: '高确定性算力基座',
    missionDesc: '确定性与低延迟是生成式 AI 工业化生产的核心基石。',
    clarityTitle: '清晰透明 (Clarity)',
    clarityDesc: '全链路算力消耗与费率透明可视，零隐形成本。',
    reliabilityTitle: '稳定可用 (Reliability)',
    reliabilityDesc: '以可用性监控与故障隔离保障生产连续性。',
    ecosystemTitle: '共荣生态 (Ecosystem)',
    ecosystemDesc: '联通 Studio 创意工坊、节点画布与多模型接入。',
    howItWorksTitle: '使用流程',
    howItWorksDesc: '简单四步开启前沿 AI 模型选型、创作与规模化集成。',
    guidesTitle: '模型研报与实战指南',
    guidesDesc: '系统化的模型指南与实战文章仍在整理中。欢迎先加入社区，获取模型更新与产品公告。',
    visitCommunity: '前往社区',
  },
  'zh-TW': {
    heroTitle1: '全球前沿多模態視覺大模型',
    heroTitle2: '應用場景算力場景與全景數據算力調度與全景遙測',
    heroDesc: '聚合 FLUX、可靈、Suno、DeepSeek 等基礎模型，提供已上架模型清單與過去 24 小時的真實調用統計。',
    exploreScreener: '探索模型看板',
    openStudio: '進入 Studio 工作台',
    listedModelsBadge: '已上架模型 · 真實調用數據',
    viewModel: '查看模型',
    actualUsageData: '真實調用數據',
    screenerTitle: '模型總攬看板 (Model Screener)',
    screenerDesc: '按實際調用量、成功率與平均耗時對比已上架模型。',
    launchAllInStudio: '在 Studio 工作台中全部體驗',
    infraBadge: '多區域基礎設施',
    usageBadge: '24h 真實調用統計',
    listedBadge: '已上架模型目錄',
    missionTitle1: '全球頂尖創作者的',
    missionTitle2: '高確定性算力基座',
    missionDesc: '確定性與低延遲是生成式 AI 工業化生產的核心基石。',
    clarityTitle: '清晰透明 (Clarity)',
    clarityDesc: '全鏈路算力消耗與費率透明可視，零隱形成本。',
    reliabilityTitle: '穩定可用 (Reliability)',
    reliabilityDesc: '以可用性監控與故障隔離保障生產連續性。',
    ecosystemTitle: '共榮生態 (Ecosystem)',
    ecosystemDesc: '聯通 Studio 創意工坊、節點畫布與多模型接入。',
    howItWorksTitle: '使用流程',
    howItWorksDesc: '簡單四步開啟前沿 AI 模型選型、創作與規模化集成。',
    guidesTitle: '模型研報與實戰指南',
    guidesDesc: '系統化的模型指南與實戰文章仍在整理中。歡迎先加入社區，獲取模型更新與產品公告。',
    visitCommunity: '前往社區',
  },
  'ja-JP': {
    heroTitle1: '世界のフロンティア・マルチモーダル視覚モデル',
    heroTitle2: 'エンタープライズ計算シナリオ＆パノラマ・テレメトリ',
    heroDesc: 'FLUX、Kling、Suno、DeepSeek などの基底モデルを集約し、掲載モデルと過去24時間の実際の利用統計を提供。',
    exploreScreener: 'モデル看板を見る',
    openStudio: 'Studio を開く',
    listedModelsBadge: '掲載モデル · 実際の呼出データ',
    viewModel: 'モデルを見る',
    actualUsageData: '実際の呼出データ',
    screenerTitle: 'モデル総覧看板 (Model Screener)',
    screenerDesc: '実際の呼出量、成功率、平均レイテンシで掲載モデルを比較。',
    launchAllInStudio: 'Studio で全モデルを試す',
    infraBadge: 'マルチリージョン基盤',
    usageBadge: '24h 呼出統計',
    listedBadge: '掲載モデル一覧',
    missionTitle1: '世界中のクリエイターのための',
    missionTitle2: '高信頼な計算基盤',
    missionDesc: '確実性と低遅延は、生成AIの工業化生産における中核基盤です。',
    clarityTitle: '明瞭・透明 (Clarity)',
    clarityDesc: 'すべての計算消費と料金が透明で、隠れた費用はありません。',
    reliabilityTitle: '高い信頼性 (Reliability)',
    reliabilityDesc: '可用性監視と障害分離により、安定した制作を保証。',
    ecosystemTitle: '共創エコシステム (Ecosystem)',
    ecosystemDesc: 'Studio ワークベンチ、ノードキャンバス、マルチモデル接続を統合。',
    howItWorksTitle: 'ご利用の流れ',
    howItWorksDesc: 'モデル選定、微調整、推論、書き出しの簡単4ステップ。',
    guidesTitle: 'モデル研究レポート＆実践ガイド',
    guidesDesc: '体系的なモデルガイドを準備中です。コミュニティに参加して最新情報を受け取ってください。',
    visitCommunity: 'コミュニティへ',
  },
  'ko-KR': {
    heroTitle1: '글로벌 프론티어 멀티모달 시각 대형 모델',
    heroTitle2: '엔터프라이즈 컴퓨팅 시나리오 & 파노라마 텔레메트리',
    heroDesc: 'FLUX, Kling, Suno, DeepSeek 등 기반 모델을 통합하여 등록된 모델 목록과 지난 24시간의 실제 사용 통계를 제공합니다.',
    exploreScreener: '모델 스크리너 탐색',
    openStudio: 'Studio 열기',
    listedModelsBadge: '등록 모델 · 실제 사용 통계',
    viewModel: '모델 보기',
    actualUsageData: '실제 사용 통계',
    screenerTitle: '파운데이션 모델 스크리너',
    screenerDesc: '실제 호출량, 성공률 및 평균 지연 시간별로 등록된 모델을 비교합니다.',
    launchAllInStudio: 'Studio에서 모두 체험하기',
    infraBadge: '멀티 리전 인프라',
    usageBadge: '24h 실제 호출 통계',
    listedBadge: '등록 모델 목록',
    missionTitle1: '전 세계 최고 크리에이터를 위한',
    missionTitle2: '신뢰할 수 있는 컴퓨팅 기반',
    missionDesc: '확정성과 낮은 지연 시간은 생성형 AI 산업화 생산의 핵심 기반입니다.',
    clarityTitle: '명확성과 투명성 (Clarity)',
    clarityDesc: '모든 컴퓨팅 비용과 요율이 투명하게 공개되며 숨겨진 비용이 없습니다.',
    reliabilityTitle: '높은 신뢰성 (Reliability)',
    reliabilityDesc: '가용성 모니터링과 장애 격리를 통해 안정적인 프로덕션을 보장합니다.',
    ecosystemTitle: '상생 생태계 (Ecosystem)',
    ecosystemDesc: 'Studio 캔버스, 비주얼 워크플로우 및 멀티 모델 액세스를 연결합니다.',
    howItWorksTitle: '이용 절차',
    howItWorksDesc: '모델 탐색, 튜닝, 추론, 내보내기의 간단한 4단계 워크플로우.',
    guidesTitle: '모델 연구 보고서 및 실전 가이드',
    guidesDesc: '체계적인 가이드를 정리 중입니다. 커뮤니티에 참여하여 업데이트를 확인하세요.',
    visitCommunity: '커뮤니티 바로가기',
  },
  es: {
    heroTitle1: 'Modelos Visuales Multimodales de Vanguardia',
    heroTitle2: 'Escenarios de Cómputo Empresarial y Telemetría Panorámica',
    heroDesc: 'Agregando modelos base como FLUX, Kling, Suno y DeepSeek, con catálogo de modelos y datos de uso real en 24 horas.',
    exploreScreener: 'Explorar Screener',
    openStudio: 'Abrir Studio',
    listedModelsBadge: 'Modelos Listados · Uso Real',
    viewModel: 'Ver modelo',
    actualUsageData: 'Datos de Uso Real',
    screenerTitle: 'Screener de Modelos Fundacionales',
    screenerDesc: 'Compara modelos listados por volumen real de llamadas, tasa de éxito y latencia promedio.',
    launchAllInStudio: 'Probar Todos en Studio',
    infraBadge: 'Infraestructura multirregión',
    usageBadge: 'Uso real en 24h',
    listedBadge: 'Directorio de modelos',
    missionTitle1: 'La Base de Cómputo Confiable',
    missionTitle2: 'para Creadores de Todo el Mundo.',
    missionDesc: 'El determinismo y la baja latencia son los pilares de la industrialización de la IA generativa.',
    clarityTitle: 'Claridad (Clarity)',
    clarityDesc: 'Precios de cómputo transparentes sin cargos ocultos y registros claros.',
    reliabilityTitle: 'Confiabilidad (Reliability)',
    reliabilityDesc: 'Monitoreo de disponibilidad y aislamiento de fallas para la continuidad del trabajo.',
    ecosystemTitle: 'Ecosistema (Ecosystem)',
    ecosystemDesc: 'Unificación de lienzos de Studio, flujos de trabajo visuales y acceso multimodelo.',
    howItWorksTitle: 'Cómo Funciona',
    howItWorksDesc: 'Cuatro sencillos pasos para descubrir, ajustar, inferir y exportar.',
    guidesTitle: 'Guías de Modelos e Investigación',
    guidesDesc: 'Guías estructuradas en preparación. Únete a la comunidad para anuncios y actualizaciones.',
    visitCommunity: 'Visitar comunidad',
  },
};

export default function AboutPageClient({ locale = 'en' }) {
  const normLocale = normalizeLocale(locale);
  const isChinese = Boolean(normLocale?.startsWith('zh'));
  const t = ABOUT_COPY[normLocale] || ABOUT_COPY.en;
  const studioHref = localizeStudioPath('/studio', locale);

  return (
    <div className="min-h-screen bg-[#07080c] text-white selection:bg-[#3772FF]/40 selection:text-white relative overflow-x-hidden font-sans">
      {/* ========================================================= */}
      {/* MODULE 01: 全站统一固定顶栏导航                            */}
      {/* ========================================================= */}
      <StudioHeader locale={locale} activeTab="about" className="relative z-40" />

      {/* 核心 AI 空间光影与极光物理仿真系统 (与主页一致的 7 层全域流体光场 + 点阵 Canvas，指针安全) */}
      <SpatialBackground />

      <main className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pt-4 pb-20">
        {/* ========================================================= */}
        {/* 头部专属：顶级模型品牌滑块 (FigmaBrandSlider)                */}
        {/* ========================================================= */}
        <section className="pt-2 pb-6">
          <FigmaBrandSlider locale={locale} />
        </section>

        {/* ========================================================= */}
        {/* MODULE 02: HERO STAGE (全球前沿多模态大模型实时算力中心)    */}
        {/* ========================================================= */}
        <section className="pt-8 pb-16 sm:pt-12 sm:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* 左侧文本与行动 */}
            <div className="lg:col-span-7 flex flex-col items-start text-left">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.2] mb-5">
                <span className="block text-white">
                  {t.heroTitle1}
                </span>
                <span className="block mt-2 text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-[#00f5d4] via-white to-white/80 bg-clip-text text-transparent leading-[1.3]">
                  {t.heroTitle2}
                </span>
              </h1>

              {/* 极简副标 (无废话，直奔主题) */}
              <p className="text-sm sm:text-base text-white/75 max-w-lg leading-relaxed mb-8">
                {t.heroDesc}
              </p>

              {/* 胶囊按钮群 */}
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="#models"
                  className="px-8 py-3.5 rounded-full bg-[#3772FF] hover:bg-[#2e62de] text-white text-sm font-semibold tracking-wide transition-all duration-300 shadow-[0_4px_20px_rgba(55,114,255,0.4)] hover:shadow-[0_8px_30px_rgba(55,114,255,0.6)] hover:-translate-y-0.5 flex items-center gap-2 group cursor-pointer"
                >
                  <span>{t.exploreScreener}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>

                <Link
                  href={studioHref}
                  className="px-6 py-3.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white text-sm font-semibold tracking-wide transition-all duration-300 border border-white/10 hover:border-white/20 hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer shadow-elevation-1"
                >
                  <Zap className="w-4 h-4 text-[#00f5d4]" />
                  <span>{t.openStudio}</span>
                </Link>
              </div>
            </div>

            {/* 右侧：3D 暗黑立体几何展台与动态漂浮官方品牌胶囊 */}
            <div className="lg:col-span-5 relative flex items-center justify-center min-h-[360px] sm:min-h-[420px]">
              <div className="relative w-full max-w-[420px] aspect-square flex items-center justify-center">
                {/* 环状发光底盘 */}
                <div className="absolute inset-4 rounded-full border border-white/10 bg-gradient-to-b from-white/5 to-transparent [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_70%)] animate-pulse" />
                <div className="absolute w-72 h-72 rounded-full bg-[#3772FF]/15 blur-3xl animate-glow-pulse" />
                <div className="absolute -bottom-4 w-60 h-20 bg-[#00f5d4]/10 blur-2xl rounded-full" />

                {/* 核心 3D 浮雕柱展台 */}
                <div className="relative z-10 w-56 h-56 rounded-3xl bg-gradient-to-tr from-[#12141a] via-[#1a1d26] to-[#252936] border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2)] flex flex-col items-center justify-center p-6 text-center transform -rotate-2 hover:rotate-0 transition-transform duration-500 group">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#3772FF] to-[#00f5d4] p-[1.5px] mb-4 shadow-[0_0_30px_rgba(55,114,255,0.5)] group-hover:scale-105 transition-transform">
                    <div className="w-full h-full rounded-[14px] bg-[#0c0d12] flex items-center justify-center">
                      <Cpu className="w-8 h-8 text-[#00f5d4]" />
                    </div>
                  </div>
                  <div className="text-xl font-black text-white tracking-tight">SUPDANCE MODEL HUB</div>
                  <div className="text-[11px] font-mono text-emerald-400 mt-1 flex items-center gap-1.5 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{t.listedModelsBadge}</span>
                  </div>
                </div>

                {/* 漂浮品牌胶囊 1: FLUX.1 [dev] (带官方 BFL 标识与平滑悬浮动效) */}
                <Link
                  href={localizeStudioPath('/models/flux-dev', locale)}
                  className="absolute -top-2 left-2 z-20 px-3.5 py-1.5 rounded-full bg-[#161920]/95 backdrop-blur-md border border-white/15 shadow-2xl flex items-center gap-2.5 animate-subtle-float hover:scale-105 transition-transform cursor-pointer"
                >
                  <ModelBrandLogo providerId="bfl" size="sm" showRing={false} />
                  <span className="text-xs font-bold text-white">FLUX.1 [dev]</span>
                  <span className="text-xs font-mono text-emerald-400 font-semibold">
                    {t.viewModel}
                  </span>
                </Link>

                {/* 漂浮品牌胶囊 2: Kling 2.6 Pro (带快手官方标识) */}
                <Link
                  href={localizeStudioPath('/models/kling-v2.6-pro-t2v', locale)}
                  className="absolute bottom-4 -right-2 z-20 px-3.5 py-1.5 rounded-full bg-[#161920]/95 backdrop-blur-md border border-white/15 shadow-2xl flex items-center gap-2.5 animate-subtle-float-reverse hover:scale-105 transition-transform cursor-pointer"
                >
                  <ModelBrandLogo providerId="kuaishou" size="sm" showRing={false} />
                  <span className="text-xs font-bold text-white">Kling 2.6 Pro</span>
                  <span className="text-xs font-mono text-emerald-400 font-semibold">
                    {t.viewModel}
                  </span>
                </Link>

                {/* 漂浮品牌胶囊 3: Suno V3.5 (带 Suno 官方标识) */}
                <Link
                  href={localizeStudioPath('/models/suno-create-music', locale)}
                  className="absolute top-24 -right-4 z-20 px-3 py-1.5 rounded-full bg-[#161920]/95 backdrop-blur-md border border-white/15 shadow-2xl flex items-center gap-2.5 animate-subtle-float hover:scale-105 transition-transform cursor-pointer"
                >
                  <ModelBrandLogo providerId="suno" size="sm" showRing={false} />
                  <span className="text-xs font-bold text-white">Suno V3.5</span>
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                    {t.viewModel}
                  </span>
                </Link>
              </div>
            </div>
          </div>

        </section>

        {/* ========================================================= */}
        {/* MODULE 05: 模型总揽看板 (MODEL SCREENER SECTION)           */}
        {/* ========================================================= */}
        <section id="models" className="py-20 border-t border-white/[0.06] relative scroll-mt-20">
          <span id="market-update" className="sr-only" />

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-mono text-[#00f5d4] mb-2.5">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{t.actualUsageData || (isChinese ? '真实调用数据' : 'Actual Usage Data')}</span>
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">
                {t.screenerTitle}
              </h2>
              <p className="text-xs sm:text-sm text-white/60 mt-1">
                {t.screenerDesc}
              </p>
            </div>

            <Link
              href={studioHref}
              className="text-xs sm:text-sm text-[#3772FF] hover:text-white transition-colors flex items-center gap-1 group font-semibold cursor-pointer"
            >
              <span>{t.launchAllInStudio}</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* 核心 TradingView 风格高保真模型遥测表格 */}
          <ModelScreenerTable locale={locale} />
        </section>

        {/* ========================================================= */}
        {/* MODULE 06: PLATFORM METRICS & TRUST (公信力与统计数据)      */}
        {/* ========================================================= */}
        <section id="trust" className="py-20 border-t border-white/[0.06]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* 左侧：3 环同心圆数据罗盘 (动态旋转与发光) */}
            <div className="lg:col-span-6 bg-[#12141a] border border-white/10 rounded-2xl p-8 relative overflow-hidden flex flex-col items-center justify-center min-h-[420px] shadow-elevation-2">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,245,212,0.05),transparent_70%)]" />

              <div className="relative w-72 h-72 flex items-center justify-center">
                {/* 外环 (青绿旋转) */}
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#00f5d4]/40 animate-[spin_50s_linear_infinite]" />
                {/* 中环 (宝蓝逆转) */}
                <div className="absolute inset-6 rounded-full border-2 border-dashed border-[#3772FF]/40 animate-[spin_35s_linear_infinite_reverse]" />
                {/* 内环 (洋红稳态) */}
                <div className="absolute inset-12 rounded-full border-2 border-[#e11d74]/50" />

                {/* 中心核心 */}
                <div className="w-24 h-24 rounded-full bg-[#181a22] border border-white/20 shadow-2xl flex flex-col items-center justify-center p-2 z-10 text-center animate-subtle-float">
                  <Shield className="w-6 h-6 text-[#00f5d4] mb-0.5" />
                  <span className="text-[10px] font-black text-white uppercase tracking-wider font-mono">TRUST</span>
                </div>

                {/* 外环浮雕数据标签 */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#161820] border border-[#00f5d4]/40 text-[11px] font-bold text-[#00f5d4] shadow-lg whitespace-nowrap font-mono">
                  {t.infraBadge}
                </div>

                {/* 中环浮雕数据标签 */}
                <div className="absolute bottom-4 -left-4 px-3 py-1 rounded-full bg-[#161820] border border-[#3772FF]/40 text-[11px] font-bold text-[#3772FF] shadow-lg whitespace-nowrap font-mono">
                  {t.usageBadge}
                </div>

                {/* 内环浮雕数据标签 */}
                <div className="absolute bottom-4 -right-4 px-3 py-1 rounded-full bg-[#161820] border border-[#e11d74]/40 text-[11px] font-bold text-[#e11d74] shadow-lg whitespace-nowrap font-mono">
                  {t.listedBadge}
                </div>
              </div>
            </div>

            {/* 右侧：三大生产力信条 (极简有力) */}
            <div className="lg:col-span-6 flex flex-col justify-center">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-3">
                {t.missionTitle1}
                <br />
                {t.missionTitle2}
              </h2>

              <p className="text-sm text-white/70 leading-relaxed mb-8 max-w-lg">
                {t.missionDesc}
              </p>

              <div className="space-y-5">
                {/* 1. Clarity */}
                <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#3772FF]/20 border border-[#3772FF]/40 text-[#3772FF] flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      {t.clarityTitle}
                    </h4>
                    <p className="text-xs sm:text-sm text-white/60 leading-relaxed mt-0.5">
                      {t.clarityDesc}
                    </p>
                  </div>
                </div>

                {/* 2. Confidence */}
                <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#00f5d4]/20 border border-[#00f5d4]/40 text-[#00f5d4] flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      {t.reliabilityTitle}
                    </h4>
                    <p className="text-xs sm:text-sm text-white/60 leading-relaxed mt-0.5">
                      {t.reliabilityDesc}
                    </p>
                  </div>
                </div>

                {/* 3. Community */}
                <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#e11d74]/20 border border-[#e11d74]/40 text-[#e11d74] flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      {t.ecosystemTitle}
                    </h4>
                    <p className="text-xs sm:text-sm text-white/60 leading-relaxed mt-0.5">
                      {t.ecosystemDesc}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* MODULE 07: HOW IT WORK (使用流程与新手引导)                */}
        {/* ========================================================= */}
        <section id="workflow" className="py-20 border-t border-white/[0.06] text-center relative scroll-mt-20">
          <span id="how-it-work" className="sr-only" />
          <div className="max-w-xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
              {t.howItWorksTitle}
            </h2>
            <p className="text-xs sm:text-sm text-white/70">
              {t.howItWorksDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            {HOW_IT_WORKS_STEPS.map((step, idx) => {
              const IconComp = step.icon;
              return (
                <div
                  key={step.step}
                  className="group bg-[#12141a] border border-white/10 hover:border-white/30 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-elevation-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-xs font-mono font-bold text-[#3772FF]">
                        {step.step}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80 group-hover:scale-110 group-hover:border-[#00f5d4]/40 transition-all duration-300">
                        <IconComp className="w-5 h-5 text-[#00f5d4]" />
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-white mb-1.5 group-hover:text-[#00f5d4] transition-colors">
                      {step.title[normLocale] || step.title.en}
                    </h3>
                    <p className="text-xs text-white/60 leading-relaxed">
                      {step.desc[normLocale] || step.desc.en}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/[0.04] text-[11px] text-white/30 font-mono">
                    PHASE 0{idx + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================= */}
        {/* MODULE 08: COMMUNITY & RESEARCH CTA                       */}
        {/* ========================================================= */}
        <section id="learn-and-earn" className="py-20 border-t border-white/[0.06]">
          <div className="rounded-3xl border border-white/10 bg-[#12141a] p-8 text-center sm:p-12">
            <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {t.guidesTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-white/60 sm:text-sm">
              {t.guidesDesc}
            </p>
            <Link
              href={localizeStudioPath('/community', locale)}
              className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[#3772FF] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#2e62de]"
            >
              {t.visitCommunity}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

      </main>

      {/* ========================================================= */}
      {/* MODULE 09: 高端品牌与核心模型全矩阵页脚 (AboutFooter)       */}
      {/* ========================================================= */}
      <AboutFooter locale={locale} />
    </div>
  );
}
