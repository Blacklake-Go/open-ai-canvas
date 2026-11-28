export function musicLyricTimeline(lyrics: string, duration: number) {
    const lines = lyrics
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
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
