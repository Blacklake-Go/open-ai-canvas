import { parseBackendGenerationResult } from "@/services/api/generation-task";
import type { GenerationTask } from "@/services/api/task-center";
import { getResourceAccess, resolveResourceAccessURL, resolveResourceUrl } from "@/services/api/resources";
import { http, apiBaseURL } from "@/services/api/request";
import type { LogicalModelQuote } from "@/services/api/logical-models";
import type { MusicTask } from "./music-api";
import type { MusicOutput } from "./music-api";
import { downloadBrowserMedia } from "@/services/browser-download";
import { startBrowserDownload } from "@/services/browser-download";
import { adminResourceFileUrl } from "@/services/api/admin-storage";
import { resourceIdFromStorageKey } from "@/services/api/resources";

export async function downloadMusicOutput(output: MusicOutput, title: string) {
    const format = output.format || (output.mimeType?.split(";")[0] === "audio/mpeg" ? "mp3" : undefined);
    if (output.adminResourceId) {
        startBrowserDownload(adminResourceFileUrl(output.adminResourceId, true), title + (format ? "." + format : ""));
        return;
    }
    return downloadBrowserMedia({ storageKey: output.storageKey, url: output.audioUrl, fileName: title + (format ? "." + format : "") });
}

export async function siteMusicQuote(model: string, _duration = 0, signal?: AbortSignal) {
    return http.post<LogicalModelQuote>("/v1/supdance/music/quote", { model }, { signal });
}

export function projectSiteMusicTask(task: GenerationTask): MusicTask {
    const input = task.inputJson ? JSON.parse(task.inputJson) : {};
    const music = input.metadata?.music || {};
    const result = task.resultJson ? parseBackendGenerationResult(task) : undefined;
    const audio = result?.audio || result?.audios?.[0];
    const outputs = (result?.audios || (result?.audio ? [result.audio] : [])).map((item, index) => ({
        id: `${task.id}:${index}`,
        outputIndex: index,
        audioUrl: resolveResourceUrl(item.storageKey, item.dataUrl),
        storageKey: item.storageKey,
        durationMs: item.durationMs,
        bytes: item.bytes,
        mimeType: item.mimeType,
        format: (item.format || (item.mimeType?.split(";")[0] === "audio/mpeg" ? "mp3" : undefined)) as MusicTask["format"],
    }));
    return {
        outputs,
        upstreamTaskId: task.providerRequestId,
        mediaStage: task.mediaStage,
        canRecoverMedia: task.canRecoverMedia,
        id: task.id,
        taskId: task.id,
        userId: task.userId || "",
        model: task.model || "",
        mode: music.mode || (music.lyrics ? "custom" : "simple"),
        prompt: task.prompt,
        title: music.title || task.prompt.slice(0, 30),
        lyrics: music.lyrics,
        tags: music.style,
        songLanguage: music.songLanguage,
        instrumental: music.instrumental === true,
        durationTargetSeconds: Number(music.duration) || 0,
        format: outputs[0]?.format,
        resultAudioUrl: audio ? resolveResourceUrl(audio.storageKey, audio.dataUrl) : undefined,
        resultStorageKey: audio?.storageKey,
        resultDurationMs: audio?.durationMs,
        status: task.status === "succeeded" ? "completed" : task.status === "running" ? "generating" : task.status,
        stage: task.stage || "",
        microcreditsCost: task.billing?.chargedMicrocredits,
        billingStatus: task.billing?.status || (music.billingOrigin === "legacy-admin-test" ? "legacy_admin_test" : undefined),
        refundedMicrocredits: task.billing?.refundedMicrocredits,
        errorMessage: task.error,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
    };
}

export function projectMusicTask(task: GenerationTask | MusicTask): MusicTask {
    if ("type" in task) return projectSiteMusicTask(task);
    const legacy = { ...task };
    if (!legacy.outputs?.length && legacy.resultAudioUrl && legacy.status === "completed") {
        legacy.outputs = [
            {
                id: `${legacy.taskId}:0`,
                outputIndex: 0,
                durationMs: legacy.resultDurationMs,
                format: legacy.format,
                audioUrl: `${apiBaseURL}/v1/supdance/music/tasks/${encodeURIComponent(legacy.taskId)}/download?format=${encodeURIComponent(legacy.format || "mp3")}`,
            },
        ];
    }
    return legacy;
}

export function projectAdminMusicTask(task: GenerationTask | MusicTask): MusicTask {
    const projected = projectMusicTask(task);
    projected.outputs = (projected.outputs || []).map((output) => {
        const id = resourceIdFromStorageKey(output.storageKey);
        return id ? { ...output, adminResourceId: id, audioUrl: adminResourceFileUrl(id) } : { ...output };
    });
    projected.resultAudioUrl = projected.outputs?.[0]?.audioUrl;
    return projected;
}

async function accessibleMusicTask(task: GenerationTask | MusicTask) {
    const projected = projectMusicTask(task);
    await Promise.all(
        (projected.outputs || []).map(async (output) => {
            if (!output.storageKey) return;
            try {
                const access = await getResourceAccess(output.storageKey, "display");
                output.audioUrl = resolveResourceAccessURL(access.url);
            } catch {
                output.audioUrl = undefined;
                projected.errorMessage = "Audio resource is unavailable";
                console.warn("Music resource access unavailable", task.id);
            }
        }),
    );
    projected.resultAudioUrl = projected.outputs?.[0]?.audioUrl;
    return projected;
}

export async function querySiteMusicTask(taskId: string, admin = false) {
    const task = await http.get<GenerationTask | MusicTask>(`/v1/supdance/music/tasks/${encodeURIComponent(taskId)}`);
    return admin ? projectAdminMusicTask(task) : accessibleMusicTask(task);
}

export async function listSiteMusicTasks(page: number, pageSize: number) {
    const response = await http.get<{ items: GenerationTask[]; legacyItems?: MusicTask[]; total: number }>("/v1/supdance/music/tasks", { params: { page, pageSize } });
    const items = await Promise.all([...response.items, ...(response.legacyItems || [])].map(accessibleMusicTask));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { items, total: response.total, page, pageSize };
}
