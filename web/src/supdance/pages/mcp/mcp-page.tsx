import { useEffect } from "react";
import { Sparkles, Terminal, Layers, ArrowUpRight, ShieldCheck, Wrench } from "lucide-react";
import { GitHubIcon } from "./github-icon";
import { McpHeader } from "./mcp-header";
import { McpCliSection } from "./mcp-cli-section";
import { McpPluginGrid } from "./mcp-plugin-grid";
import { McpToolsSection } from "./mcp-tools-section";
import { McpFaqSection } from "./mcp-faq-section";
import { OFFICIAL_REPO_URL } from "./mcp-plugin-list";
import { SupdanceAboutFooter } from "@/supdance/components/site-footer/supdance-about-footer";

export default function McpPage() {
    useEffect(() => {
        document.title = "SupDance MCP 协议与插件生态 | 影视多模态 AI 扩展中心";
    }, []);

    return (
        <div className="min-h-screen bg-[#fafafc] text-zinc-800 selection:bg-rose-500/20 selection:text-rose-600 dark:bg-[#070709] dark:text-zinc-100 dark:selection:bg-rose-500/30 dark:selection:text-white transition-colors duration-200">
            {/* 顶栏 Header */}
            <McpHeader />

            {/* Hero 区域 */}
            <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
                {/* 背景渐变光晕与点阵质感 */}
                <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[560px] w-full max-w-7xl">
                    <div className="absolute top-1/4 left-1/3 size-96 rounded-full bg-rose-500/10 blur-[120px] dark:bg-rose-600/15" />
                    <div className="absolute top-1/3 right-1/3 size-96 rounded-full bg-purple-500/10 blur-[120px] dark:bg-purple-600/15" />
                    <div className="absolute -top-10 left-1/2 size-72 -translate-x-1/2 rounded-full bg-amber-500/10 blur-[100px]" />
                </div>

                <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
                    {/* 徽标 */}
                    <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs font-semibold text-rose-600 backdrop-blur-md dark:text-rose-300">
                        <Sparkles className="size-3.5 text-rose-500 dark:text-rose-400" />
                        <span>官方开源 MCP 协议与影视创作插件中枢</span>
                    </div>

                    {/* 主标题 */}
                    <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl sm:leading-[1.15] dark:text-white">
                        让 AI 创意无限流动
                        <br />
                        <span className="bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 bg-clip-text text-transparent dark:from-rose-400 dark:via-pink-400 dark:to-purple-400">SupDance 插件与 MCP 中枢</span>
                    </h1>

                    {/* 副标题 */}
                    <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
                        专为 Cursor、Claude Desktop、Windsurf 及 ComfyUI 创作者打造。一键安装 SupDance CLI，无缝接入文生图、高清生视频、多轨音乐与智能分镜 Agent 能力。
                    </p>

                    {/* 行动按钮 */}
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
                        <a
                            href="#cli-quickstart"
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition-all hover:scale-105 hover:from-rose-600 hover:to-pink-700"
                        >
                            <Terminal className="size-4" />
                            <span>快速安装 CLI / MCP</span>
                        </a>

                        <a
                            href="#plugins-market"
                            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-800 shadow-sm backdrop-blur-sm transition-all hover:bg-zinc-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                        >
                            <Layers className="size-4" />
                            <span>浏览插件生态</span>
                        </a>

                        <a
                            href="#tools-schema"
                            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white"
                        >
                            <Wrench className="size-4" />
                            <span>查看可用工具清单</span>
                        </a>

                        <a
                            href={OFFICIAL_REPO_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white"
                        >
                            <GitHubIcon className="size-4" />
                            <span>GitHub</span>
                            <ArrowUpRight className="size-3.5 opacity-60" />
                        </a>
                    </div>

                    {/* 核心亮点标签 */}
                    <div className="mt-12 flex flex-wrap items-center justify-center gap-6 border-t border-zinc-200/80 pt-8 text-xs text-zinc-500 dark:border-white/5 dark:text-zinc-400">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="size-4 text-emerald-500" />
                            <span>100% Anthropic MCP 协议标准</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                            <span>ComfyUI 本地与云端极速桥接</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-4 text-amber-500" />
                            <span>即梦 & Seedance 动力学视频调度</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 1: 即梦风格 CLI 快速安装区 */}
            <div id="cli-quickstart">
                <McpCliSection />
            </div>

            {/* Section 2: MCP Tools 工具清单展示区 */}
            <div id="tools-schema">
                <McpToolsSection />
            </div>

            {/* Section 3: Liblib 风格插件生态市场区 */}
            <div id="plugins-market">
                <McpPluginGrid />
            </div>

            {/* Section 4: 常见故障排查 FAQ 区 */}
            <div id="faqs">
                <McpFaqSection />
            </div>

            {/* Footer */}
            <SupdanceAboutFooter pagePath="/mcp" />
        </div>
    );
}
