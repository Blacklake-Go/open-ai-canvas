/**
 * 入驻画像的唯一契约：枚举、运营标签、人群短码与校验都从这里出。
 *
 * 每个维度都必须是受控枚举，因为它要作为「自述 vs 行为」偏差分析的基线：
 * 只有取值可枚举，后续才能把用户实际登录/生成频次和他自选的 commitment
 * 档位对齐，或用 style_codes 衡量用户是否跳出舒适风格。
 */

export const ONBOARDING_SCHEMA_VERSION = 3;
export const ONBOARDING_STEP_IDENTITY = 1;
export const ONBOARDING_STEP_PREFERENCE = 2;

/**
 * 完成问卷的一次性积分奖励。放在这里是因为客户端要把它印在按钮上，
 * 而 schema.js 是唯一一个零依赖、两端都能 import 的模块。
 * 实发数额以 /api/user/onboarding 返回的 rewardCredits 为准。
 */
export const ONBOARDING_REWARD_CREDITS = 50;

/** 昵称：与 display_name 列的 50 字符上限留足余量 */
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 24;

/**
 * 每个选项按注册表语言码各存一份标签：`label` 是简体中文（并且是 occupation_label
 * 列的入库值，语义不可挪作他用），`labelEn` 是英文兜底，其余四档由
 * lib/onboarding/copy.js 按码取用。缺任何一档都会被 P0 闸门判红。
 */
export const OCCUPATIONS = [
  // 3.0 两步式全新受控职业枚举（严格对齐 Runow 引导设计基准）
  {
    code: 'media_culture',
    tagId: 'tag_occ_media',
    persona: 'MEDIA',
    icon: 'Clapperboard',
    label: '影视传媒',
    labelEn: 'Media & culture',
    labelTw: '影視傳媒',
    labelJa: '映像・メディア',
    labelKo: '영상·미디어',
    labelEs: 'Cine y medios',
    desc: '传统媒体、影视、游戏等',
    descEn: 'Traditional media, film & TV, gaming, etc.',
    descTw: '傳統媒體、影視、遊戲等',
    descJa: '従来メディア、映画・TV、ゲーム等',
    descKo: '전통 미디어, 영화·방송, 게임 등',
    descEs: 'Medios tradicionales, cine, TV, videojuegos',
  },
  {
    code: 'content_creator',
    tagId: 'tag_occ_creator',
    persona: 'CREATOR',
    icon: 'Camera',
    label: '自媒体创作者',
    labelEn: 'Content creator',
    labelTw: '自媒體創作者',
    labelJa: 'コンテンツクリエイター',
    labelKo: '콘텐츠 크리에이터',
    labelEs: 'Creador de contenido',
    desc: '图文、短视频等',
    descEn: 'Articles, short videos, etc.',
    descTw: '圖文、短影音等',
    descJa: '記事、ショート動画等',
    descKo: '글, 숏폼 영상 등',
    descEs: 'Artículos, vídeos cortos, etc.',
  },
  {
    code: 'freelancer',
    tagId: 'tag_occ_freelance',
    persona: 'FREE',
    icon: 'PenTool',
    label: '自由职业者',
    labelEn: 'Freelancer',
    labelTw: '自由職業者',
    labelJa: 'フリーランス',
    labelKo: '프리랜서',
    labelEs: 'Freelancer',
    desc: '独立摄影师、撰稿人等',
    descEn: 'Independent photographers, writers, etc.',
    descTw: '獨立攝影師、撰稿人等',
    descJa: '独立カメラマン、ライター等',
    descKo: '독립 사진가, 작가 등',
    descEs: 'Fotógrafos independientes, redactores, etc.',
  },
  {
    code: 'art_design',
    tagId: 'tag_occ_design',
    persona: 'DESIGN',
    icon: 'Palette',
    label: '艺术与设计',
    labelEn: 'Art & design',
    labelTw: '藝術與設計',
    labelJa: 'アート・デザイン',
    labelKo: '예술·디자인',
    labelEs: 'Arte y diseño',
    desc: '动画、插画、平面设计等',
    descEn: 'Animation, illustration, graphic design, etc.',
    descTw: '動畫、插畫、平面設計等',
    descJa: 'アニメ、イラスト、グラフィック等',
    descKo: '애니메이션, 일러스트, 그래픽 디자인 등',
    descEs: 'Animación, ilustración, diseño gráfico, etc.',
  },
  {
    code: 'education_training',
    tagId: 'tag_occ_edu',
    persona: 'EDU',
    icon: 'BookOpen',
    label: '教育与培训',
    labelEn: 'Education & training',
    labelTw: '教育與培訓',
    labelJa: '教育・研修',
    labelKo: '교육·트레이닝',
    labelEs: 'Educación y formación',
    desc: '教师、AIGC 培训等',
    descEn: 'Teachers, AIGC training, etc.',
    descTw: '教師、AIGC 培訓等',
    descJa: '講師、AIGC研修等',
    descKo: '교사, AIGC 교육 등',
    descEs: 'Docentes, formación AIGC, etc.',
  },
  {
    code: 'ad_marketing',
    tagId: 'tag_occ_marketing',
    persona: 'MKT',
    icon: 'Megaphone',
    label: '广告与营销',
    labelEn: 'Advertising & marketing',
    labelTw: '廣告與行銷',
    labelJa: '広告・マーケティング',
    labelKo: '광고·마케팅',
    labelEs: 'Publicidad y marketing',
    desc: '广告营销、电商等',
    descEn: 'Advertising, e-commerce, etc.',
    descTw: '廣告行銷、電商等',
    descJa: '広告・PR、EC運用等',
    descKo: '광고, 마케팅, 이커머스 등',
    descEs: 'Publicidad, e-commerce, etc.',
  },
  {
    code: 'technology',
    tagId: 'tag_occ_tech',
    persona: 'TECH',
    icon: 'Code',
    label: '技术研发',
    labelEn: 'Technology',
    labelTw: '技術研發',
    labelJa: '技術・エンジニア',
    labelKo: '기술·개발',
    labelEs: 'Tecnología',
    desc: '软件开发、产品运营等',
    descEn: 'Software development, product operations, etc.',
    descTw: '軟體開發、產品運營等',
    descJa: 'ソフトウェア開発、プロダクト運用等',
    descKo: '소프트웨어 개발, 프로덕트 운영 등',
    descEs: 'Desarrollo de software, operaciones de producto, etc.',
  },
  {
    code: 'student',
    tagId: 'tag_occ_student',
    persona: 'STUDENT',
    icon: 'GraduationCap',
    label: '学生',
    labelEn: 'Student',
    labelTw: '學生',
    labelJa: '学生',
    labelKo: '학생',
    labelEs: 'Estudiante',
    desc: '在校学生、学习进修等',
    descEn: 'Students and learners',
    descTw: '在校學生、學習進修等',
    descJa: '在学生、学習中の方等',
    descKo: '재학생, 학습자 등',
    descEs: 'Estudiantes y personas en formación',
  },
  {
    code: 'other',
    tagId: 'tag_occ_other',
    persona: 'OTHER',
    icon: 'MoreHorizontal',
    label: '其他领域',
    labelEn: 'Other',
    labelTw: '其他領域',
    labelJa: 'その他',
    labelKo: '기타',
    labelEs: 'Otro',
    desc: '其他自定义职业领域',
    descEn: 'Describe it in your own words',
    descTw: '其他自定義職業領域',
    descJa: 'その他の分野',
    descKo: '직접 입력 또는 기타 분야',
    descEs: 'Descríbelo con tus palabras',
  },
  // 兼容存量历史枚举映射
  { code: 'pro', tagId: 'tag_occ_pro', persona: 'PRO', icon: 'Clapperboard', label: '影视 / 广告从业者', labelEn: 'Film & ad professional', labelTw: '影視 / 廣告從業者', labelJa: '映像・広告クリエイター', labelKo: '영상·광고 종사자', labelEs: 'Profesional de cine y publicidad', desc: '商业短片、TVC、MV 等交付型项目', descEn: 'Client work, TVC, music video', descTw: '商業短片、TVC、MV 等交付型專案', descJa: 'CM・MVなど受託案件中心', descKo: '상업 영상, TVC, MV 등 납품 프로젝트', descEs: 'Spot publicitarios, videoclips y encargos' },
  { code: 'designer', tagId: 'tag_occ_semi', persona: 'SEMI', icon: 'PenTool', label: '设计师 / 插画师', labelEn: 'Designer / illustrator', labelTw: '設計師 / 插畫師', labelJa: 'デザイナー・イラストレーター', labelKo: '디자이너·일러스트레이터', labelEs: 'Diseñador e ilustrador', desc: '视觉、角色、平面与概念设定', descEn: 'Visual, character & concept art', descTw: '視覺、角色、平面與概念設定', descJa: 'ビジュアル・キャラクター・コンセプト設計', descKo: '비주얼, 캐릭터, 평면 및 컨셉 설정', descEs: 'Arte visual, de personajes y conceptual' },
  { code: 'content_ops', tagId: 'tag_occ_ops', persona: 'OPS', icon: 'Smartphone', label: '自媒体 / 电商运营', labelEn: 'Creator & e-commerce ops', labelTw: '新媒體 / 電商運營', labelJa: 'メディア・EC運営', labelKo: '콘텐츠·이커머스 운영', labelEs: 'Creador y e-commerce', desc: '账号内容矩阵、商品主图与详情', descEn: 'Social channels & product visuals', descTw: '帳號內容矩陣、商品主圖與詳情', descJa: 'アカウント運用と商品画像制作', descKo: '계정 콘텐츠 매트릭스, 상품 상세 이미지', descEs: 'Contenidos de canal y fichas de producto' },
  { code: 'game_art', tagId: 'tag_occ_game', persona: 'GAME', icon: 'Gamepad2', label: '游戏 / 动漫美术', labelEn: 'Game & anime artist', labelTw: '遊戲 / 動漫美術', labelJa: 'ゲーム・アニメ美術', labelKo: '게임·애니메이션 아트', labelEs: 'Artista de videojuegos y anime', desc: '角色、场景、道具资产量产', descEn: 'In-game asset production', descTw: '角色、場景、道具資產量產', descJa: 'キャラ・背景・小物アセットの量産', descKo: '캐릭터, 배경, 아이템 애셋 대량 생산', descEs: 'Producción en serie de assets' },
];

/** 目的按用户排序提交，purposeCodes[0] 即 primary，也是人群短码第二段 */
export const PURPOSES = [
  // 3.0 两步式全新创作目的枚举（严格对齐 Runow 引导设计基准）
  {
    code: 'self_media',
    tagId: 'tag_pur_self_media',
    persona: 'SMEDIA',
    icon: 'Camera',
    label: '自媒体内容创作',
    labelEn: 'Self-media content creation',
    labelTw: '自媒體內容創作',
    labelJa: 'メディアコンテンツ制作',
    labelKo: '콘텐츠 제작',
    labelEs: 'Creación de contenido propio',
    desc: '短视频、社交媒体内容等',
    descEn: 'Short videos, social media content',
    descTw: '短影音、社群媒體內容等',
    descJa: 'ショート動画、SNSコンテンツ等',
    descKo: '숏폼 영상, 소셜 미디어 콘텐츠 등',
    descEs: 'Vídeos cortos, contenido para redes',
  },
  {
    code: 'ad_content',
    tagId: 'tag_pur_ad_content',
    persona: 'AD',
    icon: 'Megaphone',
    label: '商业广告创意',
    labelEn: 'Ad content creation',
    labelTw: '商業廣告創意',
    labelJa: '広告クリエイティブ',
    labelKo: '광고 콘텐츠 제작',
    labelEs: 'Creación publicitaria',
    desc: '商业广告、商品宣传片等',
    descEn: 'Commercials, product ads',
    descTw: '商業廣告、商品宣傳片等',
    descJa: '商業広告、商品プロモーション動画等',
    descKo: '상업 광고, 상품 홍보 영상 등',
    descEs: 'Spots comerciales, anuncios de producto',
  },
  {
    code: 'film_video',
    tagId: 'tag_pur_film_video',
    persona: 'FILM',
    icon: 'Film',
    label: '影视短片制作',
    labelEn: 'Film & video production',
    labelTw: '影視短片製作',
    labelJa: '映画・短編映像制作',
    labelKo: '영화·영상 제작',
    labelEs: 'Producción cinematográfica y de vídeo',
    desc: '微电影、短剧、故事片等',
    descEn: 'Short dramas, micro films, etc.',
    descTw: '微電影、短劇、故事片等',
    descJa: 'ショートドラマ、短編映画等',
    descKo: '숏드라마, 마이크로 필름 등',
    descEs: 'Microcortos, series cortas, ficción',
  },
  {
    code: 'product_design',
    tagId: 'tag_pur_prod_design',
    persona: 'PROD',
    icon: 'Monitor',
    label: '产品设计',
    labelEn: 'Product design',
    labelTw: '產品設計',
    labelJa: 'プロダクトデザイン',
    labelKo: '프로덕트 디자인',
    labelEs: 'Diseño de producto',
    desc: 'App UI、网页设计、产品原型等',
    descEn: 'App UI, web design, prototypes, etc.',
    descTw: 'App UI、網頁設計、產品原型等',
    descJa: 'アプリUI、Webデザイン、モックアップ等',
    descKo: '앱 UI, 웹 디자인, 프로토타입 등',
    descEs: 'UI de apps, diseño web, prototipos',
  },
  {
    code: 'personal_interest',
    tagId: 'tag_pur_interest',
    persona: 'INT',
    icon: 'Palette',
    label: '个人兴趣',
    labelEn: 'Personal interests',
    labelTw: '個人興趣',
    labelJa: '個人の趣味',
    labelKo: '개인적 관심사',
    labelEs: 'Intereses personales',
    desc: '生活记录、艺术创作等',
    descEn: 'Life logging, artistic creation',
    descTw: '生活記錄、藝術創作等',
    descJa: 'ライフログ、自由な創作活動等',
    descKo: '일상 기록, 예술적 창작 등',
    descEs: 'Diario de vida, creación artística libre',
  },
  {
    code: 'creative_inspiration',
    tagId: 'tag_pur_inspiration',
    persona: 'INSP',
    icon: 'Lightbulb',
    label: '创意灵感',
    labelEn: 'Creative inspiration',
    labelTw: '創意靈感',
    labelJa: 'クリエイティブインスピレーション',
    labelKo: '창의적 영감',
    labelEs: 'Inspiración creativa',
    desc: '创意素材、灵感探索等',
    descEn: 'Creative assets, inspiration',
    descTw: '創意素材、靈感探索等',
    descJa: '素材収集、アイデア発想等',
    descKo: '크리에이티브 애셋, 영감 수집 등',
    descEs: 'Recursos creativos, búsqueda de ideas',
  },
  {
    code: 'aigc_training',
    tagId: 'tag_pur_aigc_training',
    persona: 'TRAIN',
    icon: 'GraduationCap',
    label: 'AIGC 培训与教学',
    labelEn: 'AIGC training & teaching',
    labelTw: 'AIGC 培訓與教學',
    labelJa: 'AIGC教育・研修',
    labelKo: 'AIGC 교육 및 학습',
    labelEs: 'Formación y enseñanza AIGC',
    desc: 'AI 视频教程、教学课件等',
    descEn: 'AI video tutorials, etc.',
    descTw: 'AI 影音教學、課件等',
    descJa: 'AI動画チュートリアル、講義資料等',
    descKo: 'AI 영상 튜토리얼, 강의 자료 등',
    descEs: 'Tutoriales de vídeo IA, material docente',
  },
  {
    code: 'other',
    tagId: 'tag_pur_other',
    persona: 'OTHER',
    icon: 'MoreHorizontal',
    label: '其他方向',
    labelEn: 'Other',
    labelTw: '其他方向',
    labelJa: 'その他',
    labelKo: '기타',
    labelEs: 'Otro',
    desc: '其他自定义创作方向',
    descEn: 'Describe it in your own words',
    descTw: '其他自定義創作方向',
    descJa: 'その他の創作用途',
    descKo: '직접 입력 또는 기타',
    descEs: 'Descríbelo con tus palabras',
  },
  // 兼容存量历史目的
  { code: 'commercial', tagId: 'tag_pur_commercial', persona: 'COM', icon: 'Briefcase', label: '商业交付与变现', labelEn: 'Commercial delivery', labelTw: '商業交付與變現', labelJa: '商業案件と収益化', labelKo: '상업적 납품과 수익화', labelEs: 'Entrega comercial e ingresos', desc: '接单、交付客户、直接产生收入', descEn: 'Paid work and deliveries', descTw: '接單、交付客戶、直接產生收入', descJa: '受注から納品、直接の収入源に', descKo: '수주와 클라이언트 납품, 직접 수익 창출', descEs: 'Encargos y entregas que generan ingresos' },
  { code: 'growth', tagId: 'tag_pur_growth', persona: 'GRW', icon: 'TrendingUp', label: '涨粉与内容增长', labelEn: 'Audience growth', labelTw: '漲粉與內容增長', labelJa: 'フォロワー・コンテンツ成長', labelKo: '팔로워 및 콘텐츠 성장', labelEs: 'Crecimiento de audiencia', desc: '运营账号、追求播放与互动', descEn: 'Channels, views and reach', descTw: '運營帳號、追求播放與互動', descJa: 'チャンネル運用と再生・エンゲージメント', descKo: '계정 운영, 조회수와 반응 확대', descEs: 'Canales, visitas e interacción' },
  { code: 'learning', tagId: 'tag_pur_learning', persona: 'LRN', icon: 'BookOpen', label: '学习与技能提升', labelEn: 'Skill building', labelTw: '學習與技能提升', labelJa: '学習とスキル向上', labelKo: '학습과 기술 향상', labelEs: 'Aprendizaje y mejora técnica', desc: '掌握工作流与新的创作手法', descEn: 'Mastering new workflows', descTw: '掌握工作流與新的創作手法', descJa: 'ワークフローと新しい制作手法の習得', descKo: '워크플로우와 새로운 창작 기법 습득', descEs: 'Dominar nuevos flujos de trabajo' },
  { code: 'fun', tagId: 'tag_pur_fun', persona: 'FUN', icon: 'Smile', label: '个人兴趣与自娱', labelEn: 'Personal enjoyment', labelTw: '個人興趣與自娛', labelJa: '趣味と自分楽しみ', labelKo: '개인 취미와 즐거움', labelEs: 'Disfrute personal', desc: '不为产出，玩自己想玩的', descEn: 'Making things for fun', descTw: '不為產出，玩自己想玩的', descJa: '成果を考えず、遊びたいものを作る', descKo: '성과를 따지지 않고 하고 싶은 것 만들기', descEs: 'Crear por placer, sin buscar resultados' },
  { code: 'prototype', tagId: 'tag_pur_prototype', persona: 'PRT', icon: 'FlaskConical', label: '提案与快速原型', labelEn: 'Pitch & prototyping', labelTw: '提案與快速原型', labelJa: 'プレゼンと高速プロトタイプ', labelKo: '제안과 빠른 프로토타입', labelEs: 'Presentaciones y prototipos', desc: '方案可视化、分镜与情绪板', descEn: 'Pitches, storyboards, moodboards', descTw: '方案可視化、分鏡與情緒板', descJa: '企画の可視化、絵コンテ、ムードボード', descKo: '기획 시각화, 스토리보드, 무드보드', descEs: 'Guiones visuales y tableros de ambiente' },
  { code: 'community', tagId: 'tag_pur_community', persona: 'CMS', icon: 'Users', label: '社区分享与协作', labelEn: 'Community & collab', labelTw: '社區分享與協作', labelJa: 'コミュニティ共有とコラボ', labelKo: '커뮤니티 공유와 협업', labelEs: 'Comunidad y colaboración', desc: '发布作品、参与共创与活动', descEn: 'Publishing and co-creating', descTw: '發布作品、參與共創與活動', descJa: '作品発表、共創イベントへの参加', descKo: '작품 공개와 공동 창작 활동', descEs: 'Publicar obras y co-crear' },
];

/** 自述投入频次 —— 活跃度偏差分的锚点 */
export const COMMITMENTS = [
  { code: 'daily', tagId: 'tag_cmt_daily', persona: 'D', label: '几乎每天', labelEn: 'Nearly every day', labelTw: '幾乎每天', labelJa: 'ほぼ毎日', labelKo: '거의 매일', labelEs: 'Casi a diario', desc: '每天或每个工作日都会创作', descEn: 'Every working day', descTw: '每天或每個工作日都會創作', descJa: '毎日または平日ごとに制作', descKo: '매일 또는 근무일마다 창작', descEs: 'Todos los días laborables' },
  { code: 'weekly_high', tagId: 'tag_cmt_weekly_high', persona: 'W', label: '每周 3–4 次', labelEn: '3–4 times a week', labelTw: '每週 3–4 次', labelJa: '週 3〜4 回', labelKo: '주 3~4회', labelEs: '3–4 veces por semana', desc: '有稳定的节奏和明确的项目', descEn: 'A steady weekly rhythm', descTw: '有穩定的節奏和明確的專案', descJa: '安定したペースと明確な案件がある', descKo: '안정적인 리듬과 명확한 프로젝트', descEs: 'Un ritmo semanal estable' },
  { code: 'weekly_low', tagId: 'tag_cmt_weekly_low', persona: 'Q', label: '每周 1–2 次', labelEn: '1–2 times a week', labelTw: '每週 1–2 次', labelJa: '週 1〜2 回', labelKo: '주 1~2회', labelEs: '1–2 veces por semana', desc: '有空时集中做一阵', descEn: 'When time allows', descTw: '有空時集中做一陣', descJa: '時間が空いた時にまとめて制作', descKo: '시간이 날 때 몰아서 작업', descEs: 'Cuando el tiempo lo permite' },
  { code: 'monthly', tagId: 'tag_cmt_monthly', persona: 'M', label: '每月几次', labelEn: 'A few times a month', labelTw: '每月幾次', labelJa: '月数回', labelKo: '월 몇 회', labelEs: 'Algunas veces al mes', desc: '按需使用，不固定', descEn: 'On demand', descTw: '按需使用，不固定', descJa: '必要に応じて、不定期', descKo: '필요할 때마다, 비정기', descEs: 'Solo cuando hace falta' },
  { code: 'browsing', tagId: 'tag_cmt_browsing', persona: 'B', label: '先看看再说', labelEn: 'Just exploring', labelTw: '先看看再說', labelJa: 'とりあえず見学', labelKo: '일단 살펴보는 중', labelEs: 'Solo echando un vistazo', desc: '还在评估能不能帮到我', descEn: 'Still evaluating', descTw: '還在評估能不能幫到我', descJa: 'まだ役立つか見極め中', descKo: '아직 도움이 될지 평가 중', descEs: 'Aún valoro si me servirá' },
];

export const STYLES = [
  { code: 'realistic', tagId: 'tag_sty_realistic', persona: 'REAL', icon: 'Camera', label: '写实人像', labelEn: 'Photoreal', labelTw: '寫實人像', labelJa: 'リアルな人物', labelKo: '사실적 인물', labelEs: 'Retrato fotorrealista' },
  { code: 'anime', tagId: 'tag_sty_anime', persona: 'ANIME', icon: 'WandSparkles', label: '二次元', labelEn: 'Anime', labelTw: '二次元', labelJa: 'アニメ', labelKo: '애니메이션', labelEs: 'Anime' },
  { code: 'cg', tagId: 'tag_sty_3d', persona: 'CG', icon: 'Box', label: '3D / CG', labelEn: '3D & CG', labelTw: '3D / CG', labelJa: '3D・CG', labelKo: '3D·CG', labelEs: '3D y CG' },
  { code: 'guofeng', tagId: 'tag_sty_guofeng', persona: 'CN', icon: 'Feather', label: '国风水墨', labelEn: 'Chinese ink', labelTw: '國風水墨', labelJa: '国風・水墨', labelKo: '국풍 수묵', labelEs: 'Tinta china' },
  { code: 'scifi', tagId: 'tag_sty_scifi', persona: 'CYBER', icon: 'Rocket', label: '科幻赛博', labelEn: 'Sci-fi & cyber', labelTw: '科幻賽博', labelJa: 'SF・サイバー', labelKo: 'SF·사이버', labelEs: 'Ciencia ficción cyber' },
  { code: 'product', tagId: 'tag_sty_product', persona: 'PROD', icon: 'Package', label: '产品静物', labelEn: 'Product still life', labelTw: '產品靜物', labelJa: 'プロダクト静物', labelKo: '제품 정물', labelEs: 'Bodegón de producto' },
  { code: 'scene', tagId: 'tag_sty_scene', persona: 'SCENE', icon: 'Mountain', label: '场景概念', labelEn: 'Environment concept', labelTw: '場景概念', labelJa: '環境コンセプト', labelKo: '배경 컨셉', labelEs: 'Concepto de entorno' },
  { code: 'cozy', tagId: 'tag_sty_cozy', persona: 'COZY', icon: 'Coffee', label: '治愈插画', labelEn: 'Cozy illustration', labelTw: '治癒插畫', labelJa: '癒し系イラスト', labelKo: '힐링 일러스트', labelEs: 'Ilustración reconfortante' },
];

/**
 * 用途授权边界声明
 */
export const USAGE_INTENTS = [
  { code: 'personal', tagId: 'tag_use_personal', label: '仅个人自用', labelEn: 'Personal use only', labelTw: '僅個人自用', labelJa: '個人利用のみ', labelKo: '개인 용도만', labelEs: 'Solo uso personal', desc: '不对外发布，也不商用', descEn: 'Not published or sold', descTw: '不對外發布，也不商用', descJa: '公開も商用もしない', descKo: '외부 공개나 상업적 사용 없음', descEs: 'Ni publicado ni comercial' },
  { code: 'internal_work', tagId: 'tag_use_internal_work', label: '团队内部使用', labelEn: 'Internal team use', labelTw: '團隊內部使用', labelJa: 'チーム社内利用', labelKo: '팀 내부 사용', labelEs: 'Uso interno del equipo', desc: '用于公司或团队内部交付', descEn: 'Within my organisation', descTw: '用於公司或團隊內部交付', descJa: '会社・チーム内の納品用', descKo: '회사 또는 팀 내부 납품용', descEs: 'Para entregas dentro de la organización' },
  { code: 'commercial', tagId: 'tag_use_commercial', label: '对外商用发布', labelEn: 'Public commercial use', labelTw: '對外商用發布', labelJa: '社外での商用公開', labelKo: '외부 상업 공개', labelEs: 'Uso comercial público', desc: '会公开发布或投放', descEn: 'Published and monetised', descTw: '會對外發布或投放', descJa: '一般公開や広告出稿を行う', descKo: '대외 공개 또는 광고 집행', descEs: 'Se publica o se anuncia' },
  { code: 'public_release', label: '公开发布但不商用', labelEn: 'Public, non-commercial', labelTw: '公開發布但不商用', labelJa: '公開するが商用しない', labelKo: '공개하지만 비상업', labelEs: 'Público pero no comercial', desc: '社区展示、参赛、分享', descEn: 'Showcase and contests', descTw: '社區展示、參賽、分享', descJa: 'コミュニティ展示、コンテスト、共有', descKo: '커뮤니티 전시, 대회 참여, 공유', descEs: 'Muestras, concursos y compartir' },
];

/** 性别只在个人主页补全，引导页不采集 */
export const GENDER_OPTIONS = [
  { code: 'female', label: '女性', labelEn: 'Female' },
  { code: 'male', label: '男性', labelEn: 'Male' },
  { code: 'non_binary', label: '非二元性别', labelEn: 'Non-binary' },
  { code: 'prefer_not_to_say', label: '暂不透露', labelEn: 'Prefer not to say' },
];

export const GENDERS = GENDER_OPTIONS.map((option) => option.code);

export const COUNTRY_CODES = [
  'CN', 'HK', 'TW', 'JP', 'KR', 'SG', 'MY', 'TH', 'VN', 'ID', 'PH', 'IN', 'AE', 'SA',
  'US', 'CA', 'MX', 'BR', 'GB', 'IE', 'FR', 'DE', 'ES', 'PT', 'IT', 'NL', 'BE', 'SE',
  'NO', 'DK', 'FI', 'PL', 'CH', 'AT', 'UA', 'RU', 'TR', 'ZA', 'EG', 'NG', 'KE', 'AU', 'NZ',
];

/** 默认头像库：按 user_number 哈希确定性预选 */
export const DEFAULT_AVATAR_COUNT = 8;
export const DEFAULT_AVATAR_BASE = '/assets/avatars';

export function defaultAvatarAt(index) {
  const normalized = ((Math.trunc(index) % DEFAULT_AVATAR_COUNT) + DEFAULT_AVATAR_COUNT) % DEFAULT_AVATAR_COUNT;
  return `${DEFAULT_AVATAR_BASE}/default-${String(normalized + 1).padStart(2, '0')}.svg`;
}

export function defaultAvatarUrl(seed) {
  const digits = String(seed ?? '').replace(/\D/g, '');
  const sum = [...digits].reduce((acc, ch) => acc + Number(ch), 0);
  return defaultAvatarAt(digits ? sum : 0);
}

const byCode = (list) => Object.fromEntries(list.map((item) => [item.code, item]));
export const OCCUPATION_MAP = byCode(OCCUPATIONS);
export const PURPOSE_MAP = byCode(PURPOSES);
export const COMMITMENT_MAP = byCode(COMMITMENTS);
export const STYLE_MAP = byCode(STYLES);
export const USAGE_INTENT_MAP = byCode(USAGE_INTENTS);

export const PURPOSE_MAX = 3;
export const PURPOSE_MIN = 1;
export const STYLE_MAX = 4;
export const STYLE_MIN = 2;

/**
 * 人群短码 = 职业档-主目的-强度档-主风格，例 `MEDIA-SMEDIA-B-GEN`。
 */
export function buildPersonaCode({ occupation, purposeCodes, commitment, styleCodes }) {
  const occPart = OCCUPATION_MAP[occupation]?.persona || 'CREATOR';
  const purPart = PURPOSE_MAP[purposeCodes?.[0]]?.persona || 'CREATIVE';
  const cmtPart = COMMITMENT_MAP[commitment]?.persona || 'B';
  const styPart = STYLE_MAP[styleCodes?.[0]]?.persona || 'GEN';
  return `${occPart}-${purPart}-${cmtPart}-${styPart}`;
}

function cleanCodes(value, allowed, max) {
  if (!Array.isArray(value)) return null;
  const seen = [];
  for (const raw of value) {
    const code = typeof raw === 'string' ? raw : '';
    if (!allowed[code] || seen.includes(code)) continue;
    seen.push(code);
    if (seen.length >= max) break;
  }
  return seen;
}

/**
 * 归一化画像答案。兼容两步式精简问卷与多维深度问卷。
 */
export function normalizePreferenceAnswers(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const occupation = typeof source.occupation === 'string' ? source.occupation : '';
  if (!OCCUPATION_MAP[occupation]) return { error: '请选择你的主要工作领域' };

  // 创作目的 / 场景：支持单选 purpose 或多选 purposeCodes
  let purposeCodes = [];
  if (typeof source.purpose === 'string' && PURPOSE_MAP[source.purpose]) {
    purposeCodes = [source.purpose];
  } else if (Array.isArray(source.purposeCodes)) {
    purposeCodes = cleanCodes(source.purposeCodes, PURPOSE_MAP, PURPOSE_MAX) || [];
  }
  if (!purposeCodes || purposeCodes.length < 1) return { error: '请选择你的主要创作场景' };

  // 频次、用途、风格可选，兜底使用受控合规值，确保满足 Postgres CHECK 约束
  const commitment = (typeof source.commitment === 'string' && COMMITMENT_MAP[source.commitment])
    ? source.commitment
    : 'browsing';

  const usageIntent = (typeof source.usageIntent === 'string' && USAGE_INTENT_MAP[source.usageIntent])
    ? source.usageIntent
    : 'personal';

  const styleCodes = Array.isArray(source.styleCodes)
    ? (cleanCodes(source.styleCodes, STYLE_MAP, STYLE_MAX) || [])
    : [];

  const customText = typeof source.customText === 'string' ? source.customText.slice(0, 100).trim() : '';

  return {
    value: {
      occupation,
      occupationLabel: OCCUPATION_MAP[occupation].label,
      purposeCodes,
      commitment,
      styleCodes,
      usageIntent,
      allowTraining: source.allowTraining === true,
      customText,
    },
  };
}

/** 提交时同步落到 ops_bill.tags 的运营标签 */
export function tagIdsForPreferences({ occupation, purposeCodes, commitment, styleCodes, usageIntent, allowTraining }) {
  const ids = new Set();
  const add = (tagId) => { if (tagId) ids.add(tagId); };
  add(OCCUPATION_MAP[occupation]?.tagId);
  if (commitment && COMMITMENT_MAP[commitment]?.tagId) add(COMMITMENT_MAP[commitment]?.tagId);
  if (usageIntent && USAGE_INTENT_MAP[usageIntent]?.tagId) add(USAGE_INTENT_MAP[usageIntent]?.tagId);
  if (allowTraining) add('tag_use_training');
  for (const code of purposeCodes || []) add(PURPOSE_MAP[code]?.tagId);
  for (const code of styleCodes || []) add(STYLE_MAP[code]?.tagId);
  return [...ids];
}

export function normalizeNickname(value) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (text.length < NICKNAME_MIN) return { error: `昵称至少 ${NICKNAME_MIN} 个字符` };
  if (text.length > NICKNAME_MAX) return { error: `昵称最多 ${NICKNAME_MAX} 个字符` };
  return { value: text };
}
