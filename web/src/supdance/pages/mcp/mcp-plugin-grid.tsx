import { useState, useMemo } from "react";
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
            return item.title.toLowerCase().includes(query) || item.description.toLowerCase().includes(query) || item.name.toLowerCase().includes(query) || item.tags.some((tag) => tag.toLowerCase().includes(query));
        });
    }, [selectedCategory, searchQuery]);

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
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-rose-500 dark:text-rose-400 uppercase">
                        <Sparkles className="size-3.5" />
                        <span>Liblib Style Community Ecosystem</span>
                    </div>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-white">插件与扩展集市</h2>
                    <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">探索由 SupDance 官方及开源社区驱动的生态组件，涵盖 ComfyUI 工作流、MCP 协议中枢与多模态创作扩展。</p>
                </div>

                {/* 搜索框 */}
                <div className="relative w-full md:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索插件、协议或模型标签..."
                        className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-white/10 dark:bg-[#121217] dark:text-white dark:placeholder-zinc-500"
                    />
                </div>
            </div>

            {/* 分类切换 Tabs（带数量徽标 Badge） */}
            <div className="mt-6 flex flex-wrap gap-2 border-b border-zinc-100 pb-4 dark:border-white/5">
                {MCP_CATEGORIES.map((cat) => {
                    const isActive = cat.key === selectedCategory;
                    const count = categoryCounts[cat.key] ?? 0;
                    return (
                        <button
                            key={cat.key}
                            type="button"
                            onClick={() => setSelectedCategory(cat.key)}
                            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                                isActive ? "bg-rose-500 text-white shadow-sm shadow-rose-500/25" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
                            }`}
                        >
                            <span>{cat.label}</span>
                            <span className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-zinc-200 text-zinc-600 dark:bg-white/10 dark:text-zinc-400"}`}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* 插件卡片网格 */}
            {filteredPlugins.length === 0 ? (
                <div className="my-16 rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-white/10">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">未找到匹配的插件或扩展组件</p>
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
            <div className="mt-16 overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-r from-rose-50 via-zinc-50 to-purple-50 p-8 shadow-sm dark:border-white/10 dark:from-rose-950/40 dark:via-[#181822] dark:to-purple-950/30">
                <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                    <div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                            <GitHubIcon className="size-3.5" />
                            <span>Open Source & Community Ecosystem</span>
                        </div>
                        <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">共建 SupDance 插件与 MCP 生态</h3>
                        <p className="mt-1 max-w-2xl text-xs text-zinc-600 dark:text-zinc-400">无论你是 ComfyUI 自定义节点作者、MCP 工具开发者，还是 AI 视频模型创作者，欢迎向官方仓库提交 PR 或入驻插件集市。</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <a
                            href={OFFICIAL_REPO_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-transform hover:scale-105 hover:bg-black dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                        >
                            <GitHubIcon className="size-4" />
                            <span>前往 GitHub 仓库 Star</span>
                        </a>
                        <a
                            href={`${OFFICIAL_REPO_URL}#contributing`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
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
            className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-rose-500/40 hover:shadow-xl hover:shadow-rose-500/5 dark:border-white/10 dark:bg-[#121217]"
        >
            <div>
                {/* 顶部 16:9 影视效果封面预览图 (参考 Liblib) */}
                <div className="relative mb-4 h-36 w-full overflow-hidden rounded-xl border border-zinc-100 dark:border-white/5 bg-zinc-100 dark:bg-black/30">
                    <img src={plugin.coverImage} alt={plugin.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm">{plugin.categoryLabel}</span>
                    <span className="absolute bottom-2 right-2 rounded bg-rose-500/80 px-2 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur-sm">{plugin.version}</span>
                </div>

                {/* 标题 + 官方认证 */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-100 bg-zinc-50 dark:border-white/10 dark:bg-white/5">{renderPluginIcon(plugin.icon)}</div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h3 className="text-sm font-bold text-zinc-900 group-hover:text-rose-500 transition-colors dark:text-white dark:group-hover:text-rose-300">{plugin.title}</h3>
                                {plugin.isOfficial && (
                                    <span title="官方认证插件" className="text-rose-500">
                                        <ShieldCheck className="size-3.5" />
                                    </span>
                                )}
                            </div>
                            <div className="font-mono text-[11px] text-zinc-400">{plugin.name}</div>
                        </div>
                    </div>
                </div>

                {/* 描述 */}
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{plugin.description}</p>

                {/* 统计指标 */}
                <div className="mt-3.5 flex items-center gap-4 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {plugin.stars && (
                        <div className="flex items-center gap-1">
                            <Star className="size-3 text-amber-500" />
                            <span>{plugin.stars}</span>
                        </div>
                    )}
                    {plugin.downloads && (
                        <div className="flex items-center gap-1">
                            <DownloadCloud className="size-3 text-zinc-400" />
                            <span>{plugin.downloads}</span>
                        </div>
                    )}
                    <span className="text-[10px] text-rose-500 hover:underline">点击查看详情 →</span>
                </div>

                {/* 标签 */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {plugin.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-md border border-zinc-100 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600 dark:border-white/5 dark:bg-white/[0.03] dark:text-zinc-400">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            {/* 底部操作条：一键安装命令 + GitHub 链接 */}
            <div className="mt-5 border-t border-zinc-100 pt-3.5 dark:border-white/5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={onCopy}
                        title={`点击复制: ${plugin.quickInstall}`}
                        className="group/btn flex flex-1 items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-mono text-[11px] text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-white/10 dark:bg-black/40 dark:text-zinc-300 dark:hover:border-white/20 dark:hover:bg-black/60"
                    >
                        <span className="truncate pr-2 text-left">{plugin.quickInstall}</span>
                        {copied ? <Check className="size-3.5 shrink-0 text-emerald-500" /> : <Copy className="size-3.5 shrink-0 text-zinc-400 group-hover/btn:text-zinc-700 dark:group-hover/btn:text-zinc-300" />}
                    </button>

                    <a
                        href={plugin.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="查看 GitHub 仓库源码"
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                        <GitHubIcon className="size-3.5" />
                    </a>
                </div>
            </div>
        </div>
    );
}
