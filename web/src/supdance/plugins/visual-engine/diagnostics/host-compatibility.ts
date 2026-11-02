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
        cssCustomProperties: isClient ? window.CSS && window.CSS.supports && window.CSS.supports("color", "var(--test)") : true,
        cssLayers: isClient ? window.CSS && window.CSS.supports && window.CSS.supports("@layer") : true,
        reducedMotionQuery: isClient ? typeof window.matchMedia === "function" : true,
        popoverApi: isClient ? "showPopover" in (HTMLElement.prototype || {}) : false,
        webAnimationsApi: isClient ? "animate" in (Element.prototype || {}) : true,
    };

    const missingExtensions: string[] = [];
    if (!features.cssCustomProperties) {
        missingExtensions.push("浏览器不支持 CSS Custom Properties");
    }

    return {
        hostVersion: "1.7.3 / 1.7.4",
        compatible: missingExtensions.length === 0,
        features,
        missingExtensions,
        recommendations: [
            "推荐现代 Chromium / Safari / Firefox 核心浏览器以获得最佳平滑过渡与模糊滤镜性能",
            "已开启上游更新自动隔离机制，核心文件解耦运行",
        ],
    };
}
