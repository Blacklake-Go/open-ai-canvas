export const SUPDANCE_HTML_PAGE_MANAGER_PLUGIN_ID = "supdance-html-page-manager" as const;

export type HtmlTemplateId = "linear-dark" | "linear-aup" | "vercel-doc" | "anthropic-hub" | "supabase-clean";

export interface HtmlTemplateMeta {
    id: HtmlTemplateId;
    name: string;
    category: "minimalist" | "documentation" | "hub" | "editorial";
    description: string;
    badge: string;
    theme: "dark" | "light" | "adaptive";
    sampleHtml: string;
}

export interface ManagedHtmlPage {
    id: string;
    slug: string;
    title: string;
    description: string;
    templateId: HtmlTemplateId | string;
    html: string;
    isPublished: boolean;
    updatedAt: string;
}

export interface HtmlManagedSitePage {
    path: string;
    title: string;
    description: string;
    pageType: "spa" | "static-html" | string;
    showFooter: boolean;
}

export interface HtmlFooterSocialLink {
    id: string;
    name: string;
    handle: string;
    href: string;
}

export interface HtmlFooterLinkItem {
    label: string;
    href: string;
}

export interface HtmlFooterLinkColumn {
    title: string;
    links: HtmlFooterLinkItem[];
}

export interface HtmlSiteFooterConfig {
    enabled: boolean;
    brandName: string;
    brandSlogan: string;
    brandVision: string;
    supportEmail: string;
    officialChannelsText: string;
    socialLinks: HtmlFooterSocialLink[];
    columns: HtmlFooterLinkColumn[];
    newsletterHeading: string;
    newsletterDesc: string;
    newsletterCardTitle: string;
    newsletterCardDesc: string;
    newsletterActionText: string;
    newsletterActionHref: string;
    legalLinks: HtmlFooterLinkItem[];
    copyrightText: string;
    icpNumber: string;
    icpHref: string;
    operatingSystemText: string;
    statusPrimaryText: string;
    statusSecondaryText: string;
    sitePages: HtmlManagedSitePage[];
    updatedAt: string;
    updatedBy?: string;
}

export interface HtmlPagesAdminOverview {
    pluginId: string;
    available: boolean;
    pages: ManagedHtmlPage[];
    siteFooter: HtmlSiteFooterConfig;
    updatedAt: string;
}
