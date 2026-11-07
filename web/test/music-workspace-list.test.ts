import { expect, test } from "bun:test";
import { groupMusicHistory } from "@/supdance/plugins/music-generation/services/workspace-list";
import type { MusicTask } from "@/supdance/plugins/music-generation/services/music-api";

const music = (id: string, day: string, props: Partial<MusicTask> = {}): MusicTask => ({
    id,
    taskId: id,
    userId: "test",
    model: "suno",
    mode: "simple",
    prompt: "Rain on glass",
    instrumental: false,
    durationTargetSeconds: 0,
    status: "completed",
    stage: "completed",
    createdAt: day + "T12:00:00Z",
    updatedAt: day + "T12:00:00Z",
    outputs: [
        { id: id + ":0", outputIndex: 0 },
        { id: id + ":1", outputIndex: 1 },
    ],
    ...props,
});
const first = music("old", "2026-11-01", { lyrics: "夜雨", tags: "synth" });
const last = music("new", "2026-11-03", { instrumental: true, status: "queued" });
function ids(filter: string, query = "", oldest = false) {
    return [...groupMusicHistory([first, last], query, filter, oldest, new Set(["old:1"]), "zh-CN").values()].flat().map((t) => t.id);
}
test("filters the workspace by status, instrumental and a specific favorited output", () => {
    expect(ids("generating")).toEqual(["new"]);
    expect(ids("instrumental")).toEqual(["new"]);
    expect(ids("favorites")).toEqual(["old"]);
    expect(ids("failed")).toEqual([]);
});
test("searches style and lyrics; date order changes without reordering task outputs", () => {
    expect(ids("all", " synth ")).toEqual(["old"]);
    expect(ids("all", "夜雨")).toEqual(["old"]);
    expect(ids("all")).toEqual(["new", "old"]);
    expect(ids("all", "", true)).toEqual(["old", "new"]);
    expect(first.outputs?.[1].id).toBe("old:1");
});
