import { interfaceText } from "@/i18n/interface-text";

export function imageQualityLabel(value: string) {
    const normalized = String(value || "")
        .trim()
        .toLowerCase();
    switch (normalized) {
        case "auto":
            return interfaceText("自动");
        case "low":
            return interfaceText("低");
        case "medium":
            return interfaceText("中");
        case "high":
            return interfaceText("高");
        case "xhigh":
            return interfaceText("超高");
        case "max":
            return interfaceText("最高");
        case "1k":
        case "2k":
        case "4k":
            return normalized.toUpperCase();
        default:
            return value;
    }
}

export function imageQualityDescription(value: string) {
    switch (
        String(value || "")
            .trim()
            .toLowerCase()
    ) {
        case "auto":
            return interfaceText("由模型决定");
        case "low":
            return interfaceText("更快生成");
        case "medium":
            return interfaceText("均衡模式");
        case "high":
            return interfaceText("优先速度");
        case "xhigh":
            return interfaceText("优先质量");
        case "max":
            return interfaceText("优先细节");
        case "1k":
            return interfaceText("标准清晰度");
        case "2k":
            return interfaceText("更高清晰度");
        case "4k":
            return interfaceText("最高清晰度");
        default:
            return interfaceText("模型支持的质量/分辨率");
    }
}

export function isImageResolutionTier(value: string) {
    return ["1k", "2k", "4k"].includes(
        String(value || "")
            .trim()
            .toLowerCase(),
    );
}
