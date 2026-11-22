'use client';

import React from 'react';
import Link from 'next/link';
import {
  Zap,
  ArrowRight,
  Activity,
  Cpu,
  Layers,
  ChevronRight,
  BarChart3,
  Mail,
  Sparkles,
} from 'lucide-react';
import ModelBrandLogo from '@/components/models/ModelBrandLogo';
import BrandLogo from '@/components/site/BrandLogo';
import {
  XIcon,
  YouTubeIcon,
  InstagramVectorIcon,
  XiaohongshuIcon,
  QQVectorIcon,
} from '@/components/SocialIcons';
import { useBranding } from '@/lib/hooks/useBranding';
import { normalizeLocale, localizeStudioPath } from '@/lib/locales';

// 官方社交媒体与社区矩阵定义 (Official Brand Social & Community Links)
const OFFICIAL_SOCIAL_LINKS = [
  {
    id: 'x',
    name: 'X (Twitter)',
    handle: '@supdance_ai',
    href: 'https://x.com/supdance_ai',
    icon: XIcon,
    hoverBorder: 'hover:border-white/40',
    hoverBg: 'hover:bg-white/10',
    hoverText: 'group-hover/social:text-white',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    handle: 'SupDance AI',
    href: 'https://www.youtube.com/channel/UCOoro6d-vr6M-1UIpP5POew',
    icon: YouTubeIcon,
    hoverBorder: 'hover:border-red-500/40',
    hoverBg: 'hover:bg-red-500/10',
    hoverText: 'group-hover/social:text-[#FF0000]',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    handle: '@supdance_com',
    href: 'https://www.instagram.com/supdance_com/',
    icon: InstagramVectorIcon,
    hoverBorder: 'hover:border-pink-500/40',
    hoverBg: 'hover:bg-pink-500/10',
    hoverText: 'group-hover/social:text-[#E4405F]',
  },
  {
    id: 'xiaohongshu',
    name: '小红书 (RED)',
    handle: 'SupDance',
    href: 'https://www.xiaohongshu.com/search_result?keyword=SupDance',
    icon: XiaohongshuIcon,
    hoverBorder: 'hover:border-rose-500/40',
    hoverBg: 'hover:bg-rose-500/10',
    hoverText: 'group-hover/social:text-[#FF2442]',
  },
  {
    id: 'qq',
    name: 'QQ 交流群',
    handle: 'SupDance 官方群',
    href: 'https://qm.qq.com/q/e8alJlLDuE',
    icon: QQVectorIcon,
    hoverBorder: 'hover:border-sky-400/40',
    hoverBg: 'hover:bg-sky-400/10',
    hoverText: 'group-hover/social:text-[#12B7F5]',
  },
];

// 核心大模型矩阵导航定义 (按模态分类，涵盖官方品牌 ID 与直达路由，支持 6 种语言)
const FOOTER_MODEL_GROUPS = [
  {
    id: 'image',
    title: {
      en: 'Text-to-Image Models',
      'zh-CN': '图像生成 · 视觉大模型',
      'zh-TW': '圖像生成 · 視覺大模型',
      'ja-JP': '画像生成 · ビジュアルモデル',
      'ko-KR': '이미지 생성 · 비주얼 모델',
      es: 'Modelos de Texto a Imagen',
    },
    icon: Layers,
    accentColor: '#00f5d4',
    models: [
      {
        id: 'flux-dev',
        name: 'FLUX.1 [dev]',
        providerId: 'bfl',
        provider: 'Black Forest Labs',
        tag: {
          en: '12B · 4K Typography',
          'zh-CN': '12B · 4K 排印',
          'zh-TW': '12B · 4K 排版',
          'ja-JP': '12B · 4K タイポグラフィ',
          'ko-KR': '12B · 4K 타이포그래피',
          es: '12B · Tipografía 4K',
        },
      },
      {
        id: 'seedream-5.0',
        name: 'Seedream 5.0',
        providerId: 'bytedance',
        provider: 'ByteDance',
        tag: {
          en: 'Ultra HD Cinema',
          'zh-CN': '电影超清',
          'zh-TW': '電影超清',
          'ja-JP': '映画級超高精細',
          'ko-KR': '시네마틱 초고화질',
          es: 'Cine Ultra HD',
        },
      },
      {
        id: 'wan2.1-text-to-image',
        name: 'Wan 2.1 (通义万相)',
        providerId: 'alibaba',
        provider: 'Alibaba',
        tag: {
          en: 'Realistic Fluid',
          'zh-CN': '真实流体',
          'zh-TW': '真實流體',
          'ja-JP': 'リアル流体',
          'ko-KR': '실제 유체',
          es: 'Fluidos Reales',
        },
      },
      {
        id: 'midjourney-v7',
        name: 'Midjourney V7',
        providerId: 'midjourney',
        provider: 'Midjourney',
        tag: {
          en: 'Concept Aesthetics',
          'zh-CN': '概念美学',
          'zh-TW': '概念美學',
          'ja-JP': 'コンセプト美学',
          'ko-KR': '컨셉 미학',
          es: 'Estética Conceptual',
        },
      },
      {
        id: 'gpt-image-2.5-flash',
        name: 'GPT-Image 2.5 Flash',
        providerId: 'openai',
        provider: 'OpenAI',
        tag: {
          en: 'Sub-second Speed',
          'zh-CN': '毫秒极速',
          'zh-TW': '毫秒極速',
          'ja-JP': 'ミリ秒超高速',
          'ko-KR': '밀리초 초고속',
          es: 'Velocidad Milisegundo',
        },
      },
    ],
  },
  {
    id: 'video',
    title: {
      en: 'Text-to-Video Models',
      'zh-CN': '视频生成 · 运镜大模型',
      'zh-TW': '視頻生成 · 運鏡大模型',
      'ja-JP': '動画生成 · カメラワークモデル',
      'ko-KR': '비디오 생성 · 카메라 무빙 모델',
      es: 'Modelos de Texto a Video',
    },
    icon: Activity,
    accentColor: '#e11d74',
    models: [
      {
        id: 'kling-v2.6-pro-t2v',
        name: 'Kling 2.6 Pro (可灵)',
        providerId: 'kuaishou',
        provider: 'Kuaishou',
        tag: {
          en: '60 FPS Motion',
          'zh-CN': '60 FPS 运镜',
          'zh-TW': '60 FPS 運鏡',
          'ja-JP': '60 FPS カメラワーク',
          'ko-KR': '60 FPS 카메라 무빙',
          es: '60 FPS Cámara',
        },
      },
      {
        id: 'minimax-hailuo-2.3-standard-t2v',
        name: 'Hailuo 2.3 (海螺视频)',
        providerId: 'minimax',
        provider: 'MiniMax',
        tag: {
          en: 'Continuous Shot',
          'zh-CN': '长镜头连贯',
          'zh-TW': '長鏡頭連貫',
          'ja-JP': '長回し一貫性',
          'ko-KR': '원테이크 일관성',
          es: 'Plano Continuo',
        },
      },
      {
        id: 'veo3-text-to-video',
        name: 'Google Veo 3',
        providerId: 'google',
        provider: 'Google DeepMind',
        tag: {
          en: 'Physical Lighting',
          'zh-CN': '物理光影',
          'zh-TW': '物理光影',
          'ja-JP': '物理ライティング',
          'ko-KR': '물리적 광원',
          es: 'Iluminación Física',
        },
      },
      {
        id: 'wan2.1-t2v',
        name: 'Wan 2.1 Video',
        providerId: 'alibaba',
        provider: 'Alibaba',
        tag: {
          en: '14B Backbone',
          'zh-CN': '14B 骨干网',
          'zh-TW': '14B 骨幹網',
          'ja-JP': '14B バックボーン',
          'ko-KR': '14B 백본',
          es: 'Backbone 14B',
        },
      },
      {
        id: 'runway-gen3',
        name: 'Runway Gen-3 Alpha',
        providerId: 'runway',
        provider: 'Runway',
        tag: {
          en: 'Cinema Industry Grade',
          'zh-CN': '电影工业级',
          'zh-TW': '電影工業級',
          'ja-JP': '映画産業グレード',
          'ko-KR': '영화 산업용 등급',
          es: 'Grado Cine Industrial',
        },
      },
    ],
  },
  {
    id: 'audio',
    title: {
      en: 'Audio & Music Models',
      'zh-CN': '音频音乐 · 声音大模型',
      'zh-TW': '音頻音樂 · 聲音大模型',
      'ja-JP': '音声・音楽モデル',
      'ko-KR': '오디오 및 음악 모델',
      es: 'Modelos de Audio y Música',
    },
    icon: Sparkles,
    accentColor: '#3772FF',
    models: [
      {
        id: 'suno-create-music',
        name: 'Suno V3.5 Music',
        providerId: 'suno',
        provider: 'Suno AI',
        tag: {
          en: 'Full Track & Vocals',
          'zh-CN': '全轨编曲人声',
          'zh-TW': '全軌編曲人聲',
          'ja-JP': 'フルパート・ボーカル',
          'ko-KR': '풀 트랙 편곡 및 보컬',
          es: 'Pistas y Voces',
        },
      },
      {
        id: 'minimax-music-3.0',
        name: 'MiniMax Music 3.0',
        providerId: 'minimax',
        provider: 'MiniMax',
        tag: {
          en: 'Hi-Fi Instruments',
          'zh-CN': '高保真乐器',
          'zh-TW': '高保真樂器',
          'ja-JP': '高忠実度楽器',
          'ko-KR': '고음질 악기',
          es: 'Instrumentos Hi-Fi',
        },
      },
      {
        id: 'minimax-speech-2.6-hd',
        name: 'MiniMax Speech 2.6 HD',
        providerId: 'minimax',
        provider: 'MiniMax',
        tag: {
          en: 'Expressive TTS',
          'zh-CN': '情感语音合成',
          'zh-TW': '情感語音合成',
          'ja-JP': '感情表現TTS',
          'ko-KR': '감정 음성 합성',
          es: 'Síntesis Emocional',
        },
      },
      {
        id: 'elevenlabs-turbo-v2',
        name: 'ElevenLabs Turbo v2',
        providerId: 'elevenlabs',
        provider: 'ElevenLabs',
        tag: {
          en: 'AI Voiceover',
          'zh-CN': 'AI 配音',
          'zh-TW': 'AI 配音',
          'ja-JP': 'AI 音声吹替',
          'ko-KR': 'AI 더빙',
          es: 'Doblaje IA',
        },
      },
    ],
  },
  {
    id: 'llm',
    title: {
      en: 'LLM & Reasoning',
      'zh-CN': '大语言 · 逻辑推理模型',
      'zh-TW': '大語言 · 邏輯推理模型',
      'ja-JP': '大規模言語 · 推論モデル',
      'ko-KR': '대규모 언어 · 논리 추론 모델',
      es: 'LLM y Razonamiento',
    },
    icon: Cpu,
    accentColor: '#fbbf24',
    models: [
      {
        id: 'deepseek-v3',
        name: 'DeepSeek-V3 671B',
        providerId: 'deepseek',
        provider: 'DeepSeek',
        tag: {
          en: 'SOTA Reasoning',
          'zh-CN': 'SOTA 推理',
          'zh-TW': 'SOTA 推理',
          'ja-JP': 'SOTA 推論',
          'ko-KR': 'SOTA 추론',
          es: 'Razonamiento SOTA',
        },
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o Omni',
        providerId: 'openai',
        provider: 'OpenAI',
        tag: {
          en: 'Omni Central Hub',
          'zh-CN': '全模态中枢',
          'zh-TW': '全模態中樞',
          'ja-JP': '全モーダルハブ',
          'ko-KR': '옴니 멀티모달 허브',
          es: 'Centro Omnimodal',
        },
      },
      {
        id: 'claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        providerId: 'anthropic',
        provider: 'Anthropic',
        tag: {
          en: 'Code & Arch Flagship',
          'zh-CN': '代码架构旗舰',
          'zh-TW': '代碼架構旗艦',
          'ja-JP': 'コード・アーキテクチャ旗艦',
          'ko-KR': '코드·아키텍처 플래그십',
          es: 'Buque Insignia Código',
        },
      },
      {
        id: 'qwen-2.5-max',
        name: 'Qwen 2.5 Max (千问)',
        providerId: 'alibaba',
        provider: 'Alibaba',
        tag: {
          en: 'Complex Long Context',
          'zh-CN': '复杂长文本',
          'zh-TW': '複雜長文本',
          'ja-JP': '複雑長文コンテキスト',
          'ko-KR': '복잡한 긴 문맥',
          es: 'Contexto Extenso',
        },
      },
    ],
  },
];

const FOOTER_COPY = {
  en: {
    modelDirectoryAvailable: 'Model directory available',
    actualUsage24h: 'Actual usage · 24h',
    heroBannerTitle: 'Foundation Models & Creative Workspace',
    heroBannerDesc: 'Deterministic multi-model routing, sub-second failover, and high-performance telemetry for next-generation creative pipelines.',
    launchStudio: 'Launch Studio Workspace',
    viewModelDirectory: 'View Model Directory',
    coreDirectoryHeading: 'CORE FOUNDATION MODEL DIRECTORY',
    allModelProfiles: 'All Model Profiles',
    brandSloganDefault: 'Generative AI Workspace',
    brandVision: 'A generative AI workspace and model access layer for creators, independent studios, and teams.',
    colWorkspaces: 'WORKSPACES',
    linkImageStudio: 'Image Studio',
    linkVideoCinema: 'Video Cinema',
    linkAudioMusic: 'Audio & Music',
    linkWorkflow: 'Workflow Canvas',
    linkPricing: 'Pricing & Plans',
    colDeveloper: 'DEVELOPER & API',
    linkApiPlatform: 'API Platform (Coming Soon)',
    linkModelDirectory: 'Model Directory',
    linkCommunity: 'Community Gallery',
    linkCreatorBenefits: 'Creator Benefits',
    colNewsletter: 'NEWSLETTER & UPDATES',
    officialChannels: 'Official Social & Communities',
    newsletterDesc: (brand) => `Subscribe to receive ${brand} foundation model updates and technical release notes.`,
    newsletterComingSoon: 'Email newsletter coming soon',
    newsletterComingSoonDesc: 'Email subscriptions are not available yet. Join the community for model and product updates.',
    visitCommunity: 'Visit community',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    refundPolicy: 'Refund Policy',
    contentPolicy: 'Content Policy',
    allRightsReserved: 'All Rights Reserved.',
    icpNumber: '备案编号：沪ICP备2026050086号',
    operatingSystem: 'Next-Gen Creative AI Operating System',
    canvasCore: 'High-Precision Canvas Core',
    modelGateway: 'Model Gateway',
  },
  'zh-CN': {
    modelDirectoryAvailable: '模型目录已开放',
    actualUsage24h: '真实调用统计 · 24h',
    heroBannerTitle: '面向全球创作者与影视团队的 AI 模型与创作工作台',
    heroBannerDesc: '一站式无缝聚合 FLUX、可灵、Suno、DeepSeek 等核心旗舰模型。毫秒级自愈漂移与确定性交付，开启工业化生成时代。',
    launchStudio: '进入 Studio 创意工坊',
    viewModelDirectory: '查看模型目录',
    coreDirectoryHeading: '核心前沿模型全矩阵导航',
    allModelProfiles: '全部模型专题档案',
    brandSloganDefault: 'AI 创意工作室',
    brandVision: '面向创作者、独立工作室与团队的专业生成式 AI 创作工作台与模型接入层，支持模型发现、生成与工作流协作。',
    colWorkspaces: '创意工作台',
    linkImageStudio: '图像生图工坊',
    linkVideoCinema: '视频运镜导演台',
    linkAudioMusic: '音频音乐工作台',
    linkWorkflow: '节点式工作流',
    linkPricing: '会员订阅方案',
    colDeveloper: '开发者与遥测',
    linkApiPlatform: '开放平台（筹备中）',
    linkModelDirectory: '模型目录与真实调用',
    linkCommunity: '创作者案例广场',
    linkCreatorBenefits: '创作者算力权益',
    colNewsletter: '模型技术周刊与通知',
    officialChannels: '官方社交媒体与社区',
    newsletterDesc: (brand) => `订阅 ${brand} 技术周报，第一时间获取模型与产品更新公告。`,
    newsletterComingSoon: '邮件订阅即将开放',
    newsletterComingSoonDesc: '目前还没有可用的邮件订阅服务。欢迎先加入社区获取模型与产品更新。',
    visitCommunity: '前往社区',
    privacyPolicy: '隐私政策',
    termsOfService: '服务条款',
    refundPolicy: '退款准则',
    contentPolicy: '内容安全',
    allRightsReserved: '保留所有权利。',
    icpNumber: '备案编号：沪ICP备2026050086号',
    operatingSystem: '新一代生成式 AI 创意工作系统',
    canvasCore: '高精创作画布内核',
    modelGateway: '模型网关中枢',
  },
  'zh-TW': {
    modelDirectoryAvailable: '模型目錄已開放',
    actualUsage24h: '真實調用統計 · 24h',
    heroBannerTitle: '面向全球創作者與影視團隊的 AI 模型與創作工作台',
    heroBannerDesc: '一站式無縫聚合 FLUX、可靈、Suno、DeepSeek 等核心旗艦模型。毫秒級自愈漂移與確定性交付，開啟工業化生成時代。',
    launchStudio: '進入 Studio 創意工坊',
    viewModelDirectory: '查看模型目錄',
    coreDirectoryHeading: '核心前沿模型全矩陣導航',
    allModelProfiles: '全部模型專題檔案',
    brandSloganDefault: 'AI 創意工作室',
    brandVision: '面向創作者、獨立工作室與團隊的專業生成式 AI 創作工作台與模型接入層，支持模型發現、生成與工作流協作。',
    colWorkspaces: '創意工作台',
    linkImageStudio: '圖像生圖工坊',
    linkVideoCinema: '視頻運鏡導演台',
    linkAudioMusic: '音頻音樂工作台',
    linkWorkflow: '節點式工作流',
    linkPricing: '會員訂閱方案',
    colDeveloper: '開發者與遙測',
    linkApiPlatform: '開放平台（籌備中）',
    linkModelDirectory: '模型目錄與真實調用',
    linkCommunity: '創作者案例廣場',
    linkCreatorBenefits: '創作者算力權益',
    colNewsletter: '模型技術周刊與通知',
    officialChannels: '官方社交媒體與社區',
    newsletterDesc: (brand) => `訂閱 ${brand} 技術週報，第一時間獲取模型與產品更新公告。`,
    newsletterComingSoon: '郵件訂閱即將開放',
    newsletterComingSoonDesc: '目前還沒有可用的郵件訂閱服務。歡迎先加入社區獲取模型與產品更新。',
    visitCommunity: '前往社區',
    privacyPolicy: '隱私政策',
    termsOfService: '服務條款',
    refundPolicy: '退款準則',
    contentPolicy: '內容安全',
    allRightsReserved: '保留所有權利。',
    icpNumber: '備案編號：滬ICP備2026050086號',
    operatingSystem: '新一代生成式 AI 創意工作系統',
    canvasCore: '高精創作畫布內核',
    modelGateway: '模型網關中樞',
  },
  'ja-JP': {
    modelDirectoryAvailable: 'モデルディレクトリ公開中',
    actualUsage24h: '実利用統計 · 24h',
    heroBannerTitle: 'クリエイターと映像チームのための AI モデル＆制作ワークスペース',
    heroBannerDesc: 'FLUX、Kling、Suno、DeepSeek などの基盤モデルをシームレスに統合。次世代パイプライン向けの高速フェイルオーバーと高品質な生成を提供します。',
    launchStudio: 'Studio ワークスペースを開く',
    viewModelDirectory: 'モデルディレクトリを見る',
    coreDirectoryHeading: '主要基盤モデルディレクトリ',
    allModelProfiles: 'すべてのモデルプロファイル',
    brandSloganDefault: '生成AIクリエイティブスタジオ',
    brandVision: 'クリエイター、インディペンデントスタジオ、チームのための生成AIワークスペースおよびモデルアクセスレイヤー。',
    colWorkspaces: 'ワークスペース',
    linkImageStudio: '画像スタジオ',
    linkVideoCinema: 'ビデオシネマ',
    linkAudioMusic: 'オーディオ＆音楽',
    linkWorkflow: 'ワークフローキャンバス',
    linkPricing: '料金プラン',
    colDeveloper: '開発者＆API',
    linkApiPlatform: 'APIプラットフォーム（近日公開）',
    linkModelDirectory: 'モデルディレクトリ',
    linkCommunity: 'コミュニティギャラリー',
    linkCreatorBenefits: 'クリエイター特典',
    colNewsletter: 'ニュースレター＆更新情報',
    officialChannels: '公式ソーシャルメディア',
    newsletterDesc: (brand) => `${brand} の技術ニュースレターを購読し、モデルと製品の最新アップデートを受け取る。`,
    newsletterComingSoon: 'メール配信は近日開始',
    newsletterComingSoonDesc: '現在メール配信は準備中です。モデルや製品の更新情報はコミュニティをご覧ください。',
    visitCommunity: 'コミュニティへ',
    privacyPolicy: 'プライバシーポリシー',
    termsOfService: '利用規約',
    refundPolicy: '返金ポリシー',
    contentPolicy: 'コンテンツポリシー',
    allRightsReserved: '全著作権所有。',
    icpNumber: '届出番号：滬ICP備2026050086号',
    operatingSystem: '次世代クリエイティブAIオペレーティングシステム',
    canvasCore: '高精度キャンバスコア',
    modelGateway: 'モデルゲートウェイ',
  },
  'ko-KR': {
    modelDirectoryAvailable: '모델 디렉터리 사용 가능',
    actualUsage24h: '실제 사용 통계 · 24h',
    heroBannerTitle: '글로벌 크리에이터와 영상 팀을 위한 AI 모델 및 창작 워크스페이스',
    heroBannerDesc: 'FLUX, Kling, Suno, DeepSeek 등 핵심 플래그십 모델을 원스톱으로 통합합니다. 차세대 파이프라인을 위한 밀리초 페일오버와 결정론적 생성을 제공합니다.',
    launchStudio: 'Studio 워크스페이스 시작',
    viewModelDirectory: '모델 디렉터리 보기',
    coreDirectoryHeading: '핵심 파운데이션 모델 디렉터리',
    allModelProfiles: '전체 모델 프로필',
    brandSloganDefault: '생성형 AI 크리에이티브 스튜디오',
    brandVision: '크리에이터, 독립 스튜디오 및 팀을 위한 생성형 AI 창작 워크스페이스 및 모델 액세스 레이어입니다.',
    colWorkspaces: '워크스페이스',
    linkImageStudio: '이미지 스튜디오',
    linkVideoCinema: '비디오 시네마',
    linkAudioMusic: '오디오 & 음악',
    linkWorkflow: '워크플로 캔버스',
    linkPricing: '요금제 안내',
    colDeveloper: '개발자 및 API',
    linkApiPlatform: 'API 플랫폼 (준비 중)',
    linkModelDirectory: '모델 디렉터리',
    linkCommunity: '커뮤니티 갤러리',
    linkCreatorBenefits: '크리에이터 혜택',
    colNewsletter: '뉴스레터 및 업데이트',
    officialChannels: '공식 소셜 미디어',
    newsletterDesc: (brand) => `${brand} 기술 소식을 구독하고 최신 모델 및 제품 업데이트를 가장 먼저 받아보세요.`,
    newsletterComingSoon: '이메일 뉴스레터 곧 오픈',
    newsletterComingSoonDesc: '현재 이메일 구독은 준비 중입니다. 커뮤니티에 참여하여 모델 및 제품 업데이트를 확인하세요.',
    visitCommunity: '커뮤니티 바로가기',
    privacyPolicy: '개인정보 처리방침',
    termsOfService: '이용약관',
    refundPolicy: '환불 규정',
    contentPolicy: '콘텐츠 정책',
    allRightsReserved: 'All Rights Reserved.',
    icpNumber: '등록번호: 沪ICP备2026050086호',
    operatingSystem: '차세대 크리에이티브 AI 운영 체제',
    canvasCore: '고정밀 캔버스 코어',
    modelGateway: '모델 게이트웨이',
  },
  es: {
    modelDirectoryAvailable: 'Directorio de modelos disponible',
    actualUsage24h: 'Uso real · 24h',
    heroBannerTitle: 'Modelos Fundacionales y Espacio de Trabajo Creativo',
    heroBannerDesc: 'Enrutamiento multimodelos determinista, tolerancia a fallos en milisegundos y telemetría de alto rendimiento para pipelines creativos.',
    launchStudio: 'Abrir Espacio de Trabajo Studio',
    viewModelDirectory: 'Ver Directorio de Modelos',
    coreDirectoryHeading: 'DIRECTORIO DE MODELOS FUNDACIONALES',
    allModelProfiles: 'Todos los Perfiles de Modelos',
    brandSloganDefault: 'Espacio Creativo de IA Generativa',
    brandVision: 'Un espacio de trabajo de IA generativa y capa de acceso a modelos para creadores, estudios independientes y equipos.',
    colWorkspaces: 'ESPACIOS DE TRABAJO',
    linkImageStudio: 'Estudio de Imagen',
    linkVideoCinema: 'Cine de Video',
    linkAudioMusic: 'Audio y Música',
    linkWorkflow: 'Lienzo de Flujos',
    linkPricing: 'Precios y Planes',
    colDeveloper: 'DESARROLLADORES Y API',
    linkApiPlatform: 'Plataforma API (Próximamente)',
    linkModelDirectory: 'Directorio de Modelos',
    linkCommunity: 'Galería de la Comunidad',
    linkCreatorBenefits: 'Beneficios para Creadores',
    colNewsletter: 'BOLETÍN Y ACTUALIZACIONES',
    officialChannels: 'Canales Oficiales',
    newsletterDesc: (brand) => `Suscríbete para recibir actualizaciones de modelos y notas técnicas de lanzamiento de ${brand}.`,
    newsletterComingSoon: 'Boletín por correo próximamente',
    newsletterComingSoonDesc: 'Las suscripciones por correo aún no están disponibles. Únete a la comunidad para recibir actualizaciones.',
    visitCommunity: 'Visitar comunidad',
    privacyPolicy: 'Política de Privacidad',
    termsOfService: 'Términos de Servicio',
    refundPolicy: 'Política de Reembolso',
    contentPolicy: 'Política de Contenido',
    allRightsReserved: 'Todos los derechos reservados.',
    icpNumber: 'Registro: 沪ICP备2026050086号',
    operatingSystem: 'Sistema Operativo de IA Creativa de Próxima Generación',
    canvasCore: 'Núcleo de Lienzo de Alta Precisión',
    modelGateway: 'Pasarela de Modelos',
  },
};

export default function AboutFooter({ locale = 'en' }) {
  const activeLocale = normalizeLocale(locale);
  const copy = FOOTER_COPY[activeLocale] || FOOTER_COPY.en;
  const { brand } = useBranding();
  const brandName = brand?.brandName || 'SupDance';
  const logoHref = brand?.logoHref || localizeStudioPath('/', activeLocale);
  const logoTarget = brand?.logoTarget || '_self';

  const getModelUrl = (modelId) => {
    return localizeStudioPath(`/models/${modelId}`, activeLocale);
  };

  const getStudioUrl = (tab = 'image') => {
    return localizeStudioPath(`/studio?tab=${tab}`, activeLocale);
  };

  const getLocalizedText = (dict) => {
    if (!dict) return '';
    if (typeof dict === 'string') return dict;
    return dict[activeLocale] || dict.en || Object.values(dict)[0] || '';
  };

  return (
    <footer className="relative mt-20 border-t border-white/[0.08] bg-[#07080c] pt-16 pb-12 overflow-hidden select-none">
      {/* 底部全景极光微光环境背光 (指针安全) */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1200px] h-[480px] bg-gradient-to-t from-[#e11d74]/10 via-[#3772FF]/5 to-transparent blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-24 -left-20 w-[420px] h-[420px] bg-[#00f5d4]/5 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        {/* ========================================================= */}
        {/* TIER 1: 品牌超级号召横幅与实时算力集群全网状态条           */}
        {/* ========================================================= */}
        <div className="relative rounded-2xl p-7 sm:p-10 mb-16 overflow-hidden border border-white/10 bg-gradient-to-r from-[#12141c] via-[#161a26] to-[#12141c] backdrop-blur-2xl shadow-elevation-2">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#e11d74]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-[#3772FF]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5 mb-3">
                <span className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-mono text-[#00f5d4] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00f5d4] animate-pulse" />
                  <span>{copy.modelDirectoryAvailable}</span>
                </span>
                <span className="text-xs text-white/40 font-mono">
                  {copy.actualUsage24h}
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                {copy.heroBannerTitle}
              </h3>
              <p className="text-xs sm:text-sm text-white/60 mt-2 leading-relaxed max-w-xl">
                {copy.heroBannerDesc}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <Link
                href={localizeStudioPath('/studio', activeLocale)}
                className="px-6 py-3 rounded-full bg-[#e11d74] hover:bg-[#c0175f] text-white font-bold text-xs tracking-wide shadow-[0_4px_20px_rgba(225,29,116,0.4)] hover:shadow-[0_6px_25px_rgba(225,29,116,0.6)] transition-all hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>{copy.launchStudio}</span>
              </Link>
              <Link
                href={localizeStudioPath('/about#models', activeLocale)}
                className="px-5 py-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white font-semibold text-xs border border-white/10 transition-all hover:-translate-y-0.5 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <BarChart3 className="w-3.5 h-3.5 text-[#00f5d4]" />
                <span>{copy.viewModelDirectory}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TIER 2: 核心大模型全矩阵导航 (4 大模态深度分类目录)           */}
        {/* ========================================================= */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#00f5d4]" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                {copy.coreDirectoryHeading}
              </h4>
            </div>
            <Link
              href={localizeStudioPath('/models', activeLocale)}
              className="text-xs text-[#3772FF] hover:text-white transition-colors flex items-center gap-1 font-mono font-medium"
            >
              <span>{copy.allModelProfiles}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FOOTER_MODEL_GROUPS.map((group) => {
              const IconComp = group.icon;
              return (
                <div
                  key={group.id}
                  className="bg-[#0c0e14] border border-white/[0.08] hover:border-white/20 rounded-xl p-5 transition-all duration-300 hover:bg-[#10131b] shadow-elevation-1 flex flex-col justify-between"
                >
                  <div>
                    {/* 分组抬头 */}
                    <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-white/[0.06]">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${group.accentColor}18`,
                          color: group.accentColor,
                        }}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          {getLocalizedText(group.title)}
                        </div>
                      </div>
                    </div>

                    {/* 模型列表 */}
                    <div className="space-y-2.5">
                      {group.models.map((m) => (
                        <Link
                          key={m.id}
                          href={getModelUrl(m.id)}
                          className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/[0.04] transition-all group/item"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* 官方高清矢量品牌微标 */}
                            <ModelBrandLogo
                              providerId={m.providerId}
                              provider={m.provider}
                              modelId={m.id}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="truncate">
                              <span className="text-xs font-medium text-white/80 group-hover/item:text-[#00f5d4] transition-colors truncate block">
                                {m.name}
                              </span>
                              <span className="text-[10px] text-white/35 font-mono block truncate">
                                {m.provider}
                              </span>
                            </div>
                          </div>

                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-white/[0.05] text-white/50 border border-white/5 shrink-0 ml-2">
                            {getLocalizedText(m.tag)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* 底部微注 */}
                  <div className="pt-3 mt-3 border-t border-white/[0.04] flex items-center justify-between text-[10px] font-mono text-white/30">
                    <span>MODEL GROUP · {group.id.toUpperCase()}</span>
                    <span className="text-emerald-400">CATALOG</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* TIER 3: 产品体系、开发者生态、合规政策与技术订阅           */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/[0.08]">
          {/* 第 1 列：品牌微标与企业愿景 (占据 4 列) */}
          <div className="lg:col-span-4 flex flex-col items-start space-y-4">
            <Link
              href={logoHref}
              target={logoTarget}
              className="group flex flex-col items-start gap-1.5 cursor-pointer"
              aria-label={`${brandName} Home`}
            >
              <BrandLogo
                brand={brand}
                className="inline-flex items-center gap-2.5 [&>span:first-child]:group-hover:scale-105 transition-transform duration-200"
                nameClassName="text-lg font-black tracking-tight text-white group-hover:text-[#00f5d4] transition-colors"
              />
              <span className="text-[10px] font-mono text-white/40 tracking-wider uppercase">
                {brand?.brandSlogan || copy.brandSloganDefault}
              </span>
            </Link>

            <p className="text-xs text-white/60 leading-relaxed max-w-sm">
              {copy.brandVision}
            </p>

            <div className="pt-2 text-xs font-mono text-white/50 space-y-1">
              <div>support@{brandName.toLowerCase()}.com</div>
            </div>

            {/* 品牌官方社交与社区入口 (Official Social Channels) */}
            <div className="pt-3 flex flex-col items-start gap-2.5">
              <span className="text-[11px] font-mono text-white/45 tracking-wider uppercase">
                {copy.officialChannels}
              </span>
              <div className="flex items-center flex-wrap gap-2">
                {OFFICIAL_SOCIAL_LINKS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group/social relative flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white transition-all duration-200 cursor-pointer ${item.hoverBorder} ${item.hoverBg} hover:scale-105 active:scale-95 shadow-elevation-1`}
                      title={`${item.name} (${item.handle})`}
                      aria-label={`${item.name} ${item.handle}`}
                    >
                      <Icon
                        size={17}
                        className={`transition-colors duration-200 ${item.hoverText}`}
                      />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 第 2 列：核心工作台 (2 列) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              {copy.colWorkspaces}
            </div>
            <ul className="space-y-2 text-xs text-white/60">
              <li>
                <Link href={getStudioUrl('image')} className="hover:text-white transition-colors">
                  {copy.linkImageStudio}
                </Link>
              </li>
              <li>
                <Link href={getStudioUrl('video')} className="hover:text-white transition-colors">
                  {copy.linkVideoCinema}
                </Link>
              </li>
              <li>
                <Link href={getStudioUrl('audio')} className="hover:text-white transition-colors">
                  {copy.linkAudioMusic}
                </Link>
              </li>
              <li>
                <Link href={localizeStudioPath('/workflow', activeLocale)} className="hover:text-white transition-colors">
                  {copy.linkWorkflow}
                </Link>
              </li>
              <li>
                <Link href={localizeStudioPath('/pricing', activeLocale)} className="hover:text-white transition-colors">
                  {copy.linkPricing}
                </Link>
              </li>
            </ul>
          </div>

          {/* 第 3 列：开发者与遥测 (2 列) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              {copy.colDeveloper}
            </div>
            <ul className="space-y-2 text-xs text-white/60">
              <li>
                <Link href={localizeStudioPath('/call-api', activeLocale)} className="hover:text-white transition-colors">
                  {copy.linkApiPlatform}
                </Link>
              </li>
              <li>
                <Link href={localizeStudioPath('/about#models', activeLocale)} className="hover:text-white transition-colors">
                  {copy.linkModelDirectory}
                </Link>
              </li>
              <li>
                <Link href={localizeStudioPath('/community', activeLocale)} className="hover:text-white transition-colors">
                  {copy.linkCommunity}
                </Link>
              </li>
              <li>
                <Link href={localizeStudioPath('/benefits', activeLocale)} className="hover:text-white transition-colors">
                  {copy.linkCreatorBenefits}
                </Link>
              </li>
            </ul>
          </div>

          {/* 第 4 列：技术动态订阅与合规 (4 列) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              {copy.colNewsletter}
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              {typeof copy.newsletterDesc === 'function' ? copy.newsletterDesc(brandName) : copy.newsletterDesc}
            </p>

            <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-[#12141c] p-3 text-xs text-white/60">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#00f5d4]" />
              <div>
                <p className="font-semibold text-white">
                  {copy.newsletterComingSoon}
                </p>
                <p className="mt-1 leading-relaxed">
                  {copy.newsletterComingSoonDesc}
                </p>
                <Link
                  href={localizeStudioPath('/community', activeLocale)}
                  className="mt-2 inline-flex items-center gap-1 font-semibold text-[#00f5d4] hover:text-white transition-colors"
                >
                  {copy.visitCommunity}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3 text-[11px] text-white/40">
              <Link href={localizeStudioPath('/privacy', activeLocale)} className="hover:text-white transition-colors">
                {copy.privacyPolicy}
              </Link>
              <span>·</span>
              <Link href={localizeStudioPath('/terms', activeLocale)} className="hover:text-white transition-colors">
                {copy.termsOfService}
              </Link>
              <span>·</span>
              <Link href={localizeStudioPath('/refund', activeLocale)} className="hover:text-white transition-colors">
                {copy.refundPolicy}
              </Link>
              <span>·</span>
              <Link href={localizeStudioPath('/content-policy', activeLocale)} className="hover:text-white transition-colors">
                {copy.contentPolicy}
              </Link>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TIER 4: 底部版权标识、技术底座致敬与安全状态条             */}
        {/* ========================================================= */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] font-mono text-white/40">
          <div className="flex flex-wrap items-center gap-2">
            <span>© 2026 {brandName} ({brandName.toLowerCase()}.com). {copy.allRightsReserved}</span>
            <span className="hidden sm:inline">·</span>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              {copy.icpNumber}
            </a>
            <span className="hidden sm:inline">·</span>
            <span className="text-white/30 hidden sm:inline">{copy.operatingSystem}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-white/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{copy.canvasCore}</span>
            </span>
            <span>·</span>
            <span>{copy.modelGateway}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
