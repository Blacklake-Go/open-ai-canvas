import { registerCanvasThemeExtension } from "@/lib/canvas-theme";
import { registerThemeExtension } from "@/lib/theme-extensions";
import { registerOverlayExtension } from "@/lib/overlay-extensions";
import { subscribeClientDiagnostics } from "@/services/diagnostics/client-diagnostics";
export type HostCompatibilityReport = {
    hostVersion: string;
    compatible: boolean;
    features: { cssCustomProperties: boolean; cssLayers: boolean; reducedMotionQuery: boolean; popoverApi: boolean; webAnimationsApi: boolean };
    missingExtensions: string[];
    recommendations: string[];
};
export function detectHostCompatibility(overrides: Partial<Record<"theme" | "overlay" | "diagnostics" | "canvas", boolean>> = {}): HostCompatibilityReport {
    const client = typeof window !== "undefined";
    const hostVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "未提供构建版本";
    const features = {
        cssCustomProperties: client && !!window.CSS?.supports?.("color", "var(--test)"),
        cssLayers: client && "CSSLayerBlockRule" in window,
        reducedMotionQuery: client && typeof window.matchMedia === "function",
        popoverApi: client && "showPopover" in HTMLElement.prototype,
        webAnimationsApi: client && "animate" in Element.prototype,
    };
    const extensions = {
        canvas: typeof registerCanvasThemeExtension === "function",
        theme: typeof registerThemeExtension === "function",
        overlay: typeof registerOverlayExtension === "function",
        diagnostics: typeof subscribeClientDiagnostics === "function",
        ...overrides,
    };
    const missingExtensions = Object.entries(extensions)
        .filter(([, present]) => !present)
        .map(([name]) => "缺少扩展接口：" + name);
    if (!features.cssCustomProperties) missingExtensions.push("缺少 CSS Custom Properties");
    if (!features.reducedMotionQuery) missingExtensions.push("缺少减少动效查询");
    if (!/^v?1\.7\.(3|4)(?:[.-]|$)/.test(hostVersion)) missingExtensions.push("宿主版本未在 1.7.3/1.7.4 兼容范围内");
    return {
        hostVersion,
        compatible: missingExtensions.length === 0,
        features,
        missingExtensions,
        recommendations: [
            ...(!features.webAnimationsApi ? ["页面过渡已降级为即时切换"] : []),
            ...(!features.cssLayers ? ["CSS Layer 不可用，继续使用插件根标记作用域"] : []),
            ...(!features.popoverApi ? ["浮层使用宿主 AntD 定位和焦点合同"] : []),
            ...(missingExtensions.length ? ["视觉增强保持原生回退；升级适配并重新验证后启用"] : ["已验证所需扩展存在；未来上游版本仍需执行兼容测试"]),
        ],
    };
}
