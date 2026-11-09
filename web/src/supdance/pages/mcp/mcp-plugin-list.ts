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

export const OFFICIAL_REPO_URL = "https://github.com/Blacklake-Go/supdance";

export const OFFICIAL_MCP_TOOLS: McpToolItem[] = [
    {
        name: "create_storyboard",
        displayName: "智能分镜生成 (Storyboard AI)",
        category: "编剧与导演",
        description: "输入剧情梗概或剧本段落，自动拆解为电影工业级镜头列表，包含景别、运镜机位、光影氛围与镜头时长。",
        parameters: [
            { name: "script_text", type: "string", required: true, desc: "剧本文本或故事情节描述" },
            { name: "shot_count", type: "number", required: false, desc: "期望生成的镜头总数（默认 4-8 个）" },
            { name: "visual_style", type: "string", required: false, desc: "视觉风格，如 '赛博朋克'、'复古胶片'、'电影质感'" },
        ],
        examplePrompt: "@supdance 帮我将以下剧情拆解为 6 个分镜镜头，要求赛博朋克霓虹雨夜风格：主角在屋顶俯瞰霓虹都市，突然发现无人机追踪器逼近...",
    },
    {
        name: "generate_character_portrait",
        displayName: "面部锁死角色卡 (Character Consistency)",
        category: "美术资产",
        description: "生成高精度、多角度一致性锁定的角色立绘，提取 Face-ID 向量，确保跨镜头面部与服饰零漂移。",
        parameters: [
            { name: "character_name", type: "string", required: true, desc: "角色代号或姓名" },
            { name: "prompt", type: "string", required: true, desc: "外貌、年龄、发型、服装详细描述" },
            { name: "angle", type: "string", required: false, desc: "主视角：正视图/侧面/45度微仰视角" },
        ],
        examplePrompt: "@supdance 生成一名 26 岁东亚女性侦探的角色三视图，黑色风衣，短发微卷，眼神锐利，锁定此角色外观以便后续连续生成镜头。",
    },
    {
        name: "render_video_shot",
        displayName: "4K 影视动力学生视频 (High-FPS Video)",
        category: "视效生成",
        description: "调度 Seedance 2.5 或即梦 2.1 高清动力学视频模型，支持首尾帧插值、光流运镜控制与无水印导出。",
        parameters: [
            { name: "reference_image", type: "string", required: true, desc: "起始参考图片 URL 或素材 ID" },
            { name: "motion_prompt", type: "string", required: true, desc: "运动轨迹，如 '镜头向前快速推入，雨滴溅在镜头表面'" },
            { name: "duration_seconds", type: "number", required: false, desc: "视频时长（5秒 / 10秒）" },
        ],
        examplePrompt: "@supdance 驱动刚才生成的侦探立绘，执行镜头：从特写缓缓拉远，背景霓虹车流划过光晕，发丝随微风飘拂，时长 5 秒。",
    },
    {
        name: "compose_soundtrack",
        displayName: "智能多轨配乐合成 (Audio Island)",
        category: "声音工程",
        description: "根据剧情节拍与情绪曲线，自动创作影视原声带 (OST)，输出无损立体声并支持分离对白、音效与背景乐。",
        parameters: [
            { name: "mood_tags", type: "string[]", required: true, desc: "情绪标签，如 ['紧张', '悬疑', '重低音脉冲']" },
            { name: "target_duration", type: "number", required: true, desc: "音频时长，支持与视频严格对齐" },
        ],
        examplePrompt: "@supdance 生成一段 15 秒紧凑悬疑的电影配乐，重低音电子脉冲逐渐加速，伴随雨声环境音，适配追逐场景。",
    },
    {
        name: "inspect_task_queue",
        displayName: "异步任务轮询与资产入库 (Task Pipeline)",
        category: "管线控制",
        description: "实时监听云端渲染队列进度，并在任务完成后自动拉取原画资产同步到本地项目工作区。",
        parameters: [{ name: "task_id", type: "string", required: true, desc: "创建任务返回的全局流水号" }],
        examplePrompt: "@supdance 查询我提交的渲染任务 01HZX829 的当前状态，若已生成则自动下载原图保存至当前工程目录。",
    },
];

export const MCP_FAQS = [
    {
        question: "Windows PowerShell 运行安装脚本提示「无法加载脚本，因为在此系统上禁止运行脚本」？",
        answer: "这是 Windows PowerShell 默认的安全执行策略限制。请以管理员身份打开 PowerShell，执行 `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` 命令后按 Y 确认，即可顺利运行一键安装脚本。",
    },
    {
        question: "在 Cursor 或 Claude Desktop 中配置 MCP 后，为什么无法识别到 @supdance 工具？",
        answer: "请确认两点：1. 在 `mcp.json` 中配置完成后，必须**彻底退出并重新启动 Cursor 或 Claude Desktop**；2. 确保配置中的 `SUPDANCE_API_KEY` 具有有效额度，可通过 `npx -y @supdance/mcp-server@latest ping` 在终端验证连通性。",
    },
    {
        question: "ComfyUI 桥接节点如何连接 SupDance 云端加速，避免本地显存溢出 (OOM)？",
        answer: "将 `ComfyUI-SupDance-Bridge` 放入 `ComfyUI/custom_nodes/` 目录并重启 ComfyUI，在工作流中右键添加 `SupDance -> Cloud Pipeline Node`，填入你的 API Key。大模型推理将在 SupDance 专属集群执行，无缝传回张量结果，完全不占用本地 GPU 显存。",
    },
    {
        question: "如何获取 SupDance 的 API Key？",
        answer: "登录 SupDance 站点 (https://www.supdance.com)，点击右上角个人头像进入「账号设置 -> 开发者凭据」，点击「创建 API Key」即可一键生成密钥。每个新账号均附赠起步体验算力。",
    },
    {
        question: "CLI 提示「Command not found: supdance」？",
        answer: "这通常是由于系统的全局 npm 或 pip 的 bin 路径未加入到 PATH 环境变量中。可以通过运行 `npm prefix -g` 查看路径，或使用免安装运行命令 `npx -y @supdance/cli@latest` 代替。",
    },
];

export const MCP_PLUGINS: McpPluginItem[] = [
    {
        id: "supdance-mcp-server",
        title: "SupDance MCP Server",
        name: "@supdance/mcp-server",
        category: "mcp",
        categoryLabel: "MCP 协议",
        description: "官方标准化 MCP (Model Context Protocol) 服务端，支持在 Cursor、Claude Desktop、Windsurf 中直接调用 SupDance 影视生成模型与画布能力。",
        version: "v1.2.4",
        isOfficial: true,
        isFeatured: true,
        stars: 1280,
        downloads: "28.5k",
        tags: ["Anthropic MCP", "Cursor", "Claude Desktop", "Official"],
        quickInstall: "npx -y @supdance/mcp-server@latest",
        githubUrl: OFFICIAL_REPO_URL,
        docsUrl: `${OFFICIAL_REPO_URL}#mcp-server`,
        icon: "Cpu",
        coverImage: "/short-drama-styles/future-tech.jpg",
        detailDocs: {
            overview: "标准化模型上下文协议中枢，架起大语言模型代码助手与 SupDance 云端全模态影视生成引擎的坚固桥梁。",
            features: ["完全兼容 Anthropic 2024-11-05 及更新版本 MCP 开放协议规范", "支持在 Cursor 聊天框中直接通过 Tool Use 呼叫电影级画质渲染", "自带双向心跳检测与断线自动重连容灾", "无缝集成任务队列进度推送与本地资产自动落盘"],
            requirements: ["Node.js >= 18.0.0", "有效 SupDance 账户与 API Key", "Cursor 或 Claude Desktop (v0.7+)"],
            changelog: "v1.2.4: 优化 JSON-RPC 序列化性能，支持异步长任务事件流自动转接。",
        },
    },
    {
        id: "supdance-cli",
        title: "SupDance Developer CLI",
        name: "supdance-cli",
        category: "cli",
        categoryLabel: "命令行工具",
        description: "极速自动化命令行脚手架，支持批量脚本化生成短剧镜头、分镜脚本解析、云端队列轮询及资源自动同步到本地目录。",
        version: "v2.0.1",
        isOfficial: true,
        isFeatured: true,
        stars: 960,
        downloads: "19.2k",
        tags: ["Terminal", "Automation", "Batch", "Cross-Platform"],
        quickInstall: "npm i -g @supdance/cli",
        githubUrl: OFFICIAL_REPO_URL,
        docsUrl: `${OFFICIAL_REPO_URL}#cli`,
        icon: "Terminal",
        coverImage: "/short-drama-styles/cg-realistic.jpg",
        detailDocs: {
            overview: "为专业导演与技术团队设计的终端批量产出工具，轻松与 CI/CD 及自研短剧制作管线深度结合。",
            features: ["支持 CSV / JSON 剧本文件批量导入与全自动逐镜头排队渲染", "提供实时交互式终端仪表盘，展示当前任务队列与渲染耗时", "支持断点续传与任务自动重试", "内置多模型比对模式，一键输出四宫格方案供导演选拔"],
            requirements: ["支持 macOS (Apple Silicon / Intel)、Linux、Windows", "支持 Bash、Zsh、PowerShell"],
            changelog: "v2.0.1: 新增短剧项目打包导出至剪映/Premiere 格式的 XML 桥接指令。",
        },
    },
    {
        id: "comfyui-supdance-bridge",
        title: "ComfyUI SupDance Bridge",
        name: "ComfyUI-SupDance-Bridge",
        category: "comfyui",
        categoryLabel: "ComfyUI 节点",
        description: "专为 ComfyUI 设计的深度扩展节点包，支持将本地工作流直接连接至 SupDance 高性能云端集群，免去本地显存不足烦恼。",
        version: "v1.1.0",
        isOfficial: true,
        isFeatured: true,
        stars: 840,
        downloads: "14.6k",
        tags: ["ComfyUI", "Custom Nodes", "Cloud Acceleration", "Workflow"],
        quickInstall: "cd custom_nodes && git clone https://github.com/Blacklake-Go/supdance.git",
        githubUrl: OFFICIAL_REPO_URL,
        docsUrl: `${OFFICIAL_REPO_URL}#comfyui`,
        icon: "Layers",
        coverImage: "/short-drama-styles/cyber-anime.jpg",
        detailDocs: {
            overview: "突破本地消费级显卡物理限制，将 ComfyUI 的节点图直接送入云端 H100/H200 算力集群。",
            features: ["原生提供 SupDance Loader、SupDance Sampler 及 Video Exporter 节点", "支持潜空间 Latent 张量与云端实时编解码传输", "自动处理依赖项与 LoRA 权重缓存，告别庞大模型重复下载", "无缝兼容 SDXL, Flux.1, WanX 及 Seedance 骨干模型"],
            requirements: ["ComfyUI 最新稳定版", "Python 3.10+", "git"],
            changelog: "v1.1.0: 针对高分辨率潜空间网络传输增加 Zstandard 压缩，延迟降低 65%。",
        },
    },
    {
        id: "jimeng-seedance-connector",
        title: "Jimeng & Seedance High-FPS Connector",
        name: "supdance-video-seedance",
        category: "multimodal",
        categoryLabel: "影视生成模型",
        description: "结合即梦 AI 与 Seedance 2.5 视频大模型的动力学中继插件，支持运镜控制、多镜头连贯转场与 4K 超清超分增强。",
        version: "v1.4.2",
        isOfficial: true,
        isFeatured: false,
        stars: 710,
        downloads: "11.3k",
        tags: ["Jimeng 2.1", "Seedance", "Video Generation", "Camera Control"],
        quickInstall: "supdance plugin add video-seedance",
        githubUrl: OFFICIAL_REPO_URL,
        icon: "Film",
        coverImage: "/short-drama-styles/film-noir.jpg",
        detailDocs: {
            overview: "即梦与 Seedance 顶级视觉引擎的双核驱动中继，专注电影级长镜头连贯性与精细运镜控制。",
            features: ["支持 12 种专业电影机位运镜（推拉摇移、升降跟拍、希区柯克变焦）", "光流引导技术，有效消除画面人物动作撕裂与背景畸变", "支持第一帧与最后一帧插值过渡，生成无缝衔接的长镜头"],
            requirements: ["SupDance CLI v1.8+", "云端影视渲染通道开启"],
            changelog: "v1.4.2: 升级至 Seedance 2.5 动力学核心，高帧率动态稳定度提升 40%。",
        },
    },
    {
        id: "supdance-music-generator",
        title: "SupDance MusicGen Island",
        name: "supdance-music-generation",
        category: "multimodal",
        categoryLabel: "影视生成模型",
        description: "影视级智能配乐与环境音效生成插件，支持根据镜头情绪标签自动编排副歌、交响管弦与节拍对齐，一键导出无损多轨分轨包。",
        version: "v1.3.0",
        isOfficial: true,
        isFeatured: false,
        stars: 620,
        downloads: "9.8k",
        tags: ["Suno Engine", "Multi-Track", "BGM", "Audio Sync"],
        quickInstall: "supdance plugin add music-gen",
        githubUrl: OFFICIAL_REPO_URL,
        icon: "Music",
        coverImage: "/short-drama-styles/fantasy-adventure.jpg",
        detailDocs: {
            overview: "为短剧与视频打造量体裁衣的情感配乐岛，支持根据视频画面的时间码实现秒级节拍卡点。",
            features: ["涵盖史诗交响、悬疑氛围、赛博流行、国风古韵等 40+ 种影视曲风", "支持按秒精确卡点与段落情绪转折（起承转合）", "支持导出分轨 WAV（人声、鼓点、贝斯、管弦单独分离）"],
            requirements: ["支持浏览器前端与 CLI 端双模式操作"],
            changelog: "v1.3.0: 引入多轨自动化响度平衡与卡点标记生成。",
        },
    },
    {
        id: "role-consistency-engine",
        title: "Character Consistency Lock",
        name: "supdance-role-lock",
        category: "multimodal",
        categoryLabel: "影视生成模型",
        description: "角色多视角一致性锁死插件，结合面部特征嵌入与服装微调，确保连续分镜中人物容貌、服饰和发色百分之百稳定。",
        version: "v1.0.8",
        isOfficial: false,
        isFeatured: false,
        stars: 530,
        downloads: "8.1k",
        tags: ["Face ID", "Character Consistency", "LoRA", "Storyboarding"],
        quickInstall: "supdance plugin add role-lock",
        githubUrl: OFFICIAL_REPO_URL,
        icon: "UserCheck",
        coverImage: "/short-drama-styles/palace-hanfu.jpg",
        detailDocs: {
            overview: "解决 AI 影视长久以来的'换脸/变装'痛点，一套嵌入特征贯穿整部短剧剧本。",
            features: ["独家面部 512 维特征网格锁定，不同光照角度下保持极高辨识度", "支持自定义衣橱设定库，角色换装不影响发型与容貌", "支持双人与多人复杂同框场景下的角色面孔精确分配"],
            requirements: ["SupDance Studio 或 MCP Server 运行环境"],
            changelog: "v1.0.8: 优化极端特写与大远景条件下的面部多尺度对齐准确率。",
        },
    },
    {
        id: "eagle-asset-sync",
        title: "Eagle & Billfish Dual Sync",
        name: "supdance-asset-eagle",
        category: "ecosystem",
        categoryLabel: "资产与第三方集成",
        description: "将设计师与导演本地的 Eagle / Billfish 素材库实时双向索引至 SupDance 画布，拖拽即用，标签自动关联检索。",
        version: "v1.2.0",
        isOfficial: true,
        isFeatured: false,
        stars: 490,
        downloads: "7.4k",
        tags: ["Eagle.cool", "Billfish", "Asset Sync", "Local Library"],
        quickInstall: "supdance plugin add asset-eagle",
        githubUrl: OFFICIAL_REPO_URL,
        icon: "FolderSync",
        coverImage: "/short-drama-styles/retro-film.jpg",
        detailDocs: {
            overview: "打通本地庞大设计素材库与云端画布的无缝双向管道，无需繁琐的上传下载步骤。",
            features: ["本地 Eagle / Billfish 文件夹变更实时监听同步", "保留原有智能标签、评分、颜色色值筛选维度", "画布生成的每一帧成片可一键归档回本地 Eagle 影视分类库"],
            requirements: ["本地运行 Eagle (v3.0+) 或 Billfish 客户端"],
            changelog: "v1.2.0: 支持视频切片关键帧与动图缩略图的高速缓存预载。",
        },
    },
    {
        id: "open-webui-toolset",
        title: "Open-WebUI & NextChat Pack",
        name: "supdance-openwebui-tool",
        category: "ecosystem",
        categoryLabel: "资产与第三方集成",
        description: "兼容 OpenAI Tool Calling 标准与 Open-WebUI Actions 的函数包，让任何私有部署的大模型无缝获得 SupDance 画布操作能力。",
        version: "v1.0.5",
        isOfficial: false,
        isFeatured: false,
        stars: 380,
        downloads: "5.2k",
        tags: ["Open-WebUI", "NextChat", "Function Calling", "Tool API"],
        quickInstall: "curl -fsSL https://supdance.com/api/mcp/tools.json",
        githubUrl: OFFICIAL_REPO_URL,
        icon: "Wrench",
        coverImage: "/short-drama-styles/space-opera.jpg",
        detailDocs: {
            overview: "赋能私有化部署的大模型前端，通过标准函数调用接入 SupDance 商业级影视渲染管线。",
            features: ["标准化 OpenAPI 3.0 / OpenAI Function Schema 描述", "即插即用集成至 Open-WebUI, NextChat, LobeChat 与 Dify 工作流", "内置完善的错误重试与结果安全脱敏机制"],
            requirements: ["支持 Function Calling 的任意 LLM 客户端与工作流平台"],
            changelog: "v1.0.5: 支持流式生成状态进度向 Open-WebUI 回传展示。",
        },
    },
];
