import { TopbarLanguageSwitcher, useI18n } from "@/supdance/plugins/i18n";
import { useEffect, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useLocaleStore } from "@/stores/use-locale-store";
import { useLocation } from "react-router";

import { type LocalizedLegalDoc } from "./legal-i18n-content";
import { LEGAL_LOCALE_MAP, LEGAL_PAGE_COPY, type PolicyLanguage } from "./service-policies";
import { LegalThemeToggler } from "./legal-theme-toggler";
import { LegalBrand } from "./legal-brand";
import { LegalHeaderNav } from "./legal-header-nav";
import { SupdanceAboutFooter } from "@/supdance/components/site-footer/supdance-about-footer";

interface LinearLegalPageProps {
    children?: ReactNode;
    docMap: Partial<Record<PolicyLanguage, LocalizedLegalDoc>> & { en: LocalizedLegalDoc };
    currentSlug: "terms" | "privacy" | "aup";
}

/**
 * 完全基于用户指定参考图（Linear Dark Elegance）打造的法务条款页面。
 * 以英语为权威正文，八种语言共用站点语言状态。
 */
export function LinearLegalPage({ docMap, currentSlug, children }: LinearLegalPageProps) {
    const location = useLocation();
    const locale = useLocaleStore((state) => state.locale);
    const { t } = useI18n();
    const lang = LEGAL_LOCALE_MAP[locale];
    const pageCopy = LEGAL_PAGE_COPY[lang];
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
        <div className="legal-public-page bg-background font-sans text-foreground transition-colors duration-200">
            {/* 顶部 Sticky Header (Linear 风格) */}
            <header className="legal-public-header flex h-16 w-full items-center justify-between px-6 sm:px-12 transition-colors">
                {/* 左侧：Logo 与品牌 */}
                <LegalBrand />

                {/* 中间：协议导航链接 */}
                <LegalHeaderNav currentPath={`/${currentSlug}`} />

                {/* 右侧：多语言切换器 + 明暗切换 */}
                <div className="flex items-center gap-3">
                    <TopbarLanguageSwitcher surface="legal" className="min-h-11 min-w-11 rounded-full border border-border px-3 text-foreground" />
                    <LegalThemeToggler />
                </div>
            </header>

            {/* 主文本区：严格对标 Linear 极简黑夜大气质感 */}
            <main lang={locale} className="mx-auto max-w-[760px] px-6 pt-24 pb-16 sm:pt-28 sm:pb-12 lg:pt-32 lg:pb-16">
                {/* 大标题 */}
                <h1 className="text-4xl sm:text-5xl lg:text-[58px] font-semibold tracking-[-0.035em] leading-[1.08] mb-4 text-foreground">{currentDoc.title}</h1>

                {/* 元数据行 */}
                <div className="font-mono text-[var(--fs-label)] uppercase tracking-[0.12em] pb-6 mb-8 border-b border-border text-muted-foreground">
                    {pageCopy.effective}: {currentDoc.effectiveDate} · {pageCopy.version} {currentDoc.version}
                </div>

                {/* 文档导语段落 */}
                <div className="text-base sm:text-[17px] leading-[1.8] mb-12 text-foreground/90">{currentDoc.summary}</div>

                {/* 条款章节列表 */}
                <article className="space-y-12">
                    {currentDoc.sections.map((section) => (
                        <section key={section.id} id={section.id} className="scroll-mt-24">
                            {/* 章节标题 */}
                            <h2 className="text-xl sm:text-[22px] font-semibold tracking-[-0.02em] mb-4 flex items-center justify-between text-foreground">
                                <span>{section.title}</span>
                                <a
                                    href={`#${section.id}`}
                                    className="opacity-0 hover:opacity-100 focus-visible:opacity-100 text-xs font-mono text-sky-600 dark:text-sky-400 font-normal transition-opacity"
                                    aria-label={`${pageCopy.section}: ${section.title}`}
                                    title={pageCopy.section}
                                >
                                    #{section.id}
                                </a>
                            </h2>

                            {/* 段落 */}
                            {section.paragraphs?.map((p, pIdx) => (
                                <p key={pIdx} className="text-[15px] leading-[1.85] mb-4 text-foreground/80">
                                    {p}
                                </p>
                            ))}

                            {/* 重点声明框 Callout */}
                            {section.callout && <div className="my-6 rounded-xl border border-border bg-muted/50 p-4 text-sm leading-relaxed text-foreground/90">{section.callout}</div>}

                            {/* 项目列表 Bullets */}
                            {section.bullets && (
                                <ul className="my-4 space-y-2 pl-5 list-disc marker:text-muted-foreground">
                                    {section.bullets.map((b, bIdx) => (
                                        <li key={bIdx} className="text-[15px] leading-[1.8] text-foreground/80">
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {/* 结构化表格 Table */}
                            {section.table && (
                                <div className="my-6 overflow-x-auto rounded-lg border border-border bg-card">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/60">
                                                {section.table.head.map((th, thIdx) => (
                                                    <th key={thIdx} className="p-3 font-semibold font-mono tracking-wider text-foreground">
                                                        {th}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {section.table.rows.map((row, rIdx) => (
                                                <tr key={rIdx} className="border-b border-border/60 last:border-b-0">
                                                    {row.map((cell, cIdx) => (
                                                        <td key={cIdx} className={`p-3 align-top leading-relaxed ${cIdx === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
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

                {/* 快速滑动与导航浮动按钮组（右下角） */}
                <div className="fixed bottom-8 right-8 z-50 flex flex-col items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
                            const el = document.querySelector(".legal-public-page");
                            if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                        }}
                        className="flex size-10 items-center justify-center rounded-full border border-border bg-popover/95 text-foreground shadow-[var(--elevation-overlay)] backdrop-blur-md transition-all hover:scale-110 active:scale-95"
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
                        className="flex size-10 items-center justify-center rounded-full border border-border bg-popover/95 text-foreground shadow-[var(--elevation-overlay)] backdrop-blur-md transition-all hover:scale-110 active:scale-95"
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
