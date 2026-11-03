/**
 * 把前端 i18n 词典同步到后端 backend/internal/supdance/i18n/defaults.go。
 *
 * 后端字典是后台词条中心和公开 bundle 的数据源，前端语言包是浏览器渲染源。
 * 两边各自手写就会漂移：前端有、后端没有的词条在后台不可见也不可改，
 * 界面又靠 DOM 原文匹配翻译，结果就是同一批文案一半能切语言一半切不动。
 * 这里以 locales/index.ts + packs/*.ts 为唯一源，重新生成 defaults.go 的命名空间表与词条体。
 *
 * 用法：
 *   bun scripts/i18n-sync-backend.mjs           写回 defaults.go
 *   bun scripts/i18n-sync-backend.mjs --check    只比对，不一致时退出码 1（CI 门禁）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const WEB_DIR = resolve(import.meta.dir, "..");
const LOCALES = resolve(WEB_DIR, "src/supdance/plugins/i18n/locales");
const TARGET = resolve(WEB_DIR, "../backend/internal/supdance/i18n/defaults.go");
const LOCALES_CODES = ["en-US", "zh-TW", "ja-JP", "ko-KR", "es-ES"];

const indexSource = readFileSync(resolve(LOCALES, "index.ts"), "utf8");

const entries = [];
for (const match of indexSource.matchAll(/^\s{4}e\("([^"]+)",\s*"([^"]+)",\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*,\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*\),$/gm)) {
    entries.push({ key: match[1], namespace: match[2], zh: unescapeTs(match[3] ?? match[4]), description: unescapeTs(match[5] ?? match[6]) });
}
if (entries.length < 1000) throw new Error(`从 index.ts 只解析到 ${entries.length} 条词条，解析规则已失效，拒绝写回`);

const packs = {};
for (const code of LOCALES_CODES) {
    const source = readFileSync(resolve(LOCALES, "packs", `${code}.ts`), "utf8");
    const map = {};
    for (const match of source.matchAll(/^\s{4}"([^"]+)":\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*,?$/gm)) map[match[1]] = unescapeTs(match[2] ?? match[3]);
    packs[code] = map;
}

const namespaceLabels = {};
const labelsBlock = indexSource.match(/export const NAMESPACE_LABELS: Record<string, string> = \{([\s\S]*?)\n\};/);
if (!labelsBlock) throw new Error("index.ts 里找不到 NAMESPACE_LABELS");
for (const match of labelsBlock[1].matchAll(/^\s{4}([A-Za-z0-9_]+|"[^"]+"):\s*"((?:[^"\\]|\\.)*)",$/gm)) {
    namespaceLabels[match[1].replace(/^"|"$/g, "")] = unescapeTs(match[2]);
}

const missing = [];
for (const entry of entries) {
    if (!namespaceLabels[entry.namespace]) missing.push(`${entry.key} 的命名空间 ${entry.namespace} 没有标签`);
    for (const code of LOCALES_CODES) {
        if (!packs[code][entry.key]?.trim()) missing.push(`${entry.key} 缺少 ${code} 译文`);
    }
}
if (missing.length) throw new Error(`词典不完整，拒绝生成后端字典：\n  ${missing.slice(0, 20).join("\n  ")}\n  共 ${missing.length} 项`);

const namespaceOrder = [...new Set(entries.map((entry) => entry.namespace))].filter((ns) => namespaceLabels[ns]);
for (const ns of Object.keys(namespaceLabels)) if (!namespaceOrder.includes(ns)) namespaceOrder.push(ns);

const GENERATED_NOTE = "// BuiltinEntries 由 web/scripts/i18n-sync-backend.mjs 从前端词典生成，不要手工编辑词条体。\n";

const goString = (value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\t/g, "\\t").replace(/\n/g, "\\n")}"`;

const groups = [];
for (const ns of namespaceOrder) {
    const rows = entries.filter((entry) => entry.namespace === ns);
    if (!rows.length) continue;
    groups.push(`\t\t// ==================== ${ns}: ${namespaceLabels[ns]} (${rows.length}) ====================`);
    for (const row of rows) {
        groups.push(`\t\tentry(${[row.key, row.namespace, row.zh, packs["en-US"][row.key], packs["zh-TW"][row.key], packs["ja-JP"][row.key], packs["ko-KR"][row.key], packs["es-ES"][row.key], row.description].map(goString).join(", ")}),`);
    }
}

const labelsLines = Object.entries(namespaceLabels).map(([key, value]) => `\t${goString(key)}:${"\t"}${goString(value)},`);
const orderLines = namespaceOrder.map((ns) => `\t${goString(ns)},`);

const current = readFileSync(TARGET, "utf8");
const replacements = [
    { name: "NamespaceLabels", re: /var NamespaceLabels = map\[string\]string\{\n[\s\S]*?\n\}/, to: () => `var NamespaceLabels = map[string]string{\n${labelsLines.join("\n")}\n}` },
    { name: "NamespaceOrder", re: /var NamespaceOrder = \[\]string\{\n[\s\S]*?\n\}/, to: () => `var NamespaceOrder = []string{\n${orderLines.join("\n")}\n}` },
    { name: "BuiltinEntries 生成注释", re: /(?:\/\/ BuiltinEntries[^\n]*\n)?func BuiltinEntries\(\) \[\]Entry \{/, to: () => GENERATED_NOTE + "func BuiltinEntries() []Entry {" },
];

let generated = current;
for (const item of replacements) {
    if (!item.re.test(generated)) throw new Error(`defaults.go 里没匹配到 ${item.name}，生成规则已失效，拒绝写回`);
    generated = generated.replace(item.re, item.to);
}

const bodyStart = generated.indexOf("func BuiltinEntries() []Entry {");
if (bodyStart < 0) throw new Error("defaults.go 里找不到 BuiltinEntries");
generated = `${generated.slice(0, bodyStart)}func BuiltinEntries() []Entry {\n\treturn []Entry{\n${groups.join("\n")}\n\t}\n}\n`;

/** gofmt 会重排对齐，生成后必须过一遍，否则 --check 每次都会把格式化差异当成内容漂移。 */
function formatGo(text) {
    const result = spawnSync("gofmt", [], { input: text, encoding: "utf8" });
    if (result.error || result.status !== 0) {
        console.warn(`gofmt 不可用或失败，保留未格式化输出：${result.error?.message ?? result.stderr}`);
        return text;
    }
    return result.stdout;
}

generated = formatGo(generated);

if (process.argv.includes("--check")) {
    if (generated !== current) {
        console.error(`defaults.go 与前端词典不一致（前端 ${entries.length} 条）。请运行 bun scripts/i18n-sync-backend.mjs`);
        process.exit(1);
    }
    console.log(`defaults.go 与前端词典一致：${entries.length} 条 / ${namespaceOrder.length} 个命名空间`);
    process.exit(0);
}

writeFileSync(TARGET, generated);
console.log(`已生成 defaults.go：${entries.length} 条词条，${namespaceOrder.length} 个命名空间`);

/** TS 字面量里的 \\" 与 \\n 还原成真实字符，交给 Go 侧再按 Go 规则转义。 */
function unescapeTs(value) {
    return value.replace(/\\(["\\nt])/g, (_all, group) => (group === "n" ? "\n" : group === "t" ? "\t" : group));
}
