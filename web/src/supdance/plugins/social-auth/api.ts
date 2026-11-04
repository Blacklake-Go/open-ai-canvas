import { compactApiParams, http } from "@/services/api/request";
import type {
    AdminSettingsView,
    CompleteOnboardingRequest,
    OnboardingProfileView,
    OperationalPolicies,
    OperationsOverview,
    ProviderTestResult,
    PublicProvidersResponse,
    SocialAuthRegion,
    SocialLoginLogItem,
    UpdateSettingsRequest,
    UserIdentitiesView,
    UserSocialBindingAdminItem,
} from "./types";

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

export async function uploadSocialBrandIcon(file: File) {
    const form = new FormData();
    form.append("file", file);
    return http.post<{ url: string }>("/admin/social-auth/brand-icons", form);
}

export async function testSocialAuthProvider(providerId: string) {
    return http.post<ProviderTestResult>(`/admin/social-auth/test/${encodeURIComponent(providerId)}`);
}

export function buildSocialAuthStartUrl(
    providerId: string,
    options?: {
        next?: string;
        acceptedTerms?: boolean;
        simulateRegion?: SocialAuthRegion;
    },
) {
    const params = new URLSearchParams();
    if (options?.next) params.set("next", options.next);
    if (options?.acceptedTerms) params.set("acceptedTerms", "true");
    if (options?.simulateRegion) params.set("simulate_region", options.simulateRegion);
    const query = params.toString();
    return `/api/auth/social/${encodeURIComponent(providerId)}/start${query ? `?${query}` : ""}`;
}

export async function getSocialAuthOperationsOverview(signal?: AbortSignal) {
    return http.get<OperationsOverview>("/admin/social-auth/operations/overview", { signal });
}

export async function updateSocialAuthPolicies(policies: OperationalPolicies) {
    return http.put<OperationsOverview>("/admin/social-auth/operations/policies", policies);
}

export async function searchSocialAuthUsers(query?: string, limit?: number, signal?: AbortSignal) {
    return http.get<UserSocialBindingAdminItem[]>("/admin/social-auth/operations/users", {
        params: compactApiParams({ q: query, limit }),
        signal,
    });
}

export async function adminUnbindSocialAuth(userId: string, provider: string) {
    return http.delete<{ message: string }>(`/admin/social-auth/operations/users/${encodeURIComponent(userId)}/unbind/${encodeURIComponent(provider)}`);
}

export async function getSocialAuthLoginLogs(limit?: number, signal?: AbortSignal) {
    return http.get<SocialLoginLogItem[]>("/admin/social-auth/operations/logs", {
        params: compactApiParams({ limit }),
        signal,
    });
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
