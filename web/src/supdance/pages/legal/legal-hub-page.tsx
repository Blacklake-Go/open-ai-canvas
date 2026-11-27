import { TopbarLanguageSwitcher, useI18n } from "@/supdance/plugins/i18n";
import { interfaceText } from "@/i18n/interface-text";
import { ArrowRight, FileText, Shield } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";

import { LEGAL_OPERATOR_CONFIG } from "./legal-i18n-content";
import { LegalThemeToggler } from "./legal-theme-toggler";
import { LegalBrand } from "./legal-brand";
import { LegalHeaderNav } from "./legal-header-nav";
import { SupdanceAboutFooter } from "@/supdance/components/site-footer/supdance-about-footer";
import { usePublicTitle } from "../public-copy/public-page";
import { REFUND_COPY } from "../public-copy/refund";
import { SUPPORTED_LOCALES } from "@/i18n/locales";

export default function LegalHubPage() {
    const { locale } = useI18n();
    const title = interfaceText("法律与合规中心", undefined, "src/supdance/pages/legal/legal-hub-page.tsx");
    usePublicTitle(title);
    // 物理级滚轮与键盘全响应支持：确保在任何浏览器与操作系统中，鼠标滚轮、触控板与按键均能顺畅向下滑动
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            window.scrollBy({ top: e.deltaY, behavior: "auto" });
            const el = document.querySelector(".legal-public-page");
            if (el && el !== document.documentElement) {
                el.scrollTop += e.deltaY;
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown" || e.key === "PageDown") {
                window.scrollBy({ top: e.key === "PageDown" ? 600 : 150, behavior: "smooth" });
            } else if (e.key === "ArrowUp" || e.key === "PageUp") {
                window.scrollBy({ top: e.key === "PageUp" ? -600 : -150, behavior: "smooth" });
            } else if (e.key === " " && (e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
                e.preventDefault();
                window.scrollBy({ top: e.shiftKey ? -600 : 600, behavior: "smooth" });
            }
        };

        window.addEventListener("wheel", handleWheel, { passive: true });
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("wheel", handleWheel);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    useEffect(() => {
        document.documentElement.classList.add("is-legal-doc-page");
        document.body.classList.add("is-legal-doc-page");
        return () => {
            document.documentElement.classList.remove("is-legal-doc-page");
            document.body.classList.remove("is-legal-doc-page");
        };
    }, []);

    return (
        <div className="legal-public-page bg-background font-sans text-foreground transition-colors duration-200">
            {/* 顶栏 */}
            <header className="legal-public-header flex h-16 w-full items-center justify-between px-6 sm:px-12 transition-colors">
                <LegalBrand />
                <LegalHeaderNav currentPath="/legal" />

                <div className="flex items-center gap-4">
                    <TopbarLanguageSwitcher surface="legal" className="min-h-11 min-w-11 rounded-full border border-border px-3 text-foreground" />
                    <LegalThemeToggler />
                </div>
            </header>

            {/* 展台区 */}
            <main className="mx-auto max-w-[840px] px-6 pt-24 pb-16 sm:pt-28 sm:pb-24">
                <div className="font-mono text-[var(--fs-label)] uppercase tracking-[0.16em] text-sky-600 dark:text-sky-400 mb-3">§ 官方合规门户</div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.035em] leading-[1.08] mb-6 text-foreground">{title}</h1>
                <p className="text-base sm:text-lg leading-relaxed mb-12 text-muted-foreground">
                    {interfaceText("查看 {product} 的法律协议、隐私政策与内容规则。英文为权威版本，另提供简体中文、繁体中文、西班牙语、法语、德语、日语和韩语译文。", { product: LEGAL_OPERATOR_CONFIG.productName })}
                </p>

                {/* 三大核心法务卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                    {/* 1. TOS */}
                    <Link to="/terms" className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-6 no-underline transition-all hover:border-foreground/25 hover:bg-muted/50">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-mono text-[var(--fs-label)] uppercase tracking-wider text-sky-600 dark:text-sky-400 font-semibold">服务条款 · V2 积分</span>
                                <FileText className="size-4 text-muted-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors" />
                            </div>
                            <h2 className="text-lg font-semibold tracking-tight mb-2 text-foreground">服务条款</h2>
                            <p className="text-xs leading-relaxed text-muted-foreground">规范账号资格、积分预付即时数字交付、Waffo Pancake PCI-DSS 安全支付、7天退款与 AI 资产所有权。</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-mono text-sky-600 dark:text-sky-400 pt-6 mt-6 border-t border-border">
                            <span>阅读政策</span>
                            <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>

                    {/* 2. Privacy */}
                    <Link to="/privacy" className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-6 no-underline transition-all hover:border-foreground/25 hover:bg-muted/50">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-mono text-[var(--fs-label)] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">隐私 · GDPR / CCPA</span>
                                <Shield className="size-4 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                            </div>
                            <h2 className="text-lg font-semibold tracking-tight mb-2 text-foreground">隐私政策</h2>
                            <p className="text-xs leading-relaxed text-muted-foreground">个人信息收集范围、不存卡号承诺、不出售用户隐私承诺、主流模型推理隔离与 72h 泄露通报。</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-mono text-emerald-600 dark:text-emerald-400 pt-6 mt-6 border-t border-border">
                            <span>阅读政策</span>
                            <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>

                    {/* 3. AUP */}
                    <Link to="/aup" className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-6 no-underline transition-all hover:border-foreground/25 hover:bg-muted/50">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-mono text-[var(--fs-label)] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">AUP · 内容规则</span>
                                <Shield className="size-4 text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                            </div>
                            <h2 className="text-lg font-semibold tracking-tight mb-2 text-foreground">可接受使用政策（AUP）</h2>
                            <p className="text-xs leading-relaxed text-muted-foreground">六大禁止类别（色情/暴力/仇恨/CSAM/深伪冒充/侵权）、真人肖像授权要求、举报时效与处置。</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-mono text-amber-600 dark:text-amber-400 pt-6 mt-6 border-t border-border">
                            <span>阅读政策</span>
                            <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>
                </div>

                <Link to="/html/refund" className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm text-foreground underline underline-offset-4">
                    {REFUND_COPY.title[SUPPORTED_LOCALES.findIndex(({ code }) => code === locale)]}
                    <ArrowRight className="size-4" aria-hidden />
                </Link>

                {/* 经营主体公示 */}
                <section className="rounded-2xl border border-border bg-card p-8 text-xs leading-relaxed">
                    <h3 className="text-sm font-semibold mb-4 tracking-tight text-foreground">运营主体与合规联络渠道</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <span className="text-muted-foreground block mb-1">经营者 / 商户法定名称</span>
                            <span className="font-mono text-foreground font-medium">{LEGAL_OPERATOR_CONFIG.legalName}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block mb-1">对外经营名称 (Trade Name)</span>
                            <span className="font-mono text-foreground font-medium">{LEGAL_OPERATOR_CONFIG.tradeName}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block mb-1">客户支持与账单退款</span>
                            <a href={`mailto:${LEGAL_OPERATOR_CONFIG.supportEmail}`} className="font-mono text-sky-600 dark:text-sky-400 no-underline hover:underline">
                                {LEGAL_OPERATOR_CONFIG.supportEmail}
                            </a>
                        </div>
                        <div>
                            <span className="text-muted-foreground block mb-1">内容安全与 AUP 举报通道</span>
                            <a href={`mailto:${LEGAL_OPERATOR_CONFIG.safetyEmail}`} className="font-mono text-amber-600 dark:text-amber-400 no-underline hover:underline">
                                {LEGAL_OPERATOR_CONFIG.safetyEmail}
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            <SupdanceAboutFooter pagePath="/legal" />
        </div>
    );
}
