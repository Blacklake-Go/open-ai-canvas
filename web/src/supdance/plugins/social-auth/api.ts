import { compactApiParams, http } from "@/services/api/request";
import type { AdminSettingsView, CompleteOnboardingRequest, OnboardingProfileView, ProviderTestResult, PublicProvidersResponse, SocialAuthRegion, UpdateSettingsRequest, UserIdentitiesView } from "./types";

export async function getPublicSocialAuthProviders(params?: { simulateRegion?: SocialAuthRegion }, signal?: AbortSignal) {
    return http.get<PublicProvidersResponse>("/auth/social/providers", {
        params: compactApiParams({
            simulate_region: params?.simulateRegion,
        }),
        signal,
    });
}

export async function getAdminSocialAuthSettings(signal?: AbortSignal) {
    return http.get<AdminSettingsView>("/admin/social-auth/settings", { signal });
}

export async function updateAdminSocialAuthSettings(req: UpdateSettingsRequest) {
    return http.put<AdminSettingsView>("/admin/social-auth/settings", req);
}

export async function testSocialAuthProvider(providerId: string) {
    return http.post<ProviderTestResult>(`/admin/social-auth/test/${encodeURIComponent(providerId)}`);
}

export async function triggerMockSocialCallback(payload: { provider: string; state: string; code: string }) {
    return http.post<{ user: any; next: string; isNew: boolean }>("/auth/social/mock-callback", payload);
}

export function buildSocialAuthStartUrl(
    providerId: string,
    options?: {
        next?: string;
        acceptedTerms?: boolean;
        mock?: boolean;
        simulateRegion?: SocialAuthRegion;
    },
) {
    const params = new URLSearchParams();
    if (options?.next) params.set("next", options.next);
    if (options?.acceptedTerms) params.set("acceptedTerms", "true");
    if (options?.mock) params.set("mock", "true");
    if (options?.simulateRegion) params.set("simulate_region", options.simulateRegion);
    const query = params.toString();
    return `/api/auth/social/${encodeURIComponent(providerId)}/start${query ? `?${query}` : ""}`;
}

export async function getSocialOnboardingProfile(ticket: string, signal?: AbortSignal) {
    return http.get<OnboardingProfileView>("/auth/social/onboarding/profile", {
        params: { ticket },
        signal,
    });
}

export async function completeSocialOnboarding(req: CompleteOnboardingRequest) {
    return http.post<{ user: any; next: string }>("/auth/social/onboarding/complete", req);
}

export async function getUserSocialIdentities(signal?: AbortSignal) {
    return http.get<UserIdentitiesView>("/auth/social/identities", { signal });
}

export function buildSocialAuthBindUrl(providerId: string, next?: string) {
    const params = new URLSearchParams();
    if (next) params.set("next", next);
    const query = params.toString();
    return `/api/auth/social/${encodeURIComponent(providerId)}/bind${query ? `?${query}` : ""}`;
}

export async function unbindSocialIdentity(providerId: string) {
    return http.post<UserIdentitiesView>(`/auth/social/${encodeURIComponent(providerId)}/unbind`);
}
