import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useLocaleStore } from "@/stores/use-locale-store";
import { useI18n } from "@/supdance/plugins/i18n";
import "./site-footer.css";

import { DEFAULT_HTML_SITE_FOOTER_CONFIG, fetchPublicHtmlSiteFooterConfig } from "@/supdance/plugins/html-page-manager/api";
import type { HtmlSiteFooterConfig } from "@/supdance/plugins/html-page-manager/types";

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

function SocialVectorIcon({ id }: { id: string }) {
    const key = id.toLowerCase();
    if (key === "x" || key === "twitter") {
        return (
            <svg width={17} height={17} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
        );
    }
    if (key === "youtube") {
        return (
            <svg width={17} height={17} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
        );
    }
    if (key === "instagram") {
        return (
            <svg width={17} height={17} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
            </svg>
        );
    }
    if (key === "xiaohongshu" || key === "xhs" || key === "red") {
        return (
            <svg width={17} height={17} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z" />
            </svg>
        );
    }
    if (key === "qq") {
        return (
            <svg width={17} height={17} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21.395 15.035a40 40 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a39 39 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673" />
            </svg>
        );
    }
    return <span className="text-xs font-mono font-bold">{id.slice(0, 2).toUpperCase()}</span>;
}

function getSocialHoverClass(id: string): string {
    const key = id.toLowerCase();
    if (key === "youtube") return "hover:border-red-500/40 hover:bg-red-500/10 hover:text-[#FF0000]";
    if (key === "instagram") return "hover:border-pink-500/40 hover:bg-pink-500/10 hover:text-[#E4405F]";
    if (key === "xiaohongshu" || key === "xhs" || key === "red") return "hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-[#FF2442]";
    if (key === "qq") return "hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-[#12B7F5]";
    return "hover:border-white/40 hover:bg-white/10 hover:text-white";
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
        <footer className="supdance-site-footer relative mt-20 border-t border-white/[0.08] pt-16 pb-12 overflow-hidden text-white">
            {/* 底部全景极光微光环境背光 (指针安全) */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1200px] h-[480px] bg-gradient-to-t from-[#e11d74]/10 via-[#3772FF]/5 to-transparent blur-[160px] pointer-events-none" />
            <div className="absolute -bottom-24 -left-20 w-[420px] h-[420px] bg-[#00f5d4]/5 blur-[130px] rounded-full pointer-events-none" />

            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
                {/* TIER 3: 产品体系、开发者生态、合规政策与技术订阅 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/[0.08]">
                    {/* 第 1 列：品牌徽标与企业愿景 (占据 4 列) */}
                    <div className="lg:col-span-4 flex flex-col items-start space-y-4">
                        <Link to="/" className="group flex flex-col items-start gap-1.5 cursor-pointer no-underline" aria-label={`${cfg.brandName} Home`}>
                            <img src="/supdance-footer-logo.png" alt={cfg.brandName} className="supdance-footer-logo" width="1000" height="220" />
                            <span className="text-xs font-mono tracking-wider uppercase">{cfg.brandSlogan}</span>
                        </Link>

                        <p className="text-xs text-white/60 leading-relaxed max-w-sm m-0">{cfg.brandVision}</p>

                        <div className="pt-2 text-xs font-mono text-white/50 space-y-1">
                            <a href={`mailto:${cfg.supportEmail}`} className="text-white/50 hover:text-white transition-colors no-underline">
                                {cfg.supportEmail}
                            </a>
                        </div>

                        {/* 品牌官方社交与社区入口 */}
                        <div className="pt-3 flex flex-col items-start gap-2.5">
                            <span className="text-[11px] font-mono text-white/45 tracking-wider uppercase">{cfg.officialChannelsText}</span>
                            <div className="flex items-center flex-wrap gap-2">
                                {cfg.socialLinks.map((item) => (
                                    <a
                                        key={item.id}
                                        href={item.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`relative flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 ${getSocialHoverClass(item.id)}`}
                                        title={`${item.name} (${item.handle})`}
                                        aria-label={`${item.name} ${item.handle}`}
                                    >
                                        <SocialVectorIcon id={item.id} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 第 2 & 3 列：导航链接矩阵 (各占 2 列) */}
                    {toolColumns.map((col, idx) => (
                        <div key={`${col.title}-${idx}`} className="lg:col-span-2 space-y-3">
                            <div className="text-xs font-bold text-white uppercase tracking-wider font-mono">{col.title}</div>
                            <ul className="space-y-2 text-xs text-white/60 list-none p-0 m-0">
                                {col.links.map((lnk, lIdx) => (
                                    <li key={`${lnk.label}-${lIdx}`}>
                                        <SmartLink href={lnk.href} className="text-white/60 hover:text-white transition-colors no-underline">
                                            {lnk.label}
                                        </SmartLink>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    <div className="lg:col-span-4 space-y-3">
                        <div className="text-xs font-bold text-white uppercase tracking-wider font-mono">{t("public.footer.legal_support")}</div>
                        <ul className="space-y-2 text-xs text-white/60 list-none p-0 m-0">
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
                                    <SmartLink href={item.href} className="text-white/60 hover:text-white transition-colors no-underline">
                                        {item.label}
                                    </SmartLink>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* TIER 4: 底部版权标识、技术底座致敬与安全状态条 */}
                <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] font-mono text-white/40">
                    <div className="flex flex-wrap items-center gap-2">
                        <span>© {new Date().getFullYear()} Supdance</span>
                        {cfg.icpNumber && (
                            <>
                                <span className="hidden sm:inline">·</span>
                                <a href={cfg.icpHref || "https://beian.miit.gov.cn/"} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white transition-colors no-underline">
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
