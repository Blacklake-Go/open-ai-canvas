import { useAssetStore } from "@/stores/use-asset-store";
import type { MusicTask } from "./music-api";

/**
 * 已同步入库的音乐任务集合（内存去重，防止重复轮询多次入库）
 */
const syncedTaskIds = new Set<string>();

/**
 * 音乐生成资产入库桥接服务：
 * 当音乐生成任务完成并产出音频 URL 时，自动入库至 SupDance 全局素材库（AssetStore），
 * 使得用户在平台“我的素材（/assets）”音频分类以及自由画布（Canvas）节点中可以直接拖拽和引用该配乐。
 */
export function syncMusicTaskToAssetStore(task: MusicTask): string | null {
    const taskId = task.taskId || task.id;
    if (!taskId) return null;

    // 仅在任务处于成功完成状态且有有效音频 URL 时执行入库
    if (task.status !== "completed" || !task.resultAudioUrl) {
        return null;
    }

    // 防止同一次会话多次轮询重复插入
    if (syncedTaskIds.has(taskId)) {
        return null;
    }

    const assetStore = useAssetStore.getState();

    // 检查素材库中是否已存在该任务对应的资产
    const exists = assetStore.assets.some(
        (asset) =>
            asset.kind === "audio" &&
            ("metadata" in asset && (asset.metadata as Record<string, unknown>)?.musicTaskId === taskId ||
             asset.data?.url === task.resultAudioUrl)
    );

    if (exists) {
        syncedTaskIds.add(taskId);
        return null;
    }

    const durationSeconds = task.resultDurationMs ? Math.round(task.resultDurationMs / 1000) : (task.durationTargetSeconds || 180);
    const format = task.format || "mp3";
    const mimeType = format === "wav" ? "audio/wav" : format === "flac" ? "audio/flac" : "audio/mpeg";

    const title = task.title?.trim() || (task.prompt ? task.prompt.slice(0, 30) : "AI 音乐作品");

    const assetId = assetStore.addAsset({
        kind: "audio",
        title,
        coverUrl: "",
        tags: ["AI音乐", task.model || "music", ...(task.tags ? task.tags.split(/[,，\s]+/).filter(Boolean) : [])],
        category: "material",
        status: "confirmed",
        data: {
            url: task.resultAudioUrl,
            durationMs: durationSeconds * 1000,
            bytes: 0,
            mimeType,
        },
        metadata: {
            musicTaskId: taskId,
            musicModel: task.model,
            musicPrompt: task.prompt,
            musicLyrics: task.lyrics,
            musicFormat: format,
            source: "music-generation-plugin",
        },
    } as any);

    syncedTaskIds.add(taskId);
    return assetId;
}

/**
 * 辅助检查某个任务是否已被素材库同步
 */
export function isMusicTaskSynced(taskId: string): boolean {
    return syncedTaskIds.has(taskId);
}

/**
 * 清除同步记录缓存（主要用于测试重置）
 */
export function resetSyncedTaskCache(): void {
    syncedTaskIds.clear();
}
