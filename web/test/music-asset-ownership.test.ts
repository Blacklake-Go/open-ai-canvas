import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { useAssetStore } from "@/stores/use-asset-store";
import { useMusicStore } from "@/supdance/plugins/music-generation/stores/use-music-store";
import * as musicApi from "@/supdance/plugins/music-generation/services/music-api";

const completedTask: musicApi.MusicTask = {
    id: "server-owned-music-task",
    taskId: "server-owned-music-task",
    userId: "music-owner",
    model: "mureka-v7.6",
    mode: "simple",
    prompt: "Original music",
    instrumental: false,
    durationTargetSeconds: 30,
    resultDurationMs: 100258,
    resultStorageKey: "resource:server-owned-audio",
    resultAudioUrl: "https://audio.example.test/private-music.mp3",
    status: "completed",
    stage: "done",
    createdAt: "2026-11-05T00:00:00Z",
    updatedAt: "2026-11-05T00:00:00Z",
};

describe("platform music asset ownership", () => {
    let previousMusic: ReturnType<typeof useMusicStore.getState>;
    let previousAssets: ReturnType<typeof useAssetStore.getState>;
    let assetWrites = 0;
    let restoreTaskList = () => {};
    let listedTasks: musicApi.MusicTask[] = [];

    beforeEach(() => {
        previousMusic = useMusicStore.getState();
        previousAssets = useAssetStore.getState();
        useMusicStore.getState().resetUser();
        assetWrites = 0;
        listedTasks = [completedTask];
        useAssetStore.setState({
            assets: [],
            addAsset: () => {
                assetWrites += 1;
                return "unexpected-client-copy";
            },
        });
        const taskList = spyOn(musicApi, "listUserMusicTasks").mockImplementation(async () => ({ items: listedTasks, total: listedTasks.length, page: 1, pageSize: 50 }));
        restoreTaskList = () => taskList.mockRestore();
    });

    afterEach(() => {
        useMusicStore.getState().resetUser();
        restoreTaskList();
        useMusicStore.setState(previousMusic, true);
        useAssetStore.setState(previousAssets, true);
    });

    test("completed platform history stays playable before the asset catalog hydrates without creating a copy", async () => {
        await useMusicStore.getState().loadTasks();
        expect(useMusicStore.getState().tasks).toEqual([completedTask]);
        expect(useMusicStore.getState().activeTrack?.resultStorageKey).toBe(completedTask.resultStorageKey);
        expect(useMusicStore.getState().activeTrack?.resultAudioUrl).toBe(completedTask.resultAudioUrl);
        expect(assetWrites).toBe(0);
    });

    test("reloading history after account state resets never creates client asset records", async () => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            useMusicStore.getState().resetUser();
            useAssetStore.setState({ assets: [] });
            await useMusicStore.getState().loadTasks();
            expect(useMusicStore.getState().activeTrackId).toBe(completedTask.taskId);
        }
        expect(assetWrites).toBe(0);
        expect(useAssetStore.getState().assets).toEqual([]);
    });

    test("polling a completed platform task updates playback without creating another asset", async () => {
        const polledTask = { ...completedTask, id: "server-owned-polled-task", taskId: "server-owned-polled-task" };
        listedTasks = [{ ...polledTask, status: "queued", resultAudioUrl: undefined, resultStorageKey: undefined }];
        let poll = () => {};
        const interval = spyOn(globalThis, "setInterval").mockImplementation((callback) => {
            poll = () => {
                if (typeof callback === "function") callback();
            };
            return setTimeout(() => {}, 60000);
        });
        const query = spyOn(musicApi, "queryMusicTask").mockResolvedValue(polledTask);
        try {
            await useMusicStore.getState().loadTasks();
            expect(useMusicStore.getState().activeTaskIds.has(polledTask.taskId)).toBe(true);
            poll();
            await Promise.resolve();
            expect(query).toHaveBeenCalledWith(polledTask.taskId);
            expect(useMusicStore.getState().activeTaskIds.size).toBe(0);
            expect(useMusicStore.getState().activeTrack?.resultStorageKey).toBe(polledTask.resultStorageKey);
            expect(assetWrites).toBe(0);
        } finally {
            useMusicStore.getState().resetUser();
            query.mockRestore();
            interval.mockRestore();
        }
    });
});
