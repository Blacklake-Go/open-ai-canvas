import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { i18n } from "../src/i18n";
import { SUPPORTED_LOCALES } from "../src/i18n/locales";
import { AREA_CATALOGS } from "../src/i18n/areas";
const catalog = AREA_CATALOGS.upstream;
import { CanvasAgentHud } from "../src/components/canvas/canvas-agent-hud";
import { AgentMediaBatchBar } from "../src/components/canvas/canvas-cloud-agent-media-batch-bar";
import type { CloudAgentMediaBatchProgress } from "../src/lib/canvas/cloud-agent-media-batch";
import { canvasThemes } from "../src/lib/canvas-theme";
import { creationSurfaceTexts } from "../scripts/i18n/creation-surfaces.mjs";
import { workspacePageTitleKey } from "../src/lib/workspace-page-title";

function flatten(value: object, prefix = ""): Record<string, string> {
    return Object.fromEntries(
        Object.entries(value).flatMap(([key, child]) => {
            const path = prefix ? `${prefix}.${key}` : key;
            return typeof child === "string" ? [[path, child]] : Object.entries(flatten(child, path));
        }),
    );
}

describe("native translations for merged upstream interfaces", () => {
    test("music page titles resolve through the native catalog in every supported language", async () => {
        const originalLanguage = i18n.language;
        const key = workspacePageTitleKey("/toolbox/music");
        expect(key).toBeDefined();
        try {
            for (const { code } of SUPPORTED_LOCALES) {
                await i18n.changeLanguage(code);
                expect(i18n.exists(key!)).toBe(true);
                expect(i18n.t(key!)).not.toBe(key!);
            }
        } finally {
            await i18n.changeLanguage(originalLanguage);
        }
    });

    test("all supported languages have the same keys and interpolation contract", () => {
        const source = flatten(catalog["zh-CN"]);
        for (const { code } of SUPPORTED_LOCALES) {
            const translated = flatten(catalog[code]);
            expect(Object.keys(translated).sort()).toEqual(Object.keys(source).sort());
            for (const [key, text] of Object.entries(source)) {
                expect(translated[key].trim().length).toBeGreaterThan(0);
                const placeholders = (value: string) => [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
                expect(placeholders(translated[key])).toEqual(placeholders(text));
            }
        }
    });

    test("HUD and batch bar contain no untranslated interface sinks", () => {
        for (const file of ["src/components/canvas/canvas-agent-hud.tsx", "src/components/canvas/canvas-cloud-agent-media-batch-bar.tsx", "src/pages/admin/components/channel-model-token-rules.tsx"]) {
            const source = readFileSync(resolve(import.meta.dir, "../", file), "utf8");
            expect(creationSurfaceTexts(source, file).filter((item: { rewrite: boolean }) => item.rewrite)).toEqual([]);
        }
    });

    test("real components translate status labels while retaining task identities and user titles", async () => {
        const originalLanguage = i18n.language;
        const batch: CloudAgentMediaBatchProgress = {
            batchId: "batch-unchanged",
            mode: "image",
            phase: "canary_done",
            concurrency: 2,
            total: 4,
            items: [
                { index: 0, nodeId: "node-first", status: "succeeded", title: "用户原文：删除 / 生成中" },
                { index: 1, nodeId: "node-second", status: "failed", title: "客户标题：商品主图", error: "上游原始错误 / original error" },
                { index: 2, nodeId: "node-third", status: "submitted", title: "音乐" },
            ],
        };
        const originalBatch = JSON.stringify(batch);
        const renderedLabels = new Set<string>();
        try {
            for (const { code } of SUPPORTED_LOCALES) {
                await i18n.changeLanguage(code);
                const hud = renderToStaticMarkup(createElement(CanvasAgentHud, { nodeCount: 12, connectionCount: 7, followAgent: true, onFollowAgentChange() {} }));
                const progress = renderToStaticMarkup(createElement(AgentMediaBatchBar, { batch, theme: canvasThemes.light }));
                renderedLabels.add(i18n.t("upstream.canvasHud.followAgent"));
                expect(hud).toContain('aria-pressed="true"');
                expect(hud).toContain(">12</strong>");
                expect(hud).toContain(">7</strong>");
                expect(progress).toContain("用户原文：删除 / 生成中");
                expect(progress).toContain("客户标题：商品主图");
                expect(progress).toContain('aria-valuemax="4"');
                expect(progress).toContain('aria-valuenow="2"');
                expect(progress).toContain('data-status="submitted"');
                expect(progress).not.toContain("upstream.mediaBatch.");
                expect(JSON.stringify(batch)).toBe(originalBatch);
                if (code === "en-US") {
                    expect(hud).toContain("Connections");
                    expect(progress).toContain("Batch generation progress");
                    expect(progress).toContain("Trial run complete, awaiting approval to continue");
                }
            }
            expect(renderedLabels.size).toBe(SUPPORTED_LOCALES.length);
        } finally {
            await i18n.changeLanguage(originalLanguage);
        }
    });
});

test("real pricing inputs and music suggestions preserve business state through all six locales", () => {
    const result = Bun.spawnSync([process.execPath, "test", "./test/fixtures/upstream-native-i18n.harness.tsx"], { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
    if (result.exitCode) console.error(result.stdout.toString(), result.stderr.toString());
    expect(result.exitCode).toBe(0);
}, 30_000);
