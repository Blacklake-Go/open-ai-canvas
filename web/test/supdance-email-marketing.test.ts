import { describe, expect, it } from "bun:test";
import { isOfficialApplicationPluginId, SUPDANCE_APPLICATION_PLUGIN_IDS } from "@/lib/plugins/official-applications";
import {
    SUPDANCE_EMAIL_MARKETING_PLUGIN_ID,
    supdanceEmailMarketingManifest,
} from "@/supdance/plugins/email-marketing";
import { renderClientTemplate } from "@/supdance/plugins/email-marketing/admin/render";

describe("Email Marketing Plugin Tests", () => {
    it("exports valid official application manifest", () => {
        expect(SUPDANCE_EMAIL_MARKETING_PLUGIN_ID).toBe("supdance-email-marketing");
        expect(supdanceEmailMarketingManifest.id).toBe("supdance-email-marketing");
        expect(supdanceEmailMarketingManifest.name).toBe("supdance 邮件营销与模板管理");
        expect(supdanceEmailMarketingManifest.trusted).toBe(true);
        expect(supdanceEmailMarketingManifest.surfaces).toContain("fullscreen");
        expect(supdanceEmailMarketingManifest.surfaces).toContain("settings");
    });

    it("is registered as an official application plugin", () => {
        expect(SUPDANCE_APPLICATION_PLUGIN_IDS).toContain(SUPDANCE_EMAIL_MARKETING_PLUGIN_ID);
        expect(isOfficialApplicationPluginId(SUPDANCE_EMAIL_MARKETING_PLUGIN_ID)).toBe(true);
    });

    it("renderClientTemplate interpolates custom variables, sample variables, and system defaults", () => {
        const rawTemplate = "<h1>{{greeting}}, {{name}}!</h1><p>欢迎来到 {{brand_name}}。退订链接: {{unsubscribe_url}}</p>";

        const rendered = renderClientTemplate(
            rawTemplate,
            { name: "测试用户", greeting: "你好" },
            { name: "默认创作者" },
        );

        expect(rendered).toContain("<h1>你好, 测试用户!</h1>");
        expect(rendered).toContain("欢迎来到 SupDance。");
        expect(rendered).toContain("退订链接: https://www.supdance.com/account/notifications");
        expect(rendered).not.toContain("{{");
        expect(rendered).not.toContain("}}");
    });

    it("renderClientTemplate falls back to sampleVariables when custom variable is empty", () => {
        const rawTemplate = "<p>算力额度：{{current_credits}} 点</p>";
        const rendered = renderClientTemplate(rawTemplate, {}, { current_credits: "50" });
        expect(rendered).toBe("<p>算力额度：50 点</p>");
    });
});
