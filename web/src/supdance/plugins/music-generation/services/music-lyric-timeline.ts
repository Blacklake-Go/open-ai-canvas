const timestamp = /\[(\d+):([0-5]?\d)(?:[.:](\d{1,3}))?\]/g;

type LyricLine = { text: string; start: number | null; end?: number; section: boolean; timestamped?: true };

export type MusicLyricCue = { text: string; startMs: number; endMs: number };

export function readMusicLyricCues(value: unknown): MusicLyricCue[] | undefined {
    if (!Array.isArray(value) || value.length === 0) return undefined;
    const cues: MusicLyricCue[] = [];
    let previousEnd = 0;
    for (const cue of value) {
        if (typeof cue?.text !== "string" || !cue.text.trim() || !Number.isSafeInteger(cue.startMs) || !Number.isSafeInteger(cue.endMs) || cue.startMs < previousEnd || cue.startMs >= cue.endMs) {
            return undefined;
        }
        cues.push({ text: cue.text.trim(), startMs: cue.startMs, endMs: cue.endMs });
        previousEnd = cue.endMs;
    }
    return cues;
}

export function activeMusicLyricIndex(timeline: LyricLine[], seconds: number) {
    return timeline.findLastIndex((row) => row.start !== null && row.start <= seconds && (row.end === undefined || seconds < row.end));
}

export function musicLyricTimeline(lyrics: string, duration: number, cues?: MusicLyricCue[]): LyricLine[] {
    if (cues?.length) return cues.map(({ text, startMs, endMs }) => ({ text, start: startMs / 1000, end: endMs / 1000, section: false, timestamped: true }));

    const lines = lyrics
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const offsetMs = Number(/^\[offset:([+-]?\d+)\]$/im.exec(lyrics.trim())?.[1] || 0);
    const timed = lines.flatMap((line) => {
        const text = line
            .replace(timestamp, "")
            .replace(/<\d+:[0-5]?\d(?:[.:]\d{1,3})?>/g, "")
            .trim();
        if (!text) return [];
        return [...line.matchAll(timestamp)].map(([, minutes, seconds, fraction]) => ({
            text,
            start: Math.max(0, Number(minutes) * 60 + Number(seconds) + Number("0." + (fraction || "0")) - offsetMs / 1000),
            section: false,
            timestamped: true as const,
        }));
    });
    if (timed.length) {
        timed.sort((a, b) => a.start - b.start);
        return timed.map((line, index) => ({ ...line, end: timed[index + 1]?.start ?? (duration > line.start ? duration : undefined) }));
    }

    const count = lines.filter((line) => !/^\[[^\]]+\]$/.test(line)).length;
    let nextLine = 0;
    return lines.map((text) => {
        const section = /^\[([^\]]+)\]$/.exec(text);
        if (section) return { text: section[1], start: null, section: true };
        const start = duration > 0 ? (nextLine * duration) / count : null;
        nextLine += 1;
        return { text, start, section: false };
    });
}
