import { http } from "@/services/api/request";
import { listSiteMusicTasks, querySiteMusicTask, projectMusicTask, projectAdminMusicTask } from "./music-site-api";
import type { GenerationTask } from "@/services/api/task-center";

export type AudioFormat = "mp3" | "wav" | "flac";

export type ModelCapabilities = {
    channelId?: string;
    modelKey?: string;
    lyricsSupported?: boolean;
    instrumentalSupported?: boolean;
    titleSupported?: boolean;
    styleSupported?: boolean;
    durationSupported?: boolean;
    outputCount?: number;
    billingMode?: string;
    id: string;
    name: string;
    version: string;
    modes: ("simple" | "custom")[];
    minDuration: number;
    maxDuration: number;
    formats: AudioFormat[];
    maxPromptChars: number;
    maxLyricsChars: number;
    costPerSecondMicrocredits: number;
    vocalGenders?: string[];
    stemSeparation: boolean;
    supportedStems?: string[];
    tempoBpmRange?: [number, number];
    keySignatures?: string[];
    synthIdWatermarking?: boolean;
    continuationSupported?: boolean;
    highFidelityVocal?: boolean;
    available: boolean;
    unavailableReason?: string;
};

export type MusicTask = {
    outputs?: MusicOutput[];
    mediaStage?: string;
    canRecoverMedia?: boolean;
    id: string;
    userId: string;
    taskId: string;
    upstreamTaskId?: string;
    model: string;
    mode: "simple" | "custom";
    prompt: string;
    title?: string;
    lyrics?: string;
    tags?: string;
    songLanguage?: string;
    instrumental: boolean;
    durationTargetSeconds: number;
    status: "submitted" | "queued" | "generating" | "transcoding" | "completed" | "failed" | "cancelled";
    stage: string;
    resultAudioUrl?: string;
    resultStorageKey?: string;
    resultDurationMs?: number;
    format?: AudioFormat;
    stemsJson?: string;
    billingOrderId?: string;
    microcreditsCost?: number;
    billingStatus?: string;
    refundedMicrocredits?: number;
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
};

export type MusicOutput = {
    id: string;
    outputIndex: number;
    audioUrl?: string;
    storageKey?: string;
    adminResourceId?: string;
    durationMs?: number;
    bytes?: number;
    mimeType?: string;
    format?: AudioFormat;
};

export type SubmitMusicTaskPayload = {
    quotedMicrocredits?: number;
    model: string;
    mode: "simple" | "custom";
    prompt: string;
    title?: string;
    lyrics?: string;
    tags?: string;
    songLanguage?: string;
    instrumental?: boolean;
    duration?: number;
    format?: AudioFormat;
    vocalGender?: string;
    tempoBpm?: number;
    keySignature?: string;
    synthIdWatermark?: boolean;
    stems?: string[];
    continuationClipId?: string;
    idempotencyNonce: string;
};

export type AdminMusicConfig = {
    baseUrl: string;
    hasApiKey: boolean;
    maskedApiKey: string;
    hasWebhookSecret: boolean;
    defaultModel: string;
    modelPricing: Record<string, { enabled: boolean; costPerSecondMicrocredits: number }>;
    updatedAt: string;
    updatedBy?: string;
};

export type MusicLifecycleInfo = {
    state: "installed" | "enabled" | "draining" | "disabled" | "updating" | "error" | "uninstalled";
    activeTasks: number;
    isDraining: boolean;
    updatedAt: string;
    updatedBy?: string;
};

// Client API functions
export async function fetchMusicCapabilities(): Promise<ModelCapabilities[]> {
    return http.get<ModelCapabilities[]>("/v1/supdance/music/capabilities");
}

export async function submitMusicTask(payload: SubmitMusicTaskPayload): Promise<{ taskId: string; status: string }> {
    return http.post<{ taskId: string; status: string }>("/v1/supdance/music/tasks", payload);
}

export async function queryMusicTask(taskId: string): Promise<MusicTask> {
    return querySiteMusicTask(taskId);
}

export async function queryAdminMusicTask(taskId: string): Promise<MusicTask> {
    return querySiteMusicTask(taskId, true);
}

export async function listUserMusicTasks(page = 1, pageSize = 20): Promise<{ items: MusicTask[]; total: number; page: number; pageSize: number }> {
    return listSiteMusicTasks(page, pageSize);
}

export function getAudioDownloadUrl(taskId: string, format: AudioFormat = "mp3"): string {
    const backendUrl = import.meta.env.VITE_CANVAS_BACKEND_URL || "/api";
    return `${backendUrl}/v1/supdance/music/tasks/${encodeURIComponent(taskId)}/download?format=${encodeURIComponent(format)}`;
}

// Admin API functions
export async function fetchMusicAdminOverview(): Promise<MusicLifecycleInfo> {
    return http.get<MusicLifecycleInfo>("/admin/plugins/music-generation/overview");
}

export async function recoverMusicAdminTest(logId: string): Promise<MusicTask> {
    const task = await http.post<GenerationTask>("/admin/plugins/music-generation/tasks/recover", { logId });
    return projectMusicTask(task);
}

export async function setMusicPluginLifecycle(state: MusicLifecycleInfo["state"]): Promise<MusicLifecycleInfo> {
    return http.post<MusicLifecycleInfo>("/admin/plugins/music-generation/lifecycle", { state });
}

export async function fetchMusicAdminConfig(): Promise<AdminMusicConfig> {
    return http.get<AdminMusicConfig>("/admin/plugins/music-generation/config");
}

export async function updateMusicAdminConfig(payload: Partial<AdminMusicConfig> & { apiKey?: string; webhookSecret?: string }): Promise<AdminMusicConfig> {
    return http.put<AdminMusicConfig>("/admin/plugins/music-generation/config", payload);
}

export async function testMusicConnection(apiKey?: string): Promise<{ status: string; code: number; message: string; endpoint: string; billed: boolean }> {
    return http.post<{ status: string; code: number; message: string; endpoint: string; billed: boolean }>("/admin/plugins/music-generation/test-connection", { apiKey });
}

export async function listAdminMusicTasks(status?: string, page = 1, pageSize = 20): Promise<{ items: MusicTask[]; total: number; page: number; pageSize: number }> {
    const result = await http.get<{ items: GenerationTask[]; legacyItems?: MusicTask[]; total: number }>("/admin/plugins/music-generation/tasks", {
        params: { status, page, pageSize },
    });
    return { items: [...result.items, ...(result.legacyItems || [])].map(projectAdminMusicTask), total: result.total, page, pageSize };
}
