import { http } from "@/services/api/request";
import type { MusicCoverModel } from "./music-api";

export type MusicCoverView = { status: "none" | "pending" | "ready" | "failed"; storageKey?: string };

type MusicCoverOptions = {
    enabled: boolean;
    defaultModel: string;
    models: MusicCoverModel[];
    allowUpload: boolean;
    maxUploadBytes: number;
    maxDimension: number;
};

const coverUrl = (taskId: string) => `/v1/supdance/music/tasks/${encodeURIComponent(taskId)}/cover`;

export function getMusicCoverOptions(signal?: AbortSignal) {
    return http.get<MusicCoverOptions>("/v1/supdance/music/cover-config", { signal });
}

export function getMusicCover(taskId: string, signal?: AbortSignal) {
    return http.get<MusicCoverView>(coverUrl(taskId), { signal });
}

export function generateMusicCover(userId: string, taskId: string, model: MusicCoverModel, nonce: string) {
    return http.post<MusicCoverView>(coverUrl(taskId) + "/regenerate", { model: model.id, quotedMicrocredits: model.quoteMicrocredits, nonce }, { headers: { "X-Canvas-Expected-User": userId } });
}

export function attachMusicCover(userId: string, taskId: string, resourceId: string) {
    return http.put<MusicCoverView>(coverUrl(taskId), { resourceId }, { headers: { "X-Canvas-Expected-User": userId } });
}
