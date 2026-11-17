/**
 * 客户端实时模板插值渲染函数（用于双栏沙箱实时预览）
 */
export function renderClientTemplate(
    templateStr: string,
    variables: Record<string, string> = {},
    sampleVariables: Record<string, string> = {},
): string {
    if (!templateStr) return "";

    const systemDefaults: Record<string, string> = {
        brand_name: "SupDance",
        support_email: "support@supdance.com",
        action_url: "https://www.supdance.com/studio",
        unsubscribe_url: "https://www.supdance.com/account/notifications",
    };

    return templateStr.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, key: string) => {
        if (variables[key] !== undefined && variables[key] !== "") {
            return variables[key];
        }
        if (sampleVariables[key] !== undefined && sampleVariables[key] !== "") {
            return sampleVariables[key];
        }
        if (systemDefaults[key] !== undefined) {
            return systemDefaults[key];
        }
        return "";
    });
}
