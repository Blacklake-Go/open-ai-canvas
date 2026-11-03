import type { AdminStatusTone } from "@/pages/admin/components/admin-ui";

import type { ProviderTestResult, SocialAuthProviderAdmin, SocialAuthStatus } from "../types";

/**
 * social-auth 后台面板与密钥弹窗共用的凭证展示规则。
 * 两边都要按渠道显示不同的密钥名（QQ 用 AppID/AppKey，抖音用 Client Key），
 * 也必须共用同一套"掩码回显不能被当成新凭证提交"的判断，避免两处实现漂移。
 */

export interface CredentialKeyLabels {
    id: string;
    secret: string;
}

/** 单个渠道的可编辑草稿；页面负责展示开关，密钥弹窗负责凭证与回调地址。 */
export interface ProviderDraftState {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    customRedirectUrl: string;
}

const CREDENTIAL_KEY_LABELS: Record<string, CredentialKeyLabels> = {
    qq: { id: "App ID", secret: "App Key" },
    wechat: { id: "AppID", secret: "AppSecret" },
    douyin: { id: "Client Key", secret: "Client Secret" },
    bilibili: { id: "App ID", secret: "App Secret" },
};

const DEFAULT_KEY_LABELS: CredentialKeyLabels = { id: "Client ID", secret: "Client Secret" };

export function credentialKeyLabels(providerId: string): CredentialKeyLabels {
    return CREDENTIAL_KEY_LABELS[providerId.toLowerCase()] ?? DEFAULT_KEY_LABELS;
}

/** 后台永远只回显掩码；含 * 或 • 的值是展示串，绝不能写回配置。 */
export function isMaskedPreview(value: string): boolean {
    return value.includes("*") || value.includes("•");
}

export function maskedClientIdOf(provider: SocialAuthProviderAdmin): string {
    return provider.clientIdMasked || provider.maskedClientId || "";
}

export function maskedSecretOf(provider: SocialAuthProviderAdmin): string {
    return provider.clientSecretMasked || provider.maskedSecret || "";
}

/**
 * 服务端只回显掩码，草稿必须留空，否则一次保存就会把 "****5200" 当成新的 ClientID 写回。
 * 少数渠道的公开 ID 不带掩码字符，这种情况下允许带出原值供管理员核对。
 */
export function draftFromProvider(provider: SocialAuthProviderAdmin): ProviderDraftState {
    const maskedId = maskedClientIdOf(provider);
    return {
        enabled: provider.enabled,
        clientId: maskedId && !maskedId.includes("*") ? maskedId : "",
        clientSecret: "",
        customRedirectUrl: provider.customRedirectUrl || "",
    };
}

const STATUS_TONE: Record<SocialAuthStatus, AdminStatusTone> = {
    online: "success",
    ready: "info",
    credentials_required: "warning",
    unconfigured: "neutral",
};

const FALLBACK_STATUS_LABEL: Record<SocialAuthStatus, string> = {
    online: "运行中",
    ready: "未启用",
    credentials_required: "待完善凭证",
    unconfigured: "未配置",
};

export function statusBadgeOf(provider: SocialAuthProviderAdmin): { label: string; tone: AdminStatusTone } {
    return {
        label: provider.statusLabel || FALLBACK_STATUS_LABEL[provider.status] || "未配置",
        tone: STATUS_TONE[provider.status] || "neutral",
    };
}

/** 只渲染真实探针结果；配置接口里的 latencyMs 是基线估算，不能伪装成测量值。 */
export function probeBadgeOf(result: ProviderTestResult | undefined): { label: string; tone: AdminStatusTone; detail: string } | null {
    if (!result) return null;
    const latency = result.pingLatencyMs ?? result.latencyMs ?? 0;
    if (result.status === "ok" || result.status === "online") {
        return { label: `正常在线 ${latency}ms`, tone: "success", detail: result.message };
    }
    if (result.status === "degraded") {
        return { label: `响应稍慢 ${latency}ms`, tone: "warning", detail: result.message };
    }
    if (result.message.includes("尚未配置") || result.message.includes("未配置")) {
        return { label: "待录入凭证", tone: "warning", detail: result.message };
    }
    return { label: "网关不可达", tone: "error", detail: result.message };
}
