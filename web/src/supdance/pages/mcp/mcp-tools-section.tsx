import { Check, Code2, Copy, Terminal } from "lucide-react";
import copy from "copy-to-clipboard";
import { useState } from "react";
import { interfaceText } from "@/i18n/interface-text";
import { useLocaleStore } from "@/stores/use-locale-store";
import { OFFICIAL_MCP_TOOLS, type McpToolItem } from "./mcp-plugin-list";

function pickToolText(locale: string, map: Record<string, string> | undefined, zhFallback: string): string {
    if (locale === "zh-CN") return zhFallback;
    return map?.[locale] || map?.["en-US"] || interfaceText(zhFallback);
}

export function McpToolsSection() {
    const locale = useLocaleStore((s) => s.locale);
    const [selectedTool, setSelectedTool] = useState<McpToolItem>(OFFICIAL_MCP_TOOLS[0]);
    const [copiedPrompt, setCopiedPrompt] = useState(false);

    const example = pickToolText(locale, selectedTool.examplePromptByLocale, selectedTool.examplePrompt);

    const handleCopyPrompt = (text: string) => {
        copy(text);
        setCopiedPrompt(true);
        window.setTimeout(() => setCopiedPrompt(false), 2000);
    };

    return (
        <section id="tools-schema" className="mcp-section-warm">
            <div className="mcp-container">
                <div className="mcp-section-head">
                    <span className="mcp-eyebrow mcp-eyebrow--light">TOOLS SCHEMA PREVIEW · 构建中</span>
                    <h2 className="mcp-section-h2">核心原子工具契约预览</h2>
                    <p className="mcp-section-lead">
                        SupDance MCP Server 正在依据严格类型约束推进开发，以下展示即将向 Cursor、Claude Desktop 与外部 Agent 开放的核心工具接口草案。
                    </p>
                </div>

                <div className="mcp-tools-layout">
                    <div className="mcp-tools-list" role="tablist" aria-label="MCP 工具接口清单">
                        {OFFICIAL_MCP_TOOLS.map((tool, index) => {
                            const isSelected = selectedTool.name === tool.name;
                            return (
                                <button
                                    key={tool.name}
                                    type="button"
                                    role="tab"
                                    aria-selected={isSelected}
                                    onClick={() => setSelectedTool(tool)}
                                    className={`mcp-tool-tab${isSelected ? " is-active" : ""}`}
                                >
                                    <div className="mcp-tool-tab-top">
                                        <span className="mcp-tool-tab-id">
                                            0{index + 1} · {tool.name}
                                        </span>
                                        <span className="mcp-tool-tab-cat">{pickToolText(locale, tool.categoryByLocale, tool.category)}</span>
                                    </div>
                                    <div className="mcp-tool-tab-name">{pickToolText(locale, tool.displayNameByLocale, tool.displayName)}</div>
                                    <p className="mcp-tool-tab-desc">{pickToolText(locale, tool.descriptionByLocale, tool.description)}</p>
                                </button>
                            );
                        })}
                    </div>

                    <div className="mcp-tool-detail-card" role="tabpanel">
                        <div>
                            <div className="mcp-tool-detail-head">
                                <div>
                                    <h3 className="mcp-tool-detail-title">{pickToolText(locale, selectedTool.displayNameByLocale, selectedTool.displayName)}</h3>
                                    <p className="mcp-tool-detail-summary">{pickToolText(locale, selectedTool.descriptionByLocale, selectedTool.description)}</p>
                                </div>
                                <span className="mcp-tool-detail-badge">SPEC PREVIEW · {selectedTool.name}</span>
                            </div>

                            <div className="mt-6">
                                <div className="mcp-schema-label">
                                    <Code2 className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                                    <span>输入参数声明（Input Schema）</span>
                                </div>
                                <div className="mcp-schema-table-wrap">
                                    <table className="mcp-schema-table">
                                        <thead>
                                            <tr>
                                                <th>参数名</th>
                                                <th>类型</th>
                                                <th>约束</th>
                                                <th>说明</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedTool.parameters.map((param) => (
                                                <tr key={param.name}>
                                                    <td className="mcp-param-name">{param.name}</td>
                                                    <td className="mcp-param-type">{param.type}</td>
                                                    <td>
                                                        {param.required ? (
                                                            <span className="mcp-param-req">required</span>
                                                        ) : (
                                                            <span className="mcp-param-opt">optional</span>
                                                        )}
                                                    </td>
                                                    <td>{pickToolText(locale, param.descByLocale, param.desc)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="mcp-prompt-box">
                            <div className="mcp-prompt-head">
                                <span className="mcp-schema-label">
                                    <Terminal className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                                    <span>自然语言调用示例</span>
                                </span>
                                <button type="button" className="mcp-copy-btn" onClick={() => handleCopyPrompt(example)}>
                                    {copiedPrompt ? <Check className="size-3.5" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={1.8} />}
                                    <span>{copiedPrompt ? "已复制" : "复制示例"}</span>
                                </button>
                            </div>
                            <p className="mcp-prompt-body">{example}</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
