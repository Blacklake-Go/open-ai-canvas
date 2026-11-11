import { describe, expect, test } from "bun:test";
import { projectSiteMusicTask, projectMusicTask, projectAdminMusicTask } from "@/supdance/plugins/music-generation/services/music-site-api";
import { musicCreationAllowed } from "@/supdance/plugins/music-generation/components/music-form";
import type { GenerationTask } from "@/services/api/task-center";

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
    test("admin playback uses the existing admin resource route and ordinary playback keeps user authorization", () => {
        const ordinary = projectSiteMusicTask(task());
        const admin = projectAdminMusicTask(task());
        expect(ordinary.outputs?.[0].audioUrl).not.toContain("/admin/");
        expect(admin.outputs?.[0]).toMatchObject({ adminResourceId: "music-audio", audioUrl: "/api/admin/resources/music-audio/file" });
    });
    test("preserves the actual archived MIME type and infers the MP3 file extension", () => {
        const result = projectSiteMusicTask(task({ resultJson: JSON.stringify({ mode: "audio", audios: [{ storageKey: "resource:actual-audio", mimeType: "audio/mpeg", durationMs: 152830, bytes: 4892674 }] }) }));
        expect(result.outputs?.[0]).toMatchObject({ format: "mp3", mimeType: "audio/mpeg", durationMs: 152830, bytes: 4892674 });
    });
    test("blocks a 1500-credit quote with 194.76 credits available, and blocks unknown balances", () => {
        const quote = { logicalModelId: "", billingMode: "fixed_request", quantity: 1, amountMicrocredits: 1500000000, estimated: false };
        expect(musicCreationAllowed(quote, 194760000)).toBe(false);
        expect(musicCreationAllowed(quote, undefined)).toBe(false);
        expect(musicCreationAllowed(quote, null)).toBe(false);
        expect(musicCreationAllowed(quote, 1500000000)).toBe(true);
        expect(musicCreationAllowed(null, 2000000000)).toBe(false);
    });
    test("keeps every real output grouped with its task and preserves millisecond durations", () => {
        const result = projectSiteMusicTask(
            task({
                resultJson: JSON.stringify({
                    mode: "audio",
                    audios: [
                        { dataUrl: "/one.mp3", format: "mp3", durationMs: 207600, bytes: 4883001 },
                        { dataUrl: "/two.mp3", format: "mp3", durationMs: 209200, bytes: 4743657 },
                    ],
                }),
            }),
        );
        expect(result.outputs?.map((output) => [output.id, output.durationMs])).toEqual([
            ["music-task:0", 207600],
            ["music-task:1", 209200],
        ]);
        expect(projectMusicTask(result).outputs).toEqual(result.outputs);
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
