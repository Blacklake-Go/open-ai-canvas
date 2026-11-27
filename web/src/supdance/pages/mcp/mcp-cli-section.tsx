import { Check, Code2, Copy, Globe, Layers, Terminal } from "lucide-react";
import copy from "copy-to-clipboard";
import { useState, type ReactNode } from "react";
import { useLocaleStore } from "@/stores/use-locale-store";

interface ConfigSpecTab {
    id: string;
    label: Record<string, string>;
    icon: ReactNode;
    status: string;
    description: Record<string, string>;
    code: Record<string, string>;
}

const CONFIG_TABS: ConfigSpecTab[] = [
    {
        id: "cursor",
        label: { "zh-CN": "Cursor (mcp.json)", "en-US": "Cursor (mcp.json)" },
        icon: <Code2 className="size-3.5" strokeWidth={1.8} aria-hidden="true" />,
        status: "SPEC DRAFT · STDIO / HTTP",
        description: {
            "zh-CN": "规划接入方式：通过标准 mcp.json 注册 SupDance 工作台能力（公测开放后提供专属令牌）",
            "zh-TW": "規劃接入方式：透過標準 mcp.json 註冊 SupDance 工作台能力（公測開放後提供專屬權杖）",
            "en-US": "Planned integration: register SupDance workspace capabilities via standard mcp.json (scoped tokens available at launch).",
            "ja-JP": "予定接続方式：標準 mcp.json 経由で SupDance ワークスペース機能を登録（公開後に専用トークンを発行）。",
            "ko-KR": "예정 연동 방식: 표준 mcp.json으로 SupDance 워크스페이스 기능을 등록(출시 후 전용 토큰 발급).",
        },
        code: {
            "zh-CN": `{
  "mcpServers": {
    "supdance": {
      "command": "npx",
      "args": ["-y", "@supdance/mcp-server@next"],
      "env": {
        "SUPDANCE_BASE_URL": "https://www.supdance.com",
        "SUPDANCE_API_KEY": "sd_live_your_scoped_token"
      }
    }
  }
}`,
        },
    },
    {
        id: "claude",
        label: { "zh-CN": "Claude Desktop", "en-US": "Claude Desktop" },
        icon: <Terminal className="size-3.5" strokeWidth={1.8} aria-hidden="true" />,
        status: "SPEC DRAFT · CLAUDE DESKTOP",
        description: {
            "zh-CN": "规划接入方式：在 claude_desktop_config.json 中挂载并自动发现分镜、图像与音乐工具",
            "zh-TW": "規劃接入方式：於 claude_desktop_config.json 中掛載並自動探索分鏡、圖像與音樂工具",
            "en-US": "Planned integration: mount in claude_desktop_config.json to auto-discover storyboard, image, and audio tools.",
            "ja-JP": "予定接続方式：claude_desktop_config.json に設定して絵コンテ・画像・音楽ツールを自動検出。",
            "ko-KR": "예정 연동 방식: claude_desktop_config.json에 등록해 스토리보드·이미지·오디오 도구를 자동 검색.",
        },
        code: {
            "zh-CN": `{
  "mcpServers": {
    "supdance-studio": {
      "command": "npx",
      "args": ["-y", "@supdance/mcp-server@next", "--profile", "studio"],
      "env": {
        "SUPDANCE_API_KEY": "sd_live_your_scoped_token"
      }
    }
  }
}`,
        },
    },
    {
        id: "http",
        label: { "zh-CN": "Streamable HTTP", "en-US": "Streamable HTTP" },
        icon: <Globe className="size-3.5" strokeWidth={1.8} aria-hidden="true" />,
        status: "SPEC DRAFT · REMOTE MCP",
        description: {
            "zh-CN": "规划远程端接入：免本地运行时直连云端托管 MCP 网关，内置 OAuth 2.1 与作用域鉴权",
            "zh-TW": "規劃遠端接入：免本地執行環境直連雲端託管 MCP 閘道，內建 OAuth 2.1 與作用域驗證",
            "en-US": "Planned remote endpoint: connect directly to the managed cloud MCP gateway without local runtimes, secured with OAuth 2.1.",
            "ja-JP": "予定リモート接続：ローカル実行不要でクラウド管理型 MCP ゲートウェイに直結（OAuth 2.1 対応）。",
            "ko-KR": "예정 원격 엔드포인트: 로컬 런타임 없이 OAuth 2.1 기반 클라우드 MCP 게이트웨이에 직접 연결.",
        },
        code: {
            "zh-CN": `POST https://www.supdance.com/api/mcp/v1/messages
Authorization: Bearer sd_live_your_scoped_token
Content-Type: application/json
Accept: application/json, text/event-stream

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}`,
        },
    },
    {
        id: "workspace-outbound",
        label: {
            "zh-CN": "工作台内置客户端（已上线）",
            "zh-TW": "工作台內建用戶端（已上線）",
            "en-US": "Workspace Client (Live)",
            "es-ES": "Cliente Workspace (Activo)",
            "fr-FR": "Client Studio (En ligne)",
            "de-DE": "Workspace-Client (Live)",
            "ja-JP": "ワークスペース内蔵（稼働中）",
            "ko-KR": "워크스페이스 클라이언트 (라이브)",
        },
        icon: <Layers className="size-3.5" strokeWidth={1.8} aria-hidden="true" />,
        status: "LIVE IN PRODUCTION",
        description: {
            "zh-CN": "当前线上工作台 Canvas Agent 已支持挂载外部兼容 MCP 服务，进入画布即可体验",
            "zh-TW": "目前線上工作台 Canvas Agent 已支援掛載外部相容 MCP 服務，進入畫布即可體驗",
            "en-US": "Canvas Agent inside the live workspace already connects to compatible external MCP servers today.",
            "ja-JP": "本番ワークスペースの Canvas Agent は既に互換外部 MCP サーバーの接続に対応しています。",
            "ko-KR": "현재 라이브 워크스페이스의 Canvas Agent에서 호환 외부 MCP 서버를 즉시 연결할 수 있습니다.",
        },
        code: {
            "zh-CN": `# 线上 Canvas Agent 已就绪能力
1. 打开工作台 -> 画布（Canvas）或管理后台 -> MCP 连接管理
2. 添加受信任的外部 MCP Server URL（支持白名单校验与额度限制）
3. 在画布对话面板直接调度外部 MCP 工具与平台原生创作节点协作`,
            "en-US": `# Live capabilities inside Canvas Agent today
1. Open Workspace -> Canvas or Admin Console -> MCP Connections
2. Register trusted external MCP Server URLs (with allowlist & quota controls)
3. Invoke external MCP tools alongside native SupDance canvas & drama nodes`,
        },
    },
];

export function McpCliSection() {
    const locale = useLocaleStore((s) => s.locale);
    const [activeTabId, setActiveTabId] = useState<string>("cursor");
    const [copied, setCopied] = useState(false);

    const activeTab = CONFIG_TABS.find((t) => t.id === activeTabId) || CONFIG_TABS[0];
    const activeCode = activeTab.code[locale] || activeTab.code[locale.startsWith("zh") ? "zh-CN" : "en-US"] || activeTab.code["zh-CN"];
    const activeDesc = activeTab.description[locale] || activeTab.description["en-US"] || activeTab.description["zh-CN"];

    const handleCopy = () => {
        copy(activeCode);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section id="config-spec" className="mcp-section-dark">
            <div className="mcp-container">
                <div className="mcp-section-head">
                    <span className="mcp-eyebrow mcp-eyebrow--dark">CONFIGURATION SPEC PREVIEW</span>
                    <h2 className="mcp-section-h2">标准协议接入规范与配置预览</h2>
                    <p className="mcp-section-lead">
                        对外开放的 SupDance MCP Server 正在研发调试中，待测试验证完备后正式发布 CLI 包与远程网关地址；工作台内外部 MCP 连接器已可直接使用。
                    </p>
                </div>

                <div className="mcp-spec-panel">
                    <div className="mcp-spec-topbar">
                        <div className="mcp-spec-tabs" role="tablist" aria-label="MCP 客户端配置模式">
                            {CONFIG_TABS.map((tab) => {
                                const isActive = tab.id === activeTabId;
                                const tabLabel = tab.label[locale] || tab.label["en-US"] || tab.label["zh-CN"];
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        onClick={() => setActiveTabId(tab.id)}
                                        className={`mcp-spec-tab${isActive ? " is-active" : ""}`}
                                    >
                                        {tab.icon}
                                        <span>{tabLabel}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button type="button" onClick={handleCopy} className="mcp-spec-copy-dark">
                            {copied ? <Check className="size-3.5" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={1.8} />}
                            <span>{copied ? "已复制片段" : "复制配置"}</span>
                        </button>
                    </div>

                    <div className="mcp-spec-meta">
                        <span className="mcp-spec-desc">{activeDesc}</span>
                        <span className="mcp-spec-status">{activeTab.status}</span>
                    </div>

                    <pre className="mcp-spec-code">
                        <code>{activeCode}</code>
                    </pre>
                </div>

                <div className="mcp-steps-grid">
                    <div className="mcp-step-card">
                        <span className="mcp-step-num">STEP 01</span>
                        <h3 className="mcp-step-title">签发作用域凭据</h3>
                        <p className="mcp-step-desc">公测开放后可在个人账户中心生成细粒度 Scoped Token，并独立设定单日积分上限。</p>
                    </div>
                    <div className="mcp-step-card">
                        <span className="mcp-step-num">STEP 02</span>
                        <h3 className="mcp-step-title">声明标准连接配置</h3>
                        <p className="mcp-step-desc">在 Cursor、Claude Desktop 或远程 Agent 运行时写入标准 MCP JSON 配置，无需专有 SDK。</p>
                    </div>
                    <div className="mcp-step-card">
                        <span className="mcp-step-num">STEP 03</span>
                        <h3 className="mcp-step-title">同步到云端自由画布</h3>
                        <p className="mcp-step-desc">通过外部编辑器调用生成的分镜、图片、视频与音频资产，将自动沉淀至你的工作台项目中。</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
