import { translate } from "@/i18n";
import { accountFileStorageUsageQueryKey } from "@/lib/account-storage-usage";
import { appQueryClient } from "@/lib/query-client";
import { getActiveUserScope } from "@/lib/user-scope";
import { resourceFileUrl, resourceIdFromStorageKey, resourceStorageKey, uploadResourceFile } from "@/services/api/resources";
import { getRemoteAssetsByIds, upsertRemoteAsset } from "@/services/api/user-data";
import { materializeEffectKey } from "@/services/generation-task-materializer";
import { generationAssetId } from "@/stores/use-asset-store";
import { useUserStore } from "@/stores/use-user-store";
import { queryMusicTask, type MusicOutput, type MusicTask } from "./music-api";

function assetHref(id: string) {
    return `/assets?${new URLSearchParams({ assetId: id })}`;
}

function assertOwner(owner: string | undefined) {
    if (!owner) throw new Error(translate("errors.reason.unauthorized"));
    if (owner !== useUserStore.getState().user?.id || owner !== getActiveUserScope()) throw new Error(translate("library.assets.accountSwitched"));
}

function requireOutput(task: MusicTask, output: MusicOutput) {
    const match = task.outputs?.find((item) => item.id === output.id && item.outputIndex === output.outputIndex);
    if (task.status !== "completed" || !match || match.adminResourceId || output.adminResourceId || match.storageKey !== output.storageKey || !Number.isInteger(output.outputIndex) || output.outputIndex < 0) {
        throw new Error(translate("library.assets.detailFailed"));
    }
}

export function canLocateMusicAsset(output: MusicOutput) {
    return !output.adminResourceId && Boolean(resourceIdFromStorageKey(output.storageKey));
}

export async function getMusicAssetHref(task: MusicTask, output: MusicOutput) {
    requireOutput(task, output);
    if (!canLocateMusicAsset(output)) throw new Error(translate("library.assets.detailFailed"));
    // Same task and output key used by registerRecoveredMediaAssets on the server.
    return assetHref(await generationAssetId(materializeEffectKey(task.id, output.outputIndex)));
}

export async function saveMusicClip(task: MusicTask, output: MusicOutput, wav: Blob, range: { start: number; end: number }) {
    const owner = useUserStore.getState().user?.id;
    assertOwner(owner);
    const startMs = Math.round(range.start * 1000);
    const endMs = Math.round(range.end * 1000);
    if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs) || startMs < 0 || endMs <= startMs || wav.type !== "audio/wav" || wav.size <= 44) {
        throw new Error(translate("errors.requestFailed"));
    }
    requireOutput(task, output);
    // Re-read the signed-in user's task before publishing a derivative of its media.
    const fresh = await queryMusicTask(task.taskId);
    assertOwner(owner);
    if (fresh.userId !== owner || fresh.taskId !== task.taskId) throw new Error(translate("errors.reason.forbidden"));
    requireOutput(fresh, output);
    const id = await generationAssetId(JSON.stringify(["music-clip-v1", owner, fresh.taskId, output.outputIndex, output.storageKey, startMs, endMs]));
    const href = assetHref(id);
    assertOwner(owner);
    const existing = await getRemoteAssetsByIds([id]);
    assertOwner(owner);
    // Retrying a confirmed selection opens its existing copy and preserves user edits.
    if (existing.assets.some((asset) => asset.id === id)) return { id, href };

    const title = `${fresh.title || fresh.prompt.slice(0, 50) || fresh.taskId} · ${output.outputIndex + 1} · ${startMs / 1000}–${endMs / 1000}s`;
    const durationMs = endMs - startMs;
    const resource = await uploadResourceFile(wav, "audio", { idempotencyKey: id, durationMs, fileName: `${id}.wav` });
    assertOwner(owner);
    if (!resource.id || resource.userId !== owner || resource.kind !== "audio" || resource.status !== "ready") throw new Error(translate("library.assets.detailFailed"));
    const now = new Date().toISOString();
    const saved = await upsertRemoteAsset({
        id,
        title,
        kind: "audio",
        category: "material",
        status: "confirmed",
        coverUrl: "",
        tags: [],
        createdAt: now,
        updatedAt: now,
        data: { url: resourceFileUrl(resource.id), storageKey: resourceStorageKey(resource.id), durationMs, bytes: resource.size, mimeType: resource.mimeType },
        metadata: { source: "music-clip", taskId: fresh.taskId, outputIndex: output.outputIndex, startMs, endMs },
    });
    assertOwner(owner);
    if (saved.asset.id !== id) throw new Error(translate("library.assets.detailFailed"));
    void appQueryClient.invalidateQueries({ queryKey: ["asset-library", owner] });
    void appQueryClient.invalidateQueries({ queryKey: accountFileStorageUsageQueryKey });
    return { id, href };
}
