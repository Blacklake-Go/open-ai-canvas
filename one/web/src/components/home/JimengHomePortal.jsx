'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Layers,
  Sparkles,
  ArrowUp,
  ArrowUpRight,
  Plus,
  Lock,
  AtSign,
  Image as ImageIcon,
  Film,
  Volume2,
  Smile,
  Wand2,
  Copy,
  Play,
  Check,
  X,
  Maximize2,
} from 'lucide-react';
import StudioHeader from '@/components/site/StudioHeader';
import { SpatialBackground } from '@/components/spatial';
import { useUserSession } from '@/lib/hooks/useUserSession';
import { localizeStudioPath, normalizeLocale, getCommonCopy, getLocaleConfig } from '@/lib/locales';
import HomeStudioPromptComposer from './HomeStudioPromptComposer';
import AuthModal from '@/components/AuthModal';
import GoogleOneTap from '@/components/auth/GoogleOneTap';

// 画布卡片占位封面：无缩略图时使用确定性的氛围渐变，贴近即梦的哑光质感
const CANVAS_CARD_BACKDROPS = [
  'radial-gradient(circle at 28% 18%, rgba(255, 214, 190, 0.16), transparent 58%), linear-gradient(135deg, #38232f 0%, #1b1f2d 58%, #0d0f13 100%)',
  'radial-gradient(circle at 72% 14%, rgba(170, 238, 255, 0.14), transparent 56%), linear-gradient(135deg, #1d3440 0%, #16202a 58%, #0d0f13 100%)',
  'radial-gradient(circle at 32% 78%, rgba(214, 196, 255, 0.12), transparent 55%), linear-gradient(135deg, #2c2938 0%, #1d2029 58%, #0d0f13 100%)',
];

// 图像创作入口卡片氛围底
const IMAGE_CREATION_BACKDROP =
  'radial-gradient(circle at 70% 22%, rgba(255, 190, 214, 0.15), transparent 56%), linear-gradient(135deg, #322234 0%, #1d2029 58%, #0d0f13 100%)';

const pick = (dict, locale) => {
  const norm = normalizeLocale(locale);
  return dict[norm] || dict.en || Object.values(dict)[0] || '';
};

const PORTAL_COPY = {
  en: {
    createAnything: 'Create anything you',
    imagine: 'imagine',
    heroSub: 'Next-Gen Multi-modal AI Creative Engine & Infinite Canvas',
    creationType: 'Creation type',
    layersStudio: 'Layers Studio',
    viewAll: 'View all',
    newCanvas: 'New canvas',
    imageCreation: 'Image creation',
    untitledCanvas: 'Untitled canvas',
    nodes: 'nodes',
    signInToSync: 'Sign in to sync',
    canvasAgentPromptPlaceholder: 'Describe your idea, use / for skills, @ to add subjects, and create with Agent',
    canvasAgentPromptLabel: 'Canvas Agent prompt',
    sendToAgent: 'Send to Agent',
    addReference: 'Add reference',
    skills: 'Skills',
    subject: 'Subject',
    creationsAndShowcase: 'Creations & Showcase',
    myCreations: (c) => `My Creations (${c})`,
    featuredCreations: 'Showcases',
    statusDone: 'Done',
    statusProcessing: 'Processing',
    statusFailed: 'Failed',
    noPromptText: 'No prompt text',
    remix: 'Remix',
    openInCanvas: 'Open in Canvas',
    preview: 'Preview',
    promptLoadedToAgent: 'Prompt loaded into the Agent composer',
    loadedPresetFromPastCreation: 'Loaded preset from past creation',
    loadedCreationPreset: 'Loaded creation preset',
    skillPresetRemoved: 'Skill preset removed',
    appliedSkill: (s) => `Applied skill: ${s}`,
    greetingDefault: 'Hello, what would you like to create today?',
  },
  'zh-CN': {
    createAnything: '创造任何你',
    imagine: '想象的事物',
    heroSub: '全模态前沿模型，多模态视听无限画布',
    creationType: '创作类型',
    layersStudio: '图层画板',
    viewAll: '全部',
    newCanvas: '新建画布',
    imageCreation: '图像创作',
    untitledCanvas: '未命名画布',
    nodes: '个节点',
    signInToSync: '登录后同步画布',
    canvasAgentPromptPlaceholder: '输入想法、剧本或上传参考，支持 / 使用技能，@添加主体，和 Agent 一起创作',
    canvasAgentPromptLabel: '画布 Agent 创作指令',
    sendToAgent: '发送给 Agent',
    addReference: '添加参考',
    skills: '技能',
    subject: '主体',
    creationsAndShowcase: '创作画廊与精选展台',
    myCreations: (c) => `我的创作 (${c})`,
    featuredCreations: '精选作品',
    statusDone: '成功',
    statusProcessing: '处理中',
    statusFailed: '失败',
    noPromptText: '无提示词文本',
    remix: '同款创作',
    openInCanvas: '画布打开',
    preview: '全屏大图预览',
    promptLoadedToAgent: '已带入 Agent 创作台，确认后即可开始',
    loadedPresetFromPastCreation: '已装配历史创作同款参数',
    loadedCreationPreset: '已装配精选作品同款创作参数',
    skillPresetRemoved: '已取消技能预设',
    appliedSkill: (s) => `已应用技能: ${s}`,
    greetingDefault: '你好，今天想要创作什么？',
  },
  'zh-TW': {
    createAnything: '創造任何你',
    imagine: '想象的事物',
    heroSub: '全模態前沿模型，多模態視聽無限畫布',
    creationType: '創作類型',
    layersStudio: '圖層畫板',
    viewAll: '全部',
    newCanvas: '新建畫布',
    imageCreation: '圖像創作',
    untitledCanvas: '未命名畫布',
    nodes: '個節點',
    signInToSync: '登入後同步畫布',
    canvasAgentPromptPlaceholder: '輸入想法、劇本或上傳參考，支持 / 使用技能，@添加主體，和 Agent 一起創作',
    canvasAgentPromptLabel: '畫布 Agent 創作指令',
    sendToAgent: '發送給 Agent',
    addReference: '添加參考',
    skills: '技能',
    subject: '主體',
    creationsAndShowcase: '創作畫廊與精選展台',
    myCreations: (c) => `我的創作 (${c})`,
    featuredCreations: '精選作品',
    statusDone: '成功',
    statusProcessing: '處理中',
    statusFailed: '失敗',
    noPromptText: '無提示詞文本',
    remix: '同款創作',
    openInCanvas: '畫布打開',
    preview: '全屏大圖預覽',
    promptLoadedToAgent: '已帶入 Agent 創作台，確認後即可開始',
    loadedPresetFromPastCreation: '已裝配歷史創作同款參數',
    loadedCreationPreset: '已裝配精選作品同款創作參數',
    skillPresetRemoved: '已取消技能預設',
    appliedSkill: (s) => `已應用技能: ${s}`,
    greetingDefault: '你好，今天想要創作什麼？',
  },
  'ja-JP': {
    createAnything: 'あなたが思い描く',
    imagine: 'すべてを形に',
    heroSub: '次世代マルチモーダルAIクリエイティブエンジン＆無限キャンバス',
    creationType: '制作タイプ',
    layersStudio: 'レイヤースタジオ',
    viewAll: 'すべて',
    newCanvas: '新規キャンバス',
    imageCreation: '画像制作',
    untitledCanvas: '無題のキャンバス',
    nodes: 'ノード',
    signInToSync: 'ログインして同期',
    canvasAgentPromptPlaceholder: 'アイデアや脚本を入力、/でスキルを使用、@で被写体を追加してAgentと制作',
    canvasAgentPromptLabel: 'キャンバス Agent プロンプト',
    sendToAgent: 'Agent に送信',
    addReference: '参照を追加',
    skills: 'スキル',
    subject: '被写体',
    creationsAndShowcase: '制作ギャラリー＆注目展台',
    myCreations: (c) => `マイ作品 (${c})`,
    featuredCreations: '注目作品',
    statusDone: '完了',
    statusProcessing: '処理中',
    statusFailed: '失敗',
    noPromptText: 'プロンプトテキストなし',
    remix: 'リミックス',
    openInCanvas: 'キャンバスで開く',
    preview: 'プレビュー',
    promptLoadedToAgent: 'Agent 制作パネルに読み込みました',
    loadedPresetFromPastCreation: '過去の作品からパラメータを適用しました',
    loadedCreationPreset: '注目作品の制作パラメータを適用しました',
    skillPresetRemoved: 'スキルのプリセットを解除しました',
    appliedSkill: (s) => `スキルを適用しました: ${s}`,
    greetingDefault: 'こんにちは、今日は何を制作しますか？',
  },
  'ko-KR': {
    createAnything: '당신이 상상하는',
    imagine: '모든 것을 현실로',
    heroSub: '차세대 멀티모달 AI 크리에이티브 엔진 및 무한 캔버스',
    creationType: '제작 유형',
    layersStudio: '레이어 스튜디오',
    viewAll: '전체',
    newCanvas: '새 캔버스',
    imageCreation: '이미지 제작',
    untitledCanvas: '제목 없는 캔버스',
    nodes: '개 노드',
    signInToSync: '로그인 후 동기화',
    canvasAgentPromptPlaceholder: '아이디어나 대본을 입력하세요. /로 스킬 사용, @로 피사체 추가, Agent와 함께 창작',
    canvasAgentPromptLabel: '캔버스 Agent 프롬프트',
    sendToAgent: 'Agent에 전송',
    addReference: '참조 추가',
    skills: '스킬',
    subject: '피사체',
    creationsAndShowcase: '창작 갤러리 및 추천 쇼케이스',
    myCreations: (c) => `내 작품 (${c})`,
    featuredCreations: '추천 작품',
    statusDone: '완료',
    statusProcessing: '처리 중',
    statusFailed: '실패',
    noPromptText: '프롬프트 텍스트 없음',
    remix: '동일 스타일 제작',
    openInCanvas: '캔버스에서 열기',
    preview: '미리보기',
    promptLoadedToAgent: 'Agent 제작 패널로 프롬프트를 가져왔습니다',
    loadedPresetFromPastCreation: '과거 작품의 제작 설정을 적용했습니다',
    loadedCreationPreset: '추천 작품의 제작 설정을 적용했습니다',
    skillPresetRemoved: '스킬 프리셋을 취소했습니다',
    appliedSkill: (s) => `스킬이 적용되었습니다: ${s}`,
    greetingDefault: '안녕하세요, 오늘 어떤 작품을 만들고 싶으신가요?',
  },
  es: {
    createAnything: 'Crea todo lo que',
    imagine: 'imagines',
    heroSub: 'Motor Creativo de IA Multimodal de Próxima Generación y Lienzo Infinito',
    creationType: 'Tipo de creación',
    layersStudio: 'Estudio de Capas',
    viewAll: 'Ver todo',
    newCanvas: 'Nuevo lienzo',
    imageCreation: 'Creación de imagen',
    untitledCanvas: 'Lienzo sin título',
    nodes: 'nodos',
    signInToSync: 'Inicia sesión para sincronizar',
    canvasAgentPromptPlaceholder: 'Describe tu idea, usa / para habilidades, @ para sujetos y crea con Agent',
    canvasAgentPromptLabel: 'Instrucción de Canvas Agent',
    sendToAgent: 'Enviar a Agent',
    addReference: 'Añadir referencia',
    skills: 'Habilidades',
    subject: 'Sujeto',
    creationsAndShowcase: 'Galería de Creaciones y Escaparate',
    myCreations: (c) => `Mis Creaciones (${c})`,
    featuredCreations: 'Destacados',
    statusDone: 'Listo',
    statusProcessing: 'Procesando',
    statusFailed: 'Fallido',
    noPromptText: 'Sin texto de prompt',
    remix: 'Recrear',
    openInCanvas: 'Abrir en Canvas',
    preview: 'Vista previa',
    promptLoadedToAgent: 'Prompt cargado en el editor de Agent',
    loadedPresetFromPastCreation: 'Ajustes aplicados de creación anterior',
    loadedCreationPreset: 'Ajustes de creación cargados',
    skillPresetRemoved: 'Preajuste de habilidad eliminado',
    appliedSkill: (s) => `Habilidad aplicada: ${s}`,
    greetingDefault: 'Hola, ¿qué te gustaría crear hoy?',
  },
};

// 动态模式快捷技能预设标签列表（涵盖图像、视频、音频、Agent、数字人 5 模态，支持 6 种语言）
const getSkillPresets = (locale, tHome, mode = 'image') => {
  const norm = normalizeLocale(locale);

  if (mode === 'video') {
    return [
      {
        id: 'cinematic-drone',
        label: pick({
          en: '/ Cinematic Camera Tracking',
          'zh-CN': '/ 电影级大范围运镜',
          'zh-TW': '/ 電影級大範圍運鏡',
          'ja-JP': '/ シネマカメラワーク',
          'ko-KR': '/ 시네마틱 카메라 무빙',
          es: '/ Rastreo de Cámara Cinemática',
        }, norm),
        badge: 'New',
        badgeType: 'blue',
        prompt: pick({
          en: 'Epic cinematic drone shot, Hitchcock vertigo zoom in, dramatic film lighting, 4K UHD',
          'zh-CN': '电影级航拍大范围运镜，希区柯克变焦推拉，史诗大片光影，4K超高清',
          'zh-TW': '電影級航拍大範圍運鏡，希區考克變焦推拉，史詩大片光影，4K超高清',
          'ja-JP': '映画級ドローン空撮カメラワーク、めまいズーム、劇的シネマライティング、4K超高精細',
          'ko-KR': '영화급 드론 항공 촬영 대범위 카메라 무빙, 버티고 줌 인, 서사적 시네마틱 조명, 4K 초고화질',
          es: 'Toma épica de dron cinematográfico, zoom vértigo de Hitchcock, iluminación dramática de película, 4K UHD',
        }, norm),
      },
      {
        id: 'slow-mo-fluid',
        label: pick({
          en: '/ 120fps Slow-mo Macro',
          'zh-CN': '/ 120fps 慢动作微距',
          'zh-TW': '/ 120fps 慢動作微距',
          'ja-JP': '/ 120fps スローモーションマクロ',
          'ko-KR': '/ 120fps 슬로우모션 매크로',
          es: '/ Macro Cámara Lenta 120fps',
        }, norm),
        badge: 'Hot',
        badgeType: 'orange',
        prompt: pick({
          en: 'Ultra 120fps slow motion cinematography, macro liquid droplets refraction, pristine optics',
          'zh-CN': '高帧率120fps慢动作升格摄影，微距水滴与流体折射光斑，极致超清特写',
          'zh-TW': '高幀率120fps慢動作升格攝影，微距水滴與流體折射光斑，極致超清特寫',
          'ja-JP': '超高フレームレート120fpsハイスピード撮影、マクロ水滴と流体の光屈折、超精細クローズアップ',
          'ko-KR': '초고속 120fps 슬로우 모션 촬영, 매크로 물방울 및 유체 굴절 반사, 극상의 초고화질 클로즈업',
          es: 'Cinematografía en cámara lenta ultra 120fps, refracción macro de gotas líquidas, óptica cristalina',
        }, norm),
      },
      {
        id: 'cyber-chase',
        label: pick({
          en: '/ Cyberpunk Chase POV',
          'zh-CN': '/ 赛博疾速第一人称',
          'zh-TW': '/ 賽博疾速第一人稱',
          'ja-JP': '/ サイバーパンク追走POV',
          'ko-KR': '/ 사이버펑크 추격 1인칭',
          es: '/ Persecución Cyberpunk POV',
        }, norm),
        badge: 'Hot',
        badgeType: 'orange',
        prompt: pick({
          en: 'First-person perspective high-speed chase, neon light trails, adrenaline rush motion blur',
          'zh-CN': '第一人称疾速动态追踪，霓虹光线拖尾，激烈追逐视角，强力视觉冲击',
          'zh-TW': '第一人稱疾速動態追蹤，霓虹光線拖尾，激烈追逐視角，強力視覺衝擊',
          'ja-JP': '一人称視点高速チェイス、ネオン光跡の軌跡、躍動感あふれるモーションブラー、強烈な視覚インパクト',
          'ko-KR': '1인칭 시점 초고속 역동적 추격, 네온 불빛 잔상 트레일, 박진감 넘치는 앵글, 강력한 시각적 충격',
          es: 'Persecución a alta velocidad en primera persona, estelas de luz de neón, desenfoque de movimiento adrenalínico',
        }, norm),
      },
      {
        id: 'retro-film-35mm',
        label: pick({
          en: '/ 35mm Vintage Film',
          'zh-CN': '/ 35mm 复古胶片长镜',
          'zh-TW': '/ 35mm 復古膠片長鏡',
          'ja-JP': '/ 35mm レトロフィルム',
          'ko-KR': '/ 35mm 빈티지 필름',
          es: '/ Película Clásica 35mm',
        }, norm),
        badge: null,
        badgeType: 'neutral',
        prompt: pick({
          en: '35mm vintage film aesthetic, afternoon Tyndall sunlight, gentle breeze and soft bokeh',
          'zh-CN': '35mm复古胶片颗粒，午后阳光斜射丁达尔光，自然微风吹拂与生动景深',
          'zh-TW': '35mm復古膠片顆粒，午後陽光斜射丁達爾光，自然微風吹拂與生動景深',
          'ja-JP': '35mmレトロフィルムグレイン、午後のチンダル現象の木漏れ日、穏やかな微風と柔らかなボケ味',
          'ko-KR': '35mm 빈티지 필름 그레인, 오후 햇살의 틴들 효과 광선, 자연스러운 미풍과 부드러운 아웃포커스',
          es: 'Estética de película clásica de 35 mm, luz solar de efecto Tyndall por la tarde, suave brisa y bokeh sutil',
        }, norm),
      },
      {
        id: 'epic-fantasy-panorama',
        label: pick({
          en: '/ Epic Fantasy Panorama',
          'zh-CN': '/ 史诗奇幻全景空镜',
          'zh-TW': '/ 史詩奇幻全景空鏡',
          'ja-JP': '/ 壮大ファンタジーパノラマ',
          'ko-KR': '/ 서사적 판타지 파노라마',
          es: '/ Panorama de Fantasía Épica',
        }, norm),
        badge: null,
        badgeType: 'neutral',
        prompt: pick({
          en: 'Majestic fantasy landscape panorama, rolling sea of clouds, Unreal Engine 5 volumetric lighting',
          'zh-CN': '宏大史诗奇幻全景镜头，云海翻涌巨龙盘旋，虚幻引擎5物理光照渲染',
          'zh-TW': '宏大史詩奇幻全景鏡頭，雲海翻湧巨龍盤旋，虛幻引擎5物理光照渲染',
          'ja-JP': '雄大なファンタジー景観パノラマ、湧き立つ雲海と飛翔するドラゴン、Unreal Engine 5ボリューム光線',
          'ko-KR': '웅장한 서사 판타지 전경 앵글, 소용돌이치는 운해와 선회하는 드래곤, 언리얼 엔진 5 물리 볼륨 라이팅',
          es: 'Paisaje panorámico de fantasía majestuosa, mar de nubes ondeante, iluminación volumétrica de Unreal Engine 5',
        }, norm),
      },
      {
        id: 'more-video-tools',
        label: pick({
          en: 'Video Studio ›',
          'zh-CN': '进入视频工作室 ›',
          'zh-TW': '進入視頻工作室 ›',
          'ja-JP': '動画スタジオへ ›',
          'ko-KR': '비디오 스튜디오 바로가기 ›',
          es: 'Ir a Estudio de Video ›',
        }, norm),
        badge: null,
        badgeType: 'link',
        href: `${localizeStudioPath(norm)}?tab=video`,
      },
    ];
  }

  if (mode === 'audio') {
    return [
      {
        id: 'cinematic-orchestra',
        label: pick({
          en: '/ Cinematic Orchestral',
          'zh-CN': '/ 电影院线管弦交响',
          'zh-TW': '/ 電影院線管弦交響',
          'ja-JP': '/ 映画館オーケストラ交響曲',
          'ko-KR': '/ 시네마틱 오케스트라',
          es: '/ Orquestal Cinemático',
        }, norm),
        badge: 'Hot',
        badgeType: 'orange',
        prompt: pick({
          en: 'Grand epic orchestral score, heavy brass and soaring strings, cinematic blockbuster soundtrack',
          'zh-CN': '气势恢宏的史诗交响乐，低沉铜管与壮阔弦乐交织，院线大片配乐质感',
          'zh-TW': '氣勢恢宏的史詩交響樂，低沉銅管與壯闊弦樂交織，院線大片配樂質感',
          'ja-JP': '壮大なエピックオーケストラ曲、重厚な金管と響き渡るストリングス、映画本編のサウンドトラック',
          'ko-KR': '웅장한 서사 오케스트라 스코어, 묵직한 금관과 울려 퍼지는 현악기, 블록버스터 영화 사운드트랙 질감',
          es: 'Gran banda sonora orquestal épica, metales profundos y cuerdas elevadas, banda sonora de superproducción',
        }, norm),
      },
      {
        id: 'warm-acoustic-guitar',
        label: pick({
          en: '/ Warm Acoustic Guitar',
          'zh-CN': '/ 温暖抒情木吉他',
          'zh-TW': '/ 溫暖抒情木吉他',
          'ja-JP': '/ 温かなアコースティックギター',
          'ko-KR': '/ 따뜻한 어쿠스틱 기타',
          es: '/ Guitarra Acústica Cálida',
        }, norm),
        badge: 'New',
        badgeType: 'blue',
        prompt: pick({
          en: 'Crisp acoustic guitar chords, warm soothing indie folk vocals, peaceful afternoon ambiance',
          'zh-CN': '清亮木吉他扫弦伴奏，温暖亲切民谣人声，宁静午后治愈氛围',
          'zh-TW': '清亮木吉他掃弦伴奏，溫暖親切民謠人聲，寧靜午後治癒氛圍',
          'ja-JP': '透明感のあるアコースティックギターのストローク、温かく心地よいインディーズボーカル、穏やかな午後の癒し',
          'ko-KR': '맑고 선명한 통기타 스트로크 반주, 따뜻하고 친근한 포크 보컬, 평화로운 오후의 힐링 무드',
          es: 'Acordes nítidos de guitarra acústica, voces cálidas y relajantes de indie folk, ambiente tranquilo de tarde',
        }, norm),
      },
      {
        id: 'synthwave-heavy',
        label: pick({
          en: '/ Cyberpunk Synthwave',
          'zh-CN': '/ 赛博朋克合成器浪潮',
          'zh-TW': '/ 賽博朋克合成器浪潮',
          'ja-JP': '/ シンセウェーブ・サイバー',
          'ko-KR': '/ 사이버펑크 신스웨이브',
          es: '/ Synthwave Cyberpunk',
        }, norm),
        badge: 'Hot',
        badgeType: 'orange',
        prompt: pick({
          en: 'Pulsing synthwave bassline, cyberpunk 80s drums, neon midnight retro-future vibes',
          'zh-CN': '强劲电子Synthwave合成器低音，赛博朋克节奏，霓虹夜色工业质感',
          'zh-TW': '強勁電子Synthwave合成器低音，賽博朋克節奏，霓虹夜色工業質感',
          'ja-JP': 'うねるシンセウェーブのベースライン、80年代調サイバードラム、真夜中のネオンとレトロフューチャー',
          'ko-KR': '강렬한 일렉트로닉 신스웨이브 베이스라인, 사이버펑크 80s 드럼, 네온 한밤의 레트로 퓨처 분위기',
          es: 'Línea de bajo de synthwave palpitante, batería cyberpunk de los 80, vibras retrofuturistas de medianoche de neón',
        }, norm),
      },
      {
        id: 'lofi-chill-hop',
        label: pick({
          en: '/ Lofi Chill Beats',
          'zh-CN': '/ Lofi 治愈舒缓节拍',
          'zh-TW': '/ Lofi 治癒舒緩節拍',
          'ja-JP': '/ ローファイ・チルビート',
          'ko-KR': '/ 로파이 칠 비트',
          es: '/ Beats Relajantes Lofi',
        }, norm),
        badge: null,
        badgeType: 'neutral',
        prompt: pick({
          en: 'Vintage vinyl crackle, gentle Rhodes electric piano, mellow hip hop beats for study & focus',
          'zh-CN': '经典黑胶Lofi Hip Hop微弱爆豆声，柔和电钢琴与平缓鼓点，专注放松',
          'zh-TW': '經典黑膠Lofi Hip Hop微弱爆豆聲，柔和電鋼琴與平緩鼓點，專注放鬆',
          'ja-JP': 'ヴィンテージレコードのスクラッチ音、柔らかなローズピアノ、勉強や作業に最適なメロウなビート',
          'ko-KR': '빈티지 바이닐 LP 노이즈, 부드러운 로즈 일렉트릭 피아노와 잔잔한 힙합 비트, 집중과 힐링',
          es: 'Crujido de vinilo vintage, piano eléctrico Rhodes suave, ritmos suaves de hip hop para estudiar y concentrarse',
        }, norm),
      },
      {
        id: 'commercial-tech-beat',
        label: pick({
          en: '/ Tech Keynote Rhythm',
          'zh-CN': '/ 商业发布会高燃律动',
          'zh-TW': '/ 商業發布會高燃律動',
          'ja-JP': '/ テック発表会エネルギッシュ',
          'ko-KR': '/ 테크 키노트 리듬',
          es: '/ Ritmo de Presentación Tech',
        }, norm),
        badge: null,
        badgeType: 'neutral',
        prompt: pick({
          en: 'Modern upbeat tech corporate beat, energetic digital pulse, product launch presentation trailer',
          'zh-CN': '现代化激昂电子律动，科技感音效点缀，企业宣传片动感节奏',
          'zh-TW': '現代化激昂電子律動，科技感音效點綴，企業宣傳片動感節奏',
          'ja-JP': 'モダンでアップビートなテック企業ビート、エネルギッシュなパルス、新製品発表トレーラー向け',
          'ko-KR': '현대적인 테크 기업 비트, 에너제틱한 디지털 펄스, 신제품 런칭 프레젠테이션 예고편',
          es: 'Ritmo corporativo tecnológico y moderno, pulso digital enérgico, tráiler de lanzamiento de producto',
        }, norm),
      },
      {
        id: 'more-audio-tools',
        label: pick({
          en: 'Audio Studio ›',
          'zh-CN': '进入音频工作室 ›',
          'zh-TW': '進入音頻工作室 ›',
          'ja-JP': '音声スタジオへ ›',
          'ko-KR': '오디오 스튜디오 바로가기 ›',
          es: 'Ir a Estudio de Audio ›',
        }, norm),
        badge: null,
        badgeType: 'link',
        href: `${localizeStudioPath(norm)}?tab=audio`,
      },
    ];
  }

  if (mode === 'agent') {
    return [
      {
        id: 'director-storyboard',
        label: pick({
          en: '/ Storyboard Director Agent',
          'zh-CN': '/ 爆款分镜导演工作流',
          'zh-TW': '/ 爆款分鏡導演工作流',
          'ja-JP': '/ 絵コンテ監督エージェント',
          'ko-KR': '/ 스토리보드 디렉터 에이전트',
          es: '/ Agente Director de Storyboard',
        }, norm),
        badge: 'New',
        badgeType: 'blue',
        prompt: pick({
          en: 'Automatically expand 5-scene cinematic storyboard script, with shots, camera angles, lighting and sound',
          'zh-CN': '根据主题自动扩写5幕电影级镜头脚本，包含景别、运镜、光影与音效设计',
          'zh-TW': '根據主題自動擴寫5幕電影級鏡頭腳本，包含景別、運鏡、光影與音效設計',
          'ja-JP': 'テーマに基づき5シーンの映画級カット脚本を自動展開、アングル、カメラワーク、ライティング、音響を含む',
          'ko-KR': '주제에 따라 5막 시네마틱 앵글 대본을 자동 확장하며 숏 크기, 카메라 무빙, 조명 및 사운드 디자인 포함',
          es: 'Expande automáticamente guión gráfico de 5 escenas de cine, con planos, ángulos, iluminación y sonido',
        }, norm),
      },
      {
        id: 'brand-visual-designer',
        label: pick({
          en: '/ Omnichannel Brand Stylist',
          'zh-CN': '/ 全渠道视觉设计大师',
          'zh-TW': '/ 全渠道視覺設計大師',
          'ja-JP': '/ オムニチャネル・ブランドスタイリスト',
          'ko-KR': '/ 옴니채널 브랜드 비주얼 마스터',
          es: '/ Estilista de Marca Omnicanal',
        }, norm),
        badge: 'Hot',
        badgeType: 'orange',
        prompt: pick({
          en: 'Analyze brand aesthetics and produce multi-aspect social media graphics and multilingual copy',
          'zh-CN': '自动化解析品牌调性，产出适配多比例的社交媒体视觉方案与多语言文案',
          'zh-TW': '自動化解析品牌調性，產出適配多比例的社交媒體視覺方案與多語言文案',
          'ja-JP': 'ブランドトーンを自動解析し、複数アスペクト比に対応したSNSビジュアルと多言語コピーを生成',
          'ko-KR': '브랜드 아이덴티티를 자동 분석하여 다양한 비율의 소셜 미디어 비주얼과 다국어 카피를 생성',
          es: 'Analiza la estética de la marca y produce gráficos para redes sociales multiformato y textos multilingües'
        }, norm),
      },
      {
        id: 'novel-character-extract',
        label: pick({
          en: '/ Novel Character Forge',
          'zh-CN': '/ 沉浸式小说角色提取',
          'zh-TW': '/ 沉浸式小說角色提取',
          'ja-JP': '/ 小説キャラクター抽出',
          'ko-KR': '/ 소설 캐릭터 추출',
          es: '/ Forja de Personajes de Novela',
        }, norm),
        badge: 'Hot',
        badgeType: 'orange',
        prompt: pick({
          en: 'Extract character persona, detailed wardrobe and recurring scenes from literary text into prompt sequences',
          'zh-CN': '深度提取长篇文本中的人物设定、服装细节与关键场景，生成连贯分镜提示词',
          'zh-TW': '深度提取長篇文本中的人物設定、服裝細節與關鍵場景，生成連貫分鏡提示詞',
          'ja-JP': '長編テキストから人物設定、衣装ディテール、重要シーンを深層抽出し、一貫したプロンプトを生成',
          'ko-KR': '장문 텍스트에서 인물 설정, 의상 디테일 및 핵심 장면을 심층 추출하여 일관된 프롬프트 시퀀스 생성',
          es: 'Extrae la personalidad del personaje, vestuario detallado y escenas recurrentes del texto literario en prompts',
        }, norm),
      },
      {
        id: 'viral-video-hook',
        label: pick({
          en: '/ Viral Short Script & Hook',
          'zh-CN': '/ 爆款短视频脚本与口播',
          'zh-TW': '/ 爆款短視頻腳本與口播',
          'ja-JP': '/ バズるショート動画スクリプト',
          'ko-KR': '/ 바이럴 쇼츠 대본 및 내레이션',
          es: '/ Guión y Gancho de Video Viral',
        }, norm),
        badge: null,
        badgeType: 'neutral',
        prompt: pick({
          en: '3-second high-retention video hook, emotionally engaging arc and high-converting CTA',
          'zh-CN': '3秒黄金抓人钩子，情绪递进故事线，搭配痛点引爆与高转化行动召唤',
          'zh-TW': '3秒黃金抓人鉤子，情緒遞進故事線，搭配痛點引爆與高轉化行動召喚',
          'ja-JP': '最初の3秒で惹きつけるフック、感情が高まるストーリーライン、共感ポイントと高コンバージョンCTA',
          'ko-KR': '3초 골든 훅, 감정 상승 스토리라인, 핵심 공감대 유발 및 고전환 CTA 연계',
          es: 'Gancho de retención de 3 segundos, arco narrativo emotivo y llamada a la acción de alta conversión',
        }, norm),
      },
      {
        id: 'more-agent-tools',
        label: pick({
          en: 'Browse All Agents ›',
          'zh-CN': '浏览更多智能体 ›',
          'zh-TW': '瀏覽更多智能體 ›',
          'ja-JP': 'すべてのエージェントを見る ›',
          'ko-KR': '더 많은 에이전트 둘러보기 ›',
          es: 'Ver Todos los Agentes ›',
        }, norm),
        badge: null,
        badgeType: 'link',
        href: `${localizeStudioPath(norm)}?tab=agents`,
      },
    ];
  }

  if (mode === 'digital-human') {
    return [
      {
        id: 'business-host',
        label: pick({
          en: '/ Executive Keynote Anchor',
          'zh-CN': '/ 极简商务发布会主播',
          'zh-TW': '/ 極簡商務發布會主播',
          'ja-JP': '/ ビジネス発表会キャスター',
          'ko-KR': '/ 비즈니스 키노트 앵커',
          es: '/ Presentador Ejecutivo',
        }, norm),
        badge: 'New',
        badgeType: 'blue',
        prompt: pick({
          en: 'Polished corporate executive in tailored suit, confident natural gestures, studio lighting',
          'zh-CN': '专业干练商务西装，沉稳自信微笑与手势互动，演播室柔光箱人像质感',
          'zh-TW': '專業幹練商務西裝，沉穩自信微笑與手勢互動，演播室柔光箱人像質感',
          'ja-JP': '洗練されたビジネススーツ、落ち着いた笑顔と自然な身振り、スタジオソフトボックス照明の質感',
          'ko-KR': '세련된 비즈니스 정장, 차분하고 자신감 넘치는 미소와 제스처, 스튜디오 소프트박스 인물 조명',
          es: 'Ejecutivo corporativo elegante con traje a medida, gestos naturales seguros, iluminación de estudio',
        }, norm),
      },
      {
        id: 'ecommerce-streamer',
        label: pick({
          en: '/ E-Commerce Live Presenter',
          'zh-CN': '/ 电商带货激情口播员',
          'zh-TW': '/ 電商帶貨激情口播員',
          'ja-JP': '/ ライブコマース配信者',
          'ko-KR': '/ 라이브 커머스 진행자',
          es: '/ Presentador de Comercio en Vivo',
        }, norm),
        badge: 'Hot',
        badgeType: 'orange',
        prompt: pick({
          en: 'Vibrant expressive e-commerce streamer, animated micro-expressions and engaging gestures',
          'zh-CN': '高表现力热情互动，生动面部微表情，快节奏产品展示与专业吸睛手势',
          'zh-TW': '高表現力熱情互動，生動面部微表情，快節奏產品展示與專業吸睛手勢',
          'ja-JP': '表情豊かで熱心なインタラクション、生き生きとした微表情、テンポの良い商品紹介と引きつける手振り',
          'ko-KR': '풍부한 표현력의 활기찬 인터랙션, 생생한 미세 표정, 빠른 템포의 제품 소개와 시선 강탈 제스처',
          es: 'Presentador expresivo y dinámico de e-commerce, microexpresiones animadas y gestos atractivos',
        }, norm),
      },
      {
        id: 'cyber-hologram-assistant',
        label: pick({
          en: '/ Futuristic Holographic AI',
          'zh-CN': '/ 科技风未来全息助理',
          'zh-TW': '/ 科技風未來全息助理',
          'ja-JP': '/ 近未来ホログラムAI',
          'ko-KR': '/ 미래형 홀로그램 AI',
          es: '/ Asistente Holográfico Futurista',
        }, norm),
        badge: 'Hot',
        badgeType: 'orange',
        prompt: pick({
          en: 'Translucent high-tech holographic avatar, glowing HUD elements, clean studio background',
          'zh-CN': '半透明未来科技服饰，清澈明亮眼神，AI全息悬浮演播背景，超清数字人',
          'zh-TW': '半透明未來科技服飾，清澈明亮眼神，AI全息懸浮演播背景，超清數字人',
          'ja-JP': '半透明の近未来ハイテク衣装、澄んだ眼差し、AIホログラム浮遊スタジオ背景、超高精細デジタルヒューマン',
          'ko-KR': '반투명 미래 테크 웨어, 맑고 또렷한 눈빛, AI 홀로그램 스튜디오 배경, 초고화질 디지털 휴먼',
          es: 'Avatar holográfico translúcido de alta tecnología, elementos HUD brillantes, fondo de estudio limpio',
        }, norm),
      },
      {
        id: 'bilingual-news-anchor',
        label: pick({
          en: '/ Multilingual News Anchor',
          'zh-CN': '/ 多语言双语新闻播报',
          'zh-TW': '/ 多語言雙語新聞播報',
          'ja-JP': '/ 多言語ニュースアナウンサー',
          'ko-KR': '/ 다국어 뉴스 앵커',
          es: '/ Presentador de Noticias Multilingüe',
        }, norm),
        badge: null,
        badgeType: 'neutral',
        prompt: pick({
          en: 'Authoritative broadcast news anchor, natural lip-sync synchronization, broadcast studio desk',
          'zh-CN': '沉稳权威双语新闻主播台风，标准发音口型自然同步，新闻演播大厅背景',
          'zh-TW': '沉穩權威雙語新聞主播颱風，標準發音口型自然同步，新聞演播大廳背景',
          'ja-JP': '落ち着いた信頼感あるニュースキャスター、自然なリップシンク同期、ニューススタジオのデスク背景',
          'ko-KR': '신뢰감 있는 뉴스 앵커 스타일, 자연스러운 립싱크 동기화, 방송 스튜디오 데스크 배경',
          es: 'Presentador de noticias autoritario, sincronización de labios natural, mesa de estudio de transmisión',
        }, norm),
      },
      {
        id: 'more-avatar-tools',
        label: pick({
          en: 'Lipsync & Avatar Studio ›',
          'zh-CN': '进入数字人唇形工作室 ›',
          'zh-TW': '進入數字人唇形工作室 ›',
          'ja-JP': 'リップシンクスタジオへ ›',
          'ko-KR': '립싱크 스튜디오 바로가기 ›',
          es: 'Ir a Estudio de Avatar ›',
        }, norm),
        badge: null,
        badgeType: 'link',
        href: `${localizeStudioPath(norm)}?tab=lipsync`,
      },
    ];
  }

  // Default: image mode
  return [
    {
      id: 'cinematic-light',
      label: pick({
        en: '/ Cinematic Lighting & Texture',
        'zh-CN': '/ 电影光影与质感',
        'zh-TW': '/ 電影光影與質感',
        'ja-JP': '/ シネマ光影・質感',
        'ko-KR': '/ 시네마틱 라이팅',
        es: '/ Luz Cinematográfica',
      }, norm),
      badge: 'New',
      badgeType: 'blue',
      prompt: pick({
        en: '4K ultra cinematic lighting, volumetric Tyndall rays, 35mm film grain, shallow depth of field',
        'zh-CN': '4K超清电影级质感，大师布光，丁达尔光束，胶片颗粒与高级景深',
        'zh-TW': '4K超清電影級質感，大師布光，丁達爾光束，膠片顆粒與高級景深',
        'ja-JP': '4K超高画質シネマティック質感、巨匠ライティング、チンダル光線、35mmフィルムグレイン、浅い被写界深度',
        'ko-KR': '4K 초고화질 시네마틱 질감, 거장의 조명 연출, 틴들 광선, 35mm 필름 그레인 및 얕은 심도',
        es: 'Iluminación ultra cinematográfica 4K, rayos volumétricos Tyndall, grano de película de 35 mm, poca profundidad de campo',
      }, norm),
    },
    {
      id: 'master-portrait',
      label: pick({
        en: '/ 8K Master Portrait',
        'zh-CN': '/ 8K 极清大师肖像',
        'zh-TW': '/ 8K 極清大師肖像',
        'ja-JP': '/ 8K極清ポートレート',
        'ko-KR': '/ 8K 거장 인물',
        es: '/ Retrato Maestro 8K',
      }, norm),
      badge: 'New',
      badgeType: 'blue',
      prompt: pick({
        en: 'Hasselblad master portrait close-up, hyper-realistic skin texture, soft bokeh, natural micro-expressions',
        'zh-CN': '哈苏顶级人像特写，真实细腻皮肤纹理，柔焦散景，自然生动的面部微表情',
        'zh-TW': '哈蘇頂級人像特寫，真實細膩皮膚紋理，柔焦散景，自然生動的面部微表情',
        'ja-JP': 'ハッセルブラッド最高峰ポートレート、極めて自然な肌の質感、柔らかなボケ、生き生きとした表情',
        'ko-KR': '핫셀블라드 마스터 인물 클로즈업, 사실적인 피부 질감, 부드러운 보케, 생생한 표정',
        es: 'Primer plano de retrato maestro Hasselblad, textura de piel hiperrealista, bokeh suave, microexpresiones naturales',
      }, norm),
    },
    {
      id: 'surreal-concept',
      label: pick({
        en: '/ Surreal Concept Scene',
        'zh-CN': '/ 超现实概念场景',
        'zh-TW': '/ 超現實概念場景',
        'ja-JP': '/ 超現実コンセプト',
        'ko-KR': '/ 초현실 컨셉',
        es: '/ Concepto Surrealista',
      }, norm),
      badge: 'Hot',
      badgeType: 'orange',
      prompt: pick({
        en: 'Epic surreal concept art, Unreal Engine 5 render, majestic spatial depth and ethereal atmosphere',
        'zh-CN': '概念艺术大师构图，宏大超现实奇幻场景，虚幻引擎5渲染，磅礴空间纵深',
        'zh-TW': '概念藝術大師構圖，宏大超現實奇幻場景，虛幻引擎5渲染，磅礴空間縱深',
        'ja-JP': 'エピックな超現実コンセプトアート、Unreal Engine 5レンダリング、荘厳な空間深度と神秘的雰囲気',
        'ko-KR': '에픽 초현실 컨셉 아트, 언리얼 엔진 5 렌더링, 웅장한 공간 깊이감과 신비로운 분위기',
        es: 'Arte conceptual épico surrealista, render de Unreal Engine 5, majestuosa profundidad espacial y atmósfera etérea',
      }, norm),
    },
    {
      id: 'commercial-film',
      label: pick({
        en: '/ Commercial Film & Ad',
        'zh-CN': '/ 商业广告大片',
        'zh-TW': '/ 商業廣告大片',
        'ja-JP': '/ CM広告ビジュアル',
        'ko-KR': '/ 상업 광고 비주얼',
        es: '/ Cine Publicitario',
      }, norm),
      badge: 'Hot',
      badgeType: 'orange',
      prompt: pick({
        en: 'High-end commercial advertisement aesthetics, minimalist studio lighting, pristine reflections, magazine cover',
        'zh-CN': '极简现代高端商业广告美学，纯净高光反光，产品高级静物摄影，杂志封面质感',
        'zh-TW': '極簡現代高端商業廣告美學，純淨高光反光，產品高級靜物攝影，雜誌封面質感',
        'ja-JP': 'ハイエンド商業広告美学、ミニマルスタジオ照明、透明感ある反射、雑誌表紙の洗練された質感',
        'ko-KR': '고급 상업 광고 미학, 미니멀 스튜디오 조명, 투명한 반사광, 매거진 커버 퀄리티 정물 촬영',
        es: 'Estética de publicidad comercial de alta gama, iluminación de estudio minimalista, reflejos impecables, portada de revista',
      }, norm),
    },
    {
      id: 'anime-scene',
      label: pick({
        en: '/ Anime Cinematic Scene',
        'zh-CN': '/ 新海诚二次元分镜',
        'zh-TW': '/ 新海誠二次元分鏡',
        'ja-JP': '/ アニメ映画カット',
        'ko-KR': '/ 애니메이션 연출',
        es: '/ Escena Anime',
      }, norm),
      badge: null,
      badgeType: 'neutral',
      prompt: pick({
        en: 'Makoto Shinkai aesthetic anime film style, radiant clouds, vibrant sunset glow, scenic anime composition',
        'zh-CN': '新海诚唯美动漫电影风，透亮蓝天白云，细腻唯美色彩光晕，经典日系分镜',
        'zh-TW': '新海誠唯美動漫電影風，透亮藍天白雲，細膩唯美色彩光暈，經典日系分鏡',
        'ja-JP': '新海誠風のアニメ映画スタイル、輝く入道雲、夕焼けのグラデーション、美しい日本のアニメ構図',
        'ko-KR': '신카이 마코토 감성 애니메이션 스타일, 청명한 구름과 노을빛 광원, 서정적인 애니메이션 구도',
        es: 'Estilo de película de anime estética de Makoto Shinkai, nubes radiantes, vibrante brillo de atardecer, composición de anime',
      }, norm),
    },
    {
      id: 'cyber-future',
      label: pick({
        en: '/ Cyberpunk Hologram',
        'zh-CN': '/ 赛博未来全息',
        'zh-TW': '/ 賽博未來全息',
        'ja-JP': '/ サイバーホログラム',
        'ko-KR': '/ 사이버 홀로그램',
        es: '/ Cyberpunk Holograma',
      }, norm),
      badge: null,
      badgeType: 'neutral',
      prompt: pick({
        en: 'Futuristic cyberpunk aesthetics, holographic neon projections, rain reflections and intricate biomechanical details',
        'zh-CN': '未来赛博科技美学，霓虹光带与全息悬浮投影，雨夜倒影与金属机械构造',
        'zh-TW': '未來賽博科技美學，霓虹光帶與全息懸浮投影，雨夜倒影與金屬機械構造',
        'ja-JP': '近未来サイバーパンク美学、ホログラムネオン投影、雨夜の反射と複雑なメカニカルディテール',
        'ko-KR': '미래 사이버펑크 미학, 홀로그램 네온 프로젝션, 비 내리는 밤의 반사광과 기계 메카닉 디테일',
        es: 'Estética cyberpunk futurista, proyecciones holográficas de neón, reflejos de lluvia y detalles biomecánicos',
      }, norm),
    },
    {
      id: 'more-skills',
      label: tHome.moreSkills || pick({
        en: 'More Workflows & Agents ›',
        'zh-CN': '更多工作流与智能体 ›',
        'zh-TW': '更多工作流與智能體 ›',
        'ja-JP': 'その他のワークフロー＆Agent ›',
        'ko-KR': '더 많은 워크플로 및 에이전트 ›',
        es: 'Más Flujos y Agentes ›',
      }, norm),
      badge: null,
      badgeType: 'link',
      href: `${localizeStudioPath(norm)}?tab=workflows`,
    },
  ];
};

// 画布模式技能工作流标签（视频反解 / 创作分镜 / 广告导演 / 剧本 / 短片，支持 6 种语言）
const getCanvasSkillPresets = (locale) => {
  const norm = normalizeLocale(locale);
  return [
    {
      id: 'video-reverse',
      label: pick({
        en: '/ Video Deconstruction',
        'zh-CN': '/ 视频反解',
        'zh-TW': '/ 視頻反解',
        'ja-JP': '/ 動画の逆解析',
        'ko-KR': '/ 비디오 역분석',
        es: '/ Deconstrucción de Video',
      }, norm),
      badge: 'New',
      prompt: pick({
        en: 'Deconstruct an uploaded video frame by frame into camera language, composition, tone and re-creatable storyboard prompts',
        'zh-CN': '上传一段视频，逐帧反解其镜头语言、构图、色调与运镜，生成可复刻的分镜提示词',
        'zh-TW': '上傳一段視頻，逐幀反解其鏡頭語言、構圖、色調與運鏡，生成可復刻的分鏡提示詞',
        'ja-JP': 'アップロード動画をフレームごとに逆解析し、カメラワーク、構図、色調から再利用可能な絵コンテプロンプトを生成',
        'ko-KR': '업로드한 비디오를 프레임별로 역분석하여 카메라 연출, 구도, 색감에서 재현 가능한 스토리보드 프롬프트를 생성',
        es: 'Deconstruye un video cuadro por cuadro en lenguaje de cámara, composición, tono y prompts reproducibles',
      }, norm),
    },
    {
      id: 'storyboard-creator',
      label: pick({
        en: '/ Storyboard Creator',
        'zh-CN': '/ 创作分镜',
        'zh-TW': '/ 創作分鏡',
        'ja-JP': '/ 絵コンテ作成',
        'ko-KR': '/ 스토리보드 제작',
        es: '/ Creador de Storyboard',
      }, norm),
      badge: 'New',
      prompt: pick({
        en: 'Expand a theme into a five-act cinematic shot script with framing, camera moves, lighting and sound design',
        'zh-CN': '根据主题自动扩写5幕电影级镜头脚本，包含景别、运镜、光影与音效设计',
        'zh-TW': '根據主題自動擴寫5幕電影級鏡頭腳本，包含景別、運鏡、光影與音效設計',
        'ja-JP': 'テーマに基づき5幕の映画級カット脚本を展開、サイズ、カメラワーク、照明、音響デザインを含む',
        'ko-KR': '주제에 맞춰 5막 시네마틱 숏 스크립트로 확장하며 구도, 카메라 무빙, 조명 및 사운드 디자인 포함',
        es: 'Expande un tema en un guión de planos cinematográficos en cinco actos con encuadres, movimientos, iluminación y sonido',
      }, norm),
    },
    {
      id: 'ad-film-director',
      label: pick({
        en: '/ Full-Funnel Ad Director',
        'zh-CN': '/ 全流程广告片导演',
        'zh-TW': '/ 全流程廣告片導演',
        'ja-JP': '/ 全工程CMディレクター',
        'ko-KR': '/ 풀퍼널 광고 감독',
        es: '/ Director de Cine Publicitario',
      }, norm),
      badge: 'New',
      prompt: pick({
        en: 'Direct a commercial film end-to-end, from creative insight and storyboard to final delivery',
        'zh-CN': '从创意洞察、分镜脚本到成片交付，全流程导演一部商业广告大片',
        'zh-TW': '從創意洞察、分鏡腳本到成片交付，全流程導演一部商業廣告大片',
        'ja-JP': 'クリエイティブインサイトから絵コンテ、完成版納品まで、CM映像を全工程でディレクション',
        'ko-KR': '크리에이티브 인사이트, 스토리보드부터 최종 영상 납품까지 상업 광고 전체 프로세스를 디렉팅',
        es: 'Dirige un anuncio comercial de principio a fin, desde la idea y el guión gráfico hasta la entrega final',
      }, norm),
    },
    {
      id: 'script-development',
      label: pick({
        en: '/ Script Development',
        'zh-CN': '/ 剧本开发',
        'zh-TW': '/ 劇本開發',
        'ja-JP': '/ 脚本開発',
        'ko-KR': '/ 대본 개발',
        es: '/ Desarrollo de Guión',
      }, norm),
      badge: 'New',
      prompt: pick({
        en: 'Develop a complete script around the core idea: character profiles, three-act structure and dialogue design',
        'zh-CN': '围绕核心创意展开完整剧本：人物设定、三幕结构与对白设计',
        'zh-TW': '圍繞核心創意展開完整劇本：人物設定、三幕結構與對白設計',
        'ja-JP': 'コアアイデアから完全な脚本を作成：キャラクター設定、三幕構成、対話デザイン',
        'ko-KR': '핵심 아이디어를 바탕으로 완성도 높은 대본 개발: 캐릭터 프로필, 3막 구조 및 대사 연출',
        es: 'Desarrolla un guión completo en torno a la idea central: perfiles de personajes, estructura en tres actos y diálogos',
      }, norm),
    },
    {
      id: 'drama-short-film',
      label: pick({
        en: '/ Drama Short Film',
        'zh-CN': '/ 剧情短片',
        'zh-TW': '/ 劇情短片',
        'ja-JP': '/ ドラマショート',
        'ko-KR': '/ 드라마 단편',
        es: '/ Cortometraje Dramático',
      }, norm),
      badge: 'New',
      prompt: pick({
        en: 'Adapt your story into a dramatic short film script with shot and mood design',
        'zh-CN': '将你的故事改编为有起承转合的剧情短片脚本，含镜头与氛围设计',
        'zh-TW': '將你的故事改編為有起承轉合的劇情短片腳本，含鏡頭與氛圍設計',
        'ja-JP': 'ストーリーを起承転結のあるドラマショート脚本に脚色、カット割りや雰囲気設計を含む',
        'ko-KR': '스토리를 기승전결이 있는 드라마 단편 스크립트로 각색하며 숏 구성과 무드 연출 포함',
        es: 'Adapta tu historia a un guión de cortometraje dramático con diseño de planos y atmósfera',
      }, norm),
    },
    {
      id: 'more-canvas-skills',
      label: pick({
        en: 'More Skills ›',
        'zh-CN': '更多技能 ›',
        'zh-TW': '更多技能 ›',
        'ja-JP': 'その他のスキル ›',
        'ko-KR': '더 많은 스킬 ›',
        es: 'Más Habilidades ›',
      }, norm),
      badge: null,
      href: `${localizeStudioPath(norm)}?tab=agents`,
    },
  ];
};

// 最近上新展台卡片（全站 SupDance 真实生态与同款参数装配，支持 6 种语言）
const getRecentFeatures = (locale, tHome, rootPath) => {
  const norm = normalizeLocale(locale);
  return [
    {
      id: 'mango-glass-pro',
      title: tHome.featuredCreations ? `${tHome.featuredCreations}\nMANGO GLASS PRO` : pick({
        en: 'Featured Creations\nMANGO GLASS PRO',
        'zh-CN': '精选作品\nMANGO GLASS PRO',
        'zh-TW': '精選作品\nMANGO GLASS PRO',
        'ja-JP': '注目作品\nMANGO GLASS PRO',
        'ko-KR': '추천 작품\nMANGO GLASS PRO',
        es: 'Creaciones Destacadas\nMANGO GLASS PRO',
      }, norm),
      author: '@翻月岚',
      category: tHome.featuredCreations || pick({
        en: 'Showcases',
        'zh-CN': '精选作品',
        'zh-TW': '精選作品',
        'ja-JP': '注目作品',
        'ko-KR': '추천 작품',
        es: 'Destacados',
      }, norm),
      badge: pick({
        en: 'PRO',
        'zh-CN': '精选',
        'zh-TW': '精選',
        'ja-JP': '注目',
        'ko-KR': '추천',
        es: 'PRO',
      }, norm),
      gradient: 'from-amber-600/30 to-purple-900/40',
      bgImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
      tab: 'image',
      model: 'seedream-5.0-pro',
      ar: '3:4',
      quality: '2K',
      prompt: pick({
        en: 'MANGO GLASS PRO fashion concept portrait, retro sunglasses, moody dramatic lighting, magazine cover',
        'zh-CN': 'MANGO GLASS PRO 时尚概念人像摄影，复古太阳镜，冷峻高级面部光影，杂志封面构图，超高分辨率电影级质感',
        'zh-TW': 'MANGO GLASS PRO 時尚概念人像攝影，復古太陽鏡，冷峻高級面部光影，雜誌封面構圖，超高分辨率電影級質感',
        'ja-JP': 'MANGO GLASS PRO ファッションコンセプトポートレート、レトロサングラス、ドラマティックな陰影、雑誌カバー構図',
        'ko-KR': 'MANGO GLASS PRO 패션 컨셉 인물 사진, 레트로 선글라스, 세련된 명암 라이팅, 매거진 커버 구도',
        es: 'Fotografía de retrato conceptual de moda MANGO GLASS PRO, gafas de sol retro, iluminación dramática, portada de revista',
      }, norm),
    },
    {
      id: 'supdance-mcp-cli',
      title: pick({
        en: 'SupDance API & SDK\nComing Soon',
        'zh-CN': 'SupDance API / SDK\n接入筹备中',
        'zh-TW': 'SupDance API / SDK\n接入籌備中',
        'ja-JP': 'SupDance API / SDK\n近日公開予定',
        'ko-KR': 'SupDance API & SDK\n준비 중',
        es: 'SupDance API y SDK\nPróximamente',
      }, norm),
      desc: pick({
        en: 'Public API is not open yet; use the Studio workspace today',
        'zh-CN': '公开 API 尚未开放，可先使用 Studio 工作台',
        'zh-TW': '公開 API 尚未開放，可先使用 Studio 工作台',
        'ja-JP': '公開APIは準備中です。Studioワークスペースをご利用ください',
        'ko-KR': '공개 API는 준비 중입니다. 현재는 Studio 워크스페이스를 이용해 주세요',
        es: 'La API pública aún no está disponible; utiliza el Studio hoy',
      }, norm),
      category: pick({
        en: 'Ecosystem',
        'zh-CN': '开发生态',
        'zh-TW': '開發生態',
        'ja-JP': '開発エコシステム',
        'ko-KR': '개발 생태계',
        es: 'Ecosistema',
      }, norm),
      badge: pick({
        en: 'SOON',
        'zh-CN': '筹备中',
        'zh-TW': '籌備中',
        'ja-JP': '近日',
        'ko-KR': '준비 중',
        es: 'PRONTO',
      }, norm),
      gradient: 'from-blue-600/30 to-indigo-950/40',
      bgImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
      tab: 'api',
      href: rootPath ? `${rootPath}/call-api` : '/call-api',
    },
    {
      id: 'seedance-sample',
      title: pick({
        en: 'Seedance 2.5\nCinematic Motion',
        'zh-CN': 'Seedance 2.5\n电影运镜模式',
        'zh-TW': 'Seedance 2.5\n電影運鏡模式',
        'ja-JP': 'Seedance 2.5\nシネマカメラワーク',
        'ko-KR': 'Seedance 2.5\n시네마틱 모션',
        es: 'Seedance 2.5\nMovimiento Cinemático',
      }, norm),
      desc: pick({
        en: 'Native A/V sync, cinematic camera tracking & epic views',
        'zh-CN': '原生音视频协同，电影级大范围运镜与史诗全景',
        'zh-TW': '原生音視頻協同，電影級大範圍運鏡與史詩全景',
        'ja-JP': 'ネイティブ音声同期、映画級の広角カメラワークと雄大なパノラマ',
        'ko-KR': '자체 A/V 동기화, 영화급 대범위 카메라 트래킹 및 서사적 전경',
        es: 'Sincronización A/V nativa, rastreo de cámara de cine y vistas épicas',
      }, norm),
      category: pick({
        en: 'Model',
        'zh-CN': '模型突破',
        'zh-TW': '模型突破',
        'ja-JP': 'モデル革新',
        'ko-KR': '모델 혁신',
        es: 'Modelo',
      }, norm),
      badge: pick({
        en: 'UPGRADE',
        'zh-CN': '升级',
        'zh-TW': '升級',
        'ja-JP': '進化',
        'ko-KR': '업그레이드',
        es: 'MEJORA',
      }, norm),
      gradient: 'from-emerald-600/30 to-slate-900/40',
      bgImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
      tab: 'video',
      model: 'kling-v2.6-pro-t2v',
      ar: '16:9',
      prompt: pick({
        en: 'Epic Stonehenge sunrise panorama, cinematic drone vista, wide landscape with misty atmosphere, 4K UHD',
        'zh-CN': '巨石阵日出史诗全景，电影级空镜，广角远景与迷雾缭绕，4K超高清画质',
        'zh-TW': '巨石陣日出史詩全景，電影級空鏡，廣角遠景與迷霧繚繞，4K超高清畫質',
        'ja-JP': 'ストーンヘンジの日の出エピックパノラマ、映画級空撮、広角遠景と朝霧、4K超高画質',
        'ko-KR': '스톤헨지 일출 서사적 파노라마, 시네마틱 뷰, 광각 원경과 아침 안개, 4K 초고화질',
        es: 'Panorama épico del amanecer de Stonehenge, vista de cine con dron, paisaje amplio con niebla, 4K UHD',
      }, norm),
    },
    {
      id: 'supdance-cinema-studio',
      title: pick({
        en: 'SupDance Cinema Studio\nCinematic Craft',
        'zh-CN': 'SupDance 电影片场\nCinema Studio',
        'zh-TW': 'SupDance 電影片場\nCinema Studio',
        'ja-JP': 'SupDance 映画撮影所\nCinema Studio',
        'ko-KR': 'SupDance 시네마 스튜디오\n영화 촬영소',
        es: 'SupDance Cinema Studio\nArte Cinemático',
      }, norm),
      desc: pick({
        en: 'Master camera builder & multi-angle directorial shooting',
        'zh-CN': '大师镜头语言与多机位导演拍摄控制台',
        'zh-TW': '大師鏡頭語言與多機位導演拍攝控制台',
        'ja-JP': '巨匠カメラワーク言語＆マルチアングル監督撮影コンソール',
        'ko-KR': '거장의 카메라 워크 언어 및 다각도 연출 촬영 콘솔',
        es: 'Constructor de cámara maestra y rodaje de dirección multiángulo',
      }, norm),
      category: pick({
        en: 'New Launch',
        'zh-CN': '全新上线',
        'zh-TW': '全新上線',
        'ja-JP': '新着',
        'ko-KR': '신규 오픈',
        es: 'Nuevo',
      }, norm),
      badge: 'HOT',
      gradient: 'from-rose-600/30 to-neutral-900/40',
      bgImage: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&auto=format&fit=crop&q=80',
      tab: 'cinema',
      prompt: pick({
        en: 'Classic 1970s vintage film studio set, anamorphic widescreen, warm flare and storytelling depth',
        'zh-CN': '70年代经典复古电影片场，电影级变形宽荧幕镜头，暖色调光斑与故事感人物叙事',
        'zh-TW': '70年代經典復古電影片場，電影級變形寬熒幕鏡頭，暖色調光斑與故事感人物敘事',
        'ja-JP': '1970年代のクラシックレトロ映画セット、アナモルフィックワイドスクリーン、温かな光斑と深みのある物語性',
        'ko-KR': '1970년대 클래식 빈티지 영화 세트장, 아나모픽 와이드스크린, 따뜻한 플레어와 서사감 넘치는 인물 스토리',
        es: 'Plató de cine clásico de los años 70, pantalla ancha anamórfica, destellos cálidos y profundidad narrativa',
      }, norm),
    },
  ];
};

export default function JimengHomePortal({ locale = 'en', initialUser = undefined, googleOneTapEligible = false }) {
  const router = useRouter();
  const { user } = useUserSession(initialUser);
  const [activeMode, setActiveMode] = useState('generate'); // 'generate' | 'canvas'
  const [composerMode, setComposerMode] = useState('agent'); // 'image' | 'video' | 'audio' | 'agent' | 'digital-human'
  const composerRef = useRef(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingTask, setPendingTask] = useState(null);
  const [activeSkillId, setActiveSkillId] = useState(null);
  const [mounted, setMounted] = useState(false);
  const pendingAuthResolverRef = useRef(null);

  // 用户历史创作列表（从 /api/generations?limit=8 读取）
  const [userCreations, setUserCreations] = useState([]);
  const [loadingCreations, setLoadingCreations] = useState(false);
  const [galleryTab, setGalleryTab] = useState('featured'); // 'user' | 'featured'
  const [previewModalItem, setPreviewModalItem] = useState(null);

  // 画布模式：最近云端画布与底部 Agent 输入框
  const [canvasProjects, setCanvasProjects] = useState([]);
  const [loadingCanvasProjects, setLoadingCanvasProjects] = useState(false);
  const [canvasPrompt, setCanvasPrompt] = useState('');
  const canvasInputRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const normLocale = normalizeLocale(locale);
  const copy = getCommonCopy(normLocale);
  const tHome = copy.homePortal || {};
  const portalCopy = PORTAL_COPY[normLocale] || PORTAL_COPY.en;
  const rootPath = getLocaleConfig(normLocale)?.rootPath || '';
  const studioBase = localizeStudioPath(normLocale);
  const assetHref = localizeStudioPath('/assets', normLocale);

  const skillPresets = getSkillPresets(normLocale, tHome, composerMode);
  const canvasSkillPresets = getCanvasSkillPresets(normLocale);
  const recentFeatures = getRecentFeatures(normLocale, tHome, rootPath);

  // 请求真实后端 /api/generations 接口装配历史创作
  const fetchRecentGenerations = useCallback(async () => {
    if (!user) {
      setUserCreations([]);
      setGalleryTab('featured');
      return;
    }
    setLoadingCreations(true);
    try {
      const res = await fetch('/api/generations?limit=8', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.creations) ? data.creations : [];
        setUserCreations(list);
        if (list.length > 0) {
          setGalleryTab('user');
        }
      }
    } catch (err) {
      console.warn('[JimengHomePortal] Failed to load user creations:', err);
    } finally {
      setLoadingCreations(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRecentGenerations();
  }, [fetchRecentGenerations]);

  // 读取最近云端画布（最多展示 3 个）
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setCanvasProjects([]);
      setLoadingCanvasProjects(false);
      return () => {
        cancelled = true;
      };
    }
    setLoadingCanvasProjects(true);
    fetch('/api/canvas/projects', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.projects) ? data.projects : [];
        setCanvasProjects(list.slice(0, 2));
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[JimengHomePortal] Failed to load canvas projects:', err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCanvasProjects(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // 全局账户额度守卫：在首页遇到未登录时弹出统一 AuthModal
  const requireAccountGate = useCallback(() => {
    return new Promise((resolve) => {
      if (user) {
        resolve(user);
        return;
      }
      pendingAuthResolverRef.current = { resolve };
      setShowAuthModal(true);
    });
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__SUPDANCE_REQUIRE_ACCOUNT__ = requireAccountGate;
      window.__SUPDANCE_REQUIRE_API_KEY__ = async () => {
        const u = await requireAccountGate();
        return u ? 'supdance-account-session' : null;
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.__SUPDANCE_REQUIRE_ACCOUNT__;
        delete window.__SUPDANCE_REQUIRE_API_KEY__;
      }
    };
  }, [requireAccountGate]);

  // 动态时段问候语：挂载前固定输出 default，杜绝水合闪烁
  const getGreeting = () => {
    if (!mounted) {
      return tHome.greetingDefault || portalCopy.greetingDefault;
    }
    const hour = new Date().getHours();
    if (hour < 11) return tHome.greetingMorning || portalCopy.greetingDefault;
    if (hour < 14) return tHome.greetingNoon || portalCopy.greetingDefault;
    if (hour < 18) return tHome.greetingAfternoon || portalCopy.greetingDefault;
    return tHome.greetingEvening || portalCopy.greetingDefault;
  };

  const [queuedComposerAction, setQueuedComposerAction] = useState(null);

  useEffect(() => {
    if (activeMode === 'generate' && queuedComposerAction && composerRef.current) {
      if (queuedComposerAction.type === 'applyPreset') {
        composerRef.current.applyCreationPreset(queuedComposerAction.payload);
      } else if (queuedComposerAction.type === 'setPrompt') {
        composerRef.current.setPromptText(queuedComposerAction.prompt, queuedComposerAction.mode);
      }
      setQueuedComposerAction(null);
    }
  }, [activeMode, queuedComposerAction]);

  // 画布底部输入框：将灵感带入 Agent 创作台
  const handleCanvasPromptSubmit = (event) => {
    event.preventDefault();
    const prompt = canvasPrompt.trim();
    if (!prompt) return;
    setCanvasPrompt('');
    setActiveMode('generate');
    setQueuedComposerAction({ type: 'setPrompt', prompt, mode: 'agent' });
    window.scrollTo({ top: 120, behavior: 'smooth' });
    toast.success(portalCopy.promptLoadedToAgent);
  };

  // 输入框快捷操作：聚焦 / 插入技能斜杠 / 插入主体 @
  const handleCanvasInputAction = (action) => {
    if (action === 'skill') {
      setCanvasPrompt((prev) => `${prev}${prev.trim() && !prev.endsWith(' ') ? ' ' : ''}/`);
    } else if (action === 'subject') {
      setCanvasPrompt((prev) => `${prev}${prev.trim() && !prev.endsWith(' ') ? ' ' : ''}@`);
    }
    canvasInputRef.current?.focus();
  };

  // 画布模式技能标签：切入生成模式并带入 Agent 创作台
  const handleCanvasSkillClick = (skill) => {
    if (skill.href) {
      router.push(skill.href);
      return;
    }
    setActiveMode('generate');
    setQueuedComposerAction({ type: 'setPrompt', prompt: skill.prompt, mode: 'agent' });
    window.scrollTo({ top: 120, behavior: 'smooth' });
    toast.success(portalCopy.appliedSkill(skill.label.replace('/ ', '')));
  };

  // 点击展台卡片：一键装配创作参数或跳转
  const handleFeatureCardClick = (item) => {
    if (item.href) {
      router.push(item.href);
      return;
    }
    if (item.tab === 'image' || item.tab === 'video') {
      const payload = {
        prompt: item.prompt,
        ar: item.ar,
        quality: item.quality,
        modelId: item.model,
        mode: item.tab,
      };
      if (activeMode !== 'generate') {
        setActiveMode('generate');
        setQueuedComposerAction({ type: 'applyPreset', payload });
      } else {
        composerRef.current?.applyCreationPreset(payload);
      }
      window.scrollTo({ top: 120, behavior: 'smooth' });
      toast.success(portalCopy.loadedCreationPreset);
      return;
    }
    const params = new URLSearchParams();
    params.set('tab', item.tab);
    if (item.model) params.set('model', item.model);
    if (item.prompt) params.set('prompt', item.prompt);
    params.set('auto', '1');
    router.push(`${studioBase}?${params.toString()}`);
  };

  // 点击用户历史作品“同款创作”
  const handleApplyUserCreation = (item) => {
    const targetMode = item.studio_id || item.mediaType || 'image';
    const payload = {
      prompt: item.prompt,
      modelId: item.model_id || item.modelId,
      ar: item.aspect_ratio || item.ar,
      mode: targetMode,
    };
    if (activeMode !== 'generate') {
      setActiveMode('generate');
      setQueuedComposerAction({ type: 'applyPreset', payload });
    } else {
      composerRef.current?.applyCreationPreset(payload);
    }
    window.scrollTo({ top: 120, behavior: 'smooth' });
    toast.success(portalCopy.loadedPresetFromPastCreation);
  };

  // 点击技能标签：交互式切换高亮与提示词协同
  const handleSkillClick = (skill) => {
    if (skill.href) {
      router.push(skill.href);
      return;
    }
    if (skill.prompt) {
      if (activeSkillId === skill.id) {
        setActiveSkillId(null);
        composerRef.current?.toggleSkillPrompt(skill.prompt);
        toast(portalCopy.skillPresetRemoved, { icon: '↩' });
      } else {
        setActiveSkillId(skill.id);
        composerRef.current?.toggleSkillPrompt(skill.prompt);
        toast.success(portalCopy.appliedSkill(skill.label.replace('/ ', '')));
      }
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    fetchRecentGenerations();
    if (pendingAuthResolverRef.current) {
      pendingAuthResolverRef.current.resolve?.(user || true);
      pendingAuthResolverRef.current = null;
    }
    if (pendingTask) {
      const { prompt, model, ar, quality, batch, mode } = pendingTask;
      const params = new URLSearchParams();
      params.set('tab', mode || 'image');
      if (prompt) params.set('prompt', prompt);
      if (model) params.set('model', model);
      if (ar) params.set('ar', ar);
      if (quality) params.set('quality', quality);
      if (batch > 1) params.set('batch', String(batch));
      params.set('auto', '1');
      router.push(`${studioBase}?${params.toString()}`);
    }
  };

  const handleAuthClose = () => {
    setShowAuthModal(false);
    if (pendingAuthResolverRef.current) {
      pendingAuthResolverRef.current.resolve?.(null);
      pendingAuthResolverRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink relative selection:bg-brand selection:text-white flex flex-col justify-between overflow-x-hidden">
      {/* 1. 保留网站既有空间极光与工程点阵背景特效 */}
      <SpatialBackground />
      <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none z-0" />

      {/* 2. 统一顶栏：显式透传服务端一致的 locale 与 user */}
      <StudioHeader locale={normLocale} activeTab={null} className="relative z-40" initialUser={user} />

      {/* 3. 首页主舞台黄金视口区 */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-start pt-24 md:pt-32 pb-16 px-4 max-w-[1320px] mx-auto w-full">
        {/* 顶部中央 Dreamina 标志性品牌标题与环境光晕 */}
        <div className="relative mb-8 text-center flex flex-col items-center">
          {/* Ambient backdrop glow */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[340px] sm:w-[540px] h-[160px] bg-brand/15 blur-[90px] pointer-events-none rounded-full" />

          {activeMode === 'canvas' ? (
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-center select-none relative z-10">
              <span className="bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-transparent">
                {getGreeting()}
              </span>
            </h1>
          ) : (
            <>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-center select-none relative z-10 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
                <span className="bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-transparent">
                  {portalCopy.createAnything}
                </span>
                <span className="italic font-serif bg-gradient-to-r from-brand-hover via-pink-400 to-rose-300 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(225,29,116,0.35)]">
                  {portalCopy.imagine}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-ink-muted text-center max-w-xl mx-auto mt-3 font-normal leading-relaxed relative z-10">
                {getGreeting()} · {portalCopy.heroSub}
              </p>
            </>
          )}
        </div>

        {/* 核心模式分段器 (生成 vs 画布) */}
        <div
          data-pill-segmented
          role="group"
          aria-label={portalCopy.creationType}
          className="mode-switch rounded-full mb-8"
        >
          <button
            type="button"
            data-pill-segment-item
            aria-pressed={activeMode === 'generate'}
            onClick={() => setActiveMode('generate')}
            className="mode-switch-option rounded-full"
          >
            {tHome.modeGenerate || 'Generate'}
          </button>
          <button
            type="button"
            data-pill-segment-item
            aria-pressed={activeMode === 'canvas'}
            onClick={() => setActiveMode('canvas')}
            className="mode-switch-option rounded-full"
          >
            {tHome.modeCanvas || 'Canvas'}
          </button>
        </div>

        {/* 画布模式：画布首页（新建画布 + 最近画布 + Agent 输入框） */}
        {activeMode === 'canvas' ? (
          <div className="w-full max-w-[1280px] flex flex-col animate-fade-in">
            <div className="mb-3 flex items-center justify-end gap-5 px-1">
              <button
                type="button"
                onClick={() => router.push(`${studioBase}?tab=layers`)}
                className="flex items-center gap-1.5 text-xs text-ink-subtle hover:text-white transition-colors cursor-pointer"
              >
                <Layers className="size-3.5" />
                <span>{portalCopy.layersStudio}</span>
              </button>
              <a
                href={localizeStudioPath('/canvas', normLocale)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-ink-muted hover:text-white transition-colors"
              >
                {portalCopy.viewAll}
              </a>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* 新建画布 */}
              <a
                href={localizeStudioPath('/canvas?mode=new', normLocale)}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-[#0f1115]/80 hover:bg-[#14161c]/90 hover:border-white/20 transition-all duration-300 flex flex-col items-center justify-center gap-3"
              >
                <span className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />
                <span className="relative z-10 flex size-14 items-center justify-center rounded-2xl bg-white text-black shadow-elevation-2 transition-transform duration-300 group-hover:scale-105">
                  <Plus className="size-5" strokeWidth={2.4} />
                </span>
                <span className="relative z-10 text-sm font-medium text-white/90">
                  {portalCopy.newCanvas}
                </span>
              </a>

              {/* 图像创作 */}
              <Link
                href={`${studioBase}?tab=image`}
                title={portalCopy.imageCreation}
                className="group relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 shadow-elevation-1 hover:shadow-elevation-2"
              >
                <span
                  className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
                  style={{ backgroundImage: IMAGE_CREATION_BACKDROP }}
                />
                <span className="absolute inset-0 bg-dot-grid opacity-[0.08]" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4 sm:p-5">
                  <span className="min-w-0 flex items-center gap-2">
                    <ImageIcon className="size-4 shrink-0 text-white/70" />
                    <span className="truncate text-sm font-semibold text-white/95">
                      {portalCopy.imageCreation}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-white/40 opacity-0 transition-all duration-200 group-hover:opacity-100" />
                </span>
              </Link>

              {/* 最近云端画布 */}
              {loadingCanvasProjects
                ? Array.from({ length: 2 }).map((_, index) => (
                    <div
                      key={`canvas-skeleton-${index}`}
                      className="aspect-[16/10] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]"
                    />
                  ))
                : canvasProjects.map((project, index) => (
                    <a
                      key={project.id}
                      href={localizeStudioPath('/canvas', normLocale)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={portalCopy.openInCanvas}
                      className="group relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 shadow-elevation-1 hover:shadow-elevation-2"
                    >
                      <span
                        className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
                        style={{ backgroundImage: CANVAS_CARD_BACKDROPS[index % CANVAS_CARD_BACKDROPS.length] }}
                      />
                      <span className="absolute inset-0 bg-dot-grid opacity-[0.08]" />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                      <span className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4 sm:p-5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-white/95">
                            {project.name || portalCopy.untitledCanvas}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-white/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            {project.nodeCount || 0} {portalCopy.nodes}
                            {project.updatedAt
                              ? ` · ${new Date(project.updatedAt).toLocaleDateString(normLocale, { month: '2-digit', day: '2-digit' })}`
                              : ''}
                          </span>
                        </span>
                        <ArrowUpRight className="size-4 shrink-0 translate-y-1 -translate-x-1 text-white/40 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
                      </span>
                    </a>
                  ))}

              {/* 未登录：同步入口 */}
              {!user &&
                [0, 1].map((index) => (
                  <button
                    key={`canvas-guest-${index}`}
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="group relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25"
                  >
                    <span
                      className="absolute inset-0 opacity-55 transition-transform duration-500 group-hover:scale-105"
                      style={{
                        backgroundImage:
                          CANVAS_CARD_BACKDROPS[(index + 1) % CANVAS_CARD_BACKDROPS.length],
                      }}
                    />
                    <span className="absolute inset-0 bg-dot-grid opacity-[0.08]" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/70 transition-colors duration-200 group-hover:text-white">
                        <Lock className="size-3.5" />
                      </span>
                      <span className="text-xs font-medium text-white/65 transition-colors duration-200 group-hover:text-white/90">
                        {portalCopy.signInToSync}
                      </span>
                    </span>
                  </button>
                ))}
            </div>

            {/* 底部 Agent 输入框 */}
            <form
              onSubmit={handleCanvasPromptSubmit}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#16181d]/90 px-4 py-3 shadow-elevation-2 backdrop-blur-xl transition-colors focus-within:border-white/20 sm:px-5"
            >
              <input
                ref={canvasInputRef}
                value={canvasPrompt}
                onChange={(event) => setCanvasPrompt(event.target.value)}
                placeholder={portalCopy.canvasAgentPromptPlaceholder}
                aria-label={portalCopy.canvasAgentPromptLabel}
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-ink-subtle"
              />
              <button
                type="submit"
                disabled={!canvasPrompt.trim()}
                aria-label={portalCopy.sendToAgent}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition-all duration-200 enabled:hover:bg-white/90 enabled:active:scale-95 disabled:bg-white/10 disabled:text-white/30"
              >
                <ArrowUp className="size-4" strokeWidth={2.4} />
              </button>
            </form>

            {/* 输入框快捷操作行：添加参考 / 技能 / 主体 */}
            <div className="mt-2.5 flex items-center gap-1.5 px-1">
              <button
                type="button"
                onClick={() => handleCanvasInputAction('focus')}
                aria-label={portalCopy.addReference}
                className="flex size-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer"
              >
                <Plus className="size-4" strokeWidth={2.2} />
              </button>
              <button
                type="button"
                onClick={() => handleCanvasInputAction('skill')}
                className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer"
              >
                <Sparkles className="size-3.5 text-brand" />
                <span>{portalCopy.skills}</span>
              </button>
              <button
                type="button"
                onClick={() => handleCanvasInputAction('subject')}
                className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer"
              >
                <AtSign className="size-3.5" />
                <span>{portalCopy.subject}</span>
              </button>
            </div>

            {/* 画布模式技能工作流标签 */}
            <div className="mt-4 w-full flex items-center gap-2 overflow-x-auto py-3 no-scrollbar scrollbar-rail">
              {canvasSkillPresets.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => handleCanvasSkillClick(skill)}
                  className="h-8 px-3.5 rounded-full text-xs font-medium shrink-0 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-white/80 hover:text-white"
                >
                  <span>{skill.label}</span>
                  {skill.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      {skill.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* 生成模式高保真多功能工作室输入框控制台 */
          <HomeStudioPromptComposer
            ref={composerRef}
            locale={locale}
            skillOptions={skillPresets}
            onSkillSelect={handleSkillClick}
            onModeChange={(mode) => {
              setComposerMode(mode);
              setActiveSkillId(null);
            }}
            onTaskComplete={(task) => {
              setUserCreations((prev) => [task, ...prev]);
              setGalleryTab('user');
            }}
            onRequireAuth={(task) => {
              setPendingTask(task);
              setShowAuthModal(true);
            }}
          />
        )}

        {activeMode === 'generate' && (
          <>
        {/* 快捷技能预设胶囊推荐列表（动态联动当前选中的创作模式） */}
        <div className="w-full max-w-[1080px] flex items-center gap-2 overflow-x-auto py-3.5 no-scrollbar scrollbar-rail">
          {skillPresets.map((skill) => {
            const isActive = activeSkillId === skill.id;
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => handleSkillClick(skill)}
                className={`h-8 px-3.5 rounded-full text-xs font-medium shrink-0 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm ${
                  isActive
                    ? 'bg-brand text-white border border-brand-line shadow-elevation-1'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-white/80 hover:text-white'
                }`}
              >
                <span>{skill.label}</span>
                {skill.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : skill.badgeType === 'blue'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {skill.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 4. 底部“最近作品与精选展台”画廊卡片群 */}
        <section className="w-full max-w-[960px] mt-12 sm:mt-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-1">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-white/90 tracking-wide flex items-center gap-2">
                <Sparkles className="size-4 text-brand" />
                <span>{portalCopy.creationsAndShowcase}</span>
              </h2>

              {/* 仅在用户存在历史作品时展示切换分段器 */}
              {userCreations.length > 0 && (
                <div
                  data-pill-segmented
                  className="inline-flex items-center p-0.5 rounded-full bg-well border border-white/10"
                >
                  <button
                    type="button"
                    data-pill-segment-item
                    onClick={() => setGalleryTab('user')}
                    className={`h-6 px-3 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                      galleryTab === 'user'
                        ? 'bg-white text-black font-semibold shadow-elevation-1'
                        : 'text-ink-muted hover:text-white'
                    }`}
                  >
                    {portalCopy.myCreations(userCreations.length)}
                  </button>
                  <button
                    type="button"
                    data-pill-segment-item
                    onClick={() => setGalleryTab('featured')}
                    className={`h-6 px-3 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                      galleryTab === 'featured'
                        ? 'bg-white text-black font-semibold shadow-elevation-1'
                        : 'text-ink-muted hover:text-white'
                    }`}
                  >
                    {portalCopy.featuredCreations}
                  </button>
                </div>
              )}
            </div>

            <Link
              href={assetHref}
              className="text-xs text-ink-subtle hover:text-white transition-colors flex items-center gap-1 shrink-0"
            >
              <span>{tHome.goToAssets || pick({
                en: 'Go to Assets ›',
                'zh-CN': '前往资产库 ›',
                'zh-TW': '前往資產庫 ›',
                'ja-JP': 'アセットへ ›',
                'ko-KR': '에셋으로 이동 ›',
                es: 'Ir a Activos ›',
              }, normLocale)}</span>
            </Link>
          </div>

          {/* 选项 A：用户真实历史作品展示 */}
          {galleryTab === 'user' && userCreations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {userCreations.map((creation) => {
                const assetUrl = creation.result_url || creation.url || creation.storageUrl;
                const isVideo =
                  creation.studio_id === 'video' ||
                  creation.mediaType === 'video' ||
                  (assetUrl && (assetUrl.includes('.mp4') || assetUrl.includes('.webm')));
                const isAudio =
                  creation.studio_id === 'audio' ||
                  creation.mediaType === 'audio' ||
                  (assetUrl && (assetUrl.includes('.mp3') || assetUrl.includes('.wav')));

                return (
                  <div
                    key={creation.id}
                    className="group relative h-52 rounded-xl overflow-hidden border border-white/10 hover:border-brand-line bg-[#16181e] transition-all duration-300 hover:-translate-y-1 shadow-elevation-2 flex flex-col justify-between p-3.5"
                  >
                    {/* 背景媒体展示 */}
                    {assetUrl ? (
                      isVideo ? (
                        <video
                          src={assetUrl}
                          className="absolute inset-0 w-full h-full object-cover"
                          muted
                          loop
                          playsInline
                          onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                        />
                      ) : isAudio ? (
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/60 via-purple-950/40 to-black/80 flex items-center justify-center">
                          <Volume2 className="size-10 text-brand/40 animate-pulse" />
                        </div>
                      ) : (
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                          style={{ backgroundImage: `url(${assetUrl})` }}
                        />
                      )
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-black flex items-center justify-center">
                        <ImageIcon className="size-8 text-white/20" />
                      </div>
                    )}

                    {/* 暗黑渐变覆盖层 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent group-hover:from-black/95 transition-all" />

                    {/* 顶部状态与类型角标 */}
                    <div className="relative z-10 flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[10px] font-semibold text-white/90">
                        {creation.studio_id || creation.mediaType || 'AI 创作'}
                      </span>
                      {creation.status === 'succeeded' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300">
                          {portalCopy.statusDone}
                        </span>
                      ) : creation.status === 'processing' ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-semibold text-amber-300 animate-pulse">
                          {portalCopy.statusProcessing}
                        </span>
                      ) : creation.status === 'failed' ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-[10px] font-semibold text-rose-300">
                          {portalCopy.statusFailed}
                        </span>
                      ) : null}
                    </div>

                    {/* 底部悬浮控制栏与提示词摘要 */}
                    <div className="relative z-10 flex flex-col gap-2">
                      <p className="text-xs text-white/90 font-medium line-clamp-2 leading-relaxed">
                        {creation.prompt || portalCopy.noPromptText}
                      </p>

                      {/* 鼠标悬浮时展示便捷操作 */}
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pt-1">
                        <button
                          type="button"
                          onClick={() => handleApplyUserCreation(creation)}
                          className="flex-1 h-7 rounded-lg bg-brand hover:bg-brand-hover text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Wand2 className="size-3" />
                          <span>{portalCopy.remix}</span>
                        </button>

                        {assetUrl && (
                          <a
                            href={localizeStudioPath(`/canvas?importAsset=${encodeURIComponent(assetUrl)}`, normLocale)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title={portalCopy.openInCanvas}
                          >
                            <Layers className="size-3" />
                          </a>
                        )}

                        {assetUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewModalItem(creation)}
                            className="size-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                            title={portalCopy.preview}
                          >
                            <Maximize2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 选项 B：平台精选创作展台卡片群 */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {recentFeatures.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleFeatureCardClick(item)}
                  className="group relative h-48 rounded-xl overflow-hidden border border-white/10 hover:border-brand-line bg-[#16181e] cursor-pointer transition-all duration-300 hover:-translate-y-1 shadow-elevation-2 flex flex-col justify-end p-4"
                >
                  {/* 封面背景与半透明遮罩 */}
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${item.bgImage})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 group-hover:from-black/95 transition-all" />

                  {/* 角标 */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  </div>

                  {/* 卡片文字信息 */}
                  <div className="relative z-10 flex flex-col gap-1">
                    <h3 className="text-sm font-bold text-white leading-snug whitespace-pre-line group-hover:text-brand-hover transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-white/60 line-clamp-1 font-normal">
                      {item.author || item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
          </>
        )}
      </main>

      {/* 底部极简 Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-ink-subtle/50 border-t border-white/[0.04]">
        <span>SupDance · Premium AI Creative Workspace</span>
      </footer>

      {/* 全屏媒体预览弹窗 */}
      {previewModalItem && (
        <div
          onClick={() => setPreviewModalItem(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] rounded-2xl bg-surface border border-white/15 p-2 shadow-elevation-4 overflow-hidden flex flex-col cursor-default"
          >
            <button
              type="button"
              onClick={() => setPreviewModalItem(null)}
              className="absolute top-4 right-4 z-10 size-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="size-4" />
            </button>

            {previewModalItem.studio_id === 'video' ||
            previewModalItem.mediaType === 'video' ||
            (previewModalItem.result_url && previewModalItem.result_url.includes('.mp4')) ? (
              <video
                src={previewModalItem.result_url || previewModalItem.url}
                controls
                autoPlay
                className="max-h-[75vh] w-auto rounded-xl object-contain mx-auto"
              />
            ) : previewModalItem.studio_id === 'audio' ||
              previewModalItem.mediaType === 'audio' ||
              (previewModalItem.result_url && previewModalItem.result_url.includes('.mp3')) ? (
              <div className="p-8 flex flex-col items-center gap-4">
                <Volume2 className="size-16 text-brand" />
                <audio
                  src={previewModalItem.result_url || previewModalItem.url}
                  controls
                  autoPlay
                  className="w-full max-w-md"
                />
              </div>
            ) : (
              <img
                src={previewModalItem.result_url || previewModalItem.url}
                alt=""
                className="max-h-[75vh] w-auto rounded-xl object-contain mx-auto select-none"
              />
            )}

            <div className="p-4 flex items-center justify-between border-t border-white/10 mt-2 gap-4">
              <p className="text-xs text-white/80 line-clamp-2">{previewModalItem.prompt}</p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleApplyUserCreation(previewModalItem);
                    setPreviewModalItem(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Wand2 className="size-3.5" />
                  <span>{portalCopy.remix}</span>
                </button>
                <a
                  href={localizeStudioPath(`/canvas?importAsset=${encodeURIComponent(previewModalItem.result_url || previewModalItem.url || '')}`, normLocale)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Layers className="size-3.5" />
                  <span>{portalCopy.openInCanvas}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {!user && googleOneTapEligible && <GoogleOneTap eligible />}

      {/* 登录弹窗 */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={handleAuthClose}
          onSuccess={handleAuthSuccess}
          locale={locale}
        />
      )}
    </div>
  );
}
