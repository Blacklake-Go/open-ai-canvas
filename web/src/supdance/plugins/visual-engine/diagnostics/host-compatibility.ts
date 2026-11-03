import { SUPDANCE_HOST_VERSION } from "@/supdance/adapters/compatibility";

export type HostCompatibilityReport = {
    hostVersion: string;
    compatible: boolean;
    features: {
        cssCustomProperties: boolean;
        cssLayers: boolean;
        reducedMotionQuery: boolean;
        popoverApi: boolean;
        webAnimationsApi: boolean;
    };
    missingExtensions: string[];
    recommendations: string[];
};

export function detectHostCompatibility(): HostCompatibilityReport {
    const isClient = typeof window !== "undefined";

    const features = {
        cssCustomProperties: isClient && !!window.CSS?.supports?.("color", "var(--test)"),
        cssLayers: isClient && "CSSLayerBlockRule" in window,
        reducedMotionQuery: isClient && typeof window.matchMedia === "function",
        popoverApi: isClient ? "showPopover" in (HTMLElement.prototype || {}) : false,
        webAnimationsApi: isClient && "animate" in window.Element.prototype,
    };

    const missingExtensions: string[] = [];
    if (!features.cssCustomProperties) {
        missingExtensions.push("浏览器不支持 CSS Custom Properties");
    }

    return {
        hostVersion: SUPDANCE_HOST_VERSION,
        compatible: missingExtensions.length === 0,
        features,
        missingExtensions,
        recommendations: ["推荐现代 Chromium / Safari / Firefox 核心浏览器以获得最佳平滑过渡与模糊滤镜性能"],
    };
}
