import { useState } from "react";
import copy from "copy-to-clipboard";
import { X, Copy, Check, ExternalLink, ShieldCheck, Star, DownloadCloud } from "lucide-react";
import { GitHubIcon } from "./github-icon";
import { McpPluginItem } from "./mcp-plugin-list";

export function McpPluginModal({ plugin, onClose }: { plugin: McpPluginItem | null; onClose: () => void }) {
    const [copied, setCopied] = useState(false);

    if (!plugin) return null;

    const handleCopy = () => {
        copy(plugin.quickInstall);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#121217] sm:p-8" onClick={(e) => e.stopPropagation()}>
                {/* 关闭按钮 */}
                <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-white/10 dark:hover:text-white">
                    <X className="size-5" />
                </button>

                {/* 封面大图与标题 */}
                <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10">
                    <img src={plugin.coverImage} alt={plugin.title} className="h-48 w-full object-cover sm:h-56" />
                </div>

                <div className="mt-5 flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white sm:text-2xl">{plugin.title}</h2>
                            {plugin.isOfficial && (
                                <span title="官方认证插件" className="text-rose-500">
                                    <ShieldCheck className="size-5" />
                                </span>
                            )}
                        </div>
                        <div className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                            {plugin.name} · {plugin.version}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                        {plugin.stars && (
                            <span className="flex items-center gap-1">
                                <Star className="size-3.5 text-amber-500" />
                                <span>{plugin.stars}</span>
                            </span>
                        )}
                        {plugin.downloads && (
                            <span className="flex items-center gap-1">
                                <DownloadCloud className="size-3.5" />
                                <span>{plugin.downloads}</span>
                            </span>
                        )}
                    </div>
                </div>

                {/* 快速安装命令 */}
                <div className="mt-4 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 dark:border-white/10 dark:bg-black/40 dark:text-zinc-200">
                    <span className="truncate pr-3">{plugin.quickInstall}</span>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-sm border border-zinc-200 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                    >
                        {copied ? (
                            <>
                                <Check className="size-3 text-emerald-500" />
                                <span>已复制</span>
                            </>
                        ) : (
                            <>
                                <Copy className="size-3" />
                                <span>复制代码</span>
                            </>
                        )}
                    </button>
                </div>

                {/* 详细文档内容 */}
                {plugin.detailDocs && (
                    <div className="mt-6 space-y-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                        <div>
                            <h4 className="font-semibold text-zinc-900 dark:text-white">组件概述</h4>
                            <p className="mt-1">{plugin.detailDocs.overview}</p>
                        </div>

                        <div>
                            <h4 className="font-semibold text-zinc-900 dark:text-white">核心特性</h4>
                            <ul className="mt-1.5 list-disc space-y-1 pl-4">
                                {plugin.detailDocs.features.map((feat) => (
                                    <li key={feat}>{feat}</li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold text-zinc-900 dark:text-white">运行环境与依赖</h4>
                            <ul className="mt-1.5 list-disc space-y-1 pl-4">
                                {plugin.detailDocs.requirements.map((req) => (
                                    <li key={req}>{req}</li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold text-zinc-900 dark:text-white">最近版本更新</h4>
                            <p className="mt-1 font-mono text-[11px] text-rose-600 dark:text-rose-400">{plugin.detailDocs.changelog}</p>
                        </div>
                    </div>
                )}

                {/* 底部按钮栏 */}
                <div className="mt-8 flex items-center justify-end gap-3 border-t border-zinc-100 pt-4 dark:border-white/5">
                    <a
                        href={plugin.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/10"
                    >
                        <GitHubIcon className="size-4" />
                        <span>查看 GitHub 仓库</span>
                    </a>
                    {plugin.docsUrl && (
                        <a href={plugin.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-rose-500/25 hover:bg-rose-600">
                            <span>完整开发文档</span>
                            <ExternalLink className="size-3.5" />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
