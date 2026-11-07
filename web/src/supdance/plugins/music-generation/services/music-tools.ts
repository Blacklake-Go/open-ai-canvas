import { resourceIdFromStorageKey, type RemoteResource } from "@/services/api/resources";
import type { MusicOutput, MusicTask } from "./music-api";

export const musicOperations = ["persona", "reference", "remix", "stems", "region"] as const;
export type MusicOperation = (typeof musicOperations)[number];
export type MusicSource = { id: string; title: string; durationMs?: number; mimeType?: string; size?: number };
export function musicOutputLabel(output: MusicOutput, t: (key: string, params?: Record<string, string | number>) => string) {
    const stem = output.stemName?.trim();
    if (!stem) return t("music.track_number", { number: output.outputIndex + 1 });
    const normalized = stem.toLowerCase();
    if (["vocals", "vocal"].includes(normalized)) return t("music.adv_stem_vocals");
    if (["instrumental", "accompaniment"].includes(normalized)) return t("music.adv_stem_instrumental");
    return stem;
}
export type VoicePersona = { name: string; source: MusicSource; style: string };

export function trackSource(task: MusicTask, output: MusicOutput, variant: string): MusicSource | undefined {
    const id = resourceIdFromStorageKey(output.storageKey);
    return id && !output.adminResourceId
        ? { id, title: [task.title || task.prompt, variant].filter(Boolean).join(" · "), durationMs: output.durationMs, mimeType: output.mimeType || (output.format === "mp3" ? "audio/mpeg" : undefined), size: output.bytes }
        : undefined;
}
export function resourceSource(resource: RemoteResource, title: string, owner: string): MusicSource {
    if (resource.kind !== "audio" || resource.status !== "ready" || resource.userId !== owner) throw new Error("music.adv_no_source");
    return { id: resource.id, title, durationMs: resource.durationMs, mimeType: resource.mimeType, size: resource.size };
}
export function musicToolInputError(op: MusicOperation, source: MusicSource | undefined, prompt: string, lyrics: string, start: number, end: number): string {
    if (!source) return "music.adv_no_source";
    const mime = source.mimeType?.split(";")[0].toLowerCase();
    if (!mime || !["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/m4a"].includes(mime) || (source.size ?? 0) > 10_000_000) return "music.adv_source_format";
    const duration = source.durationMs ?? 0;
    if ((op === "persona" && duration < 15000) || (op === "reference" && duration < 30000) || (op === "remix" && (duration < 10000 || duration > 480000)) || (op === "region" && duration <= 0)) return "music.adv_source_duration";
    if (op === "region" && (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > duration || end - start < 3000)) return "music.adv_region_range";
    if (op !== "stems" && (!lyrics.trim() || [...lyrics].length > (op === "region" ? 3000 : 5000))) return "music.adv_lyrics";
    if ((op === "remix" && !prompt.trim()) || ((op === "remix" || op === "persona") && [...prompt].length > 1024)) return "music.adv_prompt";
    return "";
}

type Submission = { fingerprint: string; nonce: string };
const pending = new Map<string, Submission>();
export async function advancedSubmission(userId: string, request: object) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(request)));
    const fingerprint = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
    const key = "supdance:music:tool-receipt:" + userId;
    let previous = pending.get(key);
    try {
        previous ??= JSON.parse(sessionStorage.getItem(key) || "null") ?? undefined;
    } catch {
        /* in-memory retries remain available */
    }
    const item = previous?.fingerprint === fingerprint && previous.nonce ? previous : { fingerprint, nonce: crypto.randomUUID() };
    pending.set(key, item);
    try {
        sessionStorage.setItem(key, JSON.stringify(item));
    } catch {
        /* private browsing */
    }
    return {
        nonce: item.nonce,
        clear: () => {
            if (pending.get(key)?.nonce !== item.nonce) return;
            pending.delete(key);
            try {
                sessionStorage.removeItem(key);
            } catch {
                /* private browsing */
            }
        },
    };
}
