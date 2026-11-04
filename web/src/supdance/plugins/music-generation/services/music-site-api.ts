import { configuredModelDisplayName } from "@/lib/model-selection";
import { modelQuoteRequest } from "@/lib/model-pricing";
import { quoteModel } from "@/services/api/logical-models";
import { parseBackendGenerationResult, submitBackendGenerationTask } from "@/services/api/generation-task";
import { listGenerationTasks, queryGenerationTask, type GenerationTask } from "@/services/api/task-center";
import { getResourceAccess, resolveResourceAccessURL, resolveResourceUrl } from "@/services/api/resources";
import { modelOptionName, resolveModelChannel, selectableModelsByCapability, useConfigStore, type AiConfig } from "@/stores/use-config-store";
import type { ModelCapabilities, MusicTask, SubmitMusicTaskPayload } from "./music-api";

export function siteMusicModels(config: AiConfig): ModelCapabilities[] {
    return [...new Set(selectableModelsByCapability(config, "audio"))].flatMap((id) => {
        const channel = resolveModelChannel(config, id);
        const cost = channel.modelCosts?.find((item) => item.model === modelOptionName(id));
        if (channel.scope !== "system" || !cost || !/suno|mureka|music/i.test(`${cost.displayName} ${cost.model} ${cost.protocol}`) || /speech|tts/i.test(cost.model)) return [];
        return [
            {
                id,
                name: configuredModelDisplayName(config, id),
                version: "",
                modes: ["simple", "custom"],
                minDuration: 30,
                maxDuration: 300,
                formats: ["mp3"],
                maxPromptChars: 1500,
                maxLyricsChars: 3000,
                costPerSecondMicrocredits: 0,
                stemSeparation: false,
                available: cost.available !== false,
            },
        ];
    });
}

export async function siteMusicQuote(model: string, duration: number, signal?: AbortSignal) {
    const request = modelQuoteRequest(useConfigStore.getState().config, model, "audio", { options: { duration }, videoSeconds: String(duration) });
    if (!request) throw new Error("Music model is not configured for platform billing");
    return (await quoteModel(request, signal)).quote;
}

export async function submitSiteMusicTask(payload: SubmitMusicTaskPayload) {
    const config = useConfigStore.getState().config;
    if (!siteMusicModels(config).some((model) => model.id === payload.model && model.available)) throw new Error("Music model is unavailable");
    const task = await submitBackendGenerationTask({
        mode: "audio",
        prompt: [payload.prompt, payload.tags].filter(Boolean).join("\n"),
        config: { ...config, model: payload.model, audioModel: payload.model, audioFormat: "mp3" },
        clientOperationId: payload.idempotencyNonce,
        metadata: { source: "music-workbench", music: { title: payload.title, lyrics: payload.lyrics || "", instrumental: payload.instrumental === true, duration: payload.duration } },
    });
    return { taskId: task.id, status: task.status };
}

export function projectSiteMusicTask(task: GenerationTask): MusicTask {
    const input = task.inputJson ? JSON.parse(task.inputJson) : {};
    const music = input.metadata?.music || {};
    const result = task.status === "succeeded" ? parseBackendGenerationResult(task) : undefined;
    const audio = result?.audio || result?.audios?.[0];
    return {
        id: task.id,
        taskId: task.id,
        userId: "",
        model: task.model || "",
        mode: music.lyrics ? "custom" : "simple",
        prompt: task.prompt,
        title: music.title || task.prompt.slice(0, 30),
        lyrics: music.lyrics,
        instrumental: music.instrumental === true,
        durationTargetSeconds: Number(music.duration) || 0,
        format: "mp3",
        resultAudioUrl: audio ? resolveResourceUrl(audio.storageKey, audio.dataUrl) : undefined,
        resultStorageKey: audio?.storageKey,
        resultDurationMs: audio?.durationMs,
        status: task.status === "succeeded" ? "completed" : task.status === "running" ? "generating" : task.status,
        stage: task.stage || "",
        microcreditsCost: task.billing?.chargedMicrocredits,
        billingStatus: task.billing?.status,
        refundedMicrocredits: task.billing?.refundedMicrocredits,
        errorMessage: task.error,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
    };
}

async function accessibleMusicTask(task: GenerationTask) {
    const projected = projectSiteMusicTask(task);
    if (projected.resultStorageKey) {
        try {
            const access = await getResourceAccess(projected.resultStorageKey, "display");
            projected.resultAudioUrl = resolveResourceAccessURL(access.url);
        } catch {
            projected.resultAudioUrl = undefined;
            projected.errorMessage = "Audio resource is unavailable";
            console.warn("Music resource access unavailable", task.id);
        }
    }
    return projected;
}

export async function querySiteMusicTask(taskId: string) {
    return accessibleMusicTask(await queryGenerationTask(taskId));
}

export async function listSiteMusicTasks(page: number, pageSize: number, dependencies = { listTasks: listGenerationTasks, queryTask: queryGenerationTask }) {
    const tasks = (await dependencies.listTasks(1000)).filter((task) => task.type === "canvas_audio" && /suno|mureka|music/i.test(task.model || ""));
    const items = await Promise.all(tasks.slice((page - 1) * pageSize, page * pageSize).map(async (summary) => accessibleMusicTask(await dependencies.queryTask(summary.id))));
    return { items, total: tasks.length, page, pageSize };
}
