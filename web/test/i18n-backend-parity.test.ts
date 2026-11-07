import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { BUILTIN_SUPDANCE_I18N_ENTRIES, NAMESPACE_LABELS, SUPPORTED_LOCALE_CODES } from "../src/supdance/plugins/i18n/locales";
import enUSPack from "../src/supdance/plugins/i18n/locales/packs/en-US";
import esESPack from "../src/supdance/plugins/i18n/locales/packs/es-ES";
import jaJPPack from "../src/supdance/plugins/i18n/locales/packs/ja-JP";
import koKRPack from "../src/supdance/plugins/i18n/locales/packs/ko-KR";
import zhTWPack from "../src/supdance/plugins/i18n/locales/packs/zh-TW";
import { musicOperations } from "../src/supdance/plugins/music-generation/services/music-tools";

/**
 * 后端 defaults.go 是后台词条中心和公开 bundle 的数据源，前端词典是浏览器渲染源。
 * 两边各写一份就会漂移：前端有、后端没有的词条在后台看不见也改不动，
 * 界面又靠 DOM 原文匹配翻译，同一批文案就会出现一半能切语言一半切不动。
 * 这里把“前端是唯一源”钉成测试，后端字典必须由 scripts/i18n-sync-backend.mjs 生成。
 */
const DEFAULTS_GO = resolve(import.meta.dir, "../../backend/internal/supdance/i18n/defaults.go");

type BackendEntry = { key: string; namespace: string; values: Record<string, string> };

function parseBackendEntries(source: string): BackendEntry[] {
    const quoted = String.raw`(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')`;
    const re = new RegExp(`^\\s*entry\\(${quoted},\\s*${quoted},\\s*${quoted},\\s*${quoted},\\s*${quoted},\\s*${quoted},\\s*${quoted},\\s*${quoted},\\s*${quoted}\\),$`, "gm");
    const unescape = (value: string | undefined) => (value ?? "").replace(/\\(["'nt\\])/g, (_all, group: string) => (group === "n" ? "\n" : group === "t" ? "\t" : group));
    const rows: BackendEntry[] = [];
    for (const match of source.matchAll(re)) {
        // 每个参数是“双引号或单引号”的二选一，所以两个捕获组只能取非空的那个。
        const args: string[] = [];
        for (let index = 0; index < 9; index += 1) args.push(unescape(match[1 + index * 2] ?? match[2 + index * 2]));
        rows.push({ key: args[0]!, namespace: args[1]!, values: { "zh-CN": args[2]!, "en-US": args[3]!, "zh-TW": args[4]!, "ja-JP": args[5]!, "ko-KR": args[6]!, "es-ES": args[7]! } });
    }
    return rows;
}

/** 词典条目的外语译文是按需加载后才回填的，这里直接读语言包模块，避免依赖加载顺序。 */
const frontendValues: Record<string, Record<string, string>> = {
    "zh-CN": {},
    "en-US": enUSPack,
    "zh-TW": zhTWPack,
    "ja-JP": jaJPPack,
    "ko-KR": koKRPack,
    "es-ES": esESPack,
};

function frontendValue(key: string, locale: string, sourceText: string): string {
    if (locale === "zh-CN") return sourceText.trim();
    return (frontendValues[locale]?.[key] ?? "").trim();
}

describe("i18n frontend dictionary is the single source for the backend dictionary", () => {
    const backend = parseBackendEntries(readFileSync(DEFAULTS_GO, "utf8"));
    const backendByKey = new Map(backend.map((row) => [row.key, row]));
    const frontendKeys = BUILTIN_SUPDANCE_I18N_ENTRIES.map((entry) => entry.key);

    test("parses the backend dictionary at all", () => {
        expect(backend.length).toBeGreaterThan(1000);
    });

    test("backend has no duplicate keys", () => {
        expect(backendByKey.size).toBe(backend.length);
    });

    test("every frontend entry exists in the backend dictionary", () => {
        const missing = frontendKeys.filter((key) => !backendByKey.has(key));
        if (missing.length) console.error("[FAIL] backend missing keys:", missing.slice(0, 20));
        expect(missing).toEqual([]);
    });

    test("each selectable music tool has both a localized label and instructions", () => {
        const keys = new Set(frontendKeys);
        for (const op of musicOperations) {
            expect(keys.has(`music.adv_${op}`)).toBe(true);
            expect(keys.has(`music.adv_${op}_help`)).toBe(true);
        }
    });

    test("backend has no orphan entries that the frontend dropped", () => {
        const frontend = new Set(frontendKeys);
        const orphans = backend.map((row) => row.key).filter((key) => !frontend.has(key));
        if (orphans.length) console.error("[FAIL] backend orphan keys:", orphans.slice(0, 20));
        expect(orphans).toEqual([]);
    });

    test("backend translations match the frontend packs for every locale", () => {
        const mismatches: string[] = [];
        for (const entry of BUILTIN_SUPDANCE_I18N_ENTRIES) {
            const row = backendByKey.get(entry.key);
            if (!row) continue;
            for (const code of SUPPORTED_LOCALE_CODES) {
                const expected = frontendValue(entry.key, code, entry.sourceText);
                const actual = (row.values[code] ?? "").trim();
                if (expected !== actual) mismatches.push(`${entry.key} [${code}] frontend=${JSON.stringify(expected)} backend=${JSON.stringify(actual)}`);
            }
        }
        if (mismatches.length) console.error("[FAIL] locale value drift:", mismatches.slice(0, 20));
        expect(mismatches).toEqual([]);
    });

    test("backend namespaces are all labelled on the frontend", () => {
        const unlabelled = [...new Set(backend.map((row) => row.namespace))].filter((ns) => !(ns in NAMESPACE_LABELS));
        expect(unlabelled).toEqual([]);
    });
});
