import { describe, expect, test } from "bun:test";
import { historyMessagePayload, historySettingBool } from "@/services/creation-history-payload";
import type { CreationMessage } from "@/pages/create/creation-types";

const message = (settings: CreationMessage["settings"]): CreationMessage => ({
    id: "m-settings",
    role: "assistant",
    content: "settings",
    status: "done",
    createdAt: "2026-11-25T01:00:00Z",
    settings,
});

describe("创作历史 settings 跨设备契约", () => {
    test("扩容后的创作参数全部进入云端 payload", () => {
        const payload = historyMessagePayload(
            message({
                ratio: "16:9",
                seconds: "0",
                quality: "auto",
                videoQuality: "720",
                count: "2",
                model: "jimeng-v2",
                mode: "image",
                style: "cinematic",
                songLanguage: "zh",
                resolution: "2k",
                imageResolution: "1.5K",
                transparentBackground: true,
                thinkingLevel: "high",
                duration: "60",
                instrumental: false,
                title: "song",
            }),
        );
        const settings = payload.settings as Record<string, unknown>;
        expect(settings.imageResolution).toBe("1.5K");
        expect(settings.mode).toBe("image");
        expect(settings.style).toBe("cinematic");
        expect(settings.songLanguage).toBe("zh");
        expect(settings.resolution).toBe("2k");
        expect(settings.transparentBackground).toBe(true);
        expect(settings.thinkingLevel).toBe("high");
        expect(settings.instrumental).toBe(false);
    });

    test("payload 仍剔除未声明字段，避免密钥或页面态入云", () => {
        const payload = historyMessagePayload(message({ ratio: "1:1", seconds: "0", quality: "auto", videoQuality: "720", count: "1", apiKey: "must-not-persist" } as never));
        expect(JSON.stringify(payload)).not.toContain("apiKey");
    });

    test("布尔恢复兼容旧后端字符串归一化", () => {
        expect(historySettingBool(true)).toBe(true);
        expect(historySettingBool(false)).toBe(false);
        expect(historySettingBool("true")).toBe(true);
        expect(historySettingBool("false")).toBe(false);
        expect(historySettingBool(undefined)).toBeUndefined();
        expect(historySettingBool("yes")).toBeUndefined();
        expect(historySettingBool(1)).toBeUndefined();
    });
});
