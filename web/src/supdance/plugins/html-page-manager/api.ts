import { http } from "@/services/api/request";
import type { HtmlPagesAdminOverview, HtmlSidebarDockConfig, HtmlSiteFooterConfig, ManagedHtmlPage } from "./types";

const BASE_PUBLIC = "/plugins/supdance-html-page-manager";
const BASE_ADMIN = "/admin/plugins/supdance-html-page-manager";
export const SIDEBAR_DOCK_UPDATED_EVENT = "supdance:sidebar-dock:updated";

const additionalSocialLinks = [
    { id: "threads", name: "Threads", handle: "@supdance_ai", href: "https://www.threads.com/@supdance_ai" },
    { id: "discord", name: "Discord", handle: "SupDance", href: "https://discord.gg/dBDAqa5HAG" },
    { id: "reddit", name: "Reddit", handle: "r/Supdance_ai", href: "https://www.reddit.com/r/Supdance_ai/" },
];

function withSocialLinkFields(overview: HtmlPagesAdminOverview): HtmlPagesAdminOverview {
    const { siteFooter } = overview;
    const existingIds = new Set(siteFooter.socialLinks.map(({ id }) => id.toLowerCase()));
    const missing = additionalSocialLinks.filter(({ id }) => !existingIds.has(id));
    return { ...overview, siteFooter: { ...siteFooter, socialLinks: [...siteFooter.socialLinks, ...missing] } };
}

export const DEFAULT_HTML_SITE_FOOTER_CONFIG: HtmlSiteFooterConfig = {
    enabled: true,
    brandName: "supdance",
    brandSlogan: "AI 创意工作室",
    brandVision: "面向创作者、独立工作室与团队的专业生成式 AI 创作工作台与模型接入层，支持模型发现、生成与工作流协作。",
    supportEmail: "support@supdance.com",
    officialChannelsText: "官方社交媒体与社区",
    socialLinks: [
        { id: "x", name: "X (Twitter)", handle: "@supdance_ai", href: "https://x.com/supdance_ai" },
        { id: "youtube", name: "YouTube", handle: "SupDance AI", href: "https://www.youtube.com/channel/UCOoro6d-vr6M-1UIpP5POew" },
        { id: "instagram", name: "Instagram", handle: "@supdance_ai", href: "https://www.instagram.com/supdance_ai/" },
        { id: "xiaohongshu", name: "小红书 (RED)", handle: "SupDance", href: "https://www.xiaohongshu.com/user/profile/678ada5f000000000d0084c9" },
        { id: "qq", name: "QQ 交流群", handle: "SupDance 官方群", href: "https://qm.qq.com/q/e8alJlLDuE" },
        ...additionalSocialLinks,
    ],
    columns: [
        {
            title: "创意工作台",
            links: [
                { label: "图像生图工坊", href: "https://one.supdance.com/zh/studio?tab=image" },
                { label: "视频运镜导演台", href: "https://one.supdance.com/zh/studio?tab=video" },
                { label: "音频音乐工作台", href: "https://one.supdance.com/zh/studio?tab=audio" },
                { label: "节点式工作流", href: "https://one.supdance.com/zh/workflow" },
                { label: "会员订阅方案", href: "https://one.supdance.com/zh/pricing" },
            ],
        },
        {
            title: "开发者与遥测",
            links: [
                { label: "开放平台（筹备中）", href: "https://one.supdance.com/zh/call-api" },
                { label: "模型目录与真实调用", href: "https://one.supdance.com/zh/about#models" },
                { label: "创作者案例广场", href: "https://one.supdance.com/zh/community" },
                { label: "创作者算力权益", href: "https://one.supdance.com/zh/benefits" },
            ],
        },
    ],
    newsletterHeading: "模型技术周刊与通知",
    newsletterDesc: "订阅 supdance 技术周报，第一时间获取模型与产品更新公告。",
    newsletterCardTitle: "邮件订阅即将开放",
    newsletterCardDesc: "目前还没有可用的邮件订阅服务。欢迎先加入社区获取模型与产品更新。",
    newsletterActionText: "前往社区",
    newsletterActionHref: "https://one.supdance.com/zh/community",
    legalLinks: [
        { label: "隐私政策", href: "/privacy" },
        { label: "服务条款", href: "/terms" },
        { label: "退款准则", href: "/aup" },
        { label: "内容安全", href: "/legal" },
    ],
    copyrightText: "© 2026 supdance (supdance.com). 保留所有权利。",
    icpNumber: "备案编号：沪ICP备2026050086号",
    icpHref: "https://beian.miit.gov.cn/",
    operatingSystemText: "新一代生成式 AI 创意工作系统",
    statusPrimaryText: "高精创作画布内核",
    statusSecondaryText: "模型网关中枢",
    sitePages: [
        { path: "/terms", title: "服务条款 (Terms of Service)", description: "平台服务协议、积分即时交付与退款保障条款", pageType: "spa", showFooter: true },
        { path: "/privacy", title: "隐私政策 (Privacy Policy)", description: "个人信息收集范围、GDPR/CCPA 与数据安全保护", pageType: "spa", showFooter: true },
        { path: "/aup", title: "可接受使用政策 (Acceptable Use Policy)", description: "AI 生成内容合规底线、举报机制与安全处置", pageType: "spa", showFooter: true },
        { path: "/legal", title: "法务与合规中心 (Legal Hub)", description: "法律协议总览入口与经营主体公示", pageType: "spa", showFooter: true },
        { path: "/mcp", title: "MCP 协议与插件生态 (MCP Center)", description: "开源 MCP 工具清单、CLI 安装指南与插件市场", pageType: "spa", showFooter: true },
        { path: "/pricing.html", title: "公开价目表 (Pricing HTML)", description: "积分套餐、云存储与全量 AI 模型参考价目表", pageType: "static-html", showFooter: true },
    ],
    updatedAt: new Date(0).toISOString(),
};

/** 获取公开已发布的 HTML 页面列表 */
export async function fetchPublicHtmlPages(signal?: AbortSignal): Promise<ManagedHtmlPage[]> {
    const res = await http.get<{ pages: ManagedHtmlPage[] }>(`${BASE_PUBLIC}/pages`, { signal });
    return res.pages;
}

/** 按 slug 获取单个公开页面 */
export async function fetchPublicHtmlPageBySlug(slug: string, signal?: AbortSignal): Promise<ManagedHtmlPage> {
    return http.get<ManagedHtmlPage>(`${BASE_PUBLIC}/pages/${encodeURIComponent(slug)}`, { signal });
}

/** 获取公开的页脚与受管页面配置（免登录，失败自动回退默认值） */
export async function fetchPublicHtmlSiteFooterConfig(signal?: AbortSignal): Promise<HtmlSiteFooterConfig> {
    try {
        const res = await http.get<{ siteFooter: HtmlSiteFooterConfig }>(`${BASE_PUBLIC}/site-footer`, { signal });
        return res.siteFooter || DEFAULT_HTML_SITE_FOOTER_CONFIG;
    } catch {
        return DEFAULT_HTML_SITE_FOOTER_CONFIG;
    }
}

/** 管理员获取所有 HTML 页面与页脚概览 */
export async function fetchAdminHtmlPagesOverview(signal?: AbortSignal): Promise<HtmlPagesAdminOverview> {
    return withSocialLinkFields(await http.get<HtmlPagesAdminOverview>(`${BASE_ADMIN}/overview`, { signal }));
}

/** 管理员保存或更新页面列表 */
export async function saveAdminHtmlPages(pages: ManagedHtmlPage[]): Promise<HtmlPagesAdminOverview> {
    return http.put<HtmlPagesAdminOverview>(`${BASE_ADMIN}/pages`, { pages });
}

/** 管理员重置所有页面为默认高质感模板 */
export async function resetAdminHtmlPages(): Promise<HtmlPagesAdminOverview> {
    return http.post<HtmlPagesAdminOverview>(`${BASE_ADMIN}/reset`, {});
}

/** 管理员保存或更新页脚与受管站点页面配置 */
export async function saveAdminHtmlSiteFooter(siteFooter: HtmlSiteFooterConfig): Promise<HtmlPagesAdminOverview> {
    return http.put<HtmlPagesAdminOverview>(`${BASE_ADMIN}/site-footer`, { siteFooter });
}

/** 管理员重置页脚与受管站点页面配置为默认 */
export async function resetAdminHtmlSiteFooter(): Promise<HtmlPagesAdminOverview> {
    return withSocialLinkFields(await http.post<HtmlPagesAdminOverview>(`${BASE_ADMIN}/site-footer/reset`, {}));
}

export const DEFAULT_HTML_SIDEBAR_DOCK_CONFIG: HtmlSidebarDockConfig = {
    enabled: true,
    hideStandalonePricingGroup: true,
    cards: [
        {
            id: "about",
            icon: "about",
            href: "/html/about",
            target: "_top",
            visible: true,
            order: 1,
            defaultLabel: "关于",
            labels: {
                "zh-CN": "关于",
                "en-US": "About",
                "zh-TW": "關於",
                "es-ES": "Info",
                "fr-FR": "À propos",
                "de-DE": "Über",
                "ja-JP": "概要",
                "ko-KR": "소개",
            },
        },
        {
            id: "pricing",
            icon: "pricing",
            href: "/pricing.html",
            target: "_top",
            visible: true,
            order: 2,
            defaultLabel: "定价",
            labels: {
                "zh-CN": "定价",
                "en-US": "Pricing",
                "zh-TW": "定價",
                "es-ES": "Precios",
                "fr-FR": "Tarifs",
                "de-DE": "Preise",
                "ja-JP": "料金",
                "ko-KR": "요금",
            },
        },
        {
            id: "mcp",
            icon: "mcp",
            href: "/mcp",
            target: "_self",
            visible: true,
            order: 3,
            defaultLabel: "MCP",
            labels: {
                "zh-CN": "MCP",
                "en-US": "MCP",
                "zh-TW": "MCP",
                "es-ES": "MCP",
                "fr-FR": "MCP",
                "de-DE": "MCP",
                "ja-JP": "MCP",
                "ko-KR": "MCP",
            },
        },
    ],
    socialEnabled: true,
    syncWithSiteFooter: true,
    maxVisibleSocials: 5,
    socialLinks: [
        { id: "x", name: "X (Twitter)", handle: "@supdance_ai", href: "https://x.com/supdance_ai", visible: true, order: 1 },
        { id: "youtube", name: "YouTube", handle: "SupDance AI", href: "https://www.youtube.com/channel/UCOoro6d-vr6M-1UIpP5POew", visible: true, order: 2 },
        { id: "instagram", name: "Instagram", handle: "@supdance_ai", href: "https://www.instagram.com/supdance_ai/", visible: true, order: 3 },
        { id: "xiaohongshu", name: "小红书 (RED)", handle: "SupDance", href: "https://www.xiaohongshu.com/user/profile/678ada5f000000000d0084c9", visible: true, order: 4 },
        { id: "qq", name: "QQ 交流群", handle: "SupDance 官方群", href: "https://qm.qq.com/q/e8alJlLDuE", visible: true, order: 5 },
        ...additionalSocialLinks.map((item, index) => ({ ...item, visible: false, order: 6 + index })),
    ],
    updatedAt: new Date(0).toISOString(),
};

function notifySidebarDockUpdated(config?: HtmlSidebarDockConfig): void {
    if (typeof window !== "undefined" && config) {
        window.dispatchEvent(new CustomEvent<HtmlSidebarDockConfig>(SIDEBAR_DOCK_UPDATED_EVENT, { detail: config }));
    }
}

/** 获取公开侧边栏停靠区配置（免登录，失败回退默认配置） */
export async function fetchPublicHtmlSidebarDockConfig(signal?: AbortSignal): Promise<HtmlSidebarDockConfig> {
    try {
        const res = await http.get<{ sidebarDock: HtmlSidebarDockConfig }>(`${BASE_PUBLIC}/sidebar-dock`, { signal });
        return res.sidebarDock || DEFAULT_HTML_SIDEBAR_DOCK_CONFIG;
    } catch {
        return DEFAULT_HTML_SIDEBAR_DOCK_CONFIG;
    }
}

/** 管理员保存侧边栏停靠区配置并触发全局热更新 */
export async function saveAdminHtmlSidebarDock(sidebarDock: HtmlSidebarDockConfig): Promise<HtmlPagesAdminOverview> {
    const overview = withSocialLinkFields(await http.put<HtmlPagesAdminOverview>(`${BASE_ADMIN}/sidebar-dock`, { sidebarDock }));
    notifySidebarDockUpdated(overview.sidebarDock);
    return overview;
}

/** 管理员重置侧边栏停靠区配置为默认 */
export async function resetAdminHtmlSidebarDock(): Promise<HtmlPagesAdminOverview> {
    const overview = withSocialLinkFields(await http.post<HtmlPagesAdminOverview>(`${BASE_ADMIN}/sidebar-dock/reset`, {}));
    notifySidebarDockUpdated(overview.sidebarDock);
    return overview;
}
