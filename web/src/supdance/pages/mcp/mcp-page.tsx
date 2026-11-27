import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useEffect, type MouseEvent } from "react";
import { Link, useLocation } from "react-router";
import { useLocaleStore } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";
import { SupdanceAboutFooter } from "@/supdance/components/site-footer/supdance-about-footer";
import { McpCliSection } from "./mcp-cli-section";
import { McpFaqSection } from "./mcp-faq-section";
import { McpHeader } from "./mcp-header";
import { McpToolsSection } from "./mcp-tools-section";
import "./mcp-page.css";

interface ArchItem {
    num: string;
    title: Record<string, string>;
    desc: Record<string, string>;
    tags: readonly string[];
}

const HERO_COPY = {
    status: {
        "zh-CN": "MODEL CONTEXT PROTOCOL · 正在构建中",
        "zh-TW": "MODEL CONTEXT PROTOCOL · 正建構中",
        "en-US": "MODEL CONTEXT PROTOCOL · IN ACTIVE DEVELOPMENT",
        "ja-JP": "MODEL CONTEXT PROTOCOL · 開発中",
        "ko-KR": "MODEL CONTEXT PROTOCOL · 개발 진행 중",
        "es-ES": "MODEL CONTEXT PROTOCOL · EN DESARROLLO",
        "fr-FR": "MODEL CONTEXT PROTOCOL · EN DÉVELOPPEMENT",
        "de-DE": "MODEL CONTEXT PROTOCOL · IN ENTWICKLUNG",
    },
    title1: {
        "zh-CN": "让任意 AI 助手，",
        "zh-TW": "讓任意 AI 助手，",
        "en-US": "Let any AI assistant,",
        "ja-JP": "あらゆる AI アシスタントから、",
        "ko-KR": "모든 AI 어시스턴트에서,",
        "es-ES": "Permite a cualquier asistente de IA,",
        "fr-FR": "Laissez n'importe quel assistant IA,",
        "de-DE": "Lassen Sie jeden KI-Assistenten,",
    },
    title2: {
        "zh-CN": "直接驱动你的创作工作台。",
        "zh-TW": "直接驅動你的創作工作台。",
        "en-US": "drive your creative workspace directly.",
        "ja-JP": "あなたの制作ワークスペースを直接操作。",
        "ko-KR": "창작 워크스페이스를 직접 제어하세요.",
        "es-ES": "controlar tu espacio creativo directamente.",
        "fr-FR": "piloter directement votre espace créatif.",
        "de-DE": "Ihren kreativen Workspace direkt steuern.",
    },
    subtitle: {
        "zh-CN": "SupDance MCP 协议与服务端正在研发构建中。未来无论身处 Cursor、Claude Desktop 还是自研 Agent 运行时，都能通过统一上下文协议直连短剧分镜、图像、视频与多轨音乐引擎。",
        "zh-TW": "SupDance MCP 協議與伺服端正研發建構中。未來無論身處 Cursor、Claude Desktop 還是自研 Agent 執行階段，都能透過統一上下文協議直連短劇分鏡、圖像、影片與多軌音樂引擎。",
        "en-US": "The SupDance MCP server and protocol layer are under active engineering. Soon, whether in Cursor, Claude Desktop, or custom Agent runtimes, you will connect directly to storyboard, image, video, and music engines through one unified context protocol.",
        "ja-JP": "SupDance MCP プロトコルおよびサーバーは現在構築中です。Cursor、Claude Desktop、自作 Agent から、絵コンテ・画像・動画・音楽エンジンへ統一プロトコルで直接接続できます。",
        "ko-KR": "SupDance MCP 프로토콜과 서버가 활발히 구축 중입니다. Cursor, Claude Desktop 또는 자체 Agent 런타임에서 스토리보드, 이미지, 비디오, 오디오 엔진에 직접 연결할 수 있습니다.",
        "es-ES": "El protocolo y servidor MCP de SupDance se encuentran en desarrollo activo para conectar directamente Cursor, Claude Desktop o agentes propios con nuestros motores creativos.",
        "fr-FR": "Le serveur et protocole MCP SupDance sont en cours de développement pour connecter Cursor, Claude Desktop ou vos propres agents à nos moteurs de création.",
        "de-DE": "Das SupDance MCP-Protokoll und der Server befinden sich in aktiver Entwicklung, um Cursor, Claude Desktop oder eigene Agenten direkt mit unserer Creative Suite zu verbinden.",
    },
    ctaViewSpec: {
        "zh-CN": "查看协议预览",
        "zh-TW": "查看協議預覽",
        "en-US": "Explore Protocol Spec",
        "ja-JP": "仕様プレビューを見る",
        "ko-KR": "프로토콜 명세 보기",
        "es-ES": "Ver especificación",
        "fr-FR": "Voir les spécifications",
        "de-DE": "Spezifikation ansehen",
    },
    ctaOpenWorkspace: {
        "zh-CN": "进入线上工作台",
        "zh-TW": "進入線上工作台",
        "en-US": "Open Live Workspace",
        "ja-JP": "ワークスペースを開く",
        "ko-KR": "라이브 워크스페이스 열기",
        "es-ES": "Abrir espacio en vivo",
        "fr-FR": "Ouvrir l'espace de travail",
        "de-DE": "Live-Workspace öffnen",
    },
};

const ARCHITECTURE_PILLARS: ArchItem[] = [
    {
        num: "01",
        title: {
            "zh-CN": "标准化协议层", "zh-TW": "標準化協議層", "en-US": "Standardized Protocol Layer",
            "es-ES": "Capa de Protocolo Estándar", "fr-FR": "Couche Protocole Standard", "de-DE": "Standardisierte Protokollschicht",
            "ja-JP": "標準プロトコル層", "ko-KR": "표준 프로토콜 계층",
        },
        desc: {
            "zh-CN": "严格遵循 Anthropic Model Context Protocol 规范，统一工具发现（tools/list）、结构化入参校验与标准 JSON-RPC 调用响应。",
            "zh-TW": "嚴格遵循 Anthropic Model Context Protocol 規範，統一工具探索（tools/list）、結構化參數校驗與標準 JSON-RPC 呼叫回應。",
            "en-US": "Built strictly on the Anthropic Model Context Protocol specification—unifying tool discovery (tools/list), typed input validation, and JSON-RPC responses.",
            "es-ES": "Construido siguiendo Model Context Protocol con descubrimiento unificado (tools/list), validación tipada y respuestas JSON-RPC.",
            "fr-FR": "Basé sur la spécification Model Context Protocol avec découverte d'outils (tools/list), validation typée et JSON-RPC.",
            "de-DE": "Basiert strikt auf dem Model Context Protocol: vereinheitlichtes Discovery (tools/list), typisierte Validierung und JSON-RPC.",
            "ja-JP": "Anthropic Model Context Protocol に完全準拠し、tools/list・型安全バリデーション・JSON-RPC 応答を統一します。",
            "ko-KR": "Anthropic Model Context Protocol 사양을 준수하여 tools/list 도구 탐색, 타입 검증 및 JSON-RPC 응답을 통일합니다.",
        },
        tags: ["JSON-RPC 2.0", "Streamable HTTP", "stdio"],
    },
    {
        num: "02",
        title: {
            "zh-CN": "创作级异步管线", "zh-TW": "創作級非同步管線", "en-US": "Production Async Pipelines",
            "es-ES": "Pipelines Asíncronos", "fr-FR": "Pipelines Asynchrones", "de-DE": "Asynchrone Produktions-Pipelines",
            "ja-JP": "制作向け非同期パイプライン", "ko-KR": "프로덕션 비동기 파이프라인",
        },
        desc: {
            "zh-CN": "针对影视视频与多轨音频生成长耗时场景内建任务轮询、断点状态恢复与资产直链回写，不阻塞客户端对话流。",
            "zh-TW": "針對影視影片與多軌音訊產生長耗時場景內建任務輪詢、斷點狀態恢復與資產直鏈回寫，不阻塞用戶端對話流。",
            "en-US": "Engineered for long-running video and multi-track audio generation with non-blocking polling, crash-safe recovery, and canvas asset writeback.",
            "es-ES": "Diseñado para renders largos de video y audio con sondeo sin bloqueo, recuperación segura y guardado en lienzo.",
            "fr-FR": "Conçu pour les rendus longs vidéo et audio sans bloquer votre assistant, avec reprise sur erreur et sauvegarde canevas.",
            "de-DE": "Entwickelt für langlaufende Video- und Audio-Renders mit non-blocking Polling, Wiederherstellung und Canvas-Synchronisation.",
            "ja-JP": "長時間の動画・音声生成に対応したノンブロッキングポーリングと障害復旧を備え、対話フローを妨げずキャンバスへ保存します。",
            "ko-KR": "장시간 소요되는 비디오·오디오 렌더링을 위한 논블로킹 폴링, 장애 복구 및 캔버스 자동 기록을 지원합니다.",
        },
        tags: ["Async Tasks", "Asset Sync", "Canvas Writeback"],
    },
    {
        num: "03",
        title: {
            "zh-CN": "统一身份与额度隔离", "zh-TW": "統一身份與額度隔離", "en-US": "Unified Identity & Quota Guard",
            "es-ES": "Identidad y Cuotas Aisladas", "fr-FR": "Identité & Quotas Isolés", "de-DE": "Identität & Kontingentschutz",
            "ja-JP": "統合認証とクォータ保護", "ko-KR": "통합 인증 및 할당량 보호",
        },
        desc: {
            "zh-CN": "复用生产环境同源沙盒、Scoped Token 鉴权、单日用量上限与积分预留核算，外部工具调用与主站共用安全审计边界。",
            "zh-TW": "複用生產環境同源沙盒、Scoped Token 驗證、單日用量上限與積分預留核算，外部工具呼叫與主站共用安全稽核邊界。",
            "en-US": "Shares production sandboxing, scoped tokens, daily usage limits, and credit ledger reservations—applying identical audit boundaries.",
            "es-ES": "Comparte sandbox de producción, tokens limitados, límites diarios y contabilidad de créditos bajo la misma auditoría.",
            "fr-FR": "Partage le bac à sable de production, les jetons limités, les plafonds quotidiens et les audits de sécurité.",
            "de-DE": "Nutzt Produktions-Sandbox, Scoped Tokens, Tageslimits und Credit-Buchhaltung unter identischen Sicherheitsrichtlinien.",
            "ja-JP": "本番環境と同一のサンドボックス、Scoped Token、日次上限、クレジット予約会計を共有し監査境界を統一します。",
            "ko-KR": "프로덕션 샌드박스, 범위 제한 토큰, 일일 한도 및 크레딧 예약 정산을 공유하여 일관된 보안 경계를 유지합니다.",
        },
        tags: ["Scoped Auth", "Quota Guard", "Audit Ledger"],
    },
];

const CLIENT_TARGETS = ["Cursor", "Claude Desktop", "Windsurf", "Cline", "Custom Agents"] as const;

interface RoadmapItem {
    phase: string;
    status: Record<string, string>;
    stateClass: string;
    title: Record<string, string>;
    desc: Record<string, string>;
}

const ROADMAP_PHASES: RoadmapItem[] = [
    {
        phase: "PHASE 01",
        status: { "zh-CN": "已就绪 · LIVE", "en-US": "LIVE", "zh-TW": "已就緒 · LIVE", "ja-JP": "稼働中 · LIVE", "ko-KR": "라이브 · LIVE" },
        stateClass: "is-live",
        title: { "zh-CN": "工作台内置 MCP 连接器", "zh-TW": "工作台內建 MCP 連接器", "en-US": "Built-In Workspace Connectors", "ja-JP": "ワークスペース内蔵コネクタ", "ko-KR": "워크스페이스 내장 커넥터" },
        desc: {
            "zh-CN": "画布 Agent 已支持安全接入第三方兼容 MCP 服务，并与内部节点、短剧分镜工具同台协作。",
            "zh-TW": "畫布 Agent 已支援安全接入第三方相容 MCP 服務，並與內部節點、短劇分鏡工具同台協作。",
            "en-US": "Canvas Agent already connects securely to external MCP services alongside native canvas and drama tools.",
            "ja-JP": "Canvas Agent は外部 MCP サービスと安全に連携し、内蔵キャンバスツールと協調動作しています。",
            "ko-KR": "Canvas Agent는 이미 호환 외부 MCP 서비스와 안전하게 연결되어 기본 캔버스 도구와 함께 작동합니다.",
        },
    },
    {
        phase: "PHASE 02",
        status: { "zh-CN": "构建中 · ACTIVE", "en-US": "IN PROGRESS", "zh-TW": "建構中 · ACTIVE", "ja-JP": "開発中 · ACTIVE", "ko-KR": "구축 중 · ACTIVE" },
        stateClass: "is-building",
        title: { "zh-CN": "SupDance MCP Server 核心", "zh-TW": "SupDance MCP Server 核心", "en-US": "SupDance MCP Server Core", "ja-JP": "SupDance MCP Server コア", "ko-KR": "SupDance MCP Server 코어" },
        desc: {
            "zh-CN": "正在完善分镜拆解、角色锁定、视频镜头与多轨音频四大原子创作工具的类型契约与异步任务接口。",
            "zh-TW": "正完善分鏡拆解、角色鎖定、影片鏡頭與多軌音訊四大原子創作工具的型別契約與非同步任務介面。",
            "en-US": "Finalizing typed schemas and async execution contracts for storyboard, character lock, video, and audio tools.",
            "ja-JP": "絵コンテ分解・キャラ固定・動画・音楽4大ツールの型定義と非同期タスクインターフェースを実装中です。",
            "ko-KR": "스토리보드, 캐릭터 고정, 비디오, 오디오 4대 핵심 도구의 타입 계약과 비동기 인터페이스를 고도화 중입니다.",
        },
    },
    {
        phase: "PHASE 03",
        status: { "zh-CN": "规划中 · NEXT", "en-US": "PLANNED", "zh-TW": "規劃中 · NEXT", "ja-JP": "予定 · NEXT", "ko-KR": "예정 · NEXT" },
        stateClass: "",
        title: { "zh-CN": "OAuth 2.1 与凭据中心", "zh-TW": "OAuth 2.1 與憑證中心", "en-US": "OAuth 2.1 & Credential Hub", "ja-JP": "OAuth 2.1 と認証情報ハブ", "ko-KR": "OAuth 2.1 및 자격 증명 허브" },
        desc: {
            "zh-CN": "在个人账户中心开放开发者 Scoped API Key 管理、权限范围裁剪与细粒度消费限额设置。",
            "zh-TW": "於個人帳戶中心開放開發者 Scoped API Key 管理、權限範圍裁剪與細粒度消費限額設定。",
            "en-US": "Self-serve scoped API keys in Account Settings with fine-grained permission scopes and daily spend limits.",
            "ja-JP": "アカウント設定で開発者向け Scoped API Key 発行・権限制限・日次上限設定を開放予定です。",
            "ko-KR": "계정 설정에서 개발자용 Scoped API Key 발급, 권한 범위 제어 및 일일 한도 설정 기능을 제공합니다.",
        },
    },
    {
        phase: "PHASE 04",
        status: { "zh-CN": "规划中 · UPCOMING", "en-US": "UPCOMING", "zh-TW": "規劃中 · UPCOMING", "ja-JP": "計画中 · UPCOMING", "ko-KR": "로드맵 · UPCOMING" },
        stateClass: "",
        title: { "zh-CN": "开放 SDK 与工作流桥接", "zh-TW": "開放 SDK 與工作流橋接", "en-US": "Open SDK & Pipeline Bridges", "ja-JP": "公開 SDK とワークフロー連携", "ko-KR": "오픈 SDK 및 파이프라인 브릿지" },
        desc: {
            "zh-CN": "推出跨平台 CLI 包与第三方工作流桥接节点，支持外部管线批量驱动云端渲染与资产双向同步。",
            "zh-TW": "推出跨平台 CLI 套件與第三方工作流橋接節點，支援外部管線批次驅動雲端渲染與資產雙向同步。",
            "en-US": "Cross-platform CLI tooling and workflow bridges for batch cloud rendering and bidirectional asset sync.",
            "ja-JP": "クロスプラットフォーム CLI とワークフロー連携ノードにより外部からの一括クラウド描画を実現します。",
            "ko-KR": "크로스 플랫폼 CLI 패키지 및 외부 파이프라인 연동을 위한 클라우드 렌더링·자산 동기화 브릿지를 제공합니다.",
        },
    },
];

function pickCopy(locale: string, map: Record<string, string>): string {
    return map[locale] || map["en-US"] || map["zh-CN"];
}

export default function McpPage() {
    const user = useUserStore((s) => s.user);
    const locale = useLocaleStore((s) => s.locale);
    const location = useLocation();

    // 挂载时解除画布特有的全局 fixed/hidden 视口锁定，赋予页面 100% 原生 Window 下拉滚动体验
    useEffect(() => {
        document.documentElement.classList.add("is-mcp-page");
        document.body.classList.add("is-mcp-page");
        return () => {
            document.documentElement.classList.remove("is-mcp-page");
            document.body.classList.remove("is-mcp-page");
        };
    }, []);

    // 滚轮与键盘全场景辅助支持，确保触控板/鼠标滚轮在所有视口下均可顺畅下拉浏览
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (document.documentElement.scrollTop === 0 && e.deltaY > 0 && window.scrollY === 0) {
                window.scrollBy({ top: e.deltaY, behavior: "auto" });
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown" || e.key === "PageDown") {
                window.scrollBy({ top: e.key === "PageDown" ? 600 : 150, behavior: "smooth" });
            } else if (e.key === "ArrowUp" || e.key === "PageUp") {
                window.scrollBy({ top: e.key === "PageUp" ? -600 : -150, behavior: "smooth" });
            } else if (e.key === " " && (e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
                e.preventDefault();
                window.scrollBy({ top: e.shiftKey ? -600 : 600, behavior: "smooth" });
            }
        };

        window.addEventListener("wheel", handleWheel, { passive: true });
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("wheel", handleWheel);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    // 处理 hash 锚点平滑滚动（例如 #tools-schema, #config-spec, #mcp-roadmap）
    useEffect(() => {
        if (location.hash) {
            const targetId = location.hash.replace("#", "");
            const el = document.getElementById(targetId);
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
            }
        }
    }, [location.hash]);

    useEffect(() => {
        document.title = locale.startsWith("zh")
            ? "SupDance MCP — 开放创作协议与 Agent 扩展中心"
            : "SupDance MCP — Model Context Protocol & Agent Hub";
    }, [locale]);

    const handleScrollToTools = (e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        const target = document.querySelector("#tools-schema");
        if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    return (
        <div className="mcp-editorial-root">
            <McpHeader />

            {/* Band 1: 暗黑序幕 Hero（承袭关于页等高线纹理与极简排版） */}
            <section className="mcp-hero">
                <svg className="mcp-hero-waves" viewBox="0 0 1440 820" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
                    <path d="M-80 260C220 190 480 340 780 250C1060 165 1290 280 1520 210" stroke="#eee7d7" strokeOpacity="0.22" strokeWidth="1" />
                    <path d="M-80 320C240 255 510 390 810 300C1080 220 1300 330 1520 265" stroke="#eee7d7" strokeOpacity="0.16" strokeWidth="1" />
                    <path d="M-80 385C260 320 530 445 830 360C1100 285 1310 385 1520 325" stroke="#eee7d7" strokeOpacity="0.12" strokeWidth="1" />
                    <path d="M-80 460C270 395 540 515 840 430C1110 355 1320 450 1520 395" stroke="#eee7d7" strokeOpacity="0.09" strokeWidth="1" />
                    <path d="M-80 540C280 475 550 590 850 510C1120 435 1330 520 1520 470" stroke="#eee7d7" strokeOpacity="0.07" strokeWidth="1" />
                </svg>
                <div className="mcp-hero-vignette" />

                <div className="mcp-hero-content">
                    <div className="mcp-hero-kicker mcp-eyebrow">
                        <span className="mcp-hero-status-dot" aria-hidden="true" />
                        <span>{pickCopy(locale, HERO_COPY.status)}</span>
                    </div>

                    <h1 className="mcp-hero-title">
                        {pickCopy(locale, HERO_COPY.title1)}
                        <br />
                        {pickCopy(locale, HERO_COPY.title2)}
                    </h1>

                    <p className="mcp-hero-subtitle">
                        {pickCopy(locale, HERO_COPY.subtitle)}
                    </p>

                    <div className="mcp-hero-actions">
                        <a href="#tools-schema" onClick={handleScrollToTools} className="mcp-btn-pill-light">
                            <span>{pickCopy(locale, HERO_COPY.ctaViewSpec)}</span>
                            <ArrowDown className="size-4" strokeWidth={1.8} aria-hidden="true" />
                        </a>
                        <Link to={user ? "/create" : "/"} className="mcp-btn-pill-dark-outline">
                            <span>{pickCopy(locale, HERO_COPY.ctaOpenWorkspace)}</span>
                            <ArrowUpRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
                        </Link>
                    </div>

                    <div className="mcp-hero-emblem" aria-hidden="true">
                        <span className="mcp-hero-emblem-line" />
                        <span className="mcp-hero-emblem-mark">
                            <img src="/supdance-mark.png" alt="" />
                        </span>
                        <span className="mcp-hero-emblem-line" />
                    </div>

                    <div className="mcp-hero-pillars">
                        <div>
                            <div className="mcp-pillar-label">01 · PROTOCOL PREVIEW</div>
                            <p className="mcp-pillar-text">诚实透明的协议设计期预览：工具入参契约与远程端点正在联调与安全压测中。</p>
                        </div>
                        <div>
                            <div className="mcp-pillar-label">02 · AGENT CONNECTED</div>
                            <p className="mcp-pillar-text">线上工作台画布助手（Canvas Agent）已率先支持挂载外部兼容 MCP 服务。</p>
                        </div>
                        <div>
                            <div className="mcp-pillar-label">03 · SAME SANDBOX</div>
                            <p className="mcp-pillar-text">严格延续生产环境同源鉴权、积分核算与资产归属体系，拒绝临时拼凑网关。</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Band 2: 暖白宣纸区 · 架构原则与客户端生态 */}
            <section id="mcp-architecture" className="mcp-section-paper">
                <div className="mcp-container">
                    <div className="mcp-section-head">
                        <span className="mcp-eyebrow mcp-eyebrow--light">ARCHITECTURE & PRINCIPLES</span>
                        <h2 className="mcp-section-h2">为全模态影视工作流而生的开放协议层</h2>
                        <p className="mcp-section-lead">
                            不同于简单的文本推理封装，SupDance MCP 从一开始便针对重资产、长耗时、多步骤的创作管线进行工程设计，确保每次外部调用都能稳定沉淀为画布中的可控作品。
                        </p>
                    </div>

                    <div className="mcp-arch-grid">
                        {ARCHITECTURE_PILLARS.map((item) => (
                            <article key={item.num} className="mcp-arch-card">
                                <span className="mcp-arch-num">{item.num}</span>
                                <h3 className="mcp-arch-title">{pickCopy(locale, item.title)}</h3>
                                <p className="mcp-arch-desc">{pickCopy(locale, item.desc)}</p>
                                <div className="mcp-arch-tags">
                                    {item.tags.map((tag) => (
                                        <span key={tag} className="mcp-mono-chip">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </div>

                    <div className="mcp-clients-bar">
                        <span className="mcp-clients-label">PLANNED COMPATIBLE CLIENTS</span>
                        <div className="mcp-clients-list">
                            {CLIENT_TARGETS.map((client) => (
                                <span key={client} className="mcp-client-pill">
                                    <span className="mcp-client-dot" aria-hidden="true" />
                                    <span>{client}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Band 3: 暖灰宣纸区 · 工具规范契约预览 */}
            <McpToolsSection />

            {/* Band 4: 深炭黑技术区 · 配置片段预览 */}
            <McpCliSection />

            {/* Band 5: 暖白宣纸区 · 研发路线图 + 诚实 FAQ + CTA */}
            <section id="mcp-roadmap" className="mcp-section-paper">
                <div className="mcp-container">
                    <div className="mcp-section-head">
                        <span className="mcp-eyebrow mcp-eyebrow--light">DELIVERY ROADMAP</span>
                        <h2 className="mcp-section-h2">务实推进的构建路线图</h2>
                        <p className="mcp-section-lead">先把底座做扎实，再分阶段开放接口。你可以先在画布工作台中使用已上线的外部 MCP 连接能力。</p>
                    </div>

                    <div className="mcp-roadmap-grid">
                        {ROADMAP_PHASES.map((step) => (
                            <article key={step.phase} className="mcp-roadmap-card">
                                <div className="mcp-roadmap-top">
                                    <span className="mcp-roadmap-phase">{step.phase}</span>
                                    <span className={`mcp-roadmap-pill${step.stateClass ? ` ${step.stateClass}` : ""}`}>{pickCopy(locale, step.status)}</span>
                                </div>
                                <h3 className="mcp-roadmap-title">{pickCopy(locale, step.title)}</h3>
                                <p className="mcp-roadmap-desc">{pickCopy(locale, step.desc)}</p>
                            </article>
                        ))}
                    </div>

                    <McpFaqSection />

                    <div className="mcp-cta-banner">
                        <div>
                            <span className="mcp-eyebrow mcp-eyebrow--dark">READY TODAY · WORKSPACE</span>
                            <h3 className="mcp-cta-title">立即进入 SupDance 工作台体验</h3>
                            <p className="mcp-cta-sub">在正式版外部 MCP Server 开放之前，你已可在工作台内使用自由画布、短剧制作与内置 Agent 连接器。</p>
                        </div>
                        <div className="mcp-cta-btns">
                            <Link to={user ? "/create" : "/"} className="mcp-btn-pill-light">
                                <span>开始创作</span>
                                <ArrowUpRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
                            </Link>
                            <a href="/about" className="mcp-btn-pill-dark-outline">
                                <span>了解 SupDance</span>
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Band 6: 统一站点页脚 */}
            <SupdanceAboutFooter pagePath="/mcp" />
        </div>
    );
}
