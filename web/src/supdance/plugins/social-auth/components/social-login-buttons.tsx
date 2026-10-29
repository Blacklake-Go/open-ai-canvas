import { useEffect, useState } from "react";
import { App, Tooltip } from "antd";

import { usePluginStore } from "@/stores/use-plugin-store";
import { useI18n } from "@/supdance/plugins/i18n";
import { buildSocialAuthStartUrl, getPublicSocialAuthProviders } from "../api";
import { SocialProviderIcon } from "./social-provider-icons";
import { SUPDANCE_SOCIAL_AUTH_PLUGIN_ID } from "../types";
import type { PublicProvidersResponse, SocialAuthProviderPublic } from "../types";

export interface SocialLoginButtonsProps {
    variant?: "dark-card" | "light-card";
    next?: string;
    acceptedTerms?: boolean;
    onRequireAcceptTerms?: () => boolean;
    onProvidersChange?: (providers: SocialAuthProviderPublic[]) => void;
}

export function SocialLoginButtons({
    variant = "light-card",
    next = "/",
    acceptedTerms = true,
    onRequireAcceptTerms,
    onProvidersChange,
}: SocialLoginButtonsProps) {
    const { t } = useI18n();
    const { message } = App.useApp();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<PublicProvidersResponse | null>(null);

    // Platform and user plugin availability check for hot-plugging
    const isPluginActive = usePluginStore((state) => {
        const p = state.pluginStates[SUPDANCE_SOCIAL_AUTH_PLUGIN_ID];
        if (p) {
            if (typeof p.platformAvailable === "boolean" && !p.platformAvailable) return false;
            if (typeof p.effectiveEnabled === "boolean") return p.effectiveEnabled;
        }
        return true;
    });

    useEffect(() => {
        if (!isPluginActive) {
            setLoading(false);
            onProvidersChange?.([]);
            return;
        }

        let mounted = true;
        const controller = new AbortController();

        getPublicSocialAuthProviders(undefined, controller.signal)
            .then((res) => {
                if (!mounted) return;
                setData(res);
                const providers = res.providers || [];
                onProvidersChange?.(providers);
            })
            .catch((err) => {
                if (mounted && err?.name !== "AbortError") {
                    console.warn("加载社交登录配置失败:", err);
                    onProvidersChange?.([]);
                }
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [isPluginActive, onProvidersChange]);

    const handleProviderClick = (provider: SocialAuthProviderPublic) => {
        if (onRequireAcceptTerms && !onRequireAcceptTerms()) {
            message.warning(t("auth.accept_terms_required", undefined, "请先勾选并同意服务协议与隐私政策"));
            return;
        }

        const url = buildSocialAuthStartUrl(provider.id, {
            next,
            acceptedTerms,
            mock: provider.sandboxEnabled,
        });
        window.location.href = url;
    };

    if (!isPluginActive) {
        return null;
    }

    if (loading) {
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
            {/* Branded Social Login Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-3.5" role="group" aria-label={t("auth.social_login_group", undefined, "快捷社交登录方式")}>
                {currentProviders.map((provider) => {
                    const isMock = Boolean(provider.sandboxEnabled);
                    const tooltipText = isMock
                        ? `${provider.name} (${t("auth.sandbox_mock_mode", undefined, "沙盒联调模式")})`
                        : `${provider.name} ${t("auth.social_login_action", undefined, "登录")}`;

                    return (
                        <Tooltip
                            key={provider.id}
                            title={tooltipText}
                            placement="top"
                        >
                            <button
                                type="button"
                                aria-label={tooltipText}
                                onClick={() => handleProviderClick(provider)}
                                className={`group relative flex size-11 items-center justify-center rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 ${
                                    isDark
                                        ? "border border-white/10 bg-white/[0.04] text-white hover:border-white/25 hover:bg-white/[0.08] hover:shadow-sm"
                                        : "border border-border/70 bg-card text-foreground hover:border-primary/50 hover:bg-accent hover:shadow-sm"
                                }`}
                            >
                                <SocialProviderIcon
                                    provider={provider.id}
                                    className="size-5 transition-transform duration-150 group-hover:scale-110"
                                />
                                {isMock && (
                                    <span
                                        className={`absolute -top-1 -right-1 size-2 rounded-full ${
                                            isDark ? "bg-amber-400 ring-2 ring-slate-900" : "bg-amber-500 ring-2 ring-background"
                                        }`}
                                        title={t("auth.sandbox_mock_mode", undefined, "沙盒联调模式")}
                                        aria-hidden="true"
                                    />
                                )}
                            </button>
                        </Tooltip>
                    );
                })}
            </div>
        </div>
    );
}
