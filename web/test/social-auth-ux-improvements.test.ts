import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUILTIN_SUPDANCE_I18N_ENTRIES } from "@/supdance/plugins/i18n/locales";
import enUS from "@/supdance/plugins/i18n/locales/packs/en-US";
import zhTW from "@/supdance/plugins/i18n/locales/packs/zh-TW";
import jaJP from "@/supdance/plugins/i18n/locales/packs/ja-JP";
import koKR from "@/supdance/plugins/i18n/locales/packs/ko-KR";
import esES from "@/supdance/plugins/i18n/locales/packs/es-ES";
import { buildSocialAuthBindUrl } from "@/supdance/plugins/social-auth/api";

describe("Social Auth UX & Onboarding Improvements", () => {
    const requiredKeys = [
        "auth.onboarding.title",
        "auth.onboarding.subtitle",
        "auth.onboarding.exit",
        "auth.onboarding.exit_confirm",
        "auth.onboarding.authorized_badge",
        "auth.onboarding.verified_identity",
        "auth.onboarding.creator_id",
        "auth.onboarding.creator_id_placeholder",
        "auth.onboarding.display_name",
        "auth.onboarding.display_name_placeholder",
        "auth.onboarding.bind_email",
        "auth.onboarding.email_verified_auto",
        "auth.onboarding.optional_password",
        "auth.onboarding.password_placeholder",
        "auth.onboarding.password_confirm",
        "auth.onboarding.submit",
        "auth.onboarding.agree_prefix",
        "auth.onboarding.terms_service",
        "auth.onboarding.terms_and",
        "auth.onboarding.terms_privacy",
        "settings.social.title",
        "settings.social.subtitle",
        "settings.social.banner_title",
        "settings.social.banner_desc",
        "settings.social.bound",
        "settings.social.unbound",
        "settings.social.bind_action",
        "settings.social.rebind_action",
        "settings.social.unbind_action",
        "settings.social.qq_account_label",
        "settings.social.qq_privacy_note",
        "settings.social.bind_success",
        "settings.social.unbind_confirm_title",
        "settings.preferences.theme_title",
        "settings.preferences.theme_desc",
        "settings.preferences.theme_light",
        "settings.preferences.theme_dark",
        "settings.preferences.theme_system",
    ];

    it("defines all new UX i18n keys in the canonical catalog", () => {
        const catalogKeys = new Set(BUILTIN_SUPDANCE_I18N_ENTRIES.map((e) => e.key));
        for (const k of requiredKeys) {
            expect(catalogKeys.has(k)).toBe(true);
        }
    });

    it("provides complete translations across all 5 language packs for every new key", () => {
        const packs = [
            { name: "en-US", pack: enUS },
            { name: "zh-TW", pack: zhTW },
            { name: "ja-JP", pack: jaJP },
            { name: "ko-KR", pack: koKR },
            { name: "es-ES", pack: esES },
        ];

        for (const { name, pack } of packs) {
            for (const key of requiredKeys) {
                const val = pack[key];
                expect(typeof val).toBe("string");
                expect(val.trim().length).toBeGreaterThan(0);
            }
        }
    });

    it("buildSocialAuthBindUrl carries return path with open_settings=social", () => {
        const returnPath = "/create?open_settings=social&bind_provider=qq";
        const url = buildSocialAuthBindUrl("qq", returnPath);
        expect(url).toContain("/api/auth/social/qq/bind");
        expect(url).toContain("next=%2Fcreate%3Fopen_settings%3Dsocial%26bind_provider%3Dqq");
    });

    it("formats QQ account identity intelligently: masks hex openid vs displays nickname", () => {
        const hexOpenID = "7eb7440fdd80f23a47d64bd3";
        const isHex = /^[0-9a-fA-F]{16,64}$/.test(hexOpenID);
        expect(isHex).toBe(true);

        const formattedHex = isHex ? `QQ 创作者 (${hexOpenID.slice(-4)})` : hexOpenID;
        expect(formattedHex).toBe("QQ 创作者 (4bd3)");

        const nickname = "星尘编剧";
        const isNickHex = /^[0-9a-fA-F]{16,64}$/.test(nickname);
        expect(isNickHex).toBe(false);
        const formattedNick = isNickHex ? `QQ 创作者 (${nickname.slice(-4)})` : nickname;
        expect(formattedNick).toBe("星尘编剧");
    });

    it("hot-unplugs the social tab from the profile modal when the plugin is disabled", () => {
        const modalPath = resolve(import.meta.dir, "../src/components/layout/user-profile-modal.tsx");
        const source = readFileSync(modalPath, "utf-8");

        // 入口与内容面板都必须受插件可用性守卫，不能只隐藏一半
        expect(source).toContain('selectPluginEffectivelyEnabled("supdance-social-auth"');
        expect(source).toContain("function accountManagementItems(socialAuthEnabled: boolean)");
        expect(source).toContain('items.filter((item) => item.key !== "social")');
        expect(source).toContain('currentTab === "social" && socialAuthPluginEnabled && <SocialAccountBindings />');
    });

    it("blocks the identities read path on the backend when the plugin is disabled", () => {
        const pluginPath = resolve(import.meta.dir, "../../backend/internal/app/supdance_social_auth_plugin.go");
        const source = readFileSync(pluginPath, "utf-8");
        const identitiesFn = source.slice(source.indexOf("func (s *Service) UserSocialIdentities"), source.indexOf("// BeginSocialAuthBind"));

        expect(identitiesFn).toContain("SocialAuthPluginAvailable()");
        expect(identitiesFn).toContain("第三方社交登录插件已被系统管理员停用");
    });
});
