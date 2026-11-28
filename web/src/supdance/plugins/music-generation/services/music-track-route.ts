export const musicWorkbenchPath = "/toolbox/music";
export const musicLibraryPath = `${musicWorkbenchPath}?tab=library`;
export const musicTrackRoute = `${musicWorkbenchPath}/tracks/:taskId/:outputIndex`;

export type MusicTrackIdentity = { taskId: string; outputIndex: number };

export function musicTrackHref({ taskId, outputIndex }: MusicTrackIdentity) {
    return `${musicWorkbenchPath}/tracks/${encodeURIComponent(taskId)}/${outputIndex}`;
}

export function parseMusicOutputIndex(value: string | undefined) {
    if (!value || !/^(0|[1-9]\d*)$/.test(value)) return undefined;
    const index = Number(value);
    return Number.isSafeInteger(index) ? index : undefined;
}

export function resolveCreationMusicTrack(taskIds: string[], resultIndex: number, assetMetadata?: Record<string, unknown>): MusicTrackIdentity | undefined {
    const taskId = assetMetadata?.taskId;
    const outputIndex = assetMetadata?.outputIndex;
    if (typeof taskId === "string" && taskIds.includes(taskId) && typeof outputIndex === "number" && Number.isSafeInteger(outputIndex) && outputIndex >= 0) {
        return { taskId, outputIndex };
    }
    if (taskIds.length === 1 && resultIndex >= 0) return { taskId: taskIds[0], outputIndex: resultIndex };
    return undefined;
}
