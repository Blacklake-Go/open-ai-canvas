import { test, expect } from "bun:test";
import { advancedSubmission, musicToolInputError, trackSource, resourceSource, type MusicSource } from "@/supdance/plugins/music-generation/services/music-tools";
import type { MusicTask, MusicOutput } from "@/supdance/plugins/music-generation/services/music-api";
import type { RemoteResource } from "@/services/api/resources";

const audio: MusicSource = { id: "abc", title: "Source", durationMs: 30000, size: 299999, mimeType: "audio/mpeg" };
test("tool constraints match individual operations and reference metadata", () => {
    expect(musicToolInputError("reference", audio, "", "new words", 0, 0)).toBe("");
    expect(musicToolInputError("reference", { ...audio, durationMs: 29999 }, "", "words", 0, 0)).toBe("music.adv_source_duration");
    expect(musicToolInputError("persona", { ...audio, durationMs: 15000 }, "soft", "words", 0, 0)).toBe("");
    expect(musicToolInputError("persona", { ...audio, durationMs: 14999 }, "soft", "words", 0, 0)).toBe("music.adv_source_duration");
    expect(musicToolInputError("remix", { ...audio, durationMs: 480000 }, "house", "verse", 0, 0)).toBe("");
    expect(musicToolInputError("remix", { ...audio, durationMs: 480001 }, "house", "verse", 0, 0)).toBe("music.adv_source_duration");
    expect(musicToolInputError("remix", audio, "", "verse", 0, 0)).toBe("music.adv_prompt");
    expect(musicToolInputError("region", audio, "", "new verse", 2000, 4999)).toBe("music.adv_region_range");
    expect(musicToolInputError("region", audio, "", "new verse", 2000, 5000)).toBe("");
    expect(musicToolInputError("region", audio, "", "new verse", NaN, 5000)).toBe("music.adv_region_range");
    expect(musicToolInputError("stems", { ...audio, durationMs: undefined }, "", "", 0, 0)).toBe("");
    expect(musicToolInputError("stems", { ...audio, size: 10000001 }, "", "", 0, 0)).toBe("music.adv_source_format");
    expect(musicToolInputError("stems", { ...audio, mimeType: "image/png" }, "", "", 0, 0)).toBe("music.adv_source_format");
});
test("source uses the selected output storage key, not its task ID or remote URL", () => {
    const task = { id: "task-id", title: "Collection" } as MusicTask;
    const take = { id: "take-2", outputIndex: 1, storageKey: "resource:source-b", audioUrl: "https://invalid.example/x", format: "mp3" } as MusicOutput;
    expect(trackSource(task, take, "B")?.id).toBe("source-b");
    expect(trackSource(task, { ...take, storageKey: "" }, "B")).toBeUndefined();
    expect(trackSource(task, { ...take, adminResourceId: "not-owned" }, "B")).toBeUndefined();
    const resource = { id: "abc", kind: "audio", status: "ready", userId: "owner", mimeType: "audio/mp4" } as RemoteResource;
    expect(resourceSource(resource, "X", "owner").id).toBe("abc");
    expect(() => resourceSource(resource, "X", "other")).toThrow();
});
test("uncertain submission keeps nonce, a different operation, quote, or owner gets a different nonce", async () => {
    const request = { model: "tool", operation: "remix", quotedMicrocredits: 500, sourceResourceId: "source" };
    const a = await advancedSubmission("one", request);
    expect((await advancedSubmission("one", request)).nonce).toBe(a.nonce);
    const b = await advancedSubmission("two", request);
    expect(b.nonce).not.toBe(a.nonce);
    const changed = await advancedSubmission("one", { ...request, quotedMicrocredits: 600 });
    expect(changed.nonce).not.toBe(a.nonce);
    a.clear();
    expect((await advancedSubmission("one", { ...request, quotedMicrocredits: 600 })).nonce).toBe(changed.nonce);
    changed.clear();
    b.clear();
});
