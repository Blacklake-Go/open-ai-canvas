import { describe, expect, test } from "bun:test";
import { resolveComposerImageSettings, clampComposerCount } from "../src/pages/workspace/image-workspace-composer";
import { defaultModelCapabilityConfig } from "../src/lib/model-capabilities";
import { mediaSettingIssues } from "../src/lib/media-settings";
import { backendProviderConfig } from "../src/services/api/generation-task";
import { defaultConfig, createModelChannel, type AiConfig } from "../src/stores/use-config-store";

// 构造一个系统渠道图片模型：合同来自 defaultModelCapabilityConfig(protocol)。
function configWithImageModel(protocol: string, model = "image-model"): AiConfig {
    const capabilityConfig = defaultModelCapabilityConfig(protocol, model);
    const channel = createModelChannel({
        id: "sys",
        scope: "system",
        interfaceType: protocol,
        models: [model],
        modelCosts: [{ model, capability: "image", protocol, capabilityConfig, billingMode: "fixed_request", unitPriceMicrocredits: 1_000_000 }],
    });
    return { ...defaultConfig, channels: [channel], model: `sys::${model}`, imageModel: `sys::${model}`, imageParameters: "{}" } as AiConfig;
}

describe("图片工作台参数合同", () => {
    test("Seedream：quality 不支持而 resolution 支持时，分辨率进入 imageResolution 而不是 quality", () => {
        const config = configWithImageModel("km-kemei-seedream", "doubao-seedream-5-0-pro");
        const resolved = resolveComposerImageSettings(config, config.model, { ratio: "16:9", resolution: "1.5k" });
        expect(resolved.resolution).toBe("1.5k");
        expect(resolved.quality).not.toBe("1.5k");
        const submitted = { ...config, size: resolved.size, quality: resolved.quality, imageResolution: resolved.resolution, count: "1" } as AiConfig;
        expect(mediaSettingIssues(submitted, "image")).toEqual([]);
        const provider = backendProviderConfig(submitted, "image");
        expect(provider.imageResolution).toBe("1.5k");
    });

    test("旧记录把分辨率档存进 quality 时迁移到 imageResolution", () => {
        const config = configWithImageModel("km-kemei-seedream", "doubao-seedream-5-0-pro");
        const resolved = resolveComposerImageSettings(config, config.model, { ratio: "1:1", quality: "2k" });
        expect(resolved.resolution).toBe("2k");
        expect(resolved.quality).toBe("auto");
    });

    test("分辨率档位大小写不敏感对齐模型合同原值", () => {
        const config = configWithImageModel("km-kemei-seedream", "doubao-seedream-5-0-pro");
        const resolved = resolveComposerImageSettings(config, config.model, { ratio: "1:1", resolution: "1.5K" });
        expect(resolved.resolution).toBe("1.5k");
    });

    test("普通模型保留真实画质语义，low/medium/high 不被迁移", () => {
        const config = configWithImageModel("openai-image");
        const resolved = resolveComposerImageSettings(config, config.model, { ratio: "1:1", quality: "high" });
        expect(resolved.quality).toBe("high");
        expect(resolved.resolution).toBe("auto");
    });

    test("模型不支持的比例回落到合同默认值，不提交非法参数", () => {
        const config = configWithImageModel("kacang-midjourney-special");
        const profile = defaultModelCapabilityConfig("kacang-midjourney-special").image!;
        const resolved = resolveComposerImageSettings(config, config.model, { ratio: "21:10" });
        expect(profile.size.values).toContain(resolved.size);
        const submitted = { ...config, size: resolved.size, quality: resolved.quality, imageResolution: resolved.resolution, count: "1" } as AiConfig;
        expect(mediaSettingIssues(submitted, "image")).toEqual([]);
    });

    test("grok-image 旧 quality 档位协议继续按合同迁移", () => {
        const config = configWithImageModel("grok-image");
        const resolved = resolveComposerImageSettings(config, config.model, { ratio: "16:9", quality: "1k" });
        const submitted = { ...config, size: resolved.size, quality: resolved.quality, imageResolution: resolved.resolution, count: "1" } as AiConfig;
        expect(mediaSettingIssues(submitted, "image")).toEqual([]);
    });
});

describe("图片工作台张数上限", () => {
    test("按账号同时任务数 clamp，硬上限 15", () => {
        expect(clampComposerCount(4, 5)).toBe(4);
        expect(clampComposerCount(9, 5)).toBe(5);
        expect(clampComposerCount(99, 30)).toBe(15);
        expect(clampComposerCount(0, 5)).toBe(1);
        expect(clampComposerCount(Number.NaN, 5)).toBe(1);
        expect(clampComposerCount(2.9, 5)).toBe(2);
    });
});
