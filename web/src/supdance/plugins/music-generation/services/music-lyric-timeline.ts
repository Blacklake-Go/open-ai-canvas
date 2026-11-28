const timestamp = /\[(\d+):([0-5]?\d)(?:[.:](\d{1,3}))?\]/g;

type LyricLine = { text: string; start: number | null; section: boolean; timestamped?: true };

export function musicLyricTimeline(lyrics: string, duration: number): LyricLine[] {
    const lines = lyrics
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const timed = lines.flatMap((line) => {
        const text = line.replace(timestamp, "").trim();
        if (!text) return [];
        return [...line.matchAll(timestamp)].map(([, minutes, seconds, fraction]) => ({
            text,
            start: Number(minutes) * 60 + Number(seconds) + Number("0." + (fraction || "0")),
            section: false,
            timestamped: true as const,
        }));
    });
    if (timed.length) return timed.sort((a, b) => a.start - b.start);

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
