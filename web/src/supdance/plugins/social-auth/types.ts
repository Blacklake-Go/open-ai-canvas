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
 * 后端对 enabled / customRedirectUrl 是无条件覆盖写入，
 * 因此任何一次保存都必须带上两项的当前值，否则会被静默清空。
 */
export interface ProviderUpdateInput {
    enabled?: boolean;
    clientId?: string;
    clientSecret?: string;
    customRedirectUrl?: string;
    scopes?: string[];
}

export interface OperationalPolicies {
    autoDirectRegistration: boolean;
    mandatoryEmailOnboarding: boolean;
    signupBonusCredits: number;
    orphanAccountSafety: boolean;
}

export interface DailyLoginCount {
    date: string;
    count: number;
}

export interface OperationsOverview {
    policies: OperationalPolicies;
    providerDistribution: Record<string, number>;
    totalBindings: number;
    dailyActiveTrend: DailyLoginCount[];
    totalLogins30d: number;
}

export interface UserSocialBindingAdminItem {
    userId: string;
    username: string;
    email: string;
    displayName: string;
    createdAt: string;
    identities: UserIdentityItem[];
}

export interface SocialLoginLogItem {
    id: string;
    userId: string;
    username: string;
    account: string;
    method: string;
    source: string;
    result: string;
    reason: string;
    message: string;
    ip: string;
    createdAt: string;
}

export interface UpdateSettingsRequest {
    defaultFallbackRegion?: SocialAuthRegion;
    providers?: Record<string, ProviderUpdateInput>;
}

export interface ProviderTestResult {
    provider: string;
    status: "reachable" | "ok" | "online" | "degraded" | "error";
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
    acceptedTerms: boolean;
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
