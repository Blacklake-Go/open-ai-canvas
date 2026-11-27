export interface McpToolItem {
    name: string;
    displayName: string;
    displayNameByLocale?: Record<string, string>;
    category: string;
    categoryByLocale?: Record<string, string>;
    description: string;
    descriptionByLocale?: Record<string, string>;
    parameters: { name: string; type: string; required: boolean; desc: string; descByLocale?: Record<string, string> }[];
    examplePrompt: string;
    examplePromptByLocale?: Record<string, string>;
}

export interface McpPluginItem {
    id: string;
    title: string;
    name: string;
    category: "mcp" | "comfyui" | "cli" | "multimodal" | "ecosystem";
    categoryLabel: string;
    description: string;
    version: string;
    isOfficial?: boolean;
    isFeatured?: boolean;
    stars?: number;
    downloads?: string;
    tags: string[];
    quickInstall: string;
    githubUrl: string;
    docsUrl?: string;
    icon: string;
    coverImage: string;
    detailDocs?: {
        overview: string;
        features: string[];
        requirements: string[];
        changelog: string;
    };
}

export const MCP_CATEGORIES = [
    { key: "all", label: "全部生态", labelEn: "All Ecosystem" },
    { key: "mcp", label: "MCP 协议与 Agent", labelEn: "MCP & Agents" },
    { key: "comfyui", label: "ComfyUI 节点", labelEn: "ComfyUI Nodes" },
    { key: "cli", label: "命令行工具", labelEn: "CLI & Developer" },
    { key: "multimodal", label: "影视生成模型", labelEn: "Video & Image AI" },
    { key: "ecosystem", label: "资产与第三方集成", labelEn: "Integrations & Assets" },
] as const;

export const OFFICIAL_REPO_URL = "https://github.com/Blacklake-Go/open-ai-canvas";

export const OFFICIAL_MCP_TOOLS: McpToolItem[] = [
    {
        name: "create_storyboard",
        displayName: "智能分镜拆解",
        displayNameByLocale: {
            "en-US": "Storyboard Breakdown", "zh-TW": "智慧分鏡拆解", "es-ES": "Desglose de Storyboard",
            "fr-FR": "Découpage Storyboard", "de-DE": "Storyboard-Aufbau", "ja-JP": "絵コンテ分解", "ko-KR": "스토리보드 분해",
        },
        category: "编剧与导演",
        categoryByLocale: {
            "en-US": "Story & Directing", "zh-TW": "編劇與導演", "es-ES": "Guion y Dirección",
            "fr-FR": "Scénario", "de-DE": "Regie", "ja-JP": "脚本・演出", "ko-KR": "각본·연출",
        },
        description: "输入剧情梗概或剧本段落，自动拆解为工业级分镜镜头序列，输出景别、运镜机位、光影氛围与镜头时长。",
        descriptionByLocale: {
            "en-US": "Turn plot outlines or script excerpts into structured shot sequences with framing, camera movement, lighting, and timing.",
            "zh-TW": "輸入劇情梗概或劇本段落，自動拆解為工業級分鏡鏡頭序列，輸出景別、運鏡機位、光影氛圍與鏡頭時長。",
            "ja-JP": "あらすじや脚本から構図・カメラワーク・照明・尺を備えた映像カットリストを自動生成します。",
            "ko-KR": "줄거리나 대본을 구도, 카메라 워크, 조명, 러닝타임이 포함된 프로덕션 샷 시퀀스로 자동 분해합니다.",
        },
        parameters: [
            { name: "script_text", type: "string", required: true, desc: "剧本文本或故事情节描述", descByLocale: { "en-US": "Script text or story premise", "zh-TW": "劇本文字或故事情節描述", "ja-JP": "脚本テキストまたはあらすじ", "ko-KR": "대본 텍스트 또는 스토리 개요" } },
            { name: "shot_count", type: "number", required: false, desc: "期望拆分的镜头数量（默认 4–8 镜）", descByLocale: { "en-US": "Desired shot count (default 4–8)", "zh-TW": "期望拆分的鏡頭數量（預設 4–8 鏡）", "ja-JP": "分割カット数（標準 4–8）", "ko-KR": "생성할 샷 개수(기본 4~8개)" } },
            { name: "visual_style", type: "string", required: false, desc: "画面风格基调，如 Neo-Noir / 胶片质感", descByLocale: { "en-US": "Visual tone, e.g. Neo-Noir or Film Grain", "zh-TW": "畫面風格基調，如 Neo-Noir / 膠片質感", "ja-JP": "画風トーン（例：Neo-Noir / フィルム質感）", "ko-KR": "비주얼 톤(예: Neo-Noir / 필름 질감)" } },
        ],
        examplePrompt: "请将以下剧情拆解为 6 个电影感分镜：雨夜天台对峙，镜头从远景霓虹慢推至主角眼部特写，保留情绪留白。",
        examplePromptByLocale: {
            "en-US": "Break this scene into 6 cinematic shots: a rainy rooftop standoff, starting on a wide neon skyline and pushing slowly into an eye close-up.",
            "zh-TW": "請將以下劇情拆解為 6 個電影感分鏡：雨夜天台對峙，鏡頭從遠景霓虹慢推至主角眼部特寫，保留情緒留白。",
            "ja-JP": "次のシーンを映画的な6カットに分解してください：雨の屋上での対峙、ネオンの遠景から主人公の目元クローズアップへゆっくり寄る構成。",
            "ko-KR": "빗속 옥상 대치 장면을 6개의 시네마틱 샷으로 분해해 주세요. 네온 스카이라인 풀샷에서 주인공 눈빛 클로즈업으로 천천히 밀고 들어가는 구도.",
        },
    },
    {
        name: "generate_character_portrait",
        displayName: "角色一致性设定卡",
        displayNameByLocale: {
            "en-US": "Character Consistency Sheet", "zh-TW": "角色一致性設定卡", "es-ES": "Ficha de Personaje",
            "fr-FR": "Fiche Personnage", "de-DE": "Charakter-Konsistenzblatt", "ja-JP": "キャラクター三面図", "ko-KR": "캐릭터 일관성 시트",
        },
        category: "美术资产",
        categoryByLocale: {
            "en-US": "Art Assets", "zh-TW": "美術資產", "es-ES": "Activos de Arte",
            "fr-FR": "Direction Artistique", "de-DE": "Art Assets", "ja-JP": "美術アセット", "ko-KR": "아트 에셋",
        },
        description: "生成高精度多视角角色造型参考卡并绑定角色档案，保障跨镜头面部轮廓、发饰与服装的连贯性。",
        descriptionByLocale: {
            "en-US": "Generate high-precision multi-angle character sheets bound to your project profile to maintain facial and wardrobe consistency.",
            "zh-TW": "產生高精度多視角角色造型參考卡並綁定角色檔案，保障跨鏡頭面部輪廓、髮飾與服裝的連貫性。",
            "ja-JP": "マルチアングルキャラクターシートを生成して案件プロファイルに紐付け、カット間の顔立ちや衣装の一貫性を保ちます。",
            "ko-KR": "다각도 캐릭터 레퍼런스 시트를 생성해 프로젝트 프로필에 바인딩하고 샷 간 외모·의상 일관성을 유지합니다.",
        },
        parameters: [
            { name: "character_name", type: "string", required: true, desc: "角色名称或剧组编号", descByLocale: { "en-US": "Character name or cast ID", "zh-TW": "角色名稱或劇組編號", "ja-JP": "キャラクター名または識別子", "ko-KR": "캐릭터 이름 또는 배역 ID" } },
            { name: "prompt", type: "string", required: true, desc: "外貌特征、年代服饰与光影描述", descByLocale: { "en-US": "Appearance, wardrobe, and lighting details", "zh-TW": "外貌特徵、年代服飾與光影描述", "ja-JP": "外見・衣装・ライティング詳細", "ko-KR": "외모, 의상 및 조명 상세 설명" } },
            { name: "angle", type: "string", required: false, desc: "主参考视角（正视图 / 侧面 / 45度）", descByLocale: { "en-US": "Primary view (front / side / 3-quarter)", "zh-TW": "主參考視角（正視圖 / 側面 / 45度）", "ja-JP": "基準アングル（正面 / 側面 / 斜め45度）", "ko-KR": "기준 앵글(정면 / 측면 / 45도)" } },
        ],
        examplePrompt: "创建一名 26 岁东亚女侦探的三视图角色设定卡，深灰风衣与短发微卷，作为后续分镜一致性的主参考档案。",
        examplePromptByLocale: {
            "en-US": "Create a 3-view character reference sheet for a 26-year-old detective in a charcoal trench coat with wavy bob hair for multi-shot consistency.",
            "zh-TW": "建立一名 26 歲東亞女偵探的三視圖角色設定卡，深灰風衣與短髮微捲，作為後續分鏡一致性的主參考檔案。",
            "ja-JP": "チャコールグレーのトレンチコートを着た26歳女性探偵の三面図を作成し、以降のカットの基準アセットとして固定してください。",
            "ko-KR": "차콜 트렌치코트를 입은 26세 여성 탐정의 3면도 캐릭터 시트를 생성해 후속 샷의 기준 프로필로 고정해 주세요.",
        },
    },
    {
        name: "render_video_shot",
        displayName: "动力学视频镜头生成",
        displayNameByLocale: {
            "en-US": "Kinetic Video Shot Render", "zh-TW": "動力學影片鏡頭產生", "es-ES": "Renderizado de Video",
            "fr-FR": "Rendu Vidéo", "de-DE": "Video-Shot-Rendering", "ja-JP": "動画ショット生成", "ko-KR": "비디오 샷 생성",
        },
        category: "视效生成",
        categoryByLocale: {
            "en-US": "Video Engine", "zh-TW": "視效產生", "es-ES": "Motor de Video",
            "fr-FR": "Moteur Vidéo", "de-DE": "Video-Engine", "ja-JP": "映像エンジン", "ko-KR": "비디오 엔진",
        },
        description: "按模型协议调度视频引擎，支持首尾帧参考、镜头运动描述词注入与高清出片队列跟踪。",
        descriptionByLocale: {
            "en-US": "Dispatch video synthesis across model protocols with start/end frame references, camera motion cues, and render queue tracking.",
            "zh-TW": "依模型協議調度影片引擎，支援首尾幀參考、鏡頭運動描述詞注入與高畫質出片佇列追蹤。",
            "ja-JP": "先頭・末尾フレーム参照やカメラワーク指定付きで動画モデルを起動し、高品質レンダーキューを追跡します。",
            "ko-KR": "시작/종료 프레임 참조와 카메라 모션 큐를 적용해 비디오 엔진을 실행하고 렌더 대기열을 추적합니다.",
        },
        parameters: [
            { name: "reference_image", type: "string", required: true, desc: "首帧或角色参考资产 URI / ID", descByLocale: { "en-US": "First-frame or character asset URI / ID", "zh-TW": "首幀或角色參考資產 URI / ID", "ja-JP": "先頭フレームまたはキャラクター資産 URI / ID", "ko-KR": "첫 프레임 또는 캐릭터 에셋 URI / ID" } },
            { name: "motion_prompt", type: "string", required: true, desc: "运镜轨迹与主体动作指令", descByLocale: { "en-US": "Camera trajectory & subject motion", "zh-TW": "運鏡軌跡與主體動作指令", "ja-JP": "カメラ軌道と被写体の動き指示", "ko-KR": "카메라 궤적 및 피사체 움직임 지시" } },
            { name: "duration_seconds", type: "number", required: false, desc: "生成时长（支持 5 秒 / 10 秒）", descByLocale: { "en-US": "Clip duration (5s or 10s)", "zh-TW": "產生時長（支援 5 秒 / 10 秒）", "ja-JP": "動画尺（5秒 / 10秒）", "ko-KR": "클립 길이(5초 / 10초)" } },
        ],
        examplePrompt: "使用已锁定的侦探角色图生成 5 秒镜头：镜头缓缓推近面部，雨滴沿伞檐滑落，背景城市霓虹柔焦流动。",
        examplePromptByLocale: {
            "en-US": "Render a 5-second clip from the locked detective asset: subtle push-in, raindrops dripping off the umbrella brim, soft bokeh city traffic behind.",
            "zh-TW": "使用已鎖定的偵探角色圖產生 5 秒鏡頭：鏡頭緩緩推近面部，雨滴沿傘簷滑落，背景城市霓虹柔焦流動。",
            "ja-JP": "ロック済み探偵アセットから5秒動画を生成：顔へゆっくりプッシュイン、傘の縁から雨粒が落ち、背景のネオンが柔らかく流れる。",
            "ko-KR": "고정된 탐정 에셋으로 5초 클립을 렌더링하세요: 얼굴로 서서히 줌인되며 우산 끝에서 빗방울이 떨어지고 배경 도시 불빛이 흐릅니다.",
        },
    },
    {
        name: "compose_soundtrack",
        displayName: "多轨配乐与声音设计",
        displayNameByLocale: {
            "en-US": "Multi-Track Soundtrack", "zh-TW": "多軌配樂與聲音設計", "es-ES": "Banda Sonora Multipista",
            "fr-FR": "Bande-Son Multipiste", "de-DE": "Mehrspur-Soundtrack", "ja-JP": "マルチトラック作曲", "ko-KR": "멀티트랙 사운드트랙",
        },
        category: "声音工程",
        categoryByLocale: {
            "en-US": "Audio Island", "zh-TW": "聲音工程", "es-ES": "Audio",
            "fr-FR": "Audio", "de-DE": "Audio", "ja-JP": "サウンド", "ko-KR": "오디오",
        },
        description: "依据画面节奏与情绪曲线创作影视原声带，支持音乐风格锁定、分段长度匹配与分轨 WAV 导出。",
        descriptionByLocale: {
            "en-US": "Compose film scores aligned to scene pacing and emotional arcs, supporting style locking and multi-stem WAV export.",
            "zh-TW": "依據畫面節奏與情緒曲線創作影視原聲帶，支援音樂風格鎖定、分段長度匹配與分軌 WAV 匯出。",
            "ja-JP": "映像のテンポと感情曲線に合わせた劇伴を生成し、スタイル固定やマルチステム WAV 書き出しに対応します。",
            "ko-KR": "장면 템포와 감정선에 맞춘 오리지널 스코어를 작곡하고 스타일 고정 및 멀티 스템 WAV 내보내기를 지원합니다.",
        },
        parameters: [
            { name: "mood_tags", type: "string[]", required: true, desc: "情绪与配器标签，如 ['悬疑', '钢琴', '低音脉冲']", descByLocale: { "en-US": "Mood & instrumentation tags", "zh-TW": "情緒與配器標籤", "ja-JP": "ムード・楽器タグ", "ko-KR": "분위기 및 악기 태그" } },
            { name: "target_duration", type: "number", required: true, desc: "音频目标时长（秒），用于对齐镜头", descByLocale: { "en-US": "Target duration in seconds", "zh-TW": "音訊目標時長（秒）", "ja-JP": "目標秒数", "ko-KR": "목표 길이(초)" } },
        ],
        examplePrompt: "生成 15 秒紧凑悬疑电影配乐，前段极简钢琴铺底，8 秒后接入脉冲节奏，适配深夜追踪画面。",
        examplePromptByLocale: {
            "en-US": "Compose a 15s tense suspense cue: sparse minimal piano intro, transitioning at 8s into a driving sub-bass pulse for a night pursuit scene.",
            "zh-TW": "產生 15 秒緊湊懸疑電影配樂，前段極簡鋼琴鋪底，8 秒後接入脈衝節奏，適配深夜追蹤畫面。",
            "ja-JP": "15秒の緊張感あるサスペンス劇伴を作成：前半はミニマルなピアノ、8秒目から低音パルスが加わる深夜追跡シーン向けBGM。",
            "ko-KR": "15초 길이의 긴장감 있는 서스펜스 영화 음악을 생성하세요. 전반부 미니멀 피아노 후 8초부터 심야 추격에 맞는 펄스 리듬이 추가됩니다.",
        },
    },
    {
        name: "inspect_task_queue",
        displayName: "异步任务查询与资产入库",
        displayNameByLocale: {
            "en-US": "Async Task Queue & Archive", "zh-TW": "非同步任務查詢與資產入庫", "es-ES": "Cola de Tareas",
            "fr-FR": "Suivi de Tâches", "de-DE": "Async-Task-Queue", "ja-JP": "非同期タスク監視", "ko-KR": "비동기 작업 조회",
        },
        category: "管线控制",
        categoryByLocale: {
            "en-US": "Pipeline Control", "zh-TW": "管線控制", "es-ES": "Pipeline",
            "fr-FR": "Pipeline", "de-DE": "Pipeline", "ja-JP": "パイプライン", "ko-KR": "파이프라인",
        },
        description: "安全轮询长耗时视频与多图生成任务状态，完成后自动拉取产物地址并归档到当前工作台画布。",
        descriptionByLocale: {
            "en-US": "Safely poll long-running render jobs and automatically archive completed media assets into your workspace canvas.",
            "zh-TW": "安全輪詢長耗時影片與多圖產生任務狀態，完成後自動拉取產物位址並歸檔到目前工作台畫布。",
            "ja-JP": "長時間の動画・画像生成ジョブを安全に監視し、完了したアセットをワークスペースキャンバスへ自動保存します。",
            "ko-KR": "장시간 소요되는 렌더링 작업을 안전하게 폴링하고 완료된 미디어 자산을 캔버스 워크스페이스에 자동 보관합니다.",
        },
        parameters: [
            { name: "task_id", type: "string", required: true, desc: "生成任务提交后返回的全局任务 ID", descByLocale: { "en-US": "Global task ID returned on submission", "zh-TW": "產生任務提交後回傳的全域任務 ID", "ja-JP": "ジョブ送信時に発行されたタスク ID", "ko-KR": "작업 제출 시 반환된 전역 작업 ID" } },
        ],
        examplePrompt: "查询渲染任务 task_01hzx 的实时队列进度，完成后自动归档到当前项目素材库。",
        examplePromptByLocale: {
            "en-US": "Check live status for render job task_01hzx and archive outputs into the active project asset library once ready.",
            "zh-TW": "查詢渲染任務 task_01hzx 的即時佇列進度，完成後自動歸檔到目前專案素材庫。",
            "ja-JP": "レンダリングジョブ task_01hzx の進行状況を確認し、完了したら現在のプロジェクト素材ライブラリに保存してください。",
            "ko-KR": "렌더 작업 task_01hzx의 실시간 진행 상태를 조회하고 완료 시 현재 프로젝트 에셋 라이브러리에 보관해 주세요.",
        },
    },
];

export interface McpLocalizedFaq {
    id: string;
    q: Record<string, string>;
    a: Record<string, string>;
}

export const MCP_BUILDING_FAQS: McpLocalizedFaq[] = [
    {
        id: "progress",
        q: {
            "zh-CN": "SupDance 官方 MCP Server 目前处于什么阶段？",
            "zh-TW": "SupDance 官方 MCP Server 目前處於什麼階段？",
            "en-US": "What is the current development stage of the official SupDance MCP Server?",
            "es-ES": "¿En qué etapa está el servidor MCP oficial de SupDance?",
            "fr-FR": "Où en est le développement du serveur MCP officiel de SupDance ?",
            "de-DE": "In welcher Phase befindet sich der offizielle SupDance MCP-Server?",
            "ja-JP": "公式 SupDance MCP Server の現在の開発状況は？",
            "ko-KR": "공식 SupDance MCP Server는 현재 어떤 단계인가요?",
        },
        a: {
            "zh-CN": "当前核心协议 Schema、异步视频任务回调与 OAuth 鉴权边界正在紧锣密鼓构建中。本页展示的工具清单与配置片段为即将上线的标准协议预览；外部 MCP 连接器已优先在工作台 Agent 内投入使用。",
            "zh-TW": "目前核心協議 Schema、非同步影片任務回調與 OAuth 驗證邊界正積極建構中。本頁展示的工具清單與設定片段為即將上線的標準協議預覽；外部 MCP 連接器已優先於工作台 Agent 內開放使用。",
            "en-US": "Our core protocol schema, async video task callbacks, and OAuth credential boundary are actively under construction. The tool schemas and config snippets on this page preview the upcoming public spec, while outbound MCP connectors are already live inside Canvas Agent.",
            "es-ES": "El esquema central, los callbacks asíncronos de video y OAuth están en construcción activa. Esta página muestra una vista previa del protocolo; los conectores MCP externos ya funcionan dentro de Canvas Agent.",
            "fr-FR": "Le schéma principal, les webhooks vidéo asynchrones et OAuth sont en cours de construction. Cette page préfigure la spécification publique à venir ; les connecteurs MCP sortants sont déjà actifs dans Canvas Agent.",
            "de-DE": "Das Kernschema, asynchrone Video-Callbacks und OAuth befinden sich im Aufbau. Diese Seite zeigt eine Vorschau der kommenden Spezifikation; ausgehende MCP-Konnektoren sind im Canvas Agent bereits verfügbar.",
            "ja-JP": "現在、コアプロトコル定義・非同期動画タスクコールバック・OAuth 認証境界を開発中です。本ページは公開仕様のプレビューであり、Canvas Agent 内の外部 MCP コネクタは既に稼働しています。",
            "ko-KR": "현재 핵심 프로토콜 스키마, 비동기 비디오 콜백 및 OAuth 인증 경계를 구축 중입니다. 이 페이지는 곧 공개될 표준 사양의 프리뷰이며, Canvas Agent 내 외부 MCP 커넥터는 이미 사용 가능합니다.",
        },
    },
    {
        id: "existing-mcp",
        q: {
            "zh-CN": "现在在 SupDance 工作台里已经可以使用哪些 MCP 能力？",
            "zh-TW": "現在在 SupDance 工作台裡已經可以使用哪些 MCP 能力？",
            "en-US": "Which MCP capabilities are already available in the SupDance workspace today?",
            "es-ES": "¿Qué capacidades MCP ya están disponibles hoy en SupDance?",
            "fr-FR": "Quelles capacités MCP sont déjà disponibles dans SupDance aujourd'hui ?",
            "de-DE": "Welche MCP-Funktionen stehen bereits heute im SupDance-Workspace bereit?",
            "ja-JP": "現在 SupDance ワークスペースで既に利用できる MCP 機能は何ですか？",
            "ko-KR": "현재 SupDance 워크스페이스에서 바로 사용할 수 있는 MCP 기능은 무엇인가요?",
        },
        a: {
            "zh-CN": "在画布助手（Canvas Agent）中，平台已内置完整的 MCP 客户端与多租户安全连接管理：管理员与创作者可安全挂载第三方兼容 MCP 服务，并与画布节点、短剧分镜工具配合协作。",
            "zh-TW": "在畫布助手（Canvas Agent）中，平台已內建完整的 MCP 用戶端與多租戶安全連線管理：管理員與創作者可安全掛載第三方相容 MCP 服務，並與畫布節點、短劇分鏡工具協作。",
            "en-US": "Inside Canvas Agent, SupDance already runs a built-in MCP client with multi-tenant outbound security and rate controls—allowing admins and creators to connect compatible external MCP servers alongside native canvas and drama tools.",
            "es-ES": "En Canvas Agent ya existe un cliente MCP integrado con controles de seguridad multiinquilino para conectar servidores MCP externos compatibles junto con herramientas del lienzo y drama.",
            "fr-FR": "Canvas Agent intègre déjà un client MCP complet avec contrôle de sécurité multi-tenant pour connecter des serveurs MCP externes compatibles avec vos outils de canevas.",
            "de-DE": "Im Canvas Agent ist bereits ein vollständiger MCP-Client mit mandantenfähiger Sicherheitsprüfung integriert, um externe kompatible MCP-Server direkt anzubinden.",
            "ja-JP": "Canvas Agent 内にはマルチテナント対応の安全な MCP クライアントが実装済みで、互換性のある外部 MCP サーバーをキャンバスやショートドラマツールと連携させられます。",
            "ko-KR": "Canvas Agent에는 멀티테넌트 보안 제어가 적용된 내장 MCP 클라이언트가 탑재되어 있어, 호환되는 외부 MCP 서버를 캔버스 및 숏드라마 도구와 함께 연결해 사용할 수 있습니다.",
        },
    },
    {
        id: "clients",
        q: {
            "zh-CN": "正式上线后将支持哪些 AI 编辑器与客户端？",
            "zh-TW": "正式上線後將支援哪些 AI 編輯器與用戶端？",
            "en-US": "Which AI editors and clients will be supported at launch?",
            "es-ES": "¿Qué editores y clientes de IA serán compatibles en el lanzamiento?",
            "fr-FR": "Quels éditeurs et clients IA seront pris en charge au lancement ?",
            "de-DE": "Welche KI-Editoren und Clients werden zum Start unterstützt?",
            "ja-JP": "正式公開後、どの AI エディタ・クライアントに対応しますか？",
            "ko-KR": "정식 출시 후 어떤 AI 에디터와 클라이언트를 지원하나요?",
        },
        a: {
            "zh-CN": "所有严格遵循 Anthropic Model Context Protocol（Streamable HTTP 与 stdio 传输）的客户端均可开箱即用，重点适配 Cursor、Claude Desktop、Windsurf、Cline 以及自研 Agent 运行时。",
            "zh-TW": "所有嚴格遵循 Anthropic Model Context Protocol（Streamable HTTP 與 stdio 傳輸）的用戶端皆可開箱即用，重點適配 Cursor、Claude Desktop、Windsurf、Cline 與自研 Agent 執行環境。",
            "en-US": "Every client compliant with the Anthropic Model Context Protocol (Streamable HTTP and stdio transports) will work out of the box—prioritizing Cursor, Claude Desktop, Windsurf, Cline, and custom Agent runtimes.",
            "es-ES": "Todo cliente compatible con Model Context Protocol (Streamable HTTP y stdio) funcionará de inmediato: Cursor, Claude Desktop, Windsurf, Cline y agentes propios.",
            "fr-FR": "Tout client conforme au Model Context Protocol (Streamable HTTP et stdio) sera pris en charge : Cursor, Claude Desktop, Windsurf, Cline et agents personnalisés.",
            "de-DE": "Jeder Client nach dem Model Context Protocol (Streamable HTTP & stdio) wird unterstützt – allen voran Cursor, Claude Desktop, Windsurf, Cline und eigene Agent-Runtimes.",
            "ja-JP": "Model Context Protocol（Streamable HTTP および stdio）に準拠するすべてのクライアント（Cursor、Claude Desktop、Windsurf、Cline、独自エージェント）で利用可能になります。",
            "ko-KR": "Model Context Protocol(Streamable HTTP 및 stdio)을 준수하는 모든 클라이언트(Cursor, Claude Desktop, Windsurf, Cline 및 자체 에이전트)를 지원할 예정입니다.",
        },
    },
    {
        id: "auth",
        q: {
            "zh-CN": "对外暴露创作工作台能力时，积分与账号安全如何保障？",
            "zh-TW": "對外暴露創作工作台能力時，積分與帳號安全如何保障？",
            "en-US": "How are user credits and account security protected for external MCP calls?",
            "es-ES": "¿Cómo se protegen los créditos y la seguridad de la cuenta en llamadas MCP externas?",
            "fr-FR": "Comment la sécurité des crédits et du compte est-elle garantie pour les appels MCP externes ?",
            "de-DE": "Wie werden Credits und Kontosicherheit bei externen MCP-Aufrufen geschützt?",
            "ja-JP": "外部 MCP 呼び出しにおけるクレジットとアカウントの安全性はどう保護されますか？",
            "ko-KR": "외부 MCP 호출 시 크레딧과 계정 보안은 어떻게 보호되나요?",
        },
        a: {
            "zh-CN": "与主站采用同一套隔离沙盒、作用域令牌（Scoped Token）及积分预留核算管线。创作者可随时细粒度撤销单个客户端密钥，并设定单日额度上限与审计日志留存。",
            "zh-TW": "與主站採用同一套隔離沙盒、作用域權杖（Scoped Token）及積分預留核算管線。創作者可隨時細粒度撤銷單一用戶端金鑰，並設定單日額度上限與稽核日誌留存。",
            "en-US": "External MCP endpoints share SupDance's production sandbox, scoped token auth, and credit reservation ledger—letting creators revoke individual client credentials anytime and enforce per-key daily spend caps.",
            "es-ES": "Los endpoints MCP comparten el mismo sandbox, tokens con ámbito limitado y control de saldo, permitiendo revocar claves y fijar límites diarios en cualquier momento.",
            "fr-FR": "Les points d'accès MCP partagent le même bac à sable, des jetons à portée limitée et la comptabilité de crédits, avec révocation instantanée et plafonds quotidiens.",
            "de-DE": "Externe MCP-Endpunkte nutzen dieselbe Produktions-Sandbox, Scoped Tokens und Credit-Reservierung mit jederzeit widerrufbaren Schlüsseln und Tageslimits.",
            "ja-JP": "本番環境と同じサンドボックス、スコープ付きトークン、クレジット予約会計パイプラインを共有し、いつでも個別キーの失効や日次上限設定が可能です。",
            "ko-KR": "프로덕션과 동일한 샌드박스, 범위 제한 토큰, 크레딧 예약 원장 파이프라인을 공유하여 언제든 클라이언트 키를 폐기하고 일일 사용 한도를 설정할 수 있습니다.",
        },
    },
];

export const MCP_FAQS = MCP_BUILDING_FAQS.map((item) => ({
    question: item.q["zh-CN"],
    answer: item.a["zh-CN"],
}));

export const MCP_PLUGINS: McpPluginItem[] = [];
