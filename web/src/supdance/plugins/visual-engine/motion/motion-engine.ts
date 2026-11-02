import type { MotionConfig } from "../types";
import { MOTION_EASINGS, MOTION_SPRINGS } from "./motion-constants";

export function checkSystemReducedMotion(): boolean {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function getComponentTransition(
    actionType: "quick" | "dropdownEnter" | "dropdownExit" | "modal" | "drawer" | "tabSwitch",
    config: MotionConfig,
    userReducedMotion = false,
) {
    if (!config.enabled) {
        return { duration: 0 };
    }

    if (userReducedMotion) {
        return config.reducedMotionBehavior === "instant"
            ? { duration: 0 }
            : { duration: 0.1, ease: "linear" };
    }

    switch (actionType) {
        case "quick":
            return {
                duration: config.durationQuick / 1000,
                ease: MOTION_EASINGS.standard,
            };
        case "dropdownEnter":
            return {
                duration: config.durationDropdownEnter / 1000,
                ease: MOTION_EASINGS.standard,
            };
        case "dropdownExit":
            return {
                duration: config.durationDropdownExit / 1000,
                ease: MOTION_EASINGS.sharp,
            };
        case "modal":
            return {
                duration: config.durationModal / 1000,
                ease: MOTION_EASINGS.standard,
            };
        case "drawer":
            return {
                duration: config.durationDrawer / 1000,
                ease: MOTION_EASINGS.smooth,
            };
        case "tabSwitch":
            return MOTION_SPRINGS.snappy;
        default:
            return { duration: 0.18, ease: MOTION_EASINGS.standard };
    }
}
