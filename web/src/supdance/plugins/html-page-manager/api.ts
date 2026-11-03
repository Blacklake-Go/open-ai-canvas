import { http } from "@/services/api/request";
import type { HtmlPagesAdminOverview, ManagedHtmlPage } from "./types";

const BASE_PUBLIC = "/plugins/supdance-html-page-manager";
const BASE_ADMIN = "/admin/plugins/supdance-html-page-manager";

/** 获取公开已发布的 HTML 页面列表 */
export async function fetchPublicHtmlPages(signal?: AbortSignal): Promise<ManagedHtmlPage[]> {
    const res = await http.get<{ pages: ManagedHtmlPage[] }>(`${BASE_PUBLIC}/pages`, { signal });
    return res.pages;
}

/** 按 slug 获取单个公开页面 */
export async function fetchPublicHtmlPageBySlug(slug: string, signal?: AbortSignal): Promise<ManagedHtmlPage> {
    return http.get<ManagedHtmlPage>(`${BASE_PUBLIC}/pages/${encodeURIComponent(slug)}`, { signal });
}

/** 管理员获取所有 HTML 页面概览 */
export async function fetchAdminHtmlPagesOverview(signal?: AbortSignal): Promise<HtmlPagesAdminOverview> {
    return http.get<HtmlPagesAdminOverview>(`${BASE_ADMIN}/overview`, { signal });
}

/** 管理员保存或更新页面列表 */
export async function saveAdminHtmlPages(pages: ManagedHtmlPage[]): Promise<HtmlPagesAdminOverview> {
    return http.put<HtmlPagesAdminOverview>(`${BASE_ADMIN}/pages`, { pages });
}

/** 管理员重置所有页面为默认高质感模板 */
export async function resetAdminHtmlPages(): Promise<HtmlPagesAdminOverview> {
    return http.post<HtmlPagesAdminOverview>(`${BASE_ADMIN}/reset`, {});
}
