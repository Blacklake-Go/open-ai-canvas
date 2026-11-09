import { useEffect } from "react";
import { Link } from "react-router";
import { Sparkles, Terminal, Layers, ArrowUpRight, ShieldCheck, Heart } from "lucide-react";
import { GitHubIcon } from "./github-icon";
import { McpHeader } from "./mcp-header";
import { McpCliSection } from "./mcp-cli-section";
import { McpPluginGrid } from "./mcp-plugin-grid";
import { OFFICIAL_REPO_URL } from "./mcp-plugin-list";

export default function McpPage() {
    useEffect(() => {
        document.title = "SupDance MCP 协议与插件生态 | 影视多模态 AI 扩展中心";
    }, []);

    return (
        <div className="min-h-screen bg-[#070709] text-zinc-100 selection:bg-rose-500/30 selection:text-white">
            {/* 顶栏 Header */}
            <McpHeader />

            {/* Hero 区域 */}
            <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
                {/* 背景渐变光晕 */}
                <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-full max-w-7xl">
                    <div className="absolute top-1/4 left-1/3 size-96 rounded-full bg-rose-600/15 blur-[120px]" />
                    <div className="absolute top-1/3 right-1/3 size-96 rounded-full bg-purple-600/15 blur-[120px]" />
                    <div className="absolute -top-10 left-1/2 size-72 -translate-x-1/2 rounded-full bg-amber-500/10 blur-[100px]" />
                </div>

                <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
                    {/* 徽标 */}
                    <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs font-medium text-rose-300 backdrop-blur-md">
                        <Sparkles className="size-3.5 text-rose-400" />
                        <span>官方开源 MCP 协议与影视创作插件中枢</span>
                    </div>

                    {/* 主标题 */}
                    <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-[1.15]">
                        让 AI 创意无限流动
                        <br />
                        <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">SupDance 插件与 MCP 中枢</span>
                    </h1>

                    {/* 副标题 */}
                    <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
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

                        <a href="#plugins-market" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10">
                            <Layers className="size-4" />
                            <span>浏览插件生态</span>
                        </a>

                        <a
                            href={OFFICIAL_REPO_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition-all hover:bg-white/10 hover:text-white"
                        >
                            <GitHubIcon className="size-4" />
                            <span>GitHub 开源</span>
                            <ArrowUpRight className="size-3.5 opacity-70" />
                        </a>
                    </div>

                    {/* 核心亮点标签 */}
                    <div className="mt-12 flex flex-wrap items-center justify-center gap-6 border-t border-white/5 pt-8 text-xs text-zinc-400">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="size-4 text-emerald-400" />
                            <span>100% Anthropic MCP 协议标准</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-rose-400 animate-pulse" />
                            <span>ComfyUI 本地与云端极速桥接</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-4 text-amber-400" />
                            <span>即梦 & Seedance 动力学视频调度</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 1: 即梦风格 CLI 快速安装区 */}
            <div id="cli-quickstart">
                <McpCliSection />
            </div>

            {/* Section 2: Liblib 风格插件生态市场区 */}
            <div id="plugins-market">
                <McpPluginGrid />
            </div>

            {/* Footer */}
            <footer className="mt-28 border-t border-white/10 bg-[#050507] py-12 text-xs text-zinc-400">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
                    <div className="flex items-center gap-3">
                        <img src="/supdance-mark.png" alt="" className="size-6 object-contain" />
                        <span className="font-semibold text-white">SupDance Creative Platform</span>
                        <span className="text-zinc-600">|</span>
                        <span>Open Source AI Ecosystem</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                        <Link to="/terms" className="hover:text-white transition-colors">
                            服务条款
                        </Link>
                        <Link to="/privacy" className="hover:text-white transition-colors">
                            隐私政策
                        </Link>
                        <Link to="/aup" className="hover:text-white transition-colors">
                            使用准则
                        </Link>
                        <Link to="/legal" className="hover:text-white transition-colors">
                            法律中心
                        </Link>
                        <a href="/pricing.html" className="hover:text-white transition-colors">
                            定价说明
                        </a>
                        <a href={OFFICIAL_REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
                            <GitHubIcon className="size-3.5" />
                            <span>GitHub</span>
                        </a>
                    </div>
                </div>

                <div className="mx-auto mt-6 max-w-7xl px-4 text-center sm:px-6 text-[11px] text-zinc-400">
                    Built with <Heart className="inline size-3 text-rose-500 fill-rose-500" /> by Blacklake-Go team for AI creators worldwide.
                </div>
            </footer>
        </div>
    );
}
