import { describe, expect, it, beforeEach } from "bun:test";
import { useAssetStore } from "@/stores/use-asset-store";
import { syncMusicTaskToAssetStore, resetSyncedTaskCache } from "@/supdance/plugins/music-generation/services/music-asset-bridge";
import type { MusicTask } from "@/supdance/plugins/music-generation/services/music-api";

describe("Music Asset Ingestion Bridge Suite", () => {
    beforeEach(() => {
        resetSyncedTaskCache();
        useAssetStore.setState({ assets: [] });
    });

    it("successfully ingests a completed music task into global AssetStore as kind audio", () => {
        const completedTask: MusicTask = {
            id: "task_test_001",
            taskId: "task_test_001",
            userId: "user_123",
            model: "suno-v6",
            mode: "simple",
            stage: "done",
            instrumental: false,
            prompt: "A beautiful cinematic soundtrack for modern drama",
            title: "星际梦境 (Interstellar Dream)",
            tags: "cinematic, orchestral, ambient",
            status: "completed",
            durationTargetSeconds: 180,
            resultDurationMs: 182000,
            resultAudioUrl: "https://www.koyosim.com/files/audio/test_001.mp3",
            format: "mp3",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const assetId = syncMusicTaskToAssetStore(completedTask);
        expect(assetId).not.toBeNull();

        const assets = useAssetStore.getState().assets;
        expect(assets).toHaveLength(1);

        const asset = assets[0];
        expect(asset.id).toBe(assetId!);
        expect(asset.kind).toBe("audio");
        expect(asset.title).toBe("星际梦境 (Interstellar Dream)");
        expect(asset.category).toBe("material");
        expect(asset.data).toBeDefined();
        if (asset.kind === "audio") {
            expect(asset.data.url).toBe("https://www.koyosim.com/files/audio/test_001.mp3");
            expect(asset.data.durationMs).toBe(182000);
            expect(asset.data.mimeType).toBe("audio/mpeg");
        }
        expect((asset as any).metadata?.musicTaskId).toBe("task_test_001");
        expect((asset as any).metadata?.musicModel).toBe("suno-v6");
    });

    it("prevents duplicate ingestion for the same task", () => {
        const task: MusicTask = {
            id: "task_test_002",
            taskId: "task_test_002",
            userId: "user_123",
            model: "mureka-9.5",
            mode: "simple",
            stage: "done",
            instrumental: false,
            durationTargetSeconds: 180,
            prompt: "Cyberpunk beat",
            status: "completed",
            resultAudioUrl: "https://www.koyosim.com/files/audio/test_002.mp3",
            format: "mp3",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const firstId = syncMusicTaskToAssetStore(task);
        expect(firstId).not.toBeNull();

        // Second call should return null (idempotency guard)
        const secondId = syncMusicTaskToAssetStore(task);
        expect(secondId).toBeNull();

        expect(useAssetStore.getState().assets).toHaveLength(1);
    });

    it("rejects incomplete or failed music tasks from asset store", () => {
        const runningTask: MusicTask = {
            id: "task_test_003",
            taskId: "task_test_003",
            userId: "user_123",
            model: "lyria-3.5",
            mode: "simple",
            stage: "generating",
            instrumental: false,
            durationTargetSeconds: 180,
            prompt: "Ambient piano",
            status: "generating",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const assetId = syncMusicTaskToAssetStore(runningTask);
        expect(assetId).toBeNull();
        expect(useAssetStore.getState().assets).toHaveLength(0);
    });
});
