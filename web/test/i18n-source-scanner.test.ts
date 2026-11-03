import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { scanSource, compareManifests, validateTranslation, hashText } from "../scripts/i18n/source-scanner.mjs";

describe("source update localization pipeline", () => {
    test("finds real JSX, attributes, multiline properties and templates without collecting logs", () => {
        const result = scanSource(
            'export function View(){ console.log("内部日志"); const prompt="用户提示词"; return <button aria-label="编辑标题">保存作品{`共 ${count} 条`}</button> }\n const menu = {\n title: "菜单标题",\n label: "菜单标签" };',
            "src/view.tsx",
        );
        expect(result.diagnostics).toEqual([]);
        expect(result.items.map((i: { sourceText: string }) => i.sourceText)).toEqual(["编辑标题", "保存作品", "共 {count} 条", "菜单标题", "菜单标签"]);
        expect(result.items[2].dynamic).toBe(true);
        expect(result.items[3].references[0].line).toBe(3);
    });
    test("formatting does not alter identities; source edits become changed, not dropped", () => {
        const a = scanSource('const Page=()=> <button title="删除作品">保存作品</button>', "src/page.tsx").items;
        const b = scanSource('const Page = () => (\n <button title="删除作品">保存修改</button>\n)', "src/page.tsx").items;
        const diff = compareManifests(a, b);
        expect(diff.added).toEqual([]);
        expect(diff.retired).toEqual([]);
        expect(diff.changed.map((i: { sourceText: string }) => i.sourceText)).toEqual(["保存修改"]);
        expect(compareManifests(b, b).changed).toEqual([]);
        const moved = scanSource('const Page = () => <button title="删除作品">保存作品</button>', "src/moved.tsx").items;
        expect(compareManifests(a, moved).added).toEqual([]);
        expect(compareManifests(a, moved).retired).toEqual([]);
        expect(compareManifests(a, moved).moved.length).toBe(2);
    });
    test("reports explicit missing-key references and parse failures", () => {
        const result = scanSource('const title = t("new.title");', "src/page.ts");
        expect(result.references[0].key).toBe("new.title");
        expect(scanSource("const broken = <button", "src/broken.tsx").diagnostics.length).toBe(1);
    });
    test("rejects invented, missing and duplicate placeholders and changed URLs", () => {
        expect(validateTranslation("完成", "Done {count}")).toBe("placeholder_mismatch");
        expect(validateTranslation("共 {count} 条", "{count} {count} items")).toBe("placeholder_mismatch");
        expect(validateTranslation("共 {count} 条", "{count} items")).toBeNull();
        expect(validateTranslation("访问 https://example.com）", "Visit https://example.com)")).toBeNull();
        expect(validateTranslation("访问 https://example.com", "Visit https://other.example")).toBe("url_mismatch");
    });
    test("draft generation uses no model by default and resumes verified checkpoint translations", () => {
        const dir = mkdtempSync(join(tmpdir(), "i18n-draft-test-"));
        try {
            const input = join(dir, "scan.json"),
                output = join(dir, "drafts.json");
            const item = { key: "custom.scan_test", namespace: "custom", sourceText: "保存作品", sourceHash: hashText("保存作品"), context: "Page:jsx", references: [{ file: "src/page.tsx", line: 1 }], status: "new" };
            writeFileSync(input, JSON.stringify({ pluginId: "supdance-i18n", schemaVersion: 1, diff: { added: [item], changed: [] }, items: [item] }));
            const run = (...args: string[]) =>
                Bun.spawnSync([process.execPath, "scripts/i18n-draft.mjs", "--input", input, "--output", output, ...args], { cwd: resolve(import.meta.dir, ".."), env: { ...process.env, SUPDANCE_I18N_TRANSLATION_URL: "https://invalid.example" } });
            expect(run().exitCode).toBe(0);
            const payload = JSON.parse(readFileSync(output, "utf8"));
            expect(payload.drafts[0].entry.translations["en-US"]).toBe("");
            payload.drafts[0].entry.translations["en-US"] = "Save work";
            writeFileSync(output, JSON.stringify(payload));
            expect(run().exitCode).toBe(0);
            expect(JSON.parse(readFileSync(output, "utf8")).drafts[0].entry.translations["en-US"]).toBe("Save work");
            expect(run("--translate").exitCode).not.toBe(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
    test("legacy zero-budget and invalid-budget gates cannot silently pass", () => {
        for (const args of [["--fail", "--budget", "0"], ["--fail"], ["--fail", "--budget", "NaN"]]) {
            const result = Bun.spawnSync([process.execPath, "scripts/i18n-audit.mjs", ...args], { cwd: resolve(import.meta.dir, "..") });
            expect(result.exitCode).not.toBe(0);
        }
    });
});
