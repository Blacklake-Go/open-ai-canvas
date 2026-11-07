import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import * as scope from "@/lib/user-scope";
import * as resources from "@/services/api/resources";
import * as userData from "@/services/api/user-data";
import { useUserStore } from "@/stores/use-user-store";
import * as musicApi from "@/supdance/plugins/music-generation/services/music-api";
import { canLocateMusicAsset, getMusicAssetHref, saveMusicClip } from "@/supdance/plugins/music-generation/services/music-assets";
import { projectSiteMusicTask } from "@/supdance/plugins/music-generation/services/music-site-api";

const user = { id: "owner", username: "owner", displayName: "Owner", role: "user" as const, status: "active" as const, createdAt: "", updatedAt: "" };
const outputs = [0, 1].map((index) => ({ id: `task:${index}`, outputIndex: index, storageKey: `resource:audio-${index}` }));
const task: musicApi.MusicTask = {
    id: "task",
    taskId: "task",
    userId: user.id,
    status: "completed",
    mode: "simple",
    model: "music",
    stage: "",
    prompt: "Acoustic trio",
    durationTargetSeconds: 30,
    instrumental: true,
    outputs,
    createdAt: "",
    updatedAt: "",
};
const wav = new Blob([new Uint8Array(100)], { type: "audio/wav" });
const interval = { start: 1.5, end: 3.8 };
const remote: resources.RemoteResource = {
    id: "clip-resource",
    kind: "audio",
    userId: user.id,
    status: "ready",
    mimeType: "audio/wav",
    size: wav.size,
    provider: "",
    endpoint: "",
    bucket: "",
    objectKey: "",
    publicUrl: "",
    createdAt: "",
    updatedAt: "",
};

describe("per-output music asset actions", () => {
    const previousUser = useUserStore.getState().user;
    beforeEach(() => {
        useUserStore.getState().setUser(user);
        spyOn(scope, "getActiveUserScope").mockReturnValue(user.id);
    });
    afterEach(() => {
        mock.restore();
        useUserStore.getState().setUser(previousUser);
    });

    test("deep-links to the server materialized ID of each take without creating assets", async () => {
        const projected = projectSiteMusicTask({
            id: "task",
            userId: user.id,
            type: "canvas_audio",
            status: "succeeded",
            prompt: "Acoustic trio",
            attempts: 1,
            createdAt: "",
            updatedAt: "",
        });
        expect(projected.userId).toBe(user.id);
        for (const output of outputs) {
            const hash = createHash("sha256").update(`materialize:task:${output.outputIndex}`).digest("hex");
            expect(await getMusicAssetHref(task, output)).toBe(`/assets?assetId=generation_${hash}`);
        }
        expect(canLocateMusicAsset({ ...outputs[0], storageKey: undefined })).toBe(false);
        expect(canLocateMusicAsset({ ...outputs[0], adminResourceId: "audio-0" })).toBe(false);
        await expect(getMusicAssetHref(task, { ...outputs[1], outputIndex: 0 })).rejects.toThrow();
    });

    test("saves a trimmed second take as a separate remote asset and preserves an existing copy on retry", async () => {
        spyOn(musicApi, "queryMusicTask").mockResolvedValue(task);
        const lookup = spyOn(userData, "getRemoteAssetsByIds").mockResolvedValue({ assets: [] });
        const upload = spyOn(resources, "uploadResourceFile").mockResolvedValue(remote);
        const publish = spyOn(userData, "upsertRemoteAsset").mockImplementation(async (asset) => ({ asset }));
        const saved = await saveMusicClip(task, outputs[1], wav, interval);
        expect(saved.href).not.toBe(await getMusicAssetHref(task, outputs[1]));
        expect(upload).toHaveBeenCalledWith(wav, "audio", expect.objectContaining({ idempotencyKey: saved.id, durationMs: 2300 }));
        const asset = publish.mock.calls[0][0];
        expect(asset).toMatchObject({
            id: saved.id,
            kind: "audio",
            data: { storageKey: "resource:clip-resource", durationMs: 2300 },
            metadata: { taskId: "task", outputIndex: 1, startMs: 1500, endMs: 3800 },
        });
        lookup.mockResolvedValue({ assets: [{ ...asset, title: "User edit" }] });
        expect(await saveMusicClip(task, outputs[1], wav, interval)).toEqual(saved);
        expect(upload).toHaveBeenCalledTimes(1);
        expect(publish).toHaveBeenCalledTimes(1);
    });

    test("rejects another account's current or legacy task, unavailable takes and invalid ranges before upload", async () => {
        const read = spyOn(musicApi, "queryMusicTask").mockResolvedValue({ ...task, userId: "different-owner" });
        const upload = spyOn(resources, "uploadResourceFile").mockResolvedValue(remote);
        await expect(saveMusicClip(task, outputs[1], wav, interval)).rejects.toThrow();
        read.mockResolvedValue({ ...task, outputs: [outputs[0]] });
        await expect(saveMusicClip(task, outputs[1], wav, interval)).rejects.toThrow();
        await expect(saveMusicClip(task, outputs[0], wav, { start: 3, end: 2 })).rejects.toThrow();
        expect(upload).not.toHaveBeenCalled();
    });

    test("does not publish after an account switch during upload or when storage refuses the upload", async () => {
        spyOn(musicApi, "queryMusicTask").mockResolvedValue(task);
        spyOn(userData, "getRemoteAssetsByIds").mockResolvedValue({ assets: [] });
        const publish = spyOn(userData, "upsertRemoteAsset");
        const upload = spyOn(resources, "uploadResourceFile").mockRejectedValue(new Error("quota"));
        await expect(saveMusicClip(task, outputs[1], wav, interval)).rejects.toThrow("quota");
        upload.mockImplementation(async () => {
            useUserStore.getState().setUser(null);
            return remote;
        });
        await expect(saveMusicClip(task, outputs[1], wav, interval)).rejects.toThrow();
        expect(publish).not.toHaveBeenCalled();
    });

    test("a retry following a failed metadata write uses the same upload identity and asset ID", async () => {
        spyOn(musicApi, "queryMusicTask").mockResolvedValue(task);
        spyOn(userData, "getRemoteAssetsByIds").mockResolvedValue({ assets: [] });
        const upload = spyOn(resources, "uploadResourceFile").mockResolvedValue(remote);
        const publish = spyOn(userData, "upsertRemoteAsset")
            .mockRejectedValueOnce(new Error("disconnected"))
            .mockImplementation(async (asset) => ({ asset }));
        await expect(saveMusicClip(task, outputs[1], wav, interval)).rejects.toThrow("disconnected");
        const result = await saveMusicClip(task, outputs[1], wav, interval);
        expect(upload.mock.calls.map((args) => args[2]?.idempotencyKey)).toEqual([result.id, result.id]);
        expect(publish.mock.calls.map(([asset]) => asset.id)).toEqual([result.id, result.id]);
    });
});
