import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { BUILTIN_I18N_ENTRIES } from "../src/supdance/plugins/i18n/locales/index.ts";
import { scanSource, compareManifests, hashText } from "./i18n/source-scanner.mjs";
import { i18n } from "../src/i18n/index.ts";
import { CREATION_UI_SOURCES } from "../src/supdance/plugins/i18n/locales/creation-sources.ts";
import { SUPPORTED_LOCALES } from "../src/i18n/locales.ts";

const root = resolve(import.meta.dir, "..");
const args = process.argv.slice(2);
const allowed = new Set(["--check", "--write-baseline", "--baseline", "--output"]);
allowed.add("--source-root");
let sourceRoot = resolve(root, "src");
let baseline = resolve(root, "../supdance/i18n/source-baseline.json");
let output = resolve(root, "../.local/cache/i18n/scan.json");
for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error(`Unknown argument: ${args[i]}`);
    if (["--baseline", "--output", "--source-root"].includes(args[i])) {
        const name = args[i];
        const value = args[++i];
        if (!value || value.startsWith("--")) throw new Error(`${name} requires a path`);
        if (name === "--baseline") baseline = resolve(value);
        else if (name === "--source-root") sourceRoot = resolve(value);
        else output = resolve(value);
    }
}
const entries = [...BUILTIN_I18N_ENTRIES];
const bySource = new Map();
for (const entry of entries) bySource.set(entry.sourceText, [...(bySource.get(entry.sourceText) ?? []), entry]);
// The host and creation namespaces own their catalogs independently of legacy packs.
// Index their real source entries so upstream native labels do not become duplicate
// extension drafts. This only classifies the inventory; it never rewrites UI text.
const nativeBySource = new Map();
function indexNativeSources(value, prefix = "") {
    for (const [name, item] of Object.entries(value ?? {})) {
        const key = prefix ? `${prefix}.${name}` : name;
        if (typeof item === "string") {
            const source = item.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, "{$1}");
            if (!nativeBySource.has(source)) nativeBySource.set(source, { key, namespace: "native" });
        } else if (item && typeof item === "object") indexNativeSources(item, key);
    }
}
indexNativeSources(i18n.getResourceBundle("zh-CN", "translation"));
for (const [key, source] of Object.entries(CREATION_UI_SOURCES)) {
    if (!nativeBySource.has(source)) nativeBySource.set(source, { key, namespace: "supdance-creation" });
}
const items = [],
    references = [],
    diagnostics = [];
function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const path = resolve(dir, entry.name);
        if (entry.isDirectory()) {
            if (!["supdance/plugins/i18n", "i18n"].includes(relative(sourceRoot, path).replaceAll("\\", "/"))) walk(path);
        } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
            const result = scanSource(readFileSync(path, "utf8"), `src/${relative(sourceRoot, path).replaceAll("\\", "/")}`);
            items.push(...result.items);
            references.push(...result.references);
            diagnostics.push(...result.diagnostics);
        }
    }
}
walk(sourceRoot);
for (const item of items) {
    item.anchor = hashText(item.context).slice(0, 16);
    const matches = bySource.get(item.sourceText) ?? [];
    const native = nativeBySource.get(item.sourceText);
    item.key = matches.length === 1 ? matches[0].key : `custom.scan_${item.id}`;
    item.namespace = matches.length === 1 ? matches[0].namespace : "custom";
    item.status = matches.length > 1 ? "ambiguous" : matches.length === 1 ? "known" : item.dynamic ? "needs_context" : "new";
    if (native && matches.length !== 1) {
        item.key = native.key;
        item.namespace = native.namespace;
        item.status = "known";
    }
}
const knownKeys = new Set(entries.map((e) => e.key));
const missingKeys = references.filter((r) => !knownKeys.has(r.key) && !i18n.exists(r.key, { lng: "zh-CN" }));
if (!existsSync(baseline) && !args.includes("--write-baseline")) throw new Error("Missing baseline; create it explicitly with --write-baseline");
const previous = existsSync(baseline) ? JSON.parse(readFileSync(baseline, "utf8")) : { schemaVersion: 1, items: [], missingKeys: [] };
if (previous.schemaVersion !== 1 || !Array.isArray(previous.items)) throw new Error("Unsupported baseline schema");
const diff = compareManifests(previous.items, items);
const oldMissing = new Set((previous.missingKeys ?? []).map((r) => `${r.file}:${r.key}`));
const newMissingKeys = missingKeys.filter((r) => !oldMissing.has(`${r.file}:${r.key}`));
const blockers = [...diff.added, ...diff.changed].filter((i) => i.status !== "known");
const packs = Object.fromEntries(SUPPORTED_LOCALES.filter(({ code }) => code !== "zh-CN").map(({ code }) => [code, Object.fromEntries(entries.map((entry) => [entry.key, entry.translations[code] ?? ""]))]));
const catalog = entries.map((e) => ({ key: e.key, sourceHash: hashText(e.sourceText), translations: Object.fromEntries(Object.entries(packs).map(([code, pack]) => [code, hashText(pack[e.key] ?? "")])) }));
const oldCatalog = new Map((previous.catalog ?? []).map((e) => [e.key, e]));
const catalogChanges = catalog
    .filter((e) => oldCatalog.has(e.key) && oldCatalog.get(e.key).sourceHash !== e.sourceHash)
    .map((e) => ({
        ...e,
        sourceText: entries.find((entry) => entry.key === e.key).sourceText,
        namespace: entries.find((entry) => entry.key === e.key).namespace,
        staleLocales: Object.keys(e.translations).filter((code) => e.translations[code] === oldCatalog.get(e.key).translations[code]),
    }));
const report = {
    pluginId: "supdance-i18n",
    schemaVersion: 1,
    catalogRevision: hashText(JSON.stringify(catalog)),
    summary: {
        scannedTexts: items.length,
        added: diff.added.length,
        changed: diff.changed.length,
        retired: diff.retired.length,
        newUntranslated: blockers.length,
        newMissingKeys: newMissingKeys.length,
        staleTranslations: catalogChanges.reduce((n, e) => n + e.staleLocales.length, 0),
        syntaxErrors: diagnostics.length,
    },
    items,
    diff,
    missingKeys,
    catalogChanges,
    diagnostics,
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
if (args.includes("--write-baseline")) {
    mkdirSync(dirname(baseline), { recursive: true });
    writeFileSync(baseline, JSON.stringify({ schemaVersion: 1, items: items.map(({ id, sourceHash, anchor }) => ({ id, sourceHash, anchor })), catalog, missingKeys: missingKeys.map(({ file, key }) => ({ file, key })) }) + "\n");
}
console.log(JSON.stringify(report.summary));
console.log(`Report: ${output}`);
if (args.includes("--check") && (blockers.length || newMissingKeys.length || diagnostics.length || report.summary.staleTranslations)) process.exit(1);
