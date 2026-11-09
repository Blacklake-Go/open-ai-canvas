import React, { useState } from "react";
import copy from "copy-to-clipboard";
import { Check, Copy, Terminal, Apple, Monitor, Box, Sparkles, Code2 } from "lucide-react";
import { OFFICIAL_REPO_URL } from "./mcp-plugin-list";

interface CliTab {
    id: string;
    label: string;
    icon: React.ReactNode;
    code: string;
    description: string;
    language?: string;
}

const CLI_TABS: CliTab[] = [
    {
        id: "macos-linux",
        label: "macOS / Linux",
        icon: <Apple className="size-4" />,
        code: `curl -fsSL https://raw.githubusercontent.com/Blacklake-Go/supdance/main/scripts/install.sh | bash`,
        description: "一键安装 SupDance CLI，自动配置环境路径并适配 zsh 与 bash",
        language: "bash",
    },
    {
        id: "windows",
        label: "Windows (PowerShell)",
        icon: <Monitor className="size-4" />,
        code: `irm https://raw.githubusercontent.com/Blacklake-Go/supdance/main/scripts/install.ps1 | iex`,
        description: "在 Windows PowerShell (管理员模式) 中一键安装并初始化环境变量",
        language: "powershell",
    },
    {
        id: "npm",
        label: "Node / NPX",
        icon: <Box className="size-4" />,
        code: `# 全局安装 CLI
npm install -g @supdance/cli

# 或无需安装直接启动 MCP 服务
npx -y @supdance/mcp-server@latest`,
        description: "适用于前端与全栈开发者，支持 NPX 即开即用无需常驻后台",
        language: "bash",
    },
    {
        id: "python",
        label: "Python / UV",
        icon: <Terminal className="size-4" />,
        code: `# 使用 uv (推荐)
uv tool install supdance

# 或使用 pip
pip install --upgrade supdance-sdk`,
        description: "适用于 AI 研究员与 ComfyUI 开发者，自带 PyTorch 与模型调度 SDK",
        language: "bash",
    },
    {
        id: "mcp-json",
        label: "Cursor / Claude Desktop (MCP)",
        icon: <Code2 className="size-4" />,
        code: `{
  "mcpServers": {
    "supdance": {
      "command": "npx",
      "args": ["-y", "@supdance/mcp-server@latest"],
      "env": {
        "SUPDANCE_API_KEY": "your_api_key_here"
      }
    }
  }
}`,
        description: "直接粘贴到 Cursor (~/.cursor/mcp.json) 或 Claude Desktop 配置中，立即激活 SupDance Agent 工具集",
        language: "json",
    },
];

export function McpCliSection() {
    const [activeTabId, setActiveTabId] = useState<string>("macos-linux");
    const [copied, setCopied] = useState<boolean>(false);

    const activeTab = CLI_TABS.find((t) => t.id === activeTabId) || CLI_TABS[0];

    const handleCopy = () => {
        copy(activeTab.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section className="relative mx-auto mt-12 max-w-5xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#18181f]/80 to-[#0e0e12]/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8 dark:border-white/10 dark:from-[#18181f]/80 dark:to-[#0e0e12]/90">
                {/* 装饰光效 */}
                <div className="pointer-events-none absolute -top-24 right-1/4 h-56 w-56 rounded-full bg-rose-500/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-purple-600/15 blur-3xl" />

                {/* 标头说明 */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-400">
                            <Sparkles className="size-3.5" />
                            <span>极速接入 · 支持 Cursor & Claude Desktop</span>
                        </div>
                        <h2 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">一键安装 SupDance CLI 与 MCP 服务端</h2>
                        <p className="mt-1 text-sm text-zinc-400">选择你的开发环境或 AI 客户端，一条命令快速启动，连接多模态影视创作能力。</p>
                    </div>

                    <a href={`${OFFICIAL_REPO_URL}#quick-start`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 self-start text-xs font-medium text-rose-400 hover:text-rose-300 sm:mt-0 sm:self-center">
                        <span>查看完整文档</span>
                        <span>→</span>
                    </a>
                </div>

                {/* 环境切换 Tab (参考即梦安装页) */}
                <div className="mt-6 flex flex-wrap gap-2 border-b border-white/5 pb-4">
                    {CLI_TABS.map((tab) => {
                        const isActive = tab.id === activeTabId;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTabId(tab.id)}
                                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${isActive ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"}`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* 命令行展示窗口 */}
                <div className="relative mt-4">
                    <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-white/10 bg-[#121217] px-4 py-2.5">
                        <div className="flex items-center gap-2">
                            <div className="size-2.5 rounded-full bg-rose-500/70" />
                            <div className="size-2.5 rounded-full bg-amber-500/70" />
                            <div className="size-2.5 rounded-full bg-emerald-500/70" />
                            <span className="ml-2 font-mono text-[11px] text-zinc-400">{activeTab.description}</span>
                        </div>
                        <button type="button" onClick={handleCopy} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white">
                            {copied ? (
                                <>
                                    <Check className="size-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">已复制</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="size-3.5" />
                                    <span>复制指令</span>
                                </>
                            )}
                        </button>
                    </div>

                    <pre className="overflow-x-auto rounded-b-xl border border-white/10 bg-[#09090c] p-4 font-mono text-xs leading-relaxed text-zinc-100 selection:bg-rose-500/30">
                        <code>{activeTab.code}</code>
                    </pre>
                </div>

                {/* 极速入门 3 步 (参考即梦流程) */}
                <div className="mt-8 grid grid-cols-1 gap-4 border-t border-white/5 pt-6 sm:grid-cols-3">
                    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-rose-500/20 font-mono text-xs font-bold text-rose-400">1</span>
                        <div>
                            <div className="text-xs font-semibold text-white">运行安装指令</div>
                            <div className="mt-1 text-[11px] text-zinc-400">复制上方对应系统的命令并运行，完成 CLI 或 MCP 配置。</div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-purple-500/20 font-mono text-xs font-bold text-purple-400">2</span>
                        <div>
                            <div className="text-xs font-semibold text-white">授权与 API Key</div>
                            <div className="mt-1 text-[11px] text-zinc-400">
                                运行 <code className="rounded bg-white/10 px-1 py-0.5 text-rose-300">supdance login</code> 或填入站点密钥。
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-mono text-xs font-bold text-emerald-400">3</span>
                        <div>
                            <div className="text-xs font-semibold text-white">调用多模态能力</div>
                            <div className="mt-1 text-[11px] text-zinc-400">在 Cursor 或 Claude 中直接呼叫：“生成一段赛博朋克追逐戏分镜与配乐”。</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
