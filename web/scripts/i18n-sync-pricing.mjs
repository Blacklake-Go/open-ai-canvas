import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { format, resolveConfig } from "prettier";
import { SUPPORTED_LOCALES } from "../src/i18n/locales.ts";
import { HTML_ADMIN_I18N_ENTRIES } from "../src/supdance/plugins/i18n/locales/html-admin.ts";

const target = resolve(import.meta.dir, "../public/pricing-i18n.js");
const current = readFileSync(target, "utf8");
const keys = ["public.footer.brand_slogan", "public.footer.brand_vision", "public.footer.official_channels"];
const entries = keys.map((key) => {
    const entry = HTML_ADMIN_I18N_ENTRIES.find((item) => item.key === key);
    if (!entry) throw new Error(`Missing pricing footer entry: ${key}`);
    return entry;
});
const rows = entries.map((entry) => SUPPORTED_LOCALES.map(({ code }) => entry.translations[code]));
const marker = /\/\/ BEGIN SHARED FOOTER TRANSLATIONS[\s\S]*?\/\/ END SHARED FOOTER TRANSLATIONS/;
if (!marker.test(current)) throw new Error("Pricing footer translation markers are missing");
const replacement = `// BEGIN SHARED FOOTER TRANSLATIONS\n${rows.map((row) => `${JSON.stringify(row)},`).join("\n")}\n// END SHARED FOOTER TRANSLATIONS`;
const generated = await format(current.replace(marker, replacement), { ...(await resolveConfig(target)), filepath: target });
if (process.argv.includes("--check")) {
    if (current !== generated) throw new Error("Pricing footer translations drifted; run bun scripts/i18n-sync-pricing.mjs");
} else writeFileSync(target, generated);
console.log("Standalone pricing footer matches the native eight-language catalog");
