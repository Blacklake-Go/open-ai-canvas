import type { OverlaysConfig } from "../types";

export function getModalBackdropStyle(overlays: OverlaysConfig): React.CSSProperties {
    return {
        backdropFilter: `blur(${overlays.modalBackdropBlur}px)`,
        WebkitBackdropFilter: `blur(${overlays.modalBackdropBlur}px)`,
        backgroundColor: `rgba(0, 0, 0, ${overlays.modalBackdropOpacity})`,
        pointerEvents: "auto",
    };
}

export function getDrawerBackdropStyle(overlays: OverlaysConfig): React.CSSProperties {
    return {
        backdropFilter: `blur(${overlays.drawerBackdropBlur}px)`,
        WebkitBackdropFilter: `blur(${overlays.drawerBackdropBlur}px)`,
        backgroundColor: `rgba(0, 0, 0, ${overlays.drawerBackdropOpacity})`,
        pointerEvents: "auto",
    };
}

export function getTextProtectionGradient(enabled: boolean): string {
    if (!enabled) return "none";
    return "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 100%)";
}
