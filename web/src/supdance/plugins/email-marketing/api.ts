import { http } from "@/services/api/request";
import type {
    EmailMarketingOverview,
    EmailMarketingTestRequest,
    EmailMarketingTestResult,
    MarketingTemplate,
} from "./types";

const BASE_ADMIN = "/admin/plugins/supdance-email-marketing";

/**
 * 获取营销邮件插件总览与模板列表
 */
export async function fetchEmailMarketingOverview(): Promise<EmailMarketingOverview> {
    return http.get<EmailMarketingOverview>(`${BASE_ADMIN}/overview`);
}

/**
 * 保存自定义营销邮件模板配置
 */
export async function saveEmailMarketingTemplates(
    templates: Record<string, MarketingTemplate>,
): Promise<EmailMarketingOverview> {
    return http.put<EmailMarketingOverview>(`${BASE_ADMIN}/templates`, { templates });
}

/**
 * 重置指定模板或全部模板为系统默认
 */
export async function resetEmailMarketingTemplate(key: string): Promise<EmailMarketingOverview> {
    return http.post<EmailMarketingOverview>(
        `${BASE_ADMIN}/templates/${encodeURIComponent(key)}/reset`,
    );
}

/**
 * 发送真实营销测试邮件（含管理员权限、格式校验与频次保护）
 */
export async function sendMarketingTestEmail(
    payload: EmailMarketingTestRequest,
): Promise<EmailMarketingTestResult> {
    return http.post<EmailMarketingTestResult>(`${BASE_ADMIN}/test`, payload);
}
