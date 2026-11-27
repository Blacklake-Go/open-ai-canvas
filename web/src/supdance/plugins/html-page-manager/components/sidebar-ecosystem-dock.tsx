import { Popover } from "antd";
import { Blocks, BookOpen, CircleDollarSign, FileText, Gift, Globe, Info, MessageSquare, Plug } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { interfaceText } from "@/i18n/interface-text";
import { formatReferralRate, getPublicReferralConfig, type ReferralPublicConfig } from "@/services/api/referral";
import { useLocaleStore } from "@/stores/use-locale-store";
import { selectPluginEffectivelyEnabled, usePluginStore } from "@/stores/use-plugin-store";
import { DEFAULT_HTML_SIDEBAR_DOCK_CONFIG, DEFAULT_HTML_SITE_FOOTER_CONFIG, fetchPublicHtmlSidebarDockConfig, fetchPublicHtmlSiteFooterConfig, SIDEBAR_DOCK_UPDATED_EVENT } from "../api";
import { SUPDANCE_HTML_PAGE_MANAGER_PLUGIN_ID, type HtmlSidebarDockCard, type HtmlSidebarDockConfig, type HtmlSidebarDockSocial, type HtmlSiteFooterConfig } from "../types";
import { ShareIncentiveModal } from "./share-incentive-modal";
import "./sidebar-ecosystem-dock.css";

const pluginGate = selectPluginEffectivelyEnabled(SUPDANCE_HTML_PAGE_MANAGER_PLUGIN_ID, true);

const SOCIAL_ICON_ALIASES: Readonly<Record<string, string>> = { twitter: "x", xhs: "xiaohongshu", red: "xiaohongshu" };
const SOCIAL_SVG_PATHS: Readonly<Record<string, string>> = {
    x: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
    youtube:
        "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
    instagram:
        "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
    xiaohongshu:
        "M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z",
    qq: "M21.395 15.035a40 40 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a39 39 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673",
    threads:
        "M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z",
    discord:
        "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z",
    reddit: "M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z",
};

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

export function DockSocialSvg({ id, size = 15 }: { id: string; size?: number }) {
    const key = id.toLowerCase();
    const icon = SOCIAL_ICON_ALIASES[key] ?? key;
    const path = SOCIAL_SVG_PATHS[icon];
    if (!path) {
        return <span className="font-mono text-label font-bold">{id.slice(0, 2).toUpperCase()}</span>;
    }
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={path} />
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
        void Promise.all([fetchPublicHtmlSidebarDockConfig(controller.signal), fetchPublicHtmlSiteFooterConfig(controller.signal)]).then(([dockCfg, footerCfg]) => {
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
        <a href={href} className="sd-dock-card" target={isBlank ? "_blank" : card.target === "_top" ? "_top" : undefined} rel={isBlank ? "noopener noreferrer" : undefined} title={label} aria-label={label} onClick={onNavigate}>
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
    const [incentiveOpen, setIncentiveOpen] = useState(false);
    const [publicReferral, setPublicReferral] = useState<ReferralPublicConfig>({
        enabled: true,
        mode: "all",
        commissionRateBasisPoints: 1_000,
    });

    useEffect(() => {
        if (configOverride) return;
        const controller = new AbortController();
        void getPublicReferralConfig(controller.signal).then(setPublicReferral);
        return () => controller.abort();
    }, [configOverride]);

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

    const showIncentive = !config.hideIncentiveCard;

    if (!isEnabled || (visibleCards.length === 0 && !showIncentive && visibleSocials.length === 0)) {
        return null;
    }

    const title = COLLAPSED_POPOVER_TITLES[locale] || COLLAPSED_POPOVER_TITLES["zh-CN"];
    const rateLabel = publicReferral.commissionRateBasisPoints > 0 ? formatReferralRate(publicReferral.commissionRateBasisPoints) : "10%";
    const incentiveTitle = interfaceText("分享赢积分");
    const incentiveSubtitle = interfaceText("邀友赚 +{rate} 积分", { rate: rateLabel });

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

            {showIncentive ? (
                <button
                    type="button"
                    className="sd-dock-incentive-btn"
                    onClick={() => {
                        if (configOverride) return;
                        closePopover?.();
                        setIncentiveOpen(true);
                    }}
                    aria-label={incentiveTitle}
                >
                    <span className="sd-dock-incentive-icon" aria-hidden="true">
                        <Gift className="size-3.5" strokeWidth={1.9} />
                    </span>
                    <span className="sd-dock-incentive-copy">
                        <span className="sd-dock-incentive-title">{incentiveTitle}</span>
                        <span className="sd-dock-incentive-sub">{incentiveSubtitle}</span>
                    </span>
                </button>
            ) : null}

            {visibleSocials.length > 0 ? (
                <div className="sd-dock-socials" aria-label="Official Social Links">
                    {visibleSocials.map((item) => {
                        const href = safeHref(item.href);
                        if (!href) return null;
                        const label = item.handle ? `${item.name} (${item.handle})` : item.name;
                        return (
                            <a key={item.id} href={href} target="_blank" rel="noopener noreferrer" className="sd-dock-social-btn" data-social={item.id} title={label} aria-label={label}>
                                <DockSocialSvg id={item.id} />
                            </a>
                        );
                    })}
                </div>
            ) : null}
        </>
    );

    const modalNode = configOverride ? null : <ShareIncentiveModal open={incentiveOpen} onClose={() => setIncentiveOpen(false)} publicConfig={publicReferral} />;

    if (collapsed) {
        return (
            <>
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
                {modalNode}
            </>
        );
    }

    return (
        <>
            <div className="sd-dock-root" data-plugin-id={SUPDANCE_HTML_PAGE_MANAGER_PLUGIN_ID}>
                {dockContent()}
            </div>
            {modalNode}
        </>
    );
}
