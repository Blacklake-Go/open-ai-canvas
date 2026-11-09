import { useState, useMemo } from "react";
import copy from "copy-to-clipboard";
import { Search, Copy, Check, ExternalLink, ShieldCheck, Cpu, Terminal, Layers, Film, Music, UserCheck, FolderSync, Wrench, Sparkles, Star, DownloadCloud } from "lucide-react";
import { GitHubIcon } from "./github-icon";
import { MCP_CATEGORIES, MCP_PLUGINS, McpPluginItem, OFFICIAL_REPO_URL } from "./mcp-plugin-list";

// 图标渲染映射
function renderPluginIcon(iconName: string) {
    const props = { className: "size-5 text-rose-400" };
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
        <section className="relative mx-auto mt-16 max-w-7xl px-4 sm:px-6">
            {/* 标头区域 */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-rose-400 uppercase">
                        <Sparkles className="size-3.5" />
                        <span>Liblib & Community Verified Ecosystem</span>
                    </div>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">插件与扩展中心</h2>
                    <p className="mt-1 max-w-2xl text-sm text-zinc-400">探索由 SupDance 官方及开源社区驱动的生态组件，涵盖 ComfyUI 工作流、MCP 协议中枢与多模态创作扩展。</p>
                </div>

                {/* 搜索框 */}
                <div className="relative w-full md:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索插件、协议或关键词..."
                        className="w-full rounded-xl border border-white/10 bg-[#121217] py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                    />
                </div>
            </div>

            {/* 分类切换 Tabs (参考 Liblib 分类条) */}
            <div className="mt-6 flex flex-wrap gap-2 border-b border-white/5 pb-4">
                {MCP_CATEGORIES.map((cat) => {
                    const isActive = cat.key === selectedCategory;
                    return (
                        <button
                            key={cat.key}
                            type="button"
                            onClick={() => setSelectedCategory(cat.key)}
                            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${isActive ? "bg-rose-500 text-white shadow-sm shadow-rose-500/20" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"}`}
                        >
                            {cat.label}
                        </button>
                    );
                })}
            </div>

            {/* 插件卡片网格 */}
            {filteredPlugins.length === 0 ? (
                <div className="my-16 rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center">
                    <p className="text-sm text-zinc-400">未找到匹配的插件或扩展组件</p>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedCategory("all");
                            setSearchQuery("");
                        }}
                        className="mt-3 text-xs font-medium text-rose-400 hover:text-rose-300"
                    >
                        重置搜索与分类条件
                    </button>
                </div>
            ) : (
                <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredPlugins.map((plugin) => (
                        <PluginCard key={plugin.id} plugin={plugin} copied={copiedId === plugin.id} onCopy={() => handleCopy(plugin.id, plugin.quickInstall)} />
                    ))}
                </div>
            )}

            {/* 开发者入驻与贡献横幅 */}
            <div className="mt-16 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-rose-950/40 via-[#181822] to-purple-950/30 p-8">
                <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                    <div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                            <GitHubIcon className="size-3.5" />
                            <span>Open Source & Developers Welcome</span>
                        </div>
                        <h3 className="mt-2 text-xl font-bold text-white">共建 SupDance 插件与 MCP 生态</h3>
                        <p className="mt-1 max-w-2xl text-xs text-zinc-400">无论你是 ComfyUI 自定义节点作者、MCP 工具开发者，还是 AI 视频模型创作者，欢迎向官方仓库提交 PR 或入驻插件集市。</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <a
                            href={OFFICIAL_REPO_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-zinc-900 shadow-md transition-transform hover:scale-105 hover:bg-zinc-100"
                        >
                            <GitHubIcon className="size-4" />
                            <span>前往 GitHub 仓库 Star</span>
                        </a>
                        <a
                            href={`${OFFICIAL_REPO_URL}#contributing`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
                        >
                            <span>提交你的插件</span>
                            <ExternalLink className="size-3.5" />
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}

function PluginCard({ plugin, copied, onCopy }: { plugin: McpPluginItem; copied: boolean; onCopy: () => void }) {
    return (
        <div className="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-[#121217]/90 p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:border-rose-500/40 hover:bg-[#16161d] hover:shadow-xl hover:shadow-rose-500/5">
            <div>
                {/* 顶栏信息：图标 + 标题 + 官方认证 */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 group-hover:border-rose-500/30 group-hover:bg-rose-500/10 transition-colors">{renderPluginIcon(plugin.icon)}</div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h3 className="text-sm font-semibold text-white group-hover:text-rose-300 transition-colors">{plugin.title}</h3>
                                {plugin.isOfficial && (
                                    <span title="官方认证插件" className="inline-flex items-center text-rose-400">
                                        <ShieldCheck className="size-3.5" />
                                    </span>
                                )}
                            </div>
                            <div className="font-mono text-[11px] text-zinc-400">{plugin.name}</div>
                        </div>
                    </div>

                    <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-400">{plugin.version}</span>
                </div>

                {/* 简介 */}
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-zinc-300">{plugin.description}</p>

                {/* 统计指标 */}
                <div className="mt-3.5 flex items-center gap-4 text-[11px] text-zinc-400">
                    {plugin.stars && (
                        <div className="flex items-center gap-1">
                            <Star className="size-3 text-amber-400" />
                            <span>{plugin.stars}</span>
                        </div>
                    )}
                    {plugin.downloads && (
                        <div className="flex items-center gap-1">
                            <DownloadCloud className="size-3 text-zinc-400" />
                            <span>{plugin.downloads}</span>
                        </div>
                    )}
                    <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">{plugin.categoryLabel}</span>
                </div>

                {/* 标签 */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {plugin.tags.map((tag) => (
                        <span key={tag} className="rounded-md border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-400">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            {/* 底部操作条：一键安装命令 + GitHub 链接 */}
            <div className="mt-5 border-t border-white/5 pt-3.5">
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={onCopy}
                        title={`点击复制: ${plugin.quickInstall}`}
                        className="group/btn flex flex-1 items-center justify-between rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-zinc-300 transition-colors hover:border-white/20 hover:bg-black/60"
                    >
                        <span className="truncate pr-2 text-left">{plugin.quickInstall}</span>
                        {copied ? <Check className="size-3.5 shrink-0 text-emerald-400" /> : <Copy className="size-3.5 shrink-0 text-zinc-500 group-hover/btn:text-zinc-300" />}
                    </button>

                    <a
                        href={plugin.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="查看 GitHub 仓库源码"
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <GitHubIcon className="size-3.5" />
                    </a>
                </div>
            </div>
        </div>
    );
}
