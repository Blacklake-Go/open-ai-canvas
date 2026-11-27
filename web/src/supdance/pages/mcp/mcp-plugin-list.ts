import type { AppLocale } from "@/i18n/locales";

export interface McpToolItem {
    name: string;
    displayName: string;
    category: string;
    description: string;
    parameters: { name: string; type: string; required: boolean; desc: string }[];
    examplePrompt: string;
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
        category: "编剧与导演",
        description: "输入剧情梗概或剧本段落，自动拆解为工业级分镜镜头序列，输出景别、运镜机位、光影氛围与镜头时长。",
        parameters: [
            { name: "script_text", type: "string", required: true, desc: "剧本文本或故事情节描述" },
            { name: "shot_count", type: "number", required: false, desc: "期望拆分的镜头数量（默认 4–8 镜）" },
            { name: "visual_style", type: "string", required: false, desc: "画面风格基调，如 Neo-Noir / 胶片质感" },
        ],
        examplePrompt: "请将以下剧情拆解为 6 个电影感分镜：雨夜天台对峙，镜头从远景霓虹慢推至主角眼部特写，保留情绪留白。",
    },
    {
        name: "generate_character_portrait",
        displayName: "角色一致性设定卡",
        category: "美术资产",
        description: "生成高精度多视角角色造型参考卡并绑定角色档案，保障跨镜头面部轮廓、发饰与服装的连贯性。",
        parameters: [
            { name: "character_name", type: "string", required: true, desc: "角色名称或剧组编号" },
            { name: "prompt", type: "string", required: true, desc: "外貌特征、年代服饰与光影描述" },
            { name: "angle", type: "string", required: false, desc: "主参考视角（正视图 / 侧面 / 45度）" },
        ],
        examplePrompt: "创建一名 26 岁东亚女侦探的三视图角色设定卡，深灰风衣与短发微卷，作为后续分镜一致性的主参考档案。",
    },
    {
        name: "render_video_shot",
        displayName: "动力学视频镜头生成",
        category: "视效生成",
        description: "按模型协议调度视频引擎，支持首尾帧参考、镜头运动描述词注入与高清出片队列跟踪。",
        parameters: [
            { name: "reference_image", type: "string", required: true, desc: "首帧或角色参考资产 URI / ID" },
            { name: "motion_prompt", type: "string", required: true, desc: "运镜轨迹与主体动作指令" },
            { name: "duration_seconds", type: "number", required: false, desc: "生成时长（支持 5 秒 / 10 秒）" },
        ],
        examplePrompt: "使用已锁定的侦探角色图生成 5 秒镜头：镜头缓缓推近面部，雨滴沿伞檐滑落，背景城市霓虹柔焦流动。",
    },
    {
        name: "compose_soundtrack",
        displayName: "多轨配乐与声音设计",
        category: "声音工程",
        description: "依据画面节奏与情绪曲线创作影视原声带，支持音乐风格锁定、分段长度匹配与分轨 WAV 导出。",
        parameters: [
            { name: "mood_tags", type: "string[]", required: true, desc: "情绪与配器标签，如 ['悬疑', '钢琴', '低音脉冲']" },
            { name: "target_duration", type: "number", required: true, desc: "音频目标时长（秒），用于对齐镜头" },
        ],
        examplePrompt: "生成 15 秒紧凑悬疑电影配乐，前段极简钢琴铺底，8 秒后接入脉冲节奏，适配深夜追踪画面。",
    },
    {
        name: "inspect_task_queue",
        displayName: "异步任务查询与资产入库",
        category: "管线控制",
        description: "安全轮询长耗时视频与多图生成任务状态，完成后自动拉取产物地址并归档到当前工作台画布。",
        parameters: [{ name: "task_id", type: "string", required: true, desc: "生成任务提交后返回的全局任务 ID" }],
        examplePrompt: "查询渲染任务 task_01hzx 的实时队列进度，完成后自动归档到当前项目素材库。",
    },
];

export interface McpLocalizedFaq {
    id: string;
    q: Record<AppLocale, string>;
    a: Record<AppLocale, string>;
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
            "en-US":
                "Our core protocol schema, async video task callbacks, and OAuth credential boundary are actively under construction. The tool schemas and config snippets on this page preview the upcoming public spec, while outbound MCP connectors are already live inside Canvas Agent.",
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
