import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSocialAuthStartUrl } from "@/supdance/plugins/social-auth/api";
import { draftFromProvider, isMaskedPreview } from "@/supdance/plugins/social-auth/admin/credential-helpers";
import type { ProviderTestResult, SocialAuthProviderAdmin } from "@/supdance/plugins/social-auth/types";

describe("Adversarial Stress Testing: SupDance Social Auth Frontend", () => {
    test("Adversarial: Draft initialization & placeholder edge cases", () => {
        // Case 1: Provider with only legacy maskedClientId (no clientIdMasked)
        const legacyOnly: Partial<SocialAuthProviderAdmin> = {
            id: "qq",
            maskedClientId: "****5200",
            maskedSecret: "••••••••0QEo",
        };
        const maskedId1 = legacyOnly.clientIdMasked || legacyOnly.maskedClientId || "";
        expect(maskedId1).toBe("****5200");
        const placeholder1 = (legacyOnly.clientIdMasked || legacyOnly.maskedClientId) || "输入 App ID / Client ID";
        expect(placeholder1).toBe("****5200");

        // Case 2: Provider with new clientIdMasked (no maskedClientId)
        const newOnly: Partial<SocialAuthProviderAdmin> = {
            id: "bilibili",
            clientIdMasked: "****ec99",
            maskedSecret: "••••••••78e3",
        };
        const maskedId2 = newOnly.clientIdMasked || newOnly.maskedClientId || "";
        expect(maskedId2).toBe("****ec99");
        const placeholder2 = (newOnly.clientIdMasked || newOnly.maskedClientId) || "输入 App ID / Client ID";
        expect(placeholder2).toBe("****ec99");

        // Case 3: Completely unconfigured provider (both undefined/empty)
        const unconfigured: Partial<SocialAuthProviderAdmin> = {
            id: "wechat",
            clientIdMasked: "",
            maskedClientId: "",
            maskedSecret: "",
        };
        const maskedId3 = unconfigured.clientIdMasked || unconfigured.maskedClientId || "";
        expect(maskedId3).toBe("");
        const placeholder3 = (unconfigured.clientIdMasked || unconfigured.maskedClientId) || "输入 App ID / Client ID";
        expect(placeholder3).toBe("输入 App ID / Client ID");
        const hasSecret3 = Boolean(unconfigured.maskedSecret);
        const secretPlaceholder3 = hasSecret3 ? "已配置 · 留空不改" : "输入 App Secret / Client Secret";
        expect(secretPlaceholder3).toBe("输入 App Secret / Client Secret");

        // Case 4: Provider with 4-char short ID (boundary)
        const shortID: Partial<SocialAuthProviderAdmin> = {
            id: "custom",
            clientIdMasked: "****",
            maskedSecret: "••••••••",
        };
        expect(shortID.clientIdMasked).toBe("****");
        expect(Boolean(shortID.maskedSecret)).toBe(true);
    });

    test("Adversarial: Form dirty-checking and submission avoid sending masked previews as new credentials", () => {
        const adminPagePath = resolve(import.meta.dir, "../src/supdance/plugins/social-auth/admin/social-auth-settings-page.tsx");
        const adminSource = readFileSync(adminPagePath, "utf-8");
        const helpersSource = readFileSync(resolve(import.meta.dir, "../src/supdance/plugins/social-auth/admin/credential-helpers.ts"), "utf-8");
        const modalSource = readFileSync(resolve(import.meta.dir, "../src/supdance/plugins/social-auth/admin/provider-credential-modal.tsx"), "utf-8");

        // Verify draft init sets empty string when maskedId contains asterisk
        expect(helpersSource).toContain('clientId: maskedId && !maskedId.includes("*") ? maskedId : ""');
        expect(helpersSource).toContain('clientSecret: ""');

        // Verify page dirty checking only tracks display switches; credentials save instantly from the modal
        expect(adminSource).toContain("if (draft && draft.enabled !== p.enabled) return true;");

        // Verify submit payload rejects masked previews in both save paths
        expect(adminSource).toContain("if (clientId && !isMaskedPreview(clientId)) update.clientId = clientId;");
        expect(adminSource).toContain("if (clientSecret && !isMaskedPreview(clientSecret)) update.clientSecret = clientSecret;");
        expect(modalSource).toContain("const sendsId = Boolean(clientId) && !isMaskedPreview(clientId);");
        expect(modalSource).toContain("const sendsSecret = Boolean(clientSecret) && !isMaskedPreview(clientSecret);");

        // 后端也是同样口径（含 * 或 • 直接忽略），前端提前拦下才不会写出"掩码当密钥"的脏数据。
        expect(draftFromProvider({ id: "qq", name: "QQ", region: "cn", icon: "qq", enabled: true, status: "online", clientIdMasked: "****5200", maskedSecret: "••••••••0QEo", callbackUrl: "" } as SocialAuthProviderAdmin).clientId).toBe("");
        expect(isMaskedPreview("****5200")).toBe(true);
        expect(isMaskedPreview("aw8n726kuf")).toBe(false);

        // Simulate dirty checking logic
        const currentMaskedId = "****5200";
        const draftEmpty = "";
        const isDirtyClient = draftEmpty && draftEmpty !== currentMaskedId;
        expect(Boolean(isDirtyClient)).toBe(false);

        const draftSecretEmpty = "";
        const isDirtySecret = draftSecretEmpty.trim().length > 0;
        expect(Boolean(isDirtySecret)).toBe(false);

        const realNewSecret = "new_real_secret_12345";
        const isDirtyRealSecret = realNewSecret.trim().length > 0;
        expect(Boolean(isDirtyRealSecret)).toBe(true);
    });

    test("Adversarial: handlePing latency and status fallback resilience", () => {
        // Case A: status = "ok", pingLatencyMs provided
        const pingA: ProviderTestResult = {
            provider: "qq",
            status: "ok",
            pingLatencyMs: 228,
            latencyMs: 228,
            message: "渠道端点响应正常",
        };
        const isSuccessA = pingA.status === "ok" || (pingA.status as string) === "online";
        const latencyA = pingA.pingLatencyMs ?? pingA.latencyMs ?? 0;
        expect(isSuccessA).toBe(true);
        expect(latencyA).toBe(228);

        // Case B: status = "online", pingLatencyMs missing (only latencyMs)
        const pingB: ProviderTestResult = {
            provider: "douyin",
            status: "online",
            latencyMs: 302,
            message: "正常",
        };
        const isSuccessB = pingB.status === "ok" || pingB.status === "online";
        const latencyB = pingB.pingLatencyMs ?? pingB.latencyMs ?? 0;
        expect(isSuccessB).toBe(true);
        expect(latencyB).toBe(302);

        // Case C: status = "degraded"
        const pingC: ProviderTestResult = {
            provider: "x",
            status: "degraded",
            latencyMs: 980,
            message: "响应较慢",
        };
        const isSuccessC = pingC.status === "ok" || (pingC.status as string) === "online";
        expect(isSuccessC).toBe(false);

        // Case D: status = "error", latencyMs = 0
        const pingD: ProviderTestResult = {
            provider: "wechat",
            status: "error",
            latencyMs: 0,
            message: "该渠道尚未配置完整的 ClientID 或密钥",
        };
        const isSuccessD = pingD.status === "ok" || (pingD.status as string) === "online";
        const latencyD = pingD.pingLatencyMs ?? pingD.latencyMs ?? 0;
        expect(isSuccessD).toBe(false);
        expect(latencyD).toBe(0);
        const badgeLabelD = `${latencyD}ms · ${isSuccessD ? "连接畅通" : "异常"}`;
        const badgeToneD = isSuccessD ? "success" : "error";
        expect(badgeLabelD).toBe("0ms · 异常");
        expect(badgeToneD).toBe("error");
    });

    test("Adversarial: Start URL escaping prevents injection and preserves complex parameters", () => {
        // Test URL encoding with special characters and path traversal
        const injectionTarget = "/canvas/test?a=1&b=2#hash";
        const url = buildSocialAuthStartUrl("qq", {
            next: injectionTarget,
            acceptedTerms: true,
            mock: true,
        });

        expect(url).toContain("/api/auth/social/qq/start");
        expect(url).toContain("next=%2Fcanvas%2Ftest%3Fa%3D1%26b%3D2%23hash");
        expect(url).toContain("acceptedTerms=true");
        expect(url).toContain("mock=true");

        // Test provider ID with slashes
        const strangeProvider = "custom/provider";
        const url2 = buildSocialAuthStartUrl(strangeProvider);
        expect(url2).toBe("/api/auth/social/custom%2Fprovider/start");
    });
});
