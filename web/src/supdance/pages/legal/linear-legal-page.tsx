import { Check, ChevronDown, Globe, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";

import { LEGAL_LANGUAGE_LABELS, LEGAL_OPERATOR_CONFIG, type LocalizedLegalDoc, type SupportedLegalLanguage } from "./legal-i18n-content";

interface LinearLegalPageProps {
    docMap: Record<SupportedLegalLanguage, LocalizedLegalDoc>;
    currentSlug: "terms" | "privacy" | "aup";
}

/**
 * 完全基于用户指定参考图（Linear Dark Elegance）打造的法务条款页面。
 * 默认深黑 (#000000) 极简奢雅排版，以英语为根语言（Authoritative），内置 6 国语言逐字对照切换。
 */
export function LinearLegalPage({ docMap, currentSlug }: LinearLegalPageProps) {
    const location = useLocation();
    const [lang, setLang] = useState<SupportedLegalLanguage>(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const paramLang = searchParams.get("lang") as SupportedLegalLanguage;
        if (paramLang && paramLang in docMap) return paramLang;
        const stored = localStorage.getItem("supdance-legal-lang") as SupportedLegalLanguage;
        if (stored && stored in docMap) return stored;
        return "en"; // 根语言默认为 English
    });

    const [isDark, setIsDark] = useState<boolean>(() => {
        const stored = localStorage.getItem("supdance-legal-theme");
        if (stored) return stored === "dark";
        return true; // 默认采用参考截图中的极黑高奢风格
    });

    const [langDropdownOpen, setLangDropdownOpen] = useState(false);

    // 切换语言
    const handleSelectLang = (selected: SupportedLegalLanguage) => {
        setLang(selected);
        localStorage.setItem("supdance-legal-lang", selected);
        setLangDropdownOpen(false);
        const url = new URL(window.location.href);
        url.searchParams.set("lang", selected);
        window.history.replaceState({}, "", url.toString());
    };

    // 切换明暗主题
    const toggleTheme = () => {
        const next = !isDark;
        setIsDark(next);
        localStorage.setItem("supdance-legal-theme", next ? "dark" : "light");
    };

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
            className={`min-h-screen w-full transition-colors duration-200 ${isDark ? "bg-[#000000] text-[#f4f4f6]" : "bg-[#ffffff] text-[#111111]"}`}
            style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
            }}
        >
            {/* 顶部 Sticky Header (Linear 风格) */}
            <header className={`sticky top-0 z-40 flex h-16 w-full items-center justify-between px-6 sm:px-12 backdrop-blur-md transition-colors ${isDark ? "bg-black/85 border-b border-white/10" : "bg-white/85 border-b border-black/10"}`}>
                {/* 左侧：Logo 与品牌 */}
                <Link to="/" className="flex items-center gap-2.5 text-base font-semibold tracking-tight no-underline group">
                    <span className={`size-6 rounded-full flex items-center justify-center font-bold text-xs ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>S</span>
                    <span className={isDark ? "text-white" : "text-black"}>{LEGAL_OPERATOR_CONFIG.tradeName}</span>
                    <span className={`text-[11px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded ${isDark ? "bg-white/10 text-white/60" : "bg-black/5 text-black/60"}`}>LEGAL</span>
                </Link>

                {/* 中间：协议导航链接 */}
                <nav className="hidden md:flex items-center gap-6 text-xs font-medium tracking-wide">
                    <Link
                        to="/terms"
                        className={`transition-colors no-underline ${currentSlug === "terms" ? (isDark ? "text-white font-semibold" : "text-black font-semibold") : isDark ? "text-white/60 hover:text-white" : "text-black/60 hover:text-black"}`}
                    >
                        Terms of Service
                    </Link>
                    <Link
                        to="/privacy"
                        className={`transition-colors no-underline ${currentSlug === "privacy" ? (isDark ? "text-white font-semibold" : "text-black font-semibold") : isDark ? "text-white/60 hover:text-white" : "text-black/60 hover:text-black"}`}
                    >
                        Privacy Policy
                    </Link>
                    <Link to="/aup" className={`transition-colors no-underline ${currentSlug === "aup" ? (isDark ? "text-white font-semibold" : "text-black font-semibold") : isDark ? "text-white/60 hover:text-white" : "text-black/60 hover:text-black"}`}>
                        Acceptable Use (AUP)
                    </Link>
                    <Link to="/legal" className={`transition-colors no-underline ${isDark ? "text-white/40 hover:text-white" : "text-black/40 hover:text-black"}`}>
                        Legal Hub
                    </Link>
                </nav>

                {/* 右侧：多语言切换器 + 明暗切换 */}
                <div className="flex items-center gap-3">
                    {/* 语言切换下拉框 */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                                isDark ? "border-white/15 bg-white/5 text-white/90 hover:border-white/30" : "border-black/15 bg-black/5 text-black/90 hover:border-black/30"
                            }`}
                            aria-expanded={langDropdownOpen}
                        >
                            <Globe className="size-3.5" />
                            <span className="font-mono">{LEGAL_LANGUAGE_LABELS[lang].code}</span>
                            <ChevronDown className="size-3 opacity-60" />
                        </button>

                        {langDropdownOpen && (
                            <div className={`absolute right-0 mt-2 w-56 rounded-xl border p-1 shadow-2xl z-50 ${isDark ? "bg-[#141418] border-white/10" : "bg-white border-black/10"}`}>
                                {(Object.keys(LEGAL_LANGUAGE_LABELS) as SupportedLegalLanguage[]).map((code) => {
                                    const active = lang === code;
                                    return (
                                        <button
                                            key={code}
                                            type="button"
                                            onClick={() => handleSelectLang(code)}
                                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                                                active ? (isDark ? "bg-white/10 text-white font-medium" : "bg-black/5 text-black font-medium") : isDark ? "text-white/70 hover:bg-white/5 hover:text-white" : "text-black/70 hover:bg-black/5 hover:text-black"
                                            }`}
                                        >
                                            <span>{LEGAL_LANGUAGE_LABELS[code].label}</span>
                                            {active && <Check className="size-3 text-sky-400" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 明暗模式切换 */}
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className={`p-1.5 rounded-full border transition-colors ${isDark ? "border-white/15 bg-white/5 text-white/80 hover:text-white" : "border-black/15 bg-black/5 text-black/80 hover:text-black"}`}
                        title={isDark ? "切换为明亮模式" : "切换为极黑高奢模式"}
                    >
                        {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                    </button>
                </div>
            </header>

            {/* 主文本区：严格对标 Linear 极简黑夜大气质感 */}
            <main className="mx-auto max-w-[760px] px-6 py-12 sm:py-20 lg:py-24">
                {/* 大标题 */}
                <h1 className={`text-4xl sm:text-5xl lg:text-[58px] font-semibold tracking-[-0.035em] leading-[1.08] mb-4 ${isDark ? "text-white" : "text-[#111111]"}`}>{currentDoc.title}</h1>

                {/* 元数据行 */}
                <div className={`font-mono text-[11px] uppercase tracking-[0.12em] pb-6 mb-8 border-b ${isDark ? "text-[#8a8f98] border-white/10" : "text-[#666666] border-black/10"}`}>
                    EFFECTIVE DATE: {currentDoc.effectiveDate.toUpperCase()} · VERSION {currentDoc.version.toUpperCase()}
                </div>

                {/* 权威根语言说明声明框（Authoritative Notice） */}
                <div className={`rounded-lg p-3.5 mb-8 text-xs font-mono border leading-relaxed ${isDark ? "bg-white/[0.03] border-white/10 text-white/80" : "bg-black/[0.02] border-black/10 text-black/80"}`}>
                    <strong>AUTHORITATIVE NOTICE: </strong>
                    {currentDoc.authoritativeNotice}
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
            </main>
        </div>
    );
}
