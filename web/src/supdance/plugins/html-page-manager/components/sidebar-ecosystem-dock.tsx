import { Popover } from "antd";
import { Blocks, BookOpen, CircleDollarSign, FileText, Globe, Info, MessageSquare, Plug } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useLocaleStore } from "@/stores/use-locale-store";
import { selectPluginEffectivelyEnabled, usePluginStore } from "@/stores/use-plugin-store";
import {
    DEFAULT_HTML_SIDEBAR_DOCK_CONFIG,
    DEFAULT_HTML_SITE_FOOTER_CONFIG,
    fetchPublicHtmlSidebarDockConfig,
    fetchPublicHtmlSiteFooterConfig,
    SIDEBAR_DOCK_UPDATED_EVENT,
} from "../api";
import { SUPDANCE_HTML_PAGE_MANAGER_PLUGIN_ID, type HtmlSidebarDockCard, type HtmlSidebarDockConfig, type HtmlSidebarDockSocial, type HtmlSiteFooterConfig } from "../types";
import "./sidebar-ecosystem-dock.css";

const pluginGate = selectPluginEffectivelyEnabled(SUPDANCE_HTML_PAGE_MANAGER_PLUGIN_ID, true);

const SOCIAL_ICON_ALIASES: Readonly<Record<string, string>> = { twitter: "x", xhs: "xiaohongshu", red: "xiaohongshu" };
const SOCIAL_ICON_IDS = new Set(["x", "youtube", "instagram", "xiaohongshu", "qq", "threads", "discord", "reddit"]);

const COLLAPSED_POPOVER_TITLES: Readonly<Record<string, string>> = {
    "zh-CN": "生态与社交入口",
    "en-US": "Ecosystem & Social",
    "zh-TW": "生態與社交入口",
    "es-ES": "Ecosistema y Redes",
    "fr-FR": "Écosystème & Réseaux",
    "de-DE": "Ökosystem & Social",
    "ja-JP": "エコシステム & SNS",
    "ko-KR": "생태계 & 소셜",
};

function safeHref(href: string): string | undefined {
    const trimmed = (href || "").trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith("/")) return trimmed;
    try {
        const url = new URL(trimmed);
        if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) {
            return url.href;
        }
    } catch {
        return undefined;
    }
    return undefined;
}

function DockCardIcon({ icon }: { icon: string }) {
    switch (icon) {
        case "about":
            return <Info className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />;
        case "pricing":
            return <CircleDollarSign className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />;
        case "mcp":
            return <Blocks className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />;
        case "skills":
            return <BookOpen className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />;
        case "plugins":
            return <Plug className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />;
        case "community":
            return <MessageSquare className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />;
        default:
            return <FileText className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />;
    }
}

function DockSocialSvg({ id }: { id: string }) {
    const key = id.toLowerCase();
    const icon = SOCIAL_ICON_ALIASES[key] ?? key;
    if (!SOCIAL_ICON_IDS.has(icon)) {
        return <span className="font-mono text-[10px] font-bold">{id.slice(0, 2).toUpperCase()}</span>;
    }
    return (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <use href={`/supdance-social-icons.svg#${icon}`} />
        </svg>
    );
}

export function resolveDockSocialLinks(config: HtmlSidebarDockConfig, footer?: HtmlSiteFooterConfig): HtmlSidebarDockSocial[] {
    if (!config.socialEnabled) return [];
    const maxCount = Math.max(1, Math.min(8, config.maxVisibleSocials || 5));
    const localMap = new Map(config.socialLinks.map((item) => [item.id.toLowerCase(), item]));

    if (config.syncWithSiteFooter && footer?.socialLinks?.length) {
        const merged: HtmlSidebarDockSocial[] = [];
        footer.socialLinks.forEach((remote, idx) => {
            const id = remote.id.toLowerCase();
            const rule = localMap.get(id);
            const visible = rule ? rule.visible : idx < maxCount;
            if (!visible) return;
            merged.push({
                id,
                name: remote.name || rule?.name || id,
                handle: remote.handle || rule?.handle || "",
                href: remote.href || rule?.href || "",
                visible: true,
                order: rule?.order ?? idx + 1,
            });
        });
        return merged.sort((a, b) => a.order - b.order).slice(0, maxCount);
    }

    return [...config.socialLinks]
        .filter((item) => item.visible && safeHref(item.href))
        .sort((a, b) => a.order - b.order)
        .slice(0, maxCount);
}

/**
 * 订阅侧边栏停靠区状态（与插件中心开关 + 后台页脚配置联动实现零刷新热插拔）
 */
export function useSidebarDockState(): {
    pluginActive: boolean;
    config: HtmlSidebarDockConfig;
    siteFooter: HtmlSiteFooterConfig;
    dockActive: boolean;
    hideStandalonePricingGroup: boolean;
} {
    const pluginActive = usePluginStore(pluginGate);
    const [config, setConfig] = useState<HtmlSidebarDockConfig>(DEFAULT_HTML_SIDEBAR_DOCK_CONFIG);
    const [siteFooter, setSiteFooter] = useState<HtmlSiteFooterConfig>(DEFAULT_HTML_SITE_FOOTER_CONFIG);

    useEffect(() => {
        if (!pluginActive) return;
        const controller = new AbortController();
        void Promise.all([
            fetchPublicHtmlSidebarDockConfig(controller.signal),
            fetchPublicHtmlSiteFooterConfig(controller.signal),
        ]).then(([dockCfg, footerCfg]) => {
            setConfig(dockCfg);
            setSiteFooter(footerCfg);
        });

        const handleUpdated = (ev: Event) => {
            const custom = ev as CustomEvent<HtmlSidebarDockConfig>;
            if (custom.detail) {
                setConfig(custom.detail);
            }
        };
        window.addEventListener(SIDEBAR_DOCK_UPDATED_EVENT, handleUpdated);
        return () => {
            controller.abort();
            window.removeEventListener(SIDEBAR_DOCK_UPDATED_EVENT, handleUpdated);
        };
    }, [pluginActive]);

    const dockActive = pluginActive && config.enabled;
    return {
        pluginActive,
        config,
        siteFooter,
        dockActive,
        hideStandalonePricingGroup: dockActive && config.hideStandalonePricingGroup,
    };
}

function DockCardLink({ card, label, onNavigate }: { card: HtmlSidebarDockCard; label: string; onNavigate?: () => void }) {
    const href = safeHref(card.href);
    if (!href) return null;

    const inner: ReactNode = (
        <>
            <DockCardIcon icon={card.icon} />
            <span className="sd-dock-card-label">{label}</span>
        </>
    );

    if (href.startsWith("/") && !href.endsWith(".html") && !href.startsWith("/html/") && card.target === "_self") {
        return (
            <Link to={href} className="sd-dock-card" title={label} aria-label={label} onClick={onNavigate}>
                {inner}
            </Link>
        );
    }

    const isBlank = card.target === "_blank";
    return (
        <a
            href={href}
            className="sd-dock-card"
            target={isBlank ? "_blank" : card.target === "_top" ? "_top" : undefined}
            rel={isBlank ? "noopener noreferrer" : undefined}
            title={label}
            aria-label={label}
            onClick={onNavigate}
        >
            {inner}
        </a>
    );
}

export interface SidebarEcosystemDockProps {
    collapsed: boolean;
    onNavigate?: () => void;
    configOverride?: HtmlSidebarDockConfig;
    siteFooterOverride?: HtmlSiteFooterConfig;
}

export function SidebarEcosystemDock({ collapsed, onNavigate, configOverride, siteFooterOverride }: SidebarEcosystemDockProps) {
    const locale = useLocaleStore((state) => state.locale);
    const liveState = useSidebarDockState();
    const [popoverOpen, setPopoverOpen] = useState(false);

    const config = configOverride ?? liveState.config;
    const siteFooter = siteFooterOverride ?? liveState.siteFooter;
    const isEnabled = configOverride ? config.enabled : liveState.dockActive;

    const visibleCards = useMemo(() => {
        return [...config.cards]
            .filter((item) => item.visible && safeHref(item.href))
            .sort((a, b) => a.order - b.order)
            .slice(0, 3);
    }, [config.cards]);

    const visibleSocials = useMemo(() => {
        return resolveDockSocialLinks(config, siteFooter);
    }, [config, siteFooter]);

    if (!isEnabled || (visibleCards.length === 0 && visibleSocials.length === 0)) {
        return null;
    }

    const title = COLLAPSED_POPOVER_TITLES[locale] || COLLAPSED_POPOVER_TITLES["zh-CN"];

    const dockContent = (closePopover?: () => void) => (
        <>
            {visibleCards.length > 0 ? (
                <div className="sd-dock-grid" style={{ gridTemplateColumns: `repeat(${visibleCards.length}, minmax(0, 1fr))` }}>
                    {visibleCards.map((card) => {
                        const label = card.labels?.[locale] || card.labels?.["zh-CN"] || card.defaultLabel || card.id;
                        return (
                            <DockCardLink
                                key={card.id}
                                card={card}
                                label={label}
                                onNavigate={() => {
                                    onNavigate?.();
                                    closePopover?.();
                                }}
                            />
                        );
                    })}
                </div>
            ) : null}

            {visibleSocials.length > 0 ? (
                <div className="sd-dock-socials" aria-label="Official Social Links">
                    {visibleSocials.map((item) => {
                        const href = safeHref(item.href);
                        if (!href) return null;
                        const label = item.handle ? `${item.name} (${item.handle})` : item.name;
                        return (
                            <a
                                key={item.id}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="sd-dock-social-btn"
                                data-social={item.id}
                                title={label}
                                aria-label={label}
                            >
                                <DockSocialSvg id={item.id} />
                            </a>
                        );
                    })}
                </div>
            ) : null}
        </>
    );

    if (collapsed) {
        return (
            <div className="sd-dock-root is-collapsed" data-plugin-id={SUPDANCE_HTML_PAGE_MANAGER_PLUGIN_ID}>
                <Popover
                    open={popoverOpen}
                    onOpenChange={setPopoverOpen}
                    trigger="click"
                    placement="rightBottom"
                    arrow={false}
                    content={
                        <div className="sd-dock-popover-box">
                            <p className="sd-dock-popover-title">{title}</p>
                            {dockContent(() => setPopoverOpen(false))}
                        </div>
                    }
                >
                    <button type="button" className="sd-dock-collapsed-trigger" aria-label={title} title={title}>
                        <Globe className="size-4" strokeWidth={1.8} aria-hidden="true" />
                    </button>
                </Popover>
            </div>
        );
    }

    return (
        <div className="sd-dock-root" data-plugin-id={SUPDANCE_HTML_PAGE_MANAGER_PLUGIN_ID}>
            {dockContent()}
        </div>
    );
}
