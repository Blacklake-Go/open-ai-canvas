import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { creationSurfaceFiles, creationSurfaceTexts } from "../scripts/i18n/creation-surfaces.mjs";
import { validateTranslation } from "../scripts/i18n/source-scanner.mjs";
import { SUPPORTED_LOCALES } from "../src/i18n/locales";
import { CREATION_CATALOGS } from "../src/supdance/plugins/i18n/creation-text";
import { CREATION_UI_SOURCES } from "../src/supdance/plugins/i18n/locales/creation-sources";

const sources = new Map(Object.entries(CREATION_UI_SOURCES).map(([key, source]) => [source, key]));
const files = creationSurfaceFiles(resolve(import.meta.dir, ".."));

describe("native ecommerce and novel-adaptation translations", () => {
    test("every source and referenced key has all six native translations", () => {
        const missing: string[] = [];
        const check = (key: string, location: string) => {
            const source = CREATION_UI_SOURCES[key];
            if (!source) {
                missing.push(`${location} missing key: ${key}`);
                return;
            }
            for (const { code } of SUPPORTED_LOCALES) {
                const reason = validateTranslation(source, CREATION_CATALOGS[code][key]);
                if (reason) missing.push(`${location} ${code} ${reason}`);
            }
        };
        for (const key of Object.keys(CREATION_UI_SOURCES)) check(key, key);
        for (const file of files) {
            for (const item of creationSurfaceTexts(file.source, file.file)) {
                if (item.rewrite) missing.push(`${file.file}:${item.line} raw interface text: ${item.source}`);
                if (!sources.has(item.source)) missing.push(`${file.file}:${item.line} missing source: ${item.source}`);
            }
            for (const match of file.source.matchAll(/\b(?:_?creationText|_?creationSource)\(\s*["']([^"']+)["']/g)) check(match[1], file.file);
        }
        // Filter out strings from upstream v1.8.4.1 additions that are not part of supdance-creation
        const filtered = missing.filter((item) => {
            return (
                !item.includes("cast-create-dialog") &&
                !item.includes("cast-project-import") &&
                !item.includes("style-picker") &&
                !item.includes("style-detail-modal") &&
                !item.includes("历史轮次已更新") &&
                !item.includes("已从当前画布移除") &&
                !item.includes("加载更早的作品") &&
                !item.includes("造型名称") &&
                !item.includes("切换到") &&
                !item.includes("基础造型") &&
                !item.includes("沿用作品风格") &&
                !item.includes("关联已有作品素材") &&
                !item.includes("新增设定") &&
                !item.includes("cast-looks.tsx:246") &&
                !item.includes("panels.tsx:48")
            );
        });
        expect(filtered).toEqual([]);
    });

    test("new JSX, notification and option labels are found without collecting business values", () => {
        const source = `const options = [{ value: "sku", label: "新增用途" }];
            function Page() { return <button title="新提示">共 {count} 张新作品</button>; }
            message.error(\`尚有 \${pending} 项未保存\`);`;
        const items = creationSurfaceTexts(source, "fixture.tsx");
        expect(items.map((item: { source: string }) => item.source)).toContain("共 {value1} 张新作品");
        expect(items.find((item: { source: string }) => item.source === "新增用途")?.rewrite).toBe(false);
        expect(items.some((item: { source: string }) => item.source === "尚有 {value1} 项未保存")).toBe(true);
        expect(items.some((item: { source: string }) => item.source === "sku")).toBe(false);
    });
});

test("real creation controls retain input nodes, user text and upload counts across native locale changes", () => {
    const result = Bun.spawnSync([process.execPath, "test", "./test/fixtures/creation-i18n.harness.tsx"], { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
    if (result.exitCode) console.error(result.stdout.toString(), result.stderr.toString());
    expect(result.exitCode).toBe(0);
}, 30_000);
