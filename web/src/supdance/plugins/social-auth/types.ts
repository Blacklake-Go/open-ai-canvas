export type SocialAuthRegion = "cn" | "intl";

export type SocialAuthStatus = "unconfigured" | "credentials_required" | "ready" | "online";

export interface SocialAuthProviderPublic {
    id: string;
    name: string;
    icon: string;
    region: SocialAuthRegion;
    status: SocialAuthStatus;
    sandboxEnabled: boolean;
}

export interface PublicProvidersResponse {
    detectedRegion: SocialAuthRegion;
    clientIp: string;
    fallbackRegion: SocialAuthRegion;
    cn: SocialAuthProviderPublic[];
    intl: SocialAuthProviderPublic[];
    activeProviders: SocialAuthProviderPublic[];
}

export interface SocialAuthProviderAdmin {
    id: string;
    name: string;
    icon: string;
    region: SocialAuthRegion;
    enabled: boolean;
    status: SocialAuthStatus;
    statusMessage: string;
    clientIdMasked: string;
    clientSecretMasked: string;
    callbackUrl: string;
    testPingUrl: string;
    sandboxMockSupported: boolean;
    sandboxMockEnabled: boolean;
    updatedAt: string;
}

export interface AdminSettingsView {
    clientIp: string;
    detectedRegion: SocialAuthRegion;
    defaultFallbackRegion: SocialAuthRegion;
    cnCount: number;
    intlCount: number;
    onlineCount: number;
    providers: Record<string, SocialAuthProviderAdmin>;
}

export interface ProviderUpdateInput {
    enabled?: boolean;
    clientId?: string;
    clientSecret?: string;
    callbackUrl?: string;
    sandboxMockEnabled?: boolean;
}

export interface UpdateSettingsRequest {
    defaultFallbackRegion?: SocialAuthRegion;
    providers?: Record<string, ProviderUpdateInput>;
}

export interface ProviderTestResult {
    provider: string;
    status: "ok" | "degraded" | "error";
    message: string;
    pingLatencyMs: number;
    testedAt: string;
}
