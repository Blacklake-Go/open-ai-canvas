import { useState } from "react";
import { useTranslation } from "react-i18next";
import { interfaceText } from "@/i18n/interface-text";
import copy from "copy-to-clipboard";
import { Copy, Check, ExternalLink, ShieldCheck, Star, DownloadCloud } from "lucide-react";
import { AppModal } from "@/components/ui/product/app-modal";
import { GitHubIcon } from "./github-icon";
import { McpPluginItem } from "./mcp-plugin-list";

export function McpPluginModal({ plugin, onClose }: { plugin: McpPluginItem | null; onClose: () => void }) {
    useTranslation();
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!plugin) return;
        copy(plugin.quickInstall);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <AppModal open={Boolean(plugin)} onCancel={onClose} footer={null} width={672} flush>
            {plugin ? (
                <div className="max-h-[85vh] overflow-y-auto bg-card p-6 text-foreground sm:p-8">
                    {/* 封面大图与标题 */}
                    <div className="overflow-hidden rounded-xl border border-border">
                        <img src={plugin.coverImage} alt={plugin.title} className="h-48 w-full object-cover sm:h-56" />
                    </div>

                    <div className="mt-5 flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-foreground sm:text-2xl">{plugin.title}</h2>
                                {plugin.isOfficial && (
                                    <span title="官方认证插件" className="text-rose-500">
                                        <ShieldCheck className="size-5" />
                                    </span>
                                )}
                            </div>
                            <div className="mt-1 font-mono text-xs text-muted-foreground">
                                {plugin.name} · {plugin.version}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-muted p-3 font-mono text-xs text-foreground">
                        <span className="truncate pr-3">{plugin.quickInstall}</span>
                        <button type="button" onClick={handleCopy} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs hover:bg-surface-hover">
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
                        <div className="mt-6 space-y-4 text-xs leading-relaxed text-muted-foreground">
                            <div>
                                <h4 className="font-semibold text-foreground">组件概述</h4>
                                <p className="mt-1">{interfaceText(plugin.detailDocs.overview)}</p>
                            </div>

                            <div>
                                <h4 className="font-semibold text-foreground">核心特性</h4>
                                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                                    {plugin.detailDocs.features.map((feat) => (
                                        <li key={feat}>{interfaceText(feat)}</li>
                                    ))}
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-semibold text-foreground">运行环境与依赖</h4>
                                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                                    {plugin.detailDocs.requirements.map((req) => (
                                        <li key={req}>{interfaceText(req)}</li>
                                    ))}
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-semibold text-foreground">最近版本更新</h4>
                                <p className="mt-1 font-mono text-[var(--fs-label)] text-rose-600 dark:text-rose-400">{interfaceText(plugin.detailDocs.changelog)}</p>
                            </div>
                        </div>
                    )}

                    {/* 底部按钮栏 */}
                    <div className="mt-8 flex items-center justify-end gap-3 border-t border-border pt-4">
                        <a href={plugin.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted">
                            <GitHubIcon className="size-4" />
                            <span>查看 GitHub 仓库</span>
                        </a>
                        {plugin.docsUrl && (
                            <a
                                href={plugin.docsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--button-primary-bg)] px-4 py-2 text-xs font-semibold text-[var(--button-primary-fg)] shadow-[var(--button-primary-shadow)] hover:bg-[var(--button-primary-hover-bg)]"
                            >
                                <span>完整开发文档</span>
                                <ExternalLink className="size-3.5" />
                            </a>
                        )}
                    </div>
                </div>
            ) : null}
        </AppModal>
    );
}
