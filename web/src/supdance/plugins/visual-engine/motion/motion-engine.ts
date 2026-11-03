import type { MotionConfig } from "../types";

export function checkSystemReducedMotion(): boolean {
    return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function parseEasing(value: string): [number, number, number, number] | "linear" {
    const named: Record<string, [number, number, number, number]> = {
        ease: [0.25, 0.1, 0.25, 1],
        "ease-in": [0.42, 0, 1, 1],
        "ease-out": [0, 0, 0.58, 1],
        "ease-in-out": [0.42, 0, 0.58, 1],
    };
    if (value === "linear") return value;
    if (named[value]) return named[value];
    const match = /^cubic-bezier\(([^)]+)\)$/.exec(value);
    const values = match?.[1].split(",").map(Number);
    if (!values || values.length !== 4 || !values.every(Number.isFinite)) throw new Error("无效的动效缓动曲线");
    return [values[0], values[1], values[2], values[3]];
}

export function getComponentTransition(actionType: "quick" | "dropdownEnter" | "dropdownExit" | "modal" | "drawer" | "tabSwitch", config: MotionConfig, userReducedMotion = checkSystemReducedMotion()) {
    if (!config.enabled) return { duration: 0 };
    if (userReducedMotion) return config.reducedMotionBehavior === "instant" ? { duration: 0 } : { duration: 0.1, ease: "linear" as const };
    const duration = {
        quick: config.durationQuick,
        dropdownEnter: config.durationDropdownEnter,
        dropdownExit: config.durationDropdownExit,
        modal: config.durationModal,
        drawer: config.durationDrawer,
        tabSwitch: config.durationTabSwitch,
    }[actionType];
    const easing = actionType === "drawer" ? config.easingSmooth : actionType === "tabSwitch" ? config.easingBounce : config.easingStandard;
    return { duration: duration / 1000, ease: parseEasing(easing) };
}
