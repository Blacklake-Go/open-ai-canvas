import { useState } from "react";
import { useTranslation } from "react-i18next";
import { interfaceText } from "@/i18n/interface-text";
import copy from "copy-to-clipboard";
import { Wrench, Check, Copy, Sparkles, Terminal, Code2 } from "lucide-react";
import { OFFICIAL_MCP_TOOLS, McpToolItem } from "./mcp-plugin-list";

export function McpToolsSection() {
    useTranslation();
    const [selectedTool, setSelectedTool] = useState<McpToolItem>(OFFICIAL_MCP_TOOLS[0]);
    const [copiedPrompt, setCopiedPrompt] = useState(false);
    const example = interfaceText(selectedTool.examplePrompt);

    const handleCopyPrompt = (text: string) => {
        copy(text);
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
    };

    return (
        <section className="relative mx-auto mt-20 max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-rose-600 dark:text-rose-400 uppercase">
                        <Sparkles className="size-3.5" />
                        <span>MCP Server Tool Capabilities</span>
                    </div>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">官方 MCP 工具清单与对话指令</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">连接至 Cursor、Claude Desktop 或 Windsurf 后，大语言模型将自动获得以下原子创作工具，直接用自然语言即可驱动整套短剧创作流。</p>
                </div>
            </div>

            {/* 工具列表选择区与参数详情联动 */}
            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* 左侧：工具选择菜单 */}
                <div className="flex flex-col gap-2 lg:col-span-4">
                    {OFFICIAL_MCP_TOOLS.map((tool) => {
                        const isSelected = selectedTool.name === tool.name;
                        return (
                            <button
                                key={tool.name}
                                type="button"
                                onClick={() => setSelectedTool(tool)}
                                className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${isSelected ? "border-primary/40 bg-accent shadow-xs" : "border-border bg-card/70 hover:border-foreground/20 hover:bg-card"}`}
                            >
                                <div className="flex w-full items-center justify-between">
                                    <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">{tool.name}</span>
                                    <span className="rounded bg-muted px-2 py-0.5 text-[var(--fs-label)] text-muted-foreground">{interfaceText(tool.category)}</span>
                                </div>
                                <div className="mt-1.5 text-sm font-semibold text-foreground">{interfaceText(tool.displayName)}</div>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{interfaceText(tool.description)}</p>
                            </button>
                        );
                    })}
                </div>

                {/* 右侧：当前选中工具的 Schema 与实战 Prompt */}
                <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-[var(--elevation-card)] dark:shadow-[var(--elevation-overlay)] lg:col-span-8">
                    <div>
                        {/* 顶栏：工具元数据 */}
                        <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Wrench className="size-4 text-rose-500" />
                                    <h3 className="text-base font-bold text-foreground">{interfaceText(selectedTool.displayName)}</h3>
                                    <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-rose-600 dark:text-rose-300">{selectedTool.name}</code>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{interfaceText(selectedTool.description)}</p>
                            </div>
                        </div>

                        {/* 参数表格 */}
                        <div className="mt-5">
                            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase">
                                <Code2 className="size-3.5 text-muted-foreground" />
                                <span>输入参数结构 (Tool Parameters)</span>
                            </h4>
                            <div className="mt-2.5 overflow-x-auto rounded-xl border border-border bg-muted/40">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-border bg-muted font-mono text-[var(--fs-label)] text-muted-foreground">
                                            <th className="px-3.5 py-2">参数名</th>
                                            <th className="px-3.5 py-2">类型</th>
                                            <th className="px-3.5 py-2">必填</th>
                                            <th className="px-3.5 py-2">描述</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border font-mono text-[var(--fs-label)]">
                                        {selectedTool.parameters.map((param) => (
                                            <tr key={param.name}>
                                                <td className="px-3.5 py-2.5 font-bold text-foreground">{param.name}</td>
                                                <td className="px-3.5 py-2.5 text-purple-600 dark:text-purple-400">{param.type}</td>
                                                <td className="px-3.5 py-2.5">{param.required ? <span className="font-semibold text-rose-500">true</span> : <span className="text-muted-foreground">false</span>}</td>
                                                <td className="px-3.5 py-2.5 font-sans text-xs text-muted-foreground">{interfaceText(param.desc)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* 底部：在 Cursor 中可直接发送的 Prompt 指令 */}
                    <div className="mt-6 rounded-xl border border-border bg-muted/50 p-4">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                                <Terminal className="size-3.5" />
                                <span>在 Cursor / Claude 中直接试用该工具 (Example Prompt)</span>
                            </span>
                            <button type="button" onClick={() => handleCopyPrompt(example)} className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300">
                                {copiedPrompt ? (
                                    <>
                                        <Check className="size-3 text-emerald-500" />
                                        <span className="text-emerald-500">已复制 Prompt</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="size-3" />
                                        <span>复制指令</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-foreground/85">{example}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
