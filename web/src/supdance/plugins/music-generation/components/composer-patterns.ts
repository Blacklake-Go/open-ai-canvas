export const styleTemplates = [
    { id: "rain", genre: "score", use: "screen", bpm: 76, voice: "ballad", root: 62 },
    { id: "signal", genre: "electro", use: "opening", bpm: 124, voice: "pulse", root: 52 },
    { id: "amber", genre: "jazz", use: "stage", bpm: 92, voice: "swing", root: 57 },
    { id: "station", genre: "pop", use: "song", bpm: 86, voice: "pop", root: 60 },
    { id: "lamp", genre: "pop", use: "song", bpm: 68, voice: "ballad", root: 65 },
    { id: "jade", genre: "chinese", use: "song", bpm: 80, voice: "pluck", root: 62 },
    { id: "street", genre: "hiphop", use: "daily", bpm: 88, voice: "hop", root: 53 },
    { id: "wind", genre: "rock", use: "daily", bpm: 134, voice: "rock", root: 52 },
    { id: "orbit", genre: "score", use: "screen", bpm: 70, voice: "ambient", root: 48 },
    { id: "paper", genre: "folk", use: "daily", bpm: 100, voice: "folk", root: 55 },
    { id: "window", genre: "hiphop", use: "daily", bpm: 72, voice: "hop", root: 58 },
    { id: "skyline", genre: "electro", use: "stage", bpm: 126, voice: "club", root: 54 },
] as const;

export type StyleTemplate = (typeof styleTemplates)[number];

export function appendStyle(current: string, style: string, limit: number): string | null {
    if (!style.trim() || current.includes(style)) return current;
    const next = current + (current.trim() && !current.endsWith("\n") ? "\n" : "") + style;
    return Array.from(next).length > limit ? null : next;
}

export const lyricSections = ["Intro", "Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Bridge", "Instrumental", "Outro"];
export const songOutline = "[Verse 1]\n\n[Chorus]\n\n[Verse 2]\n\n[Bridge]\n\n[Chorus]\n\n[Outro]\n";

export function insertLyricSection(value: string, start: number, end: number, section: string, limit: number) {
    const before = value.slice(0, start);
    const insert = (before && !before.endsWith("\n") ? "\n" : "") + section;
    const lyrics = before + insert + value.slice(end);
    return Array.from(lyrics).length > limit ? null : { lyrics, caret: start + insert.length };
}
