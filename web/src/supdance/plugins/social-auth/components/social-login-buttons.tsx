import { useEffect, useState } from "react";
import { App, Badge, Button, Spin, Tooltip } from "antd";
import { Globe, Sparkles } from "lucide-react";

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
                setActiveRegion(res.detectedRegion || "cn");
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
            <div className="flex items-center justify-center py-4">
                <Spin size="small" />
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const currentProviders = activeRegion === "cn" ? data.cn : data.intl;
    const isDark = variant === "dark-card";

    return (
        <div className="w-full space-y-3">
            {/* IP Geo-Partition & Region Switcher */}
            <div className="flex items-center justify-between text-xs">
                <div className={`flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    <Globe className="size-3.5 opacity-70" />
                    <span>
                        IP 分区:{" "}
                        <strong className={isDark ? "text-slate-200" : "text-slate-700"}>
                            {data.detectedRegion === "cn" ? "中国大陆 (CN)" : "海外/港澳台 (Intl)"}
                        </strong>
                    </span>
                </div>
                <div className={`flex items-center rounded-lg p-0.5 text-xs ${isDark ? "bg-white/5 border border-white/10" : "bg-slate-100"}`}>
                    <button
                        type="button"
                        onClick={() => setActiveRegion("cn")}
                        className={`rounded-md px-2 py-0.5 transition-all ${
                            activeRegion === "cn"
                                ? isDark
                                    ? "bg-pink-600 text-white font-medium shadow-sm"
                                    : "bg-white text-slate-900 font-medium shadow-sm"
                                : isDark
                                  ? "text-slate-400 hover:text-white"
                                  : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        中国大陆渠道
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveRegion("intl")}
                        className={`rounded-md px-2 py-0.5 transition-all ${
                            activeRegion === "intl"
                                ? isDark
                                    ? "bg-pink-600 text-white font-medium shadow-sm"
                                    : "bg-white text-slate-900 font-medium shadow-sm"
                                : isDark
                                  ? "text-slate-400 hover:text-white"
                                  : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        海外渠道
                    </button>
                </div>
            </div>

            {/* Providers Button Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {currentProviders.map((provider) => {
                    const isMock = provider.sandboxEnabled;
                    return (
                        <Tooltip
                            key={provider.id}
                            title={isMock ? `${provider.name} (沙盒联调模式)` : `${provider.name} 登录`}
                        >
                            <button
                                type="button"
                                onClick={() => handleProviderClick(provider)}
                                className={`group relative flex flex-col items-center justify-center gap-1.5 rounded-xl p-2.5 transition-all focus:outline-none ${
                                    isDark
                                        ? "border border-white/10 bg-white/[0.04] hover:border-pink-500/50 hover:bg-white/[0.08] active:scale-95"
                                        : "border border-slate-200/80 bg-slate-50/60 hover:border-pink-400/60 hover:bg-white hover:shadow-sm active:scale-95"
                                }`}
                            >
                                {isMock && (
                                    <span className="absolute -top-1.5 -right-1 flex items-center gap-0.5 rounded-full bg-pink-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-pink-400 border border-pink-500/40">
                                        <Sparkles className="size-2" />
                                        Mock
                                    </span>
                                )}
                                <SocialProviderIcon provider={provider.id} className="size-6 transition-transform group-hover:scale-110" />
                                <span
                                    className={`text-xs font-medium truncate max-w-full ${
                                        isDark ? "text-slate-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"
                                    }`}
                                >
                                    {provider.name}
                                </span>
                            </button>
                        </Tooltip>
                    );
                })}
            </div>
        </div>
    );
}
