import { App } from "antd";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { usePluginStore } from "@/stores/use-plugin-store";
import { useI18n } from "@/supdance/plugins/i18n";
import { buildSocialAuthStartUrl, getPublicSocialAuthProviders } from "../api";
import { SocialProviderBrandIcon } from "./social-provider-icons";
import { SUPDANCE_SOCIAL_AUTH_PLUGIN_ID } from "../types";
import type { SocialAuthProviderPublic } from "../types";

export interface SocialLoginButtonsProps {
    variant?: "dark-card" | "light-card";
    next?: string;
    acceptedTerms?: boolean;
    onRequireAcceptTerms?: () => boolean;
    onProvidersChange?: (providers: SocialAuthProviderPublic[]) => void;
}

export function SocialLoginButtons({ variant = "light-card", next = "/", acceptedTerms = true, onRequireAcceptTerms, onProvidersChange }: SocialLoginButtonsProps) {
    const { t } = useI18n();
    const { message } = App.useApp();

    // Platform and user plugin availability check for hot-plugging
    const isPluginActive = usePluginStore((state) => {
        const p = state.pluginStates[SUPDANCE_SOCIAL_AUTH_PLUGIN_ID];
        if (p) {
            if (typeof p.platformAvailable === "boolean" && !p.platformAvailable) return false;
            if (typeof p.effectiveEnabled === "boolean") return p.effectiveEnabled;
        }
        return true;
    });

    const { data, isLoading } = useQuery({
        queryKey: ["public-social-auth-providers"],
        queryFn: ({ signal }) => getPublicSocialAuthProviders(undefined, signal),
        enabled: isPluginActive,
        staleTime: 0,
        refetchInterval: 15_000,
        refetchOnWindowFocus: true,
        gcTime: 30 * 60 * 1000,
    });

    const onProvidersChangeRef = useRef(onProvidersChange);
    onProvidersChangeRef.current = onProvidersChange;

    useEffect(() => {
        if (!isPluginActive) {
            onProvidersChangeRef.current?.([]);
            return;
        }
        if (data?.providers) {
            onProvidersChangeRef.current?.(data.providers);
        }
    }, [isPluginActive, data?.providers]);

    const handleProviderClick = (provider: SocialAuthProviderPublic) => {
        if (onRequireAcceptTerms && !onRequireAcceptTerms()) {
            message.warning(t("auth.accept_terms_required", undefined, "请先勾选并同意服务协议与隐私政策"));
            return;
        }

        const url = buildSocialAuthStartUrl(provider.id, {
            next,
            acceptedTerms,
        });
        window.location.href = url;
    };

    if (!isPluginActive) {
        return null;
    }

    if (isLoading && !data) {
        return (
            <div data-plugin-scope="social-auth" className="flex items-center justify-center py-2.5" role="status" aria-label="正在加载第三方登录渠道">
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            </div>
        );
    }

    if (!data) {
        return null;
    }

    // Authoritative IP Geo-Partitioning: display ONLY the providers returned for the detected region
    const currentProviders = data.providers || [];
    const isDark = variant === "dark-card";

    if (currentProviders.length === 0) {
        return null;
    }

    return (
        <div data-plugin-scope="social-auth" className="w-full">
            {/* 品牌药丸快捷登录 (Pill-shaped Social Login)：官方高清品牌图标 + 品牌名 + 胶囊完全圆角 */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 w-full" role="group" aria-label={t("auth.social_login_group", undefined, "快捷社交登录方式")}>
                {currentProviders.map((provider) => {
                    const shortName = provider.name.replace(/\s*(登录|登入|Login|Sign in)$/i, "").trim() || provider.name;
                    const isSingle = currentProviders.length === 1;
                    const isPair = currentProviders.length === 2;
                    return (
                        <button
                            key={provider.id}
                            type="button"
                            aria-label={`${shortName} ${t("auth.social_login_action", undefined, "登录")}`}
                            onClick={() => handleProviderClick(provider)}
                            className={`group relative flex h-11 items-center justify-center gap-2.5 rounded-full px-5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.98] ${
                                isSingle ? "w-full" : isPair ? "w-full sm:flex-1 sm:min-w-[140px]" : "flex-1 min-w-[120px] sm:min-w-[130px]"
                            } ${
                                isDark
                                    ? "border border-white/10 bg-white/[0.05] text-[#FAFAFA] hover:border-white/25 hover:bg-white/[0.09] hover:shadow-[0_0_12px_rgba(255,255,255,0.06)]"
                                    : "border border-border/80 bg-card text-foreground hover:border-primary/50 hover:bg-accent/70 hover:shadow-sm"
                            }`}
                        >
                            <SocialProviderBrandIcon provider={provider.id} iconLightUrl={provider.iconLightUrl} iconDarkUrl={provider.iconDarkUrl} className="size-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                            <span className="truncate">{shortName}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
