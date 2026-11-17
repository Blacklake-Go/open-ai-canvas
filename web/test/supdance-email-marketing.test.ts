import { describe, expect, it } from "bun:test";
import { isOfficialApplicationPluginId, SUPDANCE_APPLICATION_PLUGIN_IDS } from "@/lib/plugins/official-applications";
import {
    SUPDANCE_EMAIL_MARKETING_PLUGIN_ID,
    supdanceEmailMarketingManifest,
} from "@/supdance/plugins/email-marketing";

describe("Email Marketing Plugin Tests", () => {
    it("exports valid official application manifest", () => {
        expect(SUPDANCE_EMAIL_MARKETING_PLUGIN_ID).toBe("supdance-email-marketing");
        expect(supdanceEmailMarketingManifest.id).toBe("supdance-email-marketing");
        expect(supdanceEmailMarketingManifest.name).toBe("邮件中心");
        expect(supdanceEmailMarketingManifest.version).toBe("1.2.0");
        expect(supdanceEmailMarketingManifest.trusted).toBe(true);
        expect(supdanceEmailMarketingManifest.surfaces).toContain("fullscreen");
        expect(supdanceEmailMarketingManifest.surfaces).toContain("settings");
    });

    it("is registered as an official application plugin", () => {
        expect(SUPDANCE_APPLICATION_PLUGIN_IDS).toContain(SUPDANCE_EMAIL_MARKETING_PLUGIN_ID);
        expect(isOfficialApplicationPluginId(SUPDANCE_EMAIL_MARKETING_PLUGIN_ID)).toBe(true);
    });

});
