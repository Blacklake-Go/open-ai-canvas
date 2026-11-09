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
    icon: string; // Lucide icon identifier or SVG type
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
    },
];
