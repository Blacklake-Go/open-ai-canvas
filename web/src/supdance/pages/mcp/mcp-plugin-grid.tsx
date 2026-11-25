import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { interfaceText } from "@/i18n/interface-text";
import copy from "copy-to-clipboard";
import { Search, Copy, Check, ExternalLink, ShieldCheck, Cpu, Terminal, Layers, Film, Music, UserCheck, FolderSync, Wrench, Sparkles, Star, DownloadCloud } from "lucide-react";
import { GitHubIcon } from "./github-icon";
import { MCP_CATEGORIES, MCP_PLUGINS, McpPluginItem, OFFICIAL_REPO_URL } from "./mcp-plugin-list";
import { McpPluginModal } from "./mcp-plugin-modal";

// 图标渲染映射
function renderPluginIcon(iconName: string) {
    const props = { className: "size-4 text-rose-500" };
    switch (iconName) {
        case "Cpu":
            return <Cpu {...props} />;
        case "Terminal":
            return <Terminal {...props} />;
        case "Layers":
            return <Layers {...props} />;
        case "Film":
            return <Film {...props} />;
        case "Music":
            return <Music {...props} />;
        case "UserCheck":
            return <UserCheck {...props} />;
        case "FolderSync":
            return <FolderSync {...props} />;
        case "Wrench":
        default:
            return <Wrench {...props} />;
    }
}

export function McpPluginGrid() {
    const { i18n } = useTranslation();
    const locale = i18n.resolvedLanguage;
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [activeModalPlugin, setActiveModalPlugin] = useState<McpPluginItem | null>(null);

    // 计算各分类下的数量
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { all: MCP_PLUGINS.length };
        for (const p of MCP_PLUGINS) {
            counts[p.category] = (counts[p.category] || 0) + 1;
        }
        return counts;
    }, []);

    const filteredPlugins = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return MCP_PLUGINS.filter((item) => {
            const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
            if (!matchesCategory) return false;
            if (!query) return true;
            return [item.title, item.description, interfaceText(item.description), item.name, ...item.tags].some((text) => text.toLowerCase().includes(query));
        });
    }, [selectedCategory, searchQuery, locale]);

    const handleCopy = (id: string, text: string) => {
        copy(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <section className="relative mx-auto mt-20 max-w-7xl px-4 sm:px-6">
            {/* 标头区域 */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-rose-600 dark:text-rose-400 uppercase">
                        <Sparkles className="size-3.5" />
                        <span>Liblib Style Community Ecosystem</span>
                    </div>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">插件与扩展集市</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">探索由 SupDance 官方及开源社区驱动的生态组件，涵盖 ComfyUI 工作流、MCP 协议中枢与多模态创作扩展。</p>
                </div>

                {/* 搜索框 */}
                <div className="relative w-full md:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索插件、协议或模型标签..."
                        className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground shadow-xs focus:border-ring focus:outline-none"
                    />
                </div>
            </div>

            {/* 分类切换 Tabs（带数量徽标 Badge） */}
            <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-4">
                {MCP_CATEGORIES.map((cat) => {
                    const isActive = cat.key === selectedCategory;
                    const count = categoryCounts[cat.key] ?? 0;
                    return (
                        <button
                            key={cat.key}
                            type="button"
                            onClick={() => setSelectedCategory(cat.key)}
                            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                                isActive ? "bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)] shadow-xs" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                            }`}
                        >
                            <span>{interfaceText(cat.label)}</span>
                            <span className={`rounded-full px-1.5 py-0.2 font-mono text-[var(--fs-label)] ${isActive ? "bg-[var(--button-primary-fg)]/15 text-[var(--button-primary-fg)]" : "bg-background/70 text-muted-foreground"}`}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* 插件卡片网格 */}
            {filteredPlugins.length === 0 ? (
                <div className="my-16 rounded-2xl border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground">未找到匹配的插件或扩展组件</p>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedCategory("all");
                            setSearchQuery("");
                        }}
                        className="mt-3 text-xs font-semibold text-rose-500 hover:underline"
                    >
                        重置搜索与分类条件
                    </button>
                </div>
            ) : (
                <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredPlugins.map((plugin) => (
                        <PluginCard key={plugin.id} plugin={plugin} copied={copiedId === plugin.id} onCopy={() => handleCopy(plugin.id, plugin.quickInstall)} onOpenDetail={() => setActiveModalPlugin(plugin)} />
                    ))}
                </div>
            )}

            {/* 开发者入驻与贡献横幅 */}
            <div className="mt-16 overflow-hidden rounded-2xl border border-border bg-muted/40 p-8 shadow-xs">
                <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                    <div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                            <GitHubIcon className="size-3.5" />
                            <span>Open Source & Community Ecosystem</span>
                        </div>
                        <h3 className="mt-2 text-xl font-bold text-foreground">共建 SupDance 插件与 MCP 生态</h3>
                        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">无论你是 ComfyUI 自定义节点作者、MCP 工具开发者，还是 AI 视频模型创作者，欢迎向官方仓库提交 PR 或入驻插件集市。</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <a
                            href={OFFICIAL_REPO_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-[var(--button-primary-bg)] px-4 py-2.5 text-xs font-semibold text-[var(--button-primary-fg)] shadow-[var(--button-primary-shadow)] transition-transform hover:scale-105 hover:bg-[var(--button-primary-hover-bg)]"
                        >
                            <GitHubIcon className="size-4" />
                            <span>前往 GitHub 仓库 Star</span>
                        </a>
                        <a
                            href={`${OFFICIAL_REPO_URL}#contributing`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                        >
                            <span>提交你的插件</span>
                            <ExternalLink className="size-3.5" />
                        </a>
                    </div>
                </div>
            </div>

            {/* 插件详情弹窗 */}
            <McpPluginModal plugin={activeModalPlugin} onClose={() => setActiveModalPlugin(null)} />
        </section>
    );
}

function PluginCard({ plugin, copied, onCopy, onOpenDetail }: { plugin: McpPluginItem; copied: boolean; onCopy: () => void; onOpenDetail: () => void }) {
    return (
        <div
            onClick={onOpenDetail}
            className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-foreground/25 hover:shadow-[var(--elevation-card-hover)]"
        >
            <div>
                {/* 顶部 16:9 影视效果封面预览图 (参考 Liblib) */}
                <div className="relative mb-4 h-36 w-full overflow-hidden rounded-xl border border-border bg-muted">
                    <img src={plugin.coverImage} alt={plugin.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-neutral-950)]/70 via-transparent to-transparent" />
                    <span className="absolute bottom-2 left-2 rounded bg-[var(--color-neutral-950)]/70 px-2 py-0.5 font-mono text-[var(--fs-label)] text-[var(--color-neutral-0)] backdrop-blur-sm">{interfaceText(plugin.categoryLabel)}</span>
                    <span className="absolute bottom-2 right-2 rounded bg-rose-600/85 px-2 py-0.5 font-mono text-[var(--fs-label)] font-bold text-[var(--color-neutral-0)] backdrop-blur-sm">{plugin.version}</span>
                </div>

                {/* 标题 + 官方认证 */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">{renderPluginIcon(plugin.icon)}</div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h3 className="text-sm font-bold text-foreground group-hover:text-rose-500 transition-colors dark:group-hover:text-rose-300">{plugin.title}</h3>
                                {plugin.isOfficial && (
                                    <span title="官方认证插件" className="text-rose-500">
                                        <ShieldCheck className="size-3.5" />
                                    </span>
                                )}
                            </div>
                            <div className="font-mono text-[var(--fs-label)] text-muted-foreground">{plugin.name}</div>
                        </div>
                    </div>
                </div>

                {/* 描述 */}
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{interfaceText(plugin.description)}</p>

                {/* 统计指标 */}
                <div className="mt-3.5 flex items-center gap-4 text-[var(--fs-label)] text-muted-foreground">
                    {plugin.stars && (
                        <div className="flex items-center gap-1">
                            <Star className="size-3 text-amber-500" />
                            <span>{plugin.stars}</span>
                        </div>
                    )}
                    {plugin.downloads && (
                        <div className="flex items-center gap-1">
                            <DownloadCloud className="size-3 text-muted-foreground" />
                            <span>{plugin.downloads}</span>
                        </div>
                    )}
                    <span className="text-[var(--fs-label)] text-rose-500 hover:underline">点击查看详情 →</span>
                </div>

                {/* 标签 */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {plugin.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded border border-border bg-muted/60 px-2 py-0.5 text-[var(--fs-label)] text-muted-foreground">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            {/* 底部操作条：一键安装命令 + GitHub 链接 */}
            <div className="mt-5 border-t border-border pt-3.5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={onCopy}
                        title={`点击复制: ${plugin.quickInstall}`}
                        className="group/btn flex flex-1 items-center justify-between rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 font-mono text-[var(--fs-label)] text-foreground transition-colors hover:border-foreground/20 hover:bg-muted"
                    >
                        <span className="truncate pr-2 text-left">{plugin.quickInstall}</span>
                        {copied ? <Check className="size-3.5 shrink-0 text-emerald-500" /> : <Copy className="size-3.5 shrink-0 text-muted-foreground group-hover/btn:text-foreground" />}
                    </button>

                    <a
                        href={plugin.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="查看 GitHub 仓库源码"
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <GitHubIcon className="size-3.5" />
                    </a>
                </div>
            </div>
        </div>
    );
}
