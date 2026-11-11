import { TopbarLanguageSwitcher, useI18n } from "@/supdance/plugins/i18n";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useLocaleStore } from "@/stores/use-locale-store";
import { matchAppLocale } from "@/i18n/locales";
import { Link, useLocation } from "react-router";

import { useThemeStore } from "@/stores/use-theme-store";
import { LEGAL_OPERATOR_CONFIG, type LocalizedLegalDoc, type SupportedLegalLanguage } from "./legal-i18n-content";
import { LegalThemeToggler } from "./legal-theme-toggler";
import { LegalBrand } from "./legal-brand";
import { LegalHeaderNav } from "./legal-header-nav";
import { SupdanceAboutFooter } from "@/supdance/components/site-footer/supdance-about-footer";

interface LinearLegalPageProps {
    children?: ReactNode;
    docMap: Record<SupportedLegalLanguage, LocalizedLegalDoc>;
    currentSlug: "terms" | "privacy" | "aup";
}

/**
 * 完全基于用户指定参考图（Linear Dark Elegance）打造的法务条款页面。
 * 默认深黑 (#000000) 极简奢雅排版，以英语为根语言（Authoritative），内置 6 国语言逐字对照切换。
 */
export function LinearLegalPage({ docMap, currentSlug, children }: LinearLegalPageProps) {
    const location = useLocation();
    const isDark = useThemeStore((state) => state.theme === "dark");
    const locale = useLocaleStore((state) => state.locale);
    const { t } = useI18n();
    const lang: SupportedLegalLanguage = locale === "zh-CN" ? locale : locale === "ja-JP" ? "ja" : locale === "ko-KR" ? "ko" : "en";
    // 挂载时解除画布 fixed 视口锁定，赋予法务长文 100% 原生 Window 下拉滚动体验
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

    useEffect(() => {
        const requested = new URLSearchParams(location.search).get("lang");
        const next = matchAppLocale(requested);
        if (next) useLocaleStore.getState().setLocale(next);
    }, [location.search]);

    // 处理 hash 锚点滚动（如 #content-standards, #enforcement-actions, #reporting）
    useEffect(() => {
        if (location.hash) {
            const targetId = location.hash.replace("#", "");
            const el = document.getElementById(targetId);
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
            }
        }
    }, [location.hash, lang]);

    const currentDoc = docMap[lang] || docMap.en;

    return (
        <div
            className={`legal-public-page transition-colors duration-200 ${isDark ? "bg-[#000000] text-[#f4f4f6]" : "bg-[#ffffff] text-[#111111]"}`}
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' }}
        >
            {/* 顶部 Sticky Header (Linear 风格) */}
            <header className="legal-public-header flex h-16 w-full items-center justify-between px-6 sm:px-12 transition-colors">
                {/* 左侧：Logo 与品牌 */}
                <LegalBrand badge="LEGAL" />

                {/* 中间：协议导航链接 */}
                <LegalHeaderNav currentPath={`/${currentSlug}`} />

                {/* 右侧：多语言切换器 + 明暗切换 */}
                <div className="flex items-center gap-3">
                    <TopbarLanguageSwitcher surface="legal" className="min-h-11 min-w-11 rounded-full border border-border px-3 text-foreground" />
                    <LegalThemeToggler />
                </div>
            </header>

            {/* 主文本区：严格对标 Linear 极简黑夜大气质感 */}
            <main className="mx-auto max-w-[760px] px-6 pt-24 pb-16 sm:pt-28 sm:pb-24 lg:pt-32 lg:pb-32">
                {/* 大标题 */}
                <h1 className={`text-4xl sm:text-5xl lg:text-[58px] font-semibold tracking-[-0.035em] leading-[1.08] mb-4 ${isDark ? "text-white" : "text-[#111111]"}`}>{currentDoc.title}</h1>

                {/* 元数据行 */}
                <div className={`font-mono text-[11px] uppercase tracking-[0.12em] pb-6 mb-8 border-b ${isDark ? "text-[#8a8f98] border-white/10" : "text-[#666666] border-black/10"}`}>
                    EFFECTIVE DATE: {currentDoc.effectiveDate.toUpperCase()} · VERSION {currentDoc.version.toUpperCase()}
                </div>

                {/* 文档导语段落 */}
                <div className={`text-base sm:text-[17px] leading-[1.8] mb-12 ${isDark ? "text-[#e6e6e6]" : "text-[#222222]"}`}>{currentDoc.summary}</div>

                {/* 条款章节列表 */}
                <article className="space-y-12">
                    {currentDoc.sections.map((section) => (
                        <section key={section.id} id={section.id} className="scroll-mt-24">
                            {/* 章节标题 */}
                            <h2 className={`text-xl sm:text-[22px] font-semibold tracking-[-0.02em] mb-4 flex items-center justify-between ${isDark ? "text-white" : "text-[#111111]"}`}>
                                <span>{section.title}</span>
                                <a href={`#${section.id}`} className="opacity-0 hover:opacity-100 text-xs font-mono text-sky-400 font-normal transition-opacity" title="复制章节锚点链接">
                                    #{section.id}
                                </a>
                            </h2>

                            {/* 段落 */}
                            {section.paragraphs?.map((p, pIdx) => (
                                <p key={pIdx} className={`text-[15px] leading-[1.85] mb-4 ${isDark ? "text-[#cccccc]" : "text-[#444444]"}`}>
                                    {p}
                                </p>
                            ))}

                            {/* 重点声明框 Callout */}
                            {section.callout && <div className={`my-6 rounded-xl border p-4 text-sm leading-relaxed ${isDark ? "border-white/15 bg-white/[0.02] text-[#e0e0e0]" : "border-black/10 bg-black/[0.02] text-[#333333]"}`}>{section.callout}</div>}

                            {/* 项目列表 Bullets */}
                            {section.bullets && (
                                <ul className="my-4 space-y-2 pl-5 list-disc marker:text-white/40">
                                    {section.bullets.map((b, bIdx) => (
                                        <li key={bIdx} className={`text-[15px] leading-[1.8] ${isDark ? "text-[#cccccc]" : "text-[#444444]"}`}>
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {/* 结构化表格 Table */}
                            {section.table && (
                                <div className={`my-6 overflow-x-auto rounded-lg border ${isDark ? "border-white/10 bg-white/[0.02]" : "border-black/10 bg-black/[0.02]"}`}>
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className={isDark ? "border-b border-white/10 bg-white/[0.04]" : "border-b border-black/10 bg-black/[0.04]"}>
                                                {section.table.head.map((th, thIdx) => (
                                                    <th key={thIdx} className={`p-3 font-semibold font-mono tracking-wider ${isDark ? "text-white/80" : "text-black/80"}`}>
                                                        {th}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {section.table.rows.map((row, rIdx) => (
                                                <tr key={rIdx} className={isDark ? "border-b border-white/5 last:border-b-0" : "border-b border-black/5 last:border-b-0"}>
                                                    {row.map((cell, cIdx) => (
                                                        <td key={cIdx} className={`p-3 align-top leading-relaxed ${cIdx === 0 ? (isDark ? "font-medium text-white" : "font-medium text-black") : isDark ? "text-[#a2a2ad]" : "text-[#555555]"}`}>
                                                            {cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    ))}
                </article>
                {children}

                {/* 页面底部签署与链接 */}
                <footer className={`mt-20 pt-8 border-t flex flex-wrap items-center justify-between gap-4 text-xs font-mono ${isDark ? "border-white/10 text-white/50" : "border-black/10 text-black/50"}`}>
                    <div>
                        © 2026 {LEGAL_OPERATOR_CONFIG.tradeName} ({LEGAL_OPERATOR_CONFIG.legalName}). ALL RIGHTS RESERVED.
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/legal" className={`no-underline hover:underline ${isDark ? "text-white/80" : "text-black/80"}`}>
                            Legal Center
                        </Link>
                        <a href={`mailto:${LEGAL_OPERATOR_CONFIG.supportEmail}`} className={`no-underline hover:underline ${isDark ? "text-white/80" : "text-black/80"}`}>
                            {LEGAL_OPERATOR_CONFIG.supportEmail}
                        </a>
                    </div>
                </footer>

                {/* 快速滑动与导航浮动按钮组（右下角） */}
                <div className="fixed bottom-8 right-8 z-50 flex flex-col items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
                            const el = document.querySelector(".legal-public-page");
                            if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                        }}
                        className="flex size-10 items-center justify-center rounded-full border border-black/10 bg-white/95 text-black shadow-lg backdrop-blur-md transition-all hover:scale-110 active:scale-95 dark:border-white/15 dark:bg-black/95 dark:text-white"
                        title={t("legal.scroll_to_bottom")}
                        aria-label={t("legal.scroll_to_bottom")}
                    >
                        <ArrowDown className="size-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            window.scrollTo({ top: 0, behavior: "smooth" });
                            const el = document.querySelector(".legal-public-page");
                            if (el) el.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="flex size-10 items-center justify-center rounded-full border border-black/10 bg-white/95 text-black shadow-lg backdrop-blur-md transition-all hover:scale-110 active:scale-95 dark:border-white/15 dark:bg-black/95 dark:text-white"
                        title={t("legal.back_to_top")}
                        aria-label={t("legal.back_to_top")}
                    >
                        <ArrowUp className="size-4" />
                    </button>
                </div>
            </main>

            <SupdanceAboutFooter pagePath={`/${currentSlug}`} />
        </div>
    );
}
