import { expect, test } from "bun:test";
import { musicLyricTimeline } from "../src/supdance/plugins/music-generation/services/music-lyric-timeline";

test("keeps source timestamps and sorts repeated LRC cues", () => {
    const lines = musicLyricTimeline("[00:12.50][01:03.025]Refrain\n[00:04.2]Verse\n[ar:Artist]", 75);
    expect(lines.map(({ text, start }) => [text, start])).toEqual([
        ["Verse", 4.2],
        ["Refrain", 12.5],
        ["Refrain", 63.025],
    ]);
    expect(lines.every((line) => line.timestamped)).toBe(true);
});

test("estimates only lyric lines when the source lacks timestamps", () => {
    const lines = musicLyricTimeline("[Verse]\nFirst\n\nSecond\nThird", 60);
    expect(lines.map(({ start, section, timestamped }) => [start, section, timestamped])).toEqual([
        [null, true, undefined],
        [0, false, undefined],
        [20, false, undefined],
        [40, false, undefined],
    ]);
    expect(musicLyricTimeline("First", 0)[0].start).toBeNull();
});

test("uses the LRC offset and ends each cue at the next source timestamp", () => {
    const lines = musicLyricTimeline("[offset:+500]\r\n[00:04.00]<00:04.00>First <00:05.00>line\r\n[00:10.00]Second line", 24);
    expect(lines.map(({ text, start, end }) => [text, start, end])).toEqual([
        ["First line", 3.5, 9.5],
        ["Second line", 9.5, 24],
    ]);
});
