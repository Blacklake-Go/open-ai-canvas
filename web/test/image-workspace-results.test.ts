import { describe, expect, test } from "bun:test";
import { restoreHistoryMedia } from "@/services/creation-history-media";
import { imageTaskCardState, formatDateGroup } from "@/pages/workspace/image-workspace-timeline";
import { creationResultEntries } from "@/pages/create/creation-result-urls";
import { translate } from "@/i18n";
import type { CreationMessage } from "@/pages/create/creation-types";

const assistant = (extra: Partial<CreationMessage> = {}): CreationMessage => ({
    id: "m1",
    role: "assistant",
    mode: "image",
    content: "",
    createdAt: "2026-11-20T08:00:00Z",
    status: "done",
    ...extra,
});

describe("图片工作台结果恢复与状态判定（真实实现）", () => {
    test("restoreHistoryMedia 按 resultStorageKeys 重建展示地址，云端恢复的成功结果不再空 URL", () => {
        const restored = restoreHistoryMedia(assistant({ resultStorageKeys: ["resource:abc123", "resource:def456"] }));
        expect(restored.resultUrls).toHaveLength(2);
        expect(restored.resultUrls![0]).toContain("/resources/abc123/file");
        expect(restored.resultUrls![1]).toContain("/resources/def456/file");
    });

    test("restoreHistoryMedia 对非资源 key 保留原 URL hint，不改写本地素材消息", () => {
        const restored = restoreHistoryMedia(assistant({ resultStorageKeys: ["image:local-key"], resultUrls: ["blob:cached"] }));
        expect(restored.resultUrls).toEqual(["blob:cached"]);
        const untouched = restoreHistoryMedia(assistant({ resultUrls: ["https://example.com/a.png"] }));
        expect(untouched.resultUrls).toEqual(["https://example.com/a.png"]);
    });

    test("只有 storageKey 的恢复消息判为完成而不是失败", () => {
        const state = imageTaskCardState(assistant({ resultStorageKeys: ["resource:abc"] }));
        expect(state.isDone).toBe(true);
        expect(state.isError).toBe(false);
    });

    test("done 且无任何结果（URL 与 key 均空）仍判为错误", () => {
        const state = imageTaskCardState(assistant());
        expect(state.isDone).toBe(false);
        expect(state.isError).toBe(true);
    });

    test("syncInterrupted 不是失败：保持进行中并展示连接中断", () => {
        const state = imageTaskCardState(assistant({ status: "pending", syncInterrupted: true }));
        expect(state.isPending).toBe(true);
        expect(state.isInterrupted).toBe(true);
        expect(state.isError).toBe(false);
        // 即使误标 error，syncInterrupted 也优先按恢复中处理，避免诱导重复付费。
        const errored = imageTaskCardState(assistant({ status: "error", syncInterrupted: true }));
        expect(errored.isError).toBe(false);
    });

    test("后端确认失败（errorKind=task）判为错误，可重新生成", () => {
        const state = imageTaskCardState(assistant({ status: "error", errorKind: "task", error: "上游失败" }));
        expect(state.isError).toBe(true);
        expect(state.isInterrupted).toBe(false);
    });

    test("creationResultEntries 优先使用续签地址，过期 hint 不再交给图片元素", () => {
        const now = Date.now();
        const expiredHint = `https://cdn.example.com/a.png?expires=${Math.floor(now / 1000) - 60}`;
        const { entries } = creationResultEntries({
            storageKeys: ["resource:abc"],
            storedUrls: [expiredHint],
            resolvedByKey: { "resource:abc": "https://cdn.example.com/fresh.png" },
            failedByKey: {},
            isVideo: false,
            isRemoteKey: (key) => key.startsWith("resource:"),
            now,
        });
        expect(entries).toEqual([{ key: "resource:abc", url: "https://cdn.example.com/fresh.png" }]);
        const unresolved = creationResultEntries({
            storageKeys: ["resource:abc"],
            storedUrls: [expiredHint],
            resolvedByKey: {},
            failedByKey: {},
            isVideo: false,
            isRemoteKey: (key) => key.startsWith("resource:"),
            now,
        });
        expect(unresolved.entries).toEqual([]);
        expect(unresolved.resolving).toBe(true);
    });

    test("formatDateGroup 使用真实词典输出今天/昨天/更早与日期标签", () => {
        const t = (key: string, params?: Record<string, string | number>) => translate(key, params);
        const now = new Date();
        expect(formatDateGroup(now.toISOString(), t)).toBe("今天");
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        expect(formatDateGroup(yesterday.toISOString(), t)).toBe("昨天");
        expect(formatDateGroup("not-a-date", t)).toBe("更早");
        expect(formatDateGroup("2020-03-05T08:00:00Z", t)).toBe(translate("create.workspace.dateLabel", { year: 2020, month: 3, day: 5 }));
    });

    test("工作台词条八语齐全且占位符保留", () => {
        const keys = ["create.workspace.syncInterrupted", "create.workspace.refetch", "create.workspace.resave", "create.workspace.savedToAssets", "create.workspace.partialDone"];
        for (const key of keys) {
            expect(translate(key, { done: 1, total: 2 })).not.toBe(key);
        }
        expect(translate("create.workspace.partialDone", { done: 1, total: 4 })).toContain("1");
        expect(translate("create.workspace.partialDone", { done: 1, total: 4 })).toContain("4");
    });
});
