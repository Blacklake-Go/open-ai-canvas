import type { VisualEngineConfig } from "../types";
import type { OverlayKind, OverlayStyles } from "@/lib/overlay-extensions";
import { getModalBackdropStyle, getDrawerBackdropStyle } from "../overlays/masks-scrims";
export function createVisualEngineOverlayStyles(config: VisualEngineConfig, mode: "light" | "dark", kind: OverlayKind): OverlayStyles {
    const surface = { boxShadow: config.elevations.E3[mode === "dark" ? "shadowDark" : "shadowLight"], borderRadius: config.components.overlayRadius };
    return { mask: kind === "modal" ? getModalBackdropStyle(config.overlays) : getDrawerBackdropStyle(config.overlays), [kind === "modal" ? "container" : "section"]: surface };
}
