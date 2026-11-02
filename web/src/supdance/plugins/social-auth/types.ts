export const SUPDANCE_SOCIAL_AUTH_PLUGIN_ID = "supdance-social-auth" as const;

export type SocialAuthRegion = "cn" | "intl";

export type SocialAuthStatus = "unconfigured" | "credentials_required" | "ready" | "online";

export interface SocialAuthProviderPublic {
    id: string;
    name: string;
    platform?: string;
    region: SocialAuthRegion;
    icon: string;
    authorizeUrl?: string;
    sandboxEnabled?: boolean;
    status?: SocialAuthStatus;
}

export interface PublicProvidersResponse {
    region: SocialAuthRegion;
    detectedRegion?: SocialAuthRegion;
    regionLabel?: string;
    clientIp: string;
    fallbackRegion?: SocialAuthRegion;
    providers: SocialAuthProviderPublic[];
    cn?: SocialAuthProviderPublic[];
    intl?: SocialAuthProviderPublic[];
    allRegions?: {
        cn?: SocialAuthProviderPublic[];
        intl?: SocialAuthProviderPublic[];
    };
}

export interface SocialAuthProviderAdmin {
    id: string;
    name: string;
    platform?: string;
    region: SocialAuthRegion;
    icon: string;
    enabled: boolean;
    status: SocialAuthStatus;
    statusLabel?: string;
    hasCredentials?: boolean;
    statusMessage?: string;
    maskedClientId?: string;
    clientIdMasked?: string;
    clientSecretMasked?: string;
    maskedSecret?: string;
    callbackUrl: string;
    customRedirectUrl?: string;
    testPingUrl?: string;
    latencyMs?: number;
    scopes?: string[];
    docUrl?: string;
    sandboxMockSupported?: boolean;
    sandboxMockEnabled?: boolean;
    updatedAt?: string;
}

export interface AdminSettingsView {
    clientIp: string;
    detectedRegion: SocialAuthRegion;
    detectedRegionLabel?: string;
    ipSourceHeader?: string;
    defaultFallbackRegion: SocialAuthRegion;
    mainlandProviders?: SocialAuthProviderAdmin[];
    intlProviders?: SocialAuthProviderAdmin[];
    providers?: Record<string, SocialAuthProviderAdmin>;
    cnCount?: number;
    intlCount?: number;
    onlineCount?: number;
    updatedAt?: string;
}

/**
 * 与 backend/internal/supdance/socialauth.UpdateProviderInput 逐字段对齐。
 * 后端对 enabled / sandboxMockEnabled / customRedirectUrl 是无条件覆盖写入，
 * 因此任何一次保存都必须带上这三项的当前值，否则会被静默清空。
 */
export interface ProviderUpdateInput {
    enabled?: boolean;
    clientId?: string;
    clientSecret?: string;
    customRedirectUrl?: string;
    scopes?: string[];
    sandboxMockEnabled?: boolean;
}

export interface UpdateSettingsRequest {
    defaultFallbackRegion?: SocialAuthRegion;
    providers?: Record<string, ProviderUpdateInput>;
}

export interface ProviderTestResult {
    provider: string;
    status: "ok" | "online" | "degraded" | "error";
    message: string;
    latencyMs?: number;
    pingLatencyMs?: number;
    testedAt?: string;
    checkedAt?: string;
}

export interface OnboardingProfileView {
    ticketId: string;
    provider: string;
    providerName: string;
    providerUsername: string;
    displayName: string;
    email: string;
    avatarUrl: string;
    expiresAt: string;
}

export interface CompleteOnboardingRequest {
    ticket?: string;
    ticketId?: string;
    username: string;
    displayName?: string;
    nickname?: string;
    email?: string;
    password?: string;
}

export interface UserIdentityItem {
    id?: number | string;
    provider: string;
    providerName: string;
    subject?: string;
    providerUsername: string;
    avatarUrl?: string;
    boundAt?: string | null;
    bound?: boolean;
}

export interface UserIdentitiesView {
    hasPassword: boolean;
    identities: UserIdentityItem[];
    count: number;
}
