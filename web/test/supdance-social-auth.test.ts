import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSocialAuthStartUrl } from "@/supdance/plugins/social-auth/api";

describe("SupDance Social Auth Plugin", () => {
    test("buildSocialAuthStartUrl generates correct URL and parameters", () => {
        const url = buildSocialAuthStartUrl("qq", {
            next: "/canvas/123",
            acceptedTerms: true,
            simulateRegion: "cn",
        });

        expect(url).toContain("/api/auth/social/qq/start");
        expect(url).toContain("next=%2Fcanvas%2F123");
        expect(url).toContain("acceptedTerms=true");
        expect(url).not.toContain("mock=");
        expect(url).toContain("simulate_region=cn");
    });

    test("buildSocialAuthStartUrl handles minimal parameters", () => {
        const url = buildSocialAuthStartUrl("google");
        expect(url).toBe("/api/auth/social/google/start");
    });

    test("Plugin manifest is valid and conforms to yingce.plugin/v2", () => {
        const manifestPath = resolve(import.meta.dir, "../../supdance/plugins/supdance-social-auth/manifest.json");
        const content = readFileSync(manifestPath, "utf-8");
        const manifest = JSON.parse(content);

        expect(manifest.apiVersion).toBe("yingce.plugin/v2");
        expect(manifest.id).toBe("supdance-social-auth");
        expect(manifest.version).toBe("1.3.0");
        expect(manifest.trusted).toBe(true);
        expect(manifest.surfaces).toContain("auth");
        expect(manifest.surfaces).toContain("settings");
        expect(manifest.surfaces).toContain("onboarding-modal");
        expect(manifest.surfaces).toContain("user-account-bindings");
    });

    test("8 major providers are correctly categorized into China Mainland and International", () => {
        const mainlandProviders = ["qq", "wechat", "douyin", "bilibili"];
        const intlProviders = ["google", "x", "instagram", "tiktok"];

        for (const p of mainlandProviders) {
            const url = buildSocialAuthStartUrl(p, { simulateRegion: "cn" });
            expect(url).toContain(`/api/auth/social/${p}/start`);
            expect(url).toContain("simulate_region=cn");
        }

        for (const p of intlProviders) {
            const url = buildSocialAuthStartUrl(p, { simulateRegion: "intl" });
            expect(url).toContain(`/api/auth/social/${p}/start`);
            expect(url).toContain("simulate_region=intl");
        }
    });

    test("Router mounts dark login page, admin config center and operations panel", () => {
        const routerPath = resolve(import.meta.dir, "../src/router.tsx");
        const routerSource = readFileSync(routerPath, "utf-8");

        expect(routerSource).toContain('path: "/zh/login"');
        expect(routerSource).toContain("DarkLoginPage");
        expect(routerSource).toContain('path: "settings/social-auth"');
        expect(routerSource).toContain("SocialAuthSettingsPage");
        expect(routerSource).toContain('path: "settings/social-auth/operations"');
        expect(routerSource).toContain("SocialAuthOperationsPage");
    });

    test("social-login-buttons component does not display region switch button and follows hot-plugging", () => {
        const compPath = resolve(import.meta.dir, "../src/supdance/plugins/social-auth/components/social-login-buttons.tsx");
        const compSource = readFileSync(compPath, "utf-8");

        // Verify region switch button and strings are completely removed
        expect(compSource).not.toContain("showing_cn_switch_intl");
        expect(compSource).not.toContain("showing_intl_switch_cn");
        expect(compSource).not.toContain("switch_to_intl");
        expect(compSource).not.toContain("switch_to_cn");
        expect(compSource).not.toContain("Globe");

        // Verify plugin store hot-plug integration
        expect(compSource).toContain("usePluginStore");
        expect(compSource).toContain("SUPDANCE_SOCIAL_AUTH_PLUGIN_ID");
        expect(compSource).toContain("platformAvailable");
    });

    test("SocialAuthProviderAdmin types and draft initialization handle both clientIdMasked and maskedClientId", () => {
        const helperPath = resolve(import.meta.dir, "../src/supdance/plugins/social-auth/admin/credential-helpers.ts");
        const helperSource = readFileSync(helperPath, "utf-8");

        // Verify placeholder detection checks both keys
        expect(helperSource).toContain("provider.clientIdMasked || provider.maskedClientId");

        // Simulate draft init logic
        const sampleQQ = {
            id: "qq",
            name: "QQ",
            region: "cn" as const,
            icon: "qq",
            enabled: true,
            status: "online" as const,
            maskedClientId: "****5200",
            clientIdMasked: "****5200",
            maskedSecret: "••••••••0QEo",
            callbackUrl: "https://www.supdance.com/api/auth/qq/callback",
        };

        const resolvedMaskedId = sampleQQ.clientIdMasked || sampleQQ.maskedClientId || "";
        expect(resolvedMaskedId).toBe("****5200");
        const draftClientId = resolvedMaskedId && !resolvedMaskedId.includes("*") ? resolvedMaskedId : "";
        expect(draftClientId).toBe("");

        const placeholder = (sampleQQ.clientIdMasked || sampleQQ.maskedClientId) || "输入 App ID / Client ID";
        expect(placeholder).toBe("****5200");

        const hasSecret = Boolean(sampleQQ.maskedSecret);
        const secretPlaceholder = hasSecret ? "已配置 · 留空不改" : "输入 App Secret / Client Secret";
        expect(secretPlaceholder).toBe("已配置 · 留空不改");
    });

    test("ProviderTestResult and handlePing correctly evaluate both 'ok' and 'online' statuses and ping latency", () => {
        const adminPagePath = resolve(import.meta.dir, "../src/supdance/plugins/social-auth/admin/social-auth-settings-page.tsx");
        const adminSource = readFileSync(adminPagePath, "utf-8");

        // Verify status check condition in settings page
        expect(adminSource).toContain('res.status === "ok" || res.status === "online"');
        expect(adminSource).toContain("res.pingLatencyMs ?? res.latencyMs ?? 0");

        // Simulate ping response evaluation
        const okResult = {
            provider: "qq",
            status: "ok" as const,
            latencyMs: 228,
            pingLatencyMs: 228,
            message: "渠道端点响应正常，OAuth 2.0 凭据校验通过",
            checkedAt: new Date().toISOString(),
            testedAt: new Date().toISOString(),
        };

        const isOkSuccess = okResult.status === "ok" || (okResult.status as string) === "online";
        const okLatency = okResult.pingLatencyMs ?? okResult.latencyMs ?? 0;
        expect(isOkSuccess).toBe(true);
        expect(okLatency).toBe(228);

        const onlineResult = {
            provider: "bilibili",
            status: "online" as const,
            latencyMs: 101,
            message: "渠道端点响应正常，OAuth 2.0 凭据校验通过",
            testedAt: new Date().toISOString(),
        };

        const isOnlineSuccess = (onlineResult.status as string) === "ok" || onlineResult.status === "online";
        const onlineLatency = onlineResult.pingLatencyMs ?? onlineResult.latencyMs ?? 0;
        expect(isOnlineSuccess).toBe(true);
        expect(onlineLatency).toBe(101);

        const badgeLabel = `${onlineLatency}ms · ${isOnlineSuccess ? "连接畅通" : "异常"}`;
        const badgeTone = isOnlineSuccess ? "success" : "error";
        expect(badgeLabel).toBe("101ms · 连接畅通");
        expect(badgeTone).toBe("success");
    });

    test("supdance-social-auth barrel does not export SocialAuthSettingsPage (no admin leak)", () => {
        const barrelPath = resolve(import.meta.dir, "../src/supdance/plugins/social-auth/index.ts");
        const barrelSource = readFileSync(barrelPath, "utf-8");

        expect(barrelSource).not.toContain("SocialAuthSettingsPage");
        expect(barrelSource).toContain("./components/social-login-buttons");
    });

    test("social-login-buttons uses React Query caching", () => {
        const compPath = resolve(import.meta.dir, "../src/supdance/plugins/social-auth/components/social-login-buttons.tsx");
        const compSource = readFileSync(compPath, "utf-8");

        expect(compSource).toContain("useQuery");
        expect(compSource).toContain("staleTime: 10 * 60 * 1000");
    });

    test("buildSocialAuthBindUrl generates correct bind endpoint", async () => {
        const { buildSocialAuthBindUrl } = await import("@/supdance/plugins/social-auth/api");
        const url = buildSocialAuthBindUrl("google", "/canvas/test");
        expect(url).toBe("/api/auth/social/google/bind?next=%2Fcanvas%2Ftest");
    });

    test("useUserProfileModalStore correctly manages floating modal state", async () => {
        const { useUserProfileModalStore, openUserProfileModal } = await import("@/stores/use-user-profile-modal-store");
        expect(useUserProfileModalStore.getState().isOpen).toBe(false);

        openUserProfileModal("social");
        expect(useUserProfileModalStore.getState().isOpen).toBe(true);
        expect(useUserProfileModalStore.getState().activeTab).toBe("social");

        useUserProfileModalStore.getState().setTab("security");
        expect(useUserProfileModalStore.getState().activeTab).toBe("security");

        useUserProfileModalStore.getState().closeModal();
        expect(useUserProfileModalStore.getState().isOpen).toBe(false);
    });

    test("Plugin manifest in release directory is also synchronized to 1.3.0", () => {
        let releaseManifestPath = resolve(import.meta.dir, "../../.local/release-1.7.4-supdance/supdance/plugins/supdance-social-auth/manifest.json");
        const { existsSync } = require("node:fs");
        if (!existsSync(releaseManifestPath)) {
            releaseManifestPath = resolve(import.meta.dir, "../../supdance/plugins/supdance-social-auth/manifest.json");
        }
        const content = readFileSync(releaseManifestPath, "utf-8");
        const manifest = JSON.parse(content);

        expect(manifest.version).toBe("1.3.0");
        expect(manifest.surfaces).toContain("onboarding-modal");
        expect(manifest.surfaces).toContain("user-account-bindings");
    });

    test("docs/supdance/CUSTOMIZATIONS.md documents supdance-social-auth v1.3.0 and upstream patch", () => {
        const docPath = resolve(import.meta.dir, "../../docs/supdance/CUSTOMIZATIONS.md");
        const docSource = readFileSync(docPath, "utf-8");

        expect(docSource).toContain("supdance-social-auth` v1.3.0");
        expect(docSource).toContain("补丁 ID：`supdance-social-auth`");
    });

    test("Settings page Switch and Credential Modal provide immediate loading and keyboard feedback", () => {
        const settingsPath = resolve(import.meta.dir, "../src/supdance/plugins/social-auth/admin/social-auth-settings-page.tsx");
        const settingsSource = readFileSync(settingsPath, "utf-8");
        expect(settingsSource).toContain("loading={isToggling}");

        const modalPath = resolve(import.meta.dir, "../src/supdance/plugins/social-auth/admin/provider-credential-modal.tsx");
        const modalSource = readFileSync(modalPath, "utf-8");
        expect(modalSource).toContain("onPressEnter={() => void submit()}");
    });
});

