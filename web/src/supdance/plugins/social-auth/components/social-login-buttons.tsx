import { useEffect, useState } from "react";
import { App, Tooltip } from "antd";
import { Globe } from "lucide-react";

import { buildSocialAuthStartUrl, getPublicSocialAuthProviders } from "../api";
import { SocialProviderIcon } from "./social-provider-icons";
import type { PublicProvidersResponse, SocialAuthProviderPublic, SocialAuthRegion } from "../types";

export interface SocialLoginButtonsProps {
    variant?: "dark-card" | "light-card";
    next?: string;
    acceptedTerms?: boolean;
    onRequireAcceptTerms?: () => boolean;
}

export function SocialLoginButtons({
    variant = "light-card",
    next = "/",
    acceptedTerms = true,
    onRequireAcceptTerms,
}: SocialLoginButtonsProps) {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<PublicProvidersResponse | null>(null);
    const [activeRegion, setActiveRegion] = useState<SocialAuthRegion>("cn");

    useEffect(() => {
        let mounted = true;
        const controller = new AbortController();

        getPublicSocialAuthProviders(undefined, controller.signal)
            .then((res) => {
                if (!mounted) return;
                setData(res);
                setActiveRegion(res.detectedRegion || res.region || "cn");
            })
            .catch((err) => {
                if (mounted && err?.name !== "AbortError") {
                    console.warn("加载社交登录配置失败:", err);
                }
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
            controller.abort();
        };
    }, []);

    const handleProviderClick = (provider: SocialAuthProviderPublic) => {
        if (onRequireAcceptTerms && !onRequireAcceptTerms()) {
            message.warning("请先勾选并同意服务协议与隐私政策");
            return;
        }

        const url = buildSocialAuthStartUrl(provider.id, {
            next,
            acceptedTerms,
            mock: provider.sandboxEnabled,
            simulateRegion: activeRegion,
        });
        window.location.href = url;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-2.5">
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const detectedRegion = data.detectedRegion || data.region || "cn";
    const cnList = data.cn || data.allRegions?.cn || (detectedRegion === "cn" ? data.providers : []);
    const intlList = data.intl || data.allRegions?.intl || (detectedRegion === "intl" ? data.providers : []);
    const currentProviders = (activeRegion === "cn" ? cnList : intlList) || [];
    const isDark = variant === "dark-card";

    if (currentProviders.length === 0) {
        return (
            <div className="w-full text-center py-2">
                <p className={`text-xs ${isDark ? "text-slate-500" : "text-muted-foreground/60"}`}>
                    当前分区暂无开放的第三方登录
                </p>
                <button
                    type="button"
                    onClick={() => setActiveRegion((prev) => (prev === "cn" ? "intl" : "cn"))}
                    className={`mt-1.5 inline-flex items-center gap-1 text-[11px] transition-colors ${
                        isDark ? "text-slate-400 hover:text-pink-400" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Globe className="size-3 opacity-60" />
                    <span>{activeRegion === "cn" ? "切换至海外国际渠道" : "切换至中国大陆渠道"}</span>
                </button>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Branded Social Login Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-3.5">
                {currentProviders.map((provider) => {
                    const isMock = !!provider.sandboxEnabled;
                    return (
                        <Tooltip
                            key={provider.id}
                            title={isMock ? `${provider.name} (沙盒联调模式)` : `${provider.name} 登录`}
                            placement="top"
                        >
                            <button
                                type="button"
                                aria-label={`${provider.name} 登录`}
                                onClick={() => handleProviderClick(provider)}
                                className={`group relative flex size-11 items-center justify-center rounded-xl transition-all duration-150 focus:outline-none ${
                                    isDark
                                        ? "border border-white/10 bg-white/[0.04] text-white hover:border-pink-500/50 hover:bg-white/[0.09] hover:shadow-lg hover:shadow-pink-500/10 active:scale-95"
                                        : "border border-border/70 bg-card text-foreground hover:border-primary/50 hover:bg-accent hover:shadow-sm active:scale-95"
                                }`}
                            >
                                <SocialProviderIcon
                                    provider={provider.id}
                                    className="size-5 transition-transform duration-150 group-hover:scale-110"
                                />
                                {isMock && (
                                    <span
                                        className="absolute -top-1 -right-1 size-2 rounded-full bg-pink-500 ring-2 ring-background"
                                        title="沙盒 Mock 联调模式"
                                    />
                                )}
                            </button>
                        </Tooltip>
                    );
                })}
            </div>

            {/* Subtle Region Switcher Link */}
            <div className="mt-2.5 flex items-center justify-center">
                <button
                    type="button"
                    onClick={() => setActiveRegion((prev) => (prev === "cn" ? "intl" : "cn"))}
                    className={`inline-flex items-center gap-1.5 text-[11px] transition-colors focus:outline-none ${
                        isDark ? "text-slate-400 hover:text-pink-400" : "text-muted-foreground/75 hover:text-foreground"
                    }`}
                >
                    <Globe className="size-3 opacity-60" />
                    <span>
                        {activeRegion === "cn"
                            ? "当前显示国内渠道 · 切换至国际登录"
                            : "当前显示国际渠道 · 切换至国内登录"}
                    </span>
                </button>
            </div>
        </div>
    );
}
