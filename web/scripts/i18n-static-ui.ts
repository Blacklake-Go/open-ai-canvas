import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { transformStaticUi, eligibleUiFile, type StaticUiMessage } from "../build/static-ui-i18n";
import catalog from "../src/i18n/messages/interface.json";
import { SUPPORTED_LOCALES } from "../src/i18n/locales";
import { validateTranslation } from "./i18n/source-scanner.mjs";

const root = resolve(import.meta.dir, "..");
const rows = new Map<string, StaticUiMessage>();
function walk(directory: string) {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
        const file = resolve(directory, item.name);
        if (item.isDirectory()) walk(file);
        else if (eligibleUiFile(file) || (file.includes("/supdance/plugins/i18n/admin/") && /\.tsx?$/.test(file))) {
            for (const message of transformStaticUi(readFileSync(file, "utf8"), file, { collectOnly: true }).messages) {
                const previous = rows.get(message.key);
                if (previous && previous.source !== message.source) throw new Error(`UI key collision: ${message.key}`);
                rows.set(message.key, message);
            }
        }
    }
}
walk(resolve(root, "src"));
const output = process.argv[2];
if (output === "--check") {
    const problems: string[] = [];
    for (const row of rows.values()) {
        for (const { code } of SUPPORTED_LOCALES) {
            const text = (catalog[code] as Record<string, string>)[row.key];
            const error = validateTranslation(row.source, text);
            if (error) problems.push(`${row.file}:${row.line} [${code}] ${row.key}: ${error}`);
        }
    }
    if (problems.length) throw new Error(problems.slice(0, 30).join("\n") + `\n${problems.length} static UI coverage errors`);
} else {
    if (!output) throw new Error("Pass --check or the inventory output path");
    writeFileSync(output, JSON.stringify([...rows.values()], null, 2) + "\n");
}
console.log(`Collected ${rows.size} static UI messages`);
