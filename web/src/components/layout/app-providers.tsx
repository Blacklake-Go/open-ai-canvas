import type { ReactNode } from "react";
import { lazy, Suspense, useEffect, useLayoutEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";

import { AuthSessionHydrator } from "@/components/auth/auth-session-hydrator";
import { AppFeedbackProvider } from "@/components/layout/app-feedback";
import { FullScreenLoader } from "@/components/ui/aceternity/full-screen-loader";
import { getAntThemeConfig } from "@/lib/app-theme";
import { applySkinTheme } from "@/lib/skin-themes";
import { appQueryClient } from "@/lib/query-client";
import { isIsolatedPrevisRepro } from "@/lib/dev-repro";
import { applyAppearanceMetadata, useAppearanceStore } from "@/stores/use-appearance-store";
import { useUserStore } from "@/stores/use-user-store";
import { refreshPublicAppearance } from "@/services/appearance-bootstrap";
import { SupDanceI18nRuntimeHost, useSupDanceAntdLocale } from "@/supdance/plugins/i18n";
import { VisualEngineRuntimeHost } from "@/supdance/plugins/visual-engine";
import { useVisualEnginePolicy } from "@/supdance/plugins/visual-engine/runtime/use-visual-engine-policy";
import { mergeVisualEngineAntTheme } from "@/supdance/plugins/visual-engine/themes/host-theme";
import { SupDancePluginRuntimeSync } from "@/supdance/adapters/plugin-runtime-sync";
import { SocialOnboardingModal } from "@/supdance/plugins/social-auth";
import { UserProfileModalHost } from "@/components/layout/user-profile-modal";

const ClientRootInit = lazy(() => import("@/components/layout/client-root-init").then((module) => ({ default: module.ClientRootInit })));

function ClientRootBoundary({ children }: { children: ReactNode }) {
    const authenticated = useUserStore((state) => Boolean(state.user));
    if (!authenticated) return children;
    return (
        <Suspense fallback={<FullScreenLoader label="正在准备创作环境" detail="连接本地能力与模型配置" />}>
            <ClientRootInit>{children}</ClientRootInit>
        </Suspense>
    );
}

export function AppProviders({ children }: { children: ReactNode }) {
    const visual = useVisualEnginePolicy();
    const theme = visual.mode;
    const dark = theme === "dark";
    const appearance = useAppearanceStore((state) => state.appearance);
    const antdLocale = useSupDanceAntdLocale();
    const hostTheme = getAntThemeConfig(dark, appearance.activeSkin);
    const antdTheme = visual.active ? mergeVisualEngineAntTheme(hostTheme, visual.config, visual.policy, visual.reducedMotion) : hostTheme;

    useLayoutEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
        document.documentElement.style.colorScheme = theme;
        applySkinTheme(appearance.activeSkin, theme);
        applyAppearanceMetadata(appearance);
    }, [appearance, dark, theme]);

    // DEV 复现台必须是同源本地确定性场景：AuthSessionHydrator 会打 /api/auth/session，
    // ClientRootInit 会打 /api/model-catalog，没有后端时产生真实 502，与导演台无关却会污染判据。
    // 与启动入口共用精确路径边界；生产构建中 import.meta.env.DEV 为 false，始终不启用隔离。
    const isolateDevRepro = typeof window !== "undefined" && isIsolatedPrevisRepro(import.meta.env.DEV, window.location.pathname);

    useEffect(() => {
        if (isolateDevRepro) return;
        const refresh = () => {
            if (document.visibilityState === "visible") void refreshPublicAppearance();
        };
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refresh);
        return () => {
            window.removeEventListener("focus", refresh);
            document.removeEventListener("visibilitychange", refresh);
        };
    }, [isolateDevRepro]);

    return (
        // 两个汉字的按钮（取消、确定）不再被 antd 拉开字距，与其他按钮的文字节奏一致。
        <ConfigProvider locale={antdLocale} theme={antdTheme} wave={{ disabled: true }} button={{ autoInsertSpace: false }}>
            <AppFeedbackProvider>
                <QueryClientProvider client={appQueryClient}>
                    {isolateDevRepro ? (
                        children
                    ) : (
                        <>
                            <SupDancePluginRuntimeSync />
                            <SupDanceI18nRuntimeHost />
                            <VisualEngineRuntimeHost />
                            <SocialOnboardingModal />
                            <UserProfileModalHost />
                            <AuthSessionHydrator>
                                <ClientRootBoundary>{children}</ClientRootBoundary>
                            </AuthSessionHydrator>
                        </>
                    )}
                </QueryClientProvider>
            </AppFeedbackProvider>
        </ConfigProvider>
    );
}
