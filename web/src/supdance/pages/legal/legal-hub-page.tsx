import { TopbarLanguageSwitcher } from "@/supdance/plugins/i18n";
import { ArrowRight, FileText, Globe, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { useThemeStore } from "@/stores/use-theme-store";
import { LEGAL_OPERATOR_CONFIG } from "./legal-i18n-content";
import { LegalThemeToggler } from "./legal-theme-toggler";

export default function LegalHubPage() {
    useEffect(() => {
        document.documentElement.classList.add("is-legal-doc-page");
        document.body.classList.add("is-legal-doc-page");
        return () => {
            document.documentElement.classList.remove("is-legal-doc-page");
            document.body.classList.remove("is-legal-doc-page");
        };
    }, []);

    const isDark = useThemeStore((state) => state.theme === "dark");

    return (
        <div
            className={`legal-public-page transition-colors duration-200 ${isDark ? "bg-[#000000] text-[#f4f4f6]" : "bg-[#ffffff] text-[#111111]"}`}
            style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                maxHeight: "100%",
                overflowX: "hidden",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                overscrollBehaviorY: "contain",
                touchAction: "pan-y",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
            }}
        >
            {/* 顶栏 */}
            <header
                className={`legal-public-header fixed top-0 left-0 right-0 z-50 flex h-16 w-full items-center justify-between px-6 sm:px-12 border-b transition-colors ${isDark ? "bg-[#000000] border-white/10" : "bg-[#ffffff] border-black/10"}`}
                style={{ backgroundColor: isDark ? "#000000" : "#ffffff" }}
            >
                <Link to="/" className="flex items-center gap-2.5 text-base font-semibold tracking-tight no-underline">
                    <span className={`size-6 rounded-full flex items-center justify-center font-bold text-xs ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>S</span>
                    <span className={isDark ? "text-white" : "text-black"}>{LEGAL_OPERATOR_CONFIG.tradeName}</span>
                    <span className={`text-[11px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded ${isDark ? "bg-white/10 text-white/60" : "bg-black/5 text-black/60"}`}>LEGAL HUB</span>
                </Link>

                <div className="flex items-center gap-4">
                    <Link to="/" className={`text-xs font-medium no-underline transition-colors ${isDark ? "text-white/60 hover:text-white" : "text-black/60 hover:text-black"}`}>
                        返回创作台 &rarr;
                    </Link>
                    <TopbarLanguageSwitcher surface="legal" className="min-h-11 min-w-11 rounded-full border border-border px-3 text-foreground" />
                    <LegalThemeToggler />
                </div>
            </header>

            {/* 展台区 */}
            <main className="mx-auto max-w-[840px] px-6 pt-24 pb-16 sm:pt-28 sm:pb-24">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-sky-400 mb-3">§ OFFICIAL COMPLIANCE PORTAL</div>
                <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.035em] leading-[1.08] mb-6 ${isDark ? "text-white" : "text-[#111111]"}`}>Legal & Compliance Center</h1>
                <p className={`text-base sm:text-lg leading-relaxed mb-12 ${isDark ? "text-[#a2a2ad]" : "text-[#555555]"}`}>
                    统一查阅 {LEGAL_OPERATOR_CONFIG.productName} 面向全球创作者的各项法律协议、隐私保护规范与内容安全标准。本文档以英语（English）为根语言权威版本，并提供中繁日韩西等五大语言对照。
                </p>

                {/* 三大核心法务卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                    {/* 1. TOS */}
                    <Link
                        to="/terms"
                        className={`flex flex-col justify-between rounded-2xl border p-6 no-underline transition-all group ${
                            isDark ? "border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]" : "border-black/10 bg-black/[0.01] hover:border-black/30 hover:bg-black/[0.03]"
                        }`}
                    >
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-mono text-[11px] uppercase tracking-wider text-sky-400 font-semibold">TOS · V2 CREDITS</span>
                                <FileText className="size-4 text-white/40 group-hover:text-sky-400 transition-colors" />
                            </div>
                            <h2 className={`text-lg font-semibold tracking-tight mb-2 ${isDark ? "text-white" : "text-black"}`}>Terms of Service</h2>
                            <p className={`text-xs leading-relaxed ${isDark ? "text-[#8a8f98]" : "text-[#666666]"}`}>规范账号资格、积分预付即时数字交付、Waffo Pancake PCI-DSS 安全支付、7天退款与 AI 资产所有权。</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-mono text-sky-400 pt-6 mt-6 border-t border-white/5">
                            <span>Read Policy</span>
                            <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>

                    {/* 2. Privacy */}
                    <Link
                        to="/privacy"
                        className={`flex flex-col justify-between rounded-2xl border p-6 no-underline transition-all group ${
                            isDark ? "border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]" : "border-black/10 bg-black/[0.01] hover:border-black/30 hover:bg-black/[0.03]"
                        }`}
                    >
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">PRIVACY · GDPR / CCPA</span>
                                <Shield className="size-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
                            </div>
                            <h2 className={`text-lg font-semibold tracking-tight mb-2 ${isDark ? "text-white" : "text-black"}`}>Privacy Policy</h2>
                            <p className={`text-xs leading-relaxed ${isDark ? "text-[#8a8f98]" : "text-[#666666]"}`}>个人信息收集范围、不存卡号承诺、不出售用户隐私承诺、主流模型推理隔离与 72h 泄露通报。</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-mono text-emerald-400 pt-6 mt-6 border-t border-white/5">
                            <span>Read Policy</span>
                            <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>

                    {/* 3. AUP */}
                    <Link
                        to="/aup"
                        className={`flex flex-col justify-between rounded-2xl border p-6 no-underline transition-all group ${
                            isDark ? "border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]" : "border-black/10 bg-black/[0.01] hover:border-black/30 hover:bg-black/[0.03]"
                        }`}
                    >
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-mono text-[11px] uppercase tracking-wider text-amber-400 font-semibold">AUP · CONTENT RULES</span>
                                <Shield className="size-4 text-white/40 group-hover:text-amber-400 transition-colors" />
                            </div>
                            <h2 className={`text-lg font-semibold tracking-tight mb-2 ${isDark ? "text-white" : "text-black"}`}>Acceptable Use (AUP)</h2>
                            <p className={`text-xs leading-relaxed ${isDark ? "text-[#8a8f98]" : "text-[#666666]"}`}>六大禁止类别（色情/暴力/仇恨/CSAM/深伪冒充/侵权）、真人肖像授权要求、举报时效与处置。</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-mono text-amber-400 pt-6 mt-6 border-t border-white/5">
                            <span>Read Policy</span>
                            <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>
                </div>

                {/* 经营主体公示 */}
                <section className={`rounded-2xl border p-8 text-xs leading-relaxed ${isDark ? "border-white/10 bg-white/[0.02]" : "border-black/10 bg-black/[0.02]"}`}>
                    <h3 className={`text-sm font-semibold mb-4 tracking-tight ${isDark ? "text-white" : "text-black"}`}>运营主体与合规联络渠道</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <span className="text-[#8a8f98] block mb-1">经营者 / 商户法定名称</span>
                            <span className="font-mono text-white font-medium">{LEGAL_OPERATOR_CONFIG.legalName}</span>
                        </div>
                        <div>
                            <span className="text-[#8a8f98] block mb-1">对外经营名称 (Trade Name)</span>
                            <span className="font-mono text-white font-medium">{LEGAL_OPERATOR_CONFIG.tradeName}</span>
                        </div>
                        <div>
                            <span className="text-[#8a8f98] block mb-1">客户支持与账单退款</span>
                            <a href={`mailto:${LEGAL_OPERATOR_CONFIG.supportEmail}`} className="font-mono text-sky-400 no-underline hover:underline">
                                {LEGAL_OPERATOR_CONFIG.supportEmail}
                            </a>
                        </div>
                        <div>
                            <span className="text-[#8a8f98] block mb-1">内容安全与 AUP 举报通道</span>
                            <a href={`mailto:${LEGAL_OPERATOR_CONFIG.safetyEmail}`} className="font-mono text-amber-400 no-underline hover:underline">
                                {LEGAL_OPERATOR_CONFIG.safetyEmail}
                            </a>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
