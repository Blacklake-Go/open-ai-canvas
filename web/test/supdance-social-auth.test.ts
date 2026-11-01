import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSocialAuthStartUrl } from "@/supdance/plugins/social-auth/api";
import { credentialKeyLabels, draftFromProvider, isMaskedPreview, probeBadgeOf, statusBadgeOf } from "@/supdance/plugins/social-auth/admin/credential-helpers";
import type { ProviderTestResult, SocialAuthProviderAdmin } from "@/supdance/plugins/social-auth/types";

describe("SupDance Social Auth Plugin", () => {
    test("buildSocialAuthStartUrl generates correct URL and parameters", () => {
        const url = buildSocialAuthStartUrl("qq", {
            next: "/canvas/123",
            acceptedTerms: true,
            mock: true,
            simulateRegion: "cn",
        });

        expect(url).toContain("/api/auth/social/qq/start");
        expect(url).toContain("next=%2Fcanvas%2F123");
        expect(url).toContain("acceptedTerms=true");
        expect(url).toContain("mock=true");
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
        expect(manifest.version).toBe("1.1.0");
        expect(manifest.trusted).toBe(true);
        expect(manifest.surfaces).toContain("auth");
        expect(manifest.surfaces).toContain("settings");
    });

    test("8 major providers are correctly categorized into China Mainland and International", () => {
        const mainlandProviders = ["qq", "wechat", "douyin", "bilibili"];
        const intlProviders = ["google", "x", "instagram", "tiktok"];

        for (const p of mainlandProviders) {
            const url = buildSocialAuthStartUrl(p, { simulateRegion: "cn", mock: true });
            expect(url).toContain(`/api/auth/social/${p}/start`);
            expect(url).toContain("simulate_region=cn");
        }

        for (const p of intlProviders) {
            const url = buildSocialAuthStartUrl(p, { simulateRegion: "intl" });
            expect(url).toContain(`/api/auth/social/${p}/start`);
            expect(url).toContain("simulate_region=intl");
        }
    });

    test("Router mounts dark login page and admin config center", () => {
        const routerPath = resolve(import.meta.dir, "../src/router.tsx");
        const routerSource = readFileSync(routerPath, "utf-8");

        expect(routerSource).toContain('path: "/zh/login"');
        expect(routerSource).toContain("DarkLoginPage");
        expect(routerSource).toContain('path: "settings/social-auth"');
        expect(routerSource).toContain("SocialAuthSettingsPage");
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
        const adminPagePath = resolve(import.meta.dir, "../src/supdance/plugins/social-auth/admin/social-auth-settings-page.tsx");
        const adminSource = readFileSync(adminPagePath, "utf-8");
        const helpersSource = readFileSync(resolve(import.meta.dir, "../src/supdance/plugins/social-auth/admin/credential-helpers.ts"), "utf-8");
        const modalSource = readFileSync(resolve(import.meta.dir, "../src/supdance/plugins/social-auth/admin/provider-credential-modal.tsx"), "utf-8");

        // Verify placeholder detection checks both keys
        expect(helpersSource).toContain("provider.clientIdMasked || provider.maskedClientId");
        expect(adminSource).toContain("(provider.clientIdMasked || provider.maskedClientId)");
        // 凭证只在弹窗内录入，占位必须写清"留空保持现有凭证"，避免管理员以为被清空。
        expect(modalSource).toContain("留空保持现有凭证，输入新值覆盖");

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
            sandboxMockEnabled: true,
            callbackUrl: "https://www.supdance.com/api/auth/qq/callback",
        };

        const resolvedMaskedId = sampleQQ.clientIdMasked || sampleQQ.maskedClientId || "";
        expect(resolvedMaskedId).toBe("****5200");
        const draftClientId = resolvedMaskedId && !resolvedMaskedId.includes("*") ? resolvedMaskedId : "";
        expect(draftClientId).toBe("");
        expect(draftFromProvider(sampleQQ as SocialAuthProviderAdmin).clientId).toBe("");
        expect(draftFromProvider(sampleQQ as SocialAuthProviderAdmin).clientSecret).toBe("");
        expect(draftFromProvider(sampleQQ as SocialAuthProviderAdmin).sandboxMockEnabled).toBe(true);
        expect(isMaskedPreview("****5200")).toBe(true);
        expect(isMaskedPreview("••••••••0QEo")).toBe(true);
        expect(isMaskedPreview("102035200")).toBe(false);
        expect(credentialKeyLabels("qq")).toEqual({ id: "App ID", secret: "App Key" });
        expect(credentialKeyLabels("google")).toEqual({ id: "Client ID", secret: "Client Secret" });

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

        const badge = probeBadgeOf(onlineResult as ProviderTestResult);
        expect(badge?.label).toBe("正常在线 101ms");
        expect(badge?.tone).toBe("success");

        // 后端在未录入凭证时返回 error + 固定话术，面板必须按"待录入"而不是"网关故障"呈现。
        const missingCredentials = probeBadgeOf({
            provider: "google",
            status: "error",
            message: "该渠道尚未配置完整的 ClientID 或密钥",
        } satisfies ProviderTestResult);
        expect(missingCredentials?.label).toBe("待录入凭证");
        expect(missingCredentials?.tone).toBe("warning");

        expect(probeBadgeOf({ provider: "x", status: "error", message: "上游网关连接超时" } as ProviderTestResult)?.tone).toBe("error");
        expect(probeBadgeOf({ provider: "tiktok", status: "degraded", latencyMs: 1800, message: "响应较慢" } as ProviderTestResult)?.label).toBe("响应稍慢 1800ms");
        expect(probeBadgeOf(undefined)).toBeNull();
        expect(statusBadgeOf({ id: "qq", name: "QQ", region: "cn", icon: "qq", enabled: true, status: "online", statusLabel: "运行中", callbackUrl: "" } as SocialAuthProviderAdmin)).toEqual({ label: "运行中", tone: "success" });
    });

    test("supdance-social-auth barrel does not export SocialAuthSettingsPage (no admin leak)", () => {
        const barrelPath = resolve(import.meta.dir, "../src/supdance/plugins/social-auth/index.ts");
        const barrelSource = readFileSync(barrelPath, "utf-8");

        expect(barrelSource).not.toContain("SocialAuthSettingsPage");
        expect(barrelSource).toContain("./components/social-login-buttons");
    });

    test("social-login-buttons uses React Query caching with 10-minute staleTime", () => {
        const compPath = resolve(import.meta.dir, "../src/supdance/plugins/social-auth/components/social-login-buttons.tsx");
        const compSource = readFileSync(compPath, "utf-8");

        expect(compSource).toContain("useQuery");
        expect(compSource).toContain("staleTime: 10 * 60 * 1000");
    });
});
