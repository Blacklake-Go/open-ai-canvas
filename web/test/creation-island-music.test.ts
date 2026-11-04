import { describe, expect, it } from "bun:test";
import { modeLabels, shotScriptLabels, type CreationMode } from "@/pages/create/creation-types";
import { creationUploadAccept, creationFileAccepted } from "@/pages/create/creation-assets";
import { creationMusicEmptySuggestions } from "@/pages/create/creation-workspace-empty";
import { thinkingFor } from "@/pages/create/creation-workspace-messages";
import { creationLibraryDisabledReason } from "@/pages/create/creation-library";
import { completedCreationGenerationTask } from "@/pages/create/creation-conversations";
import { modelQuoteRequest } from "@/lib/model-pricing";
import type { CreationRuntime } from "@/pages/create/creation-runtime";
import type { AiConfig } from "@/stores/use-config-store";

describe("Creation Island Music Integration Suite", () => {
    it("CreationMode supports music with complete label dictionaries", () => {
        const musicMode: CreationMode = "music";
        expect(modeLabels[musicMode]).toBe("音乐");
        expect(shotScriptLabels[musicMode]).toBe("音乐提示");
    });

    it("Music upload and file filters restrict attachments appropriately", () => {
        expect(creationUploadAccept("music")).toBe("audio/*");
        expect(creationFileAccepted("music", { type: "audio/mp3", name: "song.mp3" })).toBe(true);
        expect(creationFileAccepted("music", { type: "audio/wav", name: "song.wav" })).toBe(true);
        expect(creationFileAccepted("music", { type: "text/plain", name: "lyrics.txt" })).toBe(true);
        expect(creationFileAccepted("music", { type: "text/plain", name: "lyrics.lrc" })).toBe(true);
        expect(creationFileAccepted("music", { type: "image/png", name: "cover.png" })).toBe(true);
        expect(creationFileAccepted("music", { type: "video/mp4", name: "movie.mp4" })).toBe(false);
    });

    it("Music library restriction validates audio material only", () => {
        expect(creationLibraryDisabledReason("music", "audio")).toBeUndefined();
        expect(creationLibraryDisabledReason("music", "video")).toBe("音乐创作仅支持参考音频");
        expect(creationLibraryDisabledReason("music", "image")).toBe("音乐创作仅支持参考音频");
    });

    it("Creation empty suggestions provide 4 dedicated music presets", () => {
        expect(creationMusicEmptySuggestions).toHaveLength(4);
        creationMusicEmptySuggestions.forEach((preset) => {
            expect(preset.mode).toBe("music");
            expect(preset.title.length).toBeGreaterThan(0);
            expect(preset.prompt.length).toBeGreaterThan(10);
        });
    });

    it("thinkingFor returns dedicated music composer phase text", () => {
        const thinking = thinkingFor("music", "SupDance");
        expect(thinking.title).toContain("乐曲");
        expect(thinking.hint).toContain("SupDance");
        expect(thinking.steps).toContain("合成母带");
    });

    it("completedCreationGenerationTask accepts mode audio and generates valid task entity", () => {
        const mockRuntime = {
            projectGenerationTaskResult: (task: any, result: any) => ({
                ...task,
                resultJson: JSON.stringify(result),
            }),
        } as unknown as CreationRuntime;

        const task = completedCreationGenerationTask(mockRuntime, {
            taskId: "task_audio_123",
            mode: "audio",
            prompt: "Summer pop track with upbeat synth",
            result: {
                mode: "audio",
                audio: { dataUrl: "https://cdn.example.com/audio.mp3", durationMs: 120000, mimeType: "audio/mpeg" },
            },
            conversationId: "conv_1",
            messageId: "msg_1",
        });

        expect(task.id).toBe("task_audio_123");
        expect(task.type).toBe("audio");
        expect(task.status).toBe("succeeded");
        expect(task.clientContext?.conversationId).toBe("conv_1");
    });

    it("modelQuoteRequest evaluates audio capability quotes from system channels", () => {
        const mockConfig = {
            channels: [
                {
                    id: "ch_sys_1",
                    scope: "system",
                    models: ["suno-v4"],
                    modelCosts: [
                        {
                            model: "suno-v4",
                            capability: "audio",
                            unitPriceMicrocredits: 80000000,
                            billingMode: "per_request",
                        },
                    ],
                },
            ],
        } as unknown as AiConfig;

        const quote = modelQuoteRequest(mockConfig, "suno-v4", "audio", {
            capability: "audio",
            input: { textCount: 1, imageCount: 0, videoCount: 0, audioCount: 0, characterCount: 0 },
        });

        expect(quote).toBeDefined();
        expect(quote?.channelId).toBe("ch_sys_1");
        expect(quote?.modelKey).toBe("suno-v4");
        expect(quote?.intent.capability).toBe("audio");
    });
});
