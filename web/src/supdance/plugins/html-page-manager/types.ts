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

export interface HtmlPagesAdminOverview {
    pluginId: string;
    available: boolean;
    pages: ManagedHtmlPage[];
    updatedAt: string;
}
