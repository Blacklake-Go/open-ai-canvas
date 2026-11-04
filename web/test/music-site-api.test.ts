import { describe, expect, test } from "bun:test";
import { siteMusicModels, projectSiteMusicTask, listSiteMusicTasks, submitSiteMusicTask } from "@/supdance/plugins/music-generation/services/music-site-api";
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
    test("Suno rejects custom lyrics mode before submitting a paid task", async () => {
        let submitted = false;
        await expect(
            submitSiteMusicTask(
                { model: "music::suno-v6", mode: "custom", prompt: "Piano", lyrics: "Verse", idempotencyNonce: "test" },
                {
                    config,
                    submitTask: async () => {
                        submitted = true;
                        return task();
                    },
                },
            ),
        ).rejects.toThrow("unsupported");
        expect(submitted).toBe(false);
        expect(siteMusicModels(config)[0].modes).toEqual(["simple"]);
    });
    test("Mureka drops unsupported instrumental while keeping custom lyrics", async () => {
        const enabledConfig = { ...config, channels: config.channels.map((channel) => ({ ...channel, modelCosts: channel.modelCosts?.map((cost) => ({ ...cost, available: true })) })) };
        await submitSiteMusicTask(
            { model: "music::mureka-v9", mode: "custom", prompt: "Piano", lyrics: "Verse", instrumental: true, idempotencyNonce: "test" },
            {
                config: enabledConfig,
                submitTask: async (input) => {
                    expect(input.metadata?.music).toEqual({ title: undefined, lyrics: "Verse", duration: undefined });
                    return task();
                },
            },
        );
    });
    test("MiniMax preserves vocal lyrics and instrumental requests separately", async () => {
        const minimaxConfig = { ...config, channels: config.channels.map((channel) => ({ ...channel, models: ["minimax-music"], modelCosts: [{ ...channel.modelCosts![0], model: "minimax-music", protocol: "runninghub-standard-audio-minimax-music" }] })) };
        expect(siteMusicModels(minimaxConfig)[0].instrumentalSupported).toBe(true);
        for (const instrumental of [false, true]) {
            await submitSiteMusicTask(
                { model: "music::minimax-music", mode: "custom", prompt: "Piano", lyrics: "Verse", instrumental, idempotencyNonce: "test" },
                {
                    config: minimaxConfig,
                    submitTask: async (input) => {
                        expect(input.metadata?.music).toEqual({ title: undefined, ...(instrumental ? {} : { lyrics: "Verse" }), instrumental, duration: undefined });
                        return task();
                    },
                },
            );
        }
    });
    test("loads owned task details because task summaries intentionally omit media and music metadata", async () => {
        const queried: string[] = [];
        const result = await listSiteMusicTasks(1, 50, {
            listTasks: async () => [task({ inputJson: undefined, resultJson: undefined, billing: { amountMicrocredits: 13100000, reservedMicrocredits: 13100000, chargedMicrocredits: 13100000, refundedMicrocredits: 0, status: "settled" } })],
            queryTask: async (id) => {
                queried.push(id);
                return task({ resultJson: JSON.stringify({ mode: "audio", audio: { dataUrl: "/saved-song.mp3", durationMs: 31000 } }) });
            },
        });
        expect(queried).toEqual(["music-task"]);
        expect(result.items[0].resultAudioUrl).toBe("/saved-song.mp3");
        expect(result.items[0].durationTargetSeconds).toBe(30);
        expect(result.items[0].billingStatus).toBe("settled");
        expect(result.items[0].microcreditsCost).toBe(13100000);
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
