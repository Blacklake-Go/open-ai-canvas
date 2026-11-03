/**
 * 全站漏译审计：找出“用户可见但不在 i18n 词典里”的硬编码中文。
 *
 * 插件的 DOM 观察者按中文原文精确匹配词典，词典里没有的文案在切换语言时保持中文，
 * 于是同一屏出现中英韩混排。只测“词典内部键奇偶”发现不了这种缺口，必须拿页面文案去比对词典。
 *
 * 用法：
 *   bun scripts/i18n-audit.mjs            打印汇总与前 40 个文件
 *   bun scripts/i18n-audit.mjs --json     输出全部命中项（供补齐脚本消费）
 *   bun scripts/i18n-audit.mjs --fail     命中数超过 --budget 时退出码 1（CI 防新增）
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const WEB_DIR = resolve(import.meta.dir, "..");
const SRC_DIR = join(WEB_DIR, "src");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const fail = args.includes("--fail");
const budget = Number(args[args.indexOf("--budget") + 1] ?? 0);

const indexSource = readFileSync(join(SRC_DIR, "supdance/plugins/i18n/locales/index.ts"), "utf8");
const dictTexts = new Set();
for (const match of indexSource.matchAll(/^\s{4}e\("[^"]+",\s*"[^"]+",\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/gm)) {
    dictTexts.add((match[1] ?? match[2] ?? "").replace(/\\"/g, '"').trim());
}

const files = [];
(function walk(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            if (path.endsWith("supdance/plugins/i18n")) continue;
            walk(path);
        } else if (/\.tsx?$/.test(name)) files.push(path);
    }
})(SRC_DIR);

/** 只认这些位置：它们会渲染成用户看得见的文字，排除注释、日志与内部异常文本。 */
const USER_FACING = /message\.(success|error|warning|info|loading)|notification\.|Modal\.(confirm|warning|error|info)|placeholder=|title=|label=|aria-label=|description=|text=|alt=|tooltip=|okText=|cancelText=|emptyText|>[^<]*[\u4e00-\u9fff]/;
const HAN = /[\u4e00-\u9fff]/;

const hits = new Map();
for (const file of files) {
    const rel = file.replace(`${WEB_DIR}/`, "");
    if (rel.startsWith("src/supdance/pages/legal/")) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((raw, index) => {
        const line = raw.trim();
        if (!line || /^(\/\/|\*|\/\*)/.test(line)) return;
        if (/console\.(log|warn|error|debug)|logger\.|throw new Error/.test(line)) return;
        if (!USER_FACING.test(line)) return;
        for (const match of line.matchAll(/["'`]([^"'`\n]{2,90})["'`]/g)) {
            const text = match[1].trim();
            if (!HAN.test(text) || text.includes("${") || text.includes("{{")) continue;
            if (dictTexts.has(text)) continue;
            if (!hits.has(text)) hits.set(text, { text, file: rel, line: index + 1, admin: /\/(pages\/)?admin\//.test(rel) });
        }
    });
}

const rows = [...hits.values()];
const user = rows.filter((row) => !row.admin);
const admin = rows.filter((row) => row.admin);

if (asJson) {
    const out = process.env.OUT ?? join("/tmp", "i18n-audit.json");
    writeFileSync(out, JSON.stringify({ dictionary: dictTexts.size, scannedFiles: files.length, user, admin }, null, 1));
    console.log(`已写出 ${out}：用户可见 ${user.length} 条 / 后台 ${admin.length} 条`);
} else {
    console.log(`词典原文 ${dictTexts.size} 条，扫描 ${files.length} 个文件`);
    console.log(`用户可见但未收录：${user.length} 条`);
    console.log(`管理后台但未收录：${admin.length} 条（translateAdminPages 默认关闭，属预期范围）`);
    const byFile = {};
    for (const row of user) byFile[row.file] = (byFile[row.file] ?? 0) + 1;
    console.log("\n待补齐最多的文件：");
    Object.entries(byFile)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 40)
        .forEach(([file, count]) => console.log(String(count).padStart(4), file));
}

if (fail && budget && user.length > budget) {
    console.error(`\n用户可见漏译 ${user.length} 条，超过预算 ${budget} 条`);
    process.exit(1);
}
