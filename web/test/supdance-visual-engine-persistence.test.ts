import { afterEach, describe, expect, test } from "bun:test";
import { apiClient } from "../src/services/api/request";
import { useVisualEngineStore } from "../src/supdance/plugins/visual-engine/storage/visual-engine-store";
import { DEFAULT_VISUAL_ENGINE_CONFIG } from "../src/supdance/plugins/visual-engine/config/default-config";
import type { VisualEngineAdminOverview } from "../src/supdance/plugins/visual-engine/api/visual-engine-api";

const originalRequest = apiClient.request;
const baseline = structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG);
function overview(config = baseline): VisualEngineAdminOverview {
    return { bundle: { pluginId: "supdance-visual-engine", enabled: true, version: config.publishedVersion, config, revision: "server-revision" }, snapshots: [], auditLogs: [], draft: null, canPublish: true, canRollback: false };
}
afterEach(() => {
    apiClient.request = originalRequest;
});

describe("visual engine server persistence", () => {
    test("account reset rejects a late publication response", async () => {
        useVisualEngineStore.getState().acceptOverview(overview());
        let resolveRequest!: (value: unknown) => void;
        apiClient.request = (() =>
            new Promise((resolve) => {
                resolveRequest = resolve;
            })) as typeof apiClient.request;
        const pending = useVisualEngineStore.getState().publishDraft();
        useVisualEngineStore.getState().resetSession();
        const late = structuredClone(baseline);
        late.publishedVersion = "late-admin-version";
        resolveRequest({ data: { code: 0, msg: "ok", data: overview(late) }, status: 200 });
        expect((await pending).success).toBe(false);
        expect(useVisualEngineStore.getState().config.publishedVersion).toBe(baseline.publishedVersion);
        expect(useVisualEngineStore.getState().permissions).toEqual([]);
    });
    test("draft is isolated and publication only adopts a successful server response", async () => {
        useVisualEngineStore.getState().acceptOverview(overview());
        useVisualEngineStore.getState().updateDraft((draft) => {
            draft.components.buttonRadius = 18;
        });
        expect(useVisualEngineStore.getState().config.components.buttonRadius).toBe(baseline.components.buttonRadius);
        let called = false;
        apiClient.request = (async (options: { url: string; data: { expectedRevision: string; config: typeof baseline } }) => {
            called = true;
            expect(options.url).toBe("/admin/plugins/supdance-visual-engine/publish");
            expect(options.data.expectedRevision).toBe("server-revision");
            expect(useVisualEngineStore.getState().config.components.buttonRadius).toBe(baseline.components.buttonRadius);
            const config = structuredClone(options.data.config);
            config.publishedVersion = "server-release-1";
            return { data: { code: 0, msg: "ok", data: overview(config) }, status: 200 };
        }) as typeof apiClient.request;
        const result = await useVisualEngineStore.getState().publishDraft();
        expect(result.success).toBe(true);
        expect(called).toBe(true);
        expect(useVisualEngineStore.getState().config.publishedVersion).toBe("server-release-1");
        expect(useVisualEngineStore.getState().config.components.buttonRadius).toBe(18);
    });

    test("server rejects publication without changing the stable configuration or losing draft", async () => {
        useVisualEngineStore.getState().acceptOverview(overview());
        useVisualEngineStore.getState().updateDraft((draft) => {
            draft.components.buttonRadius = 16;
        });
        apiClient.request = (async () => ({ data: { code: 409, msg: "revision conflict", data: null }, status: 200 })) as typeof apiClient.request;
        const result = await useVisualEngineStore.getState().publishDraft();
        expect(result.success).toBe(false);
        expect(useVisualEngineStore.getState().config).toEqual(baseline);
        expect(useVisualEngineStore.getState().isDraftDirty).toBe(true);
        expect(useVisualEngineStore.getState().draftConfig.components.buttonRadius).toBe(16);
    });

    test("draft save never publishes and rollback uses the authenticated API", async () => {
        useVisualEngineStore.getState().acceptOverview(overview());
        const paths: string[] = [];
        apiClient.request = (async (options: { url: string }) => {
            paths.push(options.url);
            return { data: { code: 0, msg: "ok", data: options.url.endsWith("/draft") ? baseline : overview() }, status: 200 };
        }) as typeof apiClient.request;
        expect((await useVisualEngineStore.getState().saveDraft()).success).toBe(true);
        expect((await useVisualEngineStore.getState().rollbackToSnapshot("2.0.0")).success).toBe(true);
        expect(paths).toEqual(["/admin/plugins/supdance-visual-engine/draft", "/admin/plugins/supdance-visual-engine/rollback"]);
    });
});
