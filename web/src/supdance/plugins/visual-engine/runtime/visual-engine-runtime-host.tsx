import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router";
import { useVisualEngineStore } from "../storage/visual-engine-store";
import { applyVisualEngineTheme, removeVisualEngineTheme } from "../themes/theme-engine";
import { startPluginStateSync } from "@/supdance/adapters/plugin-state-sync";
import { useUserStore } from "@/stores/use-user-store";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { useVisualEnginePolicy } from "./use-visual-engine-policy";

export function VisualEngineRuntimeHost() {
    const { pathname } = useLocation();
    const { active, config, policy, reducedMotion } = useVisualEnginePolicy();
    const userId = useUserStore((state) => state.user?.id ?? "");
    const isAdmin = useUserStore((state) => state.user?.role === "admin");
    const skin = useAppearanceStore((state) => state.appearance.activeSkin);
    const admin = isAdmin && pathname.startsWith("/admin/plugins/visual-engine");

    useLayoutEffect(() => {
        useVisualEngineStore.getState().resetSession();
    }, [userId]);

    useEffect(() => startPluginStateSync((signal) => useVisualEngineStore.getState().refresh(admin, signal)), [userId, admin]);

    useEffect(() => {
        if (!active) {
            removeVisualEngineTheme();
            return;
        }
        const motion = { ...config.motion, enabled: policy.motionEnabled };
        if (reducedMotion) {
            const duration = config.motion.reducedMotionBehavior === "instant" ? 0 : 100;
            motion.durationQuick = motion.durationDropdownEnter = motion.durationDropdownExit = motion.durationModal = motion.durationDrawer = motion.durationTabSwitch = duration;
        }
        applyVisualEngineTheme({ ...config, components: policy.activeComponents, motion }, policy.activeThemeMode, { customTokens: policy.activeTokens });
        return () => removeVisualEngineTheme();
    }, [active, config, pathname, reducedMotion, skin, policy.activeThemeMode, policy.motionEnabled]);

    return null;
}
