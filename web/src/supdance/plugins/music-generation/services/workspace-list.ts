import type { MusicTask } from "./music-api";

export function groupMusicHistory(tasks: MusicTask[], query: string, filter: string, oldestFirst: boolean, favorites: ReadonlySet<string>, locale: string) {
    const queryText = query.trim().toLocaleLowerCase(locale);
    const visible = tasks.filter((task) => {
        const generating = ["submitted", "queued", "generating", "transcoding"].includes(task.status);
        const status = generating ? "generating" : task.status;
        if (filter === "favorites") {
            if (!task.outputs?.some((output) => favorites.has(output.id))) return false;
        } else if (filter === "instrumental") {
            if (!task.instrumental) return false;
        } else if (filter !== "all" && filter !== status) return false;
        return [task.title, task.model, task.prompt, task.tags, task.lyrics].filter(Boolean).join(" ").toLocaleLowerCase(locale).includes(queryText);
    });
    visible.sort((a, b) => (Date.parse(b.createdAt) - Date.parse(a.createdAt)) * (oldestFirst ? -1 : 1));
    const days = new Map<string, MusicTask[]>();
    const formatter = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" });
    for (const task of visible) {
        const date = new Date(task.createdAt);
        const day = Number.isFinite(date.valueOf()) ? formatter.format(date) : "—";
        if (!days.has(day)) days.set(day, []);
        days.get(day)!.push(task);
    }
    return days;
}
