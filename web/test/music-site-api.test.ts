import { describe, expect, test } from "bun:test";
import { siteMusicModels, projectSiteMusicTask, listSiteMusicTasks } from "@/supdance/plugins/music-generation/services/music-site-api";
import { defaultConfig, type AiConfig } from "@/stores/use-config-store";
import type { GenerationTask } from "@/services/api/task-center";

const config: AiConfig = {
    ...defaultConfig,
    channels: [
        {
            ...defaultConfig.channels[0],
            id: "music",
            scope: "system",
            models: ["suno-v6", "mureka-v9", "speech-tts"],
            modelCosts: [
                { model: "suno-v6", displayName: "Suno v6", capability: "audio", protocol: "runninghub-standard-audio-suno", billingMode: "fixed_request", unitPriceMicrocredits: 13100000, available: true },
                { model: "mureka-v9", displayName: "Mureka v9", capability: "audio", protocol: "runninghub-standard-audio-mureka", billingMode: "fixed_request", unitPriceMicrocredits: 8200000, available: false },
                { model: "speech-tts", displayName: "Music Speech", capability: "audio", protocol: "openai-audio", billingMode: "fixed_request", unitPriceMicrocredits: 1000000, available: true },
            ],
        },
    ],
};

function task(overrides: Partial<GenerationTask> = {}): GenerationTask {
    return {
        id: "music-task",
        type: "canvas_audio",
        status: "succeeded",
        prompt: "Piano",
        model: "music::suno-v6",
        attempts: 1,
        createdAt: "2026-11-05T00:00:00Z",
        updatedAt: "2026-11-05T00:00:00Z",
        inputJson: JSON.stringify({ metadata: { music: { title: "Piano", instrumental: true, duration: 30 } } }),
        resultJson: JSON.stringify({ mode: "audio", audios: [{ dataUrl: "/audio.mp3", storageKey: "resource:music-audio", durationMs: 31000 }] }),
        ...overrides,
    };
}

describe("music workbench platform integration", () => {
    test("loads owned task details because task summaries intentionally omit media and music metadata", async () => {
        const queried: string[] = [];
        const result = await listSiteMusicTasks(1, 50, {
            listTasks: async () => [task({ inputJson: undefined, resultJson: undefined })],
            queryTask: async (id) => {
                queried.push(id);
                return task({ resultJson: JSON.stringify({ mode: "audio", audio: { dataUrl: "/saved-song.mp3", durationMs: 31000 } }) });
            },
        });
        expect(queried).toEqual(["music-task"]);
        expect(result.items[0].resultAudioUrl).toBe("/saved-song.mp3");
        expect(result.items[0].durationTargetSeconds).toBe(30);
    });
    test("does not invent a catalog when backend channels are empty", () => {
        expect(siteMusicModels({ ...defaultConfig, channels: [] })).toEqual([]);
    });

    test("uses channel identities and preserves disabled models without exposing TTS as music", () => {
        const models = siteMusicModels(config);
        expect(models.map((model) => [model.id, model.available])).toEqual([
            ["music::suno-v6", true],
            ["music::mureka-v9", false],
        ]);
        expect(models.every((model) => model.formats.join() === "mp3")).toBe(true);
    });

    test("does not include personal channels in platform billed music", () => {
        expect(siteMusicModels({ ...config, channels: config.channels.map((channel) => ({ ...channel, scope: "user" })) })).toEqual([]);
    });

    test("recovers stable audio references, target duration and actual duration separately", () => {
        const result = projectSiteMusicTask(task());
        expect(result.status).toBe("completed");
        expect(result.resultStorageKey).toBe("resource:music-audio");
        expect(result.durationTargetSeconds).toBe(30);
        expect(result.resultDurationMs).toBe(31000);
        expect(result.instrumental).toBe(true);
    });

    test("projects actual billing and does not claim a refund for an unsettled failure", () => {
        const settled = projectSiteMusicTask(task({ billing: { amountMicrocredits: 13100000, reservedMicrocredits: 13100000, chargedMicrocredits: 13100000, refundedMicrocredits: 0, status: "settled" } }));
        expect(settled.microcreditsCost).toBe(13100000);
        const failed = projectSiteMusicTask(task({ status: "failed", resultJson: undefined, billing: { amountMicrocredits: 13100000, reservedMicrocredits: 13100000, refundedMicrocredits: 0, status: "uncertain" } }));
        expect(failed.status).toBe("failed");
        expect(failed.billingStatus).toBe("uncertain");
        expect(failed.resultAudioUrl).toBeUndefined();
    });
});
