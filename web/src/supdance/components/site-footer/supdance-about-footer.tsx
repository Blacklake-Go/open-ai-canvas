import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useLocaleStore } from "@/stores/use-locale-store";
import { useI18n } from "@/supdance/plugins/i18n";
import "./site-footer.css";

import { DEFAULT_HTML_SITE_FOOTER_CONFIG, fetchPublicHtmlSiteFooterConfig } from "@/supdance/plugins/html-page-manager/api";
import type { HtmlSiteFooterConfig } from "@/supdance/plugins/html-page-manager/types";

const aboutLabels: Readonly<Record<string, string>> = {
    "zh-TW": "關於我們",
    "es-ES": "Sobre nosotros",
    "zh-CN": "关于我们",
    "en-US": "About Us",
    "fr-FR": "À propos",
    "de-DE": "Über uns",
    "ja-JP": "会社概要",
    "ko-KR": "회사 소개",
};

const footerLabels = {
    "zh-TW": { title: "法律與支援", center: "法律中心", contact: "聯絡我們" },
    "es-ES": { title: "Información legal y ayuda", center: "Centro legal", contact: "Contactar" },
    "zh-CN": { title: "法律与支持", center: "法律中心", contact: "联系我们" },
    "en-US": { title: "Legal & support", center: "Legal center", contact: "Contact us" },
    "fr-FR": { title: "Informations et assistance", center: "Centre juridique", contact: "Nous contacter" },
    "de-DE": { title: "Rechtliches & Support", center: "Rechtliche Informationen", contact: "Kontakt" },
    "ja-JP": { title: "法務・サポート", center: "法務情報", contact: "お問い合わせ" },
    "ko-KR": { title: "법률 및 지원", center: "법률 정보", contact: "문의하기" },
};

const socialIconAliases: Readonly<Record<string, string>> = { twitter: "x", xhs: "xiaohongshu", red: "xiaohongshu" };
const socialIconIds = new Set(["x", "youtube", "instagram", "xiaohongshu", "qq", "threads", "discord", "reddit"]);

function SocialVectorIcon({ id }: { id: string }) {
    const key = id.toLowerCase();
    const icon = socialIconAliases[key] ?? key;
    if (!socialIconIds.has(icon)) {
        return <span className="text-xs font-mono font-bold">{id.slice(0, 2).toUpperCase()}</span>;
    }
    return (
        <svg width={17} height={17} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <use href={`/supdance-social-icons.svg#${icon}`} />
        </svg>
    );
}

function safeSocialHref(href: string): string | undefined {
    try {
        const url = new URL(href);
        if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) return url.href;
    } catch {
        return undefined;
    }
}

function getSocialHoverClass(id: string): string {
    const key = id.toLowerCase();
    if (key === "youtube") return "hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400";
    if (key === "instagram") return "hover:border-pink-500/40 hover:bg-pink-500/10 hover:text-pink-600 dark:hover:text-pink-400";
    if (key === "xiaohongshu" || key === "xhs" || key === "red") return "hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400";
    if (key === "qq") return "hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-sky-600 dark:hover:text-sky-400";
    return "hover:border-foreground/30 hover:bg-surface-hover hover:text-foreground";
}

function SmartLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
    if (href.startsWith("/") && !href.endsWith(".html")) {
        return (
            <Link to={href} className={className}>
                {children}
            </Link>
        );
    }
    const isExternal = href.startsWith("http://") || href.startsWith("https://");
    return (
        <a href={href} className={className} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined}>
            {children}
        </a>
    );
}

interface SupdanceAboutFooterProps {
    pagePath?: string;
    configOverride?: HtmlSiteFooterConfig;
    forceShow?: boolean;
}

export function SupdanceAboutFooter({ pagePath, configOverride, forceShow = false }: SupdanceAboutFooterProps) {
    const { t } = useI18n();
    const locale = useLocaleStore((state) => state.locale);
    const labels = footerLabels[locale];
    const toolColumns = [
        {
            title: t("nav.sidebar.headingTools"),
            links: [
                { label: t("nav.sidebar.toolboxImage"), href: "/toolbox/image" },
                { label: t("nav.sidebar.toolboxVideo"), href: "/toolbox/video" },
                { label: t("upstream.creation.musicNavigation"), href: "/toolbox/music" },
                { label: t("nav.tools.assets"), href: "/assets" },
                { label: t("nav.tools.skills"), href: "/skills" },
                { label: t("nav.tools.plugins"), href: "/plugins" },
            ],
        },
        {
            title: t("nav.sidebar.home"),
            links: [
                { label: t("nav.sidebar.canvas"), href: "/canvas" },
                { label: t("nav.sidebar.projects"), href: "/projects" },
                { label: t("nav.tools.create"), href: "/create" },
                { label: t("nav.sidebar.ecommerce"), href: "/ecommerce" },
                { label: t("nav.tools.tasks"), href: "/tasks" },
                { label: aboutLabels[locale] || "About Us", href: "/about" },
            ],
        },
    ];
    const [remoteConfig, setRemoteConfig] = useState<HtmlSiteFooterConfig>(DEFAULT_HTML_SITE_FOOTER_CONFIG);

    useEffect(() => {
        if (configOverride) return;
        const controller = new AbortController();
        void fetchPublicHtmlSiteFooterConfig(controller.signal).then((cfg) => {
            setRemoteConfig(cfg);
        });
        return () => controller.abort();
    }, [configOverride]);

    const cfg = configOverride || remoteConfig;

    if (!forceShow) {
        if (!cfg.enabled) return null;
        if (pagePath && Array.isArray(cfg.sitePages)) {
            const matched = cfg.sitePages.find((p) => p.path === pagePath);
            if (matched && !matched.showFooter) {
                return null;
            }
        }
    }

    return (
        <footer className="supdance-site-footer relative mt-20 border-t border-white/10 bg-[#0a0a09] pt-16 pb-12 overflow-hidden text-[#f7f7f5]">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
                {/* TIER 3: 产品体系、开发者生态、合规政策与技术订阅 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/10">
                    {/* 第 1 列：品牌徽标与企业愿景 (占据 4 列) */}
                    <div className="lg:col-span-4 flex flex-col items-start space-y-4">
                        <Link to="/" className="group flex flex-col items-start gap-1.5 cursor-pointer no-underline" aria-label={`${cfg.brandName} Home`}>
                            <img src="/supdance-footer-logo.png" alt={cfg.brandName} className="supdance-footer-logo" width="1000" height="220" />
                            <span className="text-xs font-mono tracking-wider text-[#8e8e8a] uppercase">{t(cfg.brandSlogan)}</span>
                        </Link>

                        <p className="text-xs text-[#8e8e8a] leading-relaxed max-w-sm m-0">{t(cfg.brandVision)}</p>

                        <div className="pt-2 text-xs font-mono text-[#8e8e8a] space-y-1">
                            <a href={`mailto:${cfg.supportEmail}`} className="text-[#8e8e8a] hover:text-[#f7f7f5] transition-colors no-underline">
                                {cfg.supportEmail}
                            </a>
                        </div>

                        {/* 品牌官方社交与社区入口 */}
                        <div className="pt-3 flex flex-col items-start gap-2.5">
                            <span className="text-[11px] font-mono text-[#8e8e8a] tracking-wider uppercase">{t(cfg.officialChannelsText)}</span>
                            <div className="flex items-center flex-wrap gap-2">
                                {cfg.socialLinks.map((item) => {
                                    const href = safeSocialHref(item.href);
                                    if (!href) return null;
                                    const label = item.handle ? `${item.name} (${item.handle})` : item.name;
                                    return (
                                        <a
                                            key={item.id}
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`relative flex items-center justify-center size-11 rounded-xl bg-white/5 border border-white/10 text-[#8e8e8a] motion-safe:transition-all motion-safe:duration-200 cursor-pointer motion-safe:hover:scale-105 motion-safe:active:scale-95 ${getSocialHoverClass(item.id)}`}
                                            title={label}
                                            aria-label={label}
                                        >
                                            <SocialVectorIcon id={item.id} />
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* 第 2 & 3 列：导航链接矩阵 (各占 2 列) */}
                    {toolColumns.map((col, idx) => (
                        <div key={`${col.title}-${idx}`} className="lg:col-span-2 space-y-3">
                            <div className="text-xs font-bold text-[#f7f7f5] uppercase tracking-wider font-mono">{col.title}</div>
                            <ul className="space-y-2 text-xs text-[#8e8e8a] list-none p-0 m-0">
                                {col.links.map((lnk, lIdx) => (
                                    <li key={`${lnk.label}-${lIdx}`}>
                                        <SmartLink href={lnk.href} className="text-[#8e8e8a] hover:text-[#f7f7f5] transition-colors no-underline">
                                            {lnk.label}
                                        </SmartLink>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    <div className="lg:col-span-4 space-y-3">
                        <div className="text-xs font-bold text-[#f7f7f5] uppercase tracking-wider font-mono">{t("public.footer.legal_support")}</div>
                        <ul className="space-y-2 text-xs text-[#8e8e8a] list-none p-0 m-0">
                            {[
                                { label: t("legal.terms"), href: "/terms" },
                                { label: t("legal.privacy"), href: "/privacy" },
                                { label: t("legal.aup"), href: "/aup" },
                                { label: labels.center, href: "/legal" },
                                { label: t("nav.pricing"), href: "/pricing.html" },
                                { label: "MCP", href: "/mcp" },
                                { label: labels.contact, href: `mailto:${cfg.supportEmail}` },
                            ].map((item) => (
                                <li key={item.href}>
                                    <SmartLink href={item.href} className="text-[#8e8e8a] hover:text-[#f7f7f5] transition-colors no-underline">
                                        {item.label}
                                    </SmartLink>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* TIER 4: 底部版权标识、技术底座致敬与安全状态条 */}
                <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] font-mono text-[#70706b]">
                    <div className="flex flex-wrap items-center gap-2">
                        <span>© {new Date().getFullYear()} Supdance</span>
                        {cfg.icpNumber && (
                            <>
                                <span className="hidden sm:inline">·</span>
                                <a href={cfg.icpHref || "https://beian.miit.gov.cn/"} target="_blank" rel="noopener noreferrer" className="text-[#70706b] hover:text-[#f7f7f5] transition-colors no-underline">
                                    {cfg.icpNumber}
                                </a>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default SupdanceAboutFooter;
