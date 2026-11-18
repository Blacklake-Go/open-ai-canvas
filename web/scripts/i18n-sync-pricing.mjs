import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { Window } from "happy-dom";
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

if (process.argv.includes("--render-html")) {
    const page = resolve(import.meta.dir, "../public/pricing.html");
    const window = new Window({ url: "https://example.test/pricing.html", settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
    try {
        const { document } = window;
        document.write(readFileSync(page, "utf8"));
        const nodes = [];
        const walker = document.createTreeWalker(document.body, window.NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.nodeValue.trim() && node.parentElement?.closest("main, header, .sd-link-list, .sd-col-heading") && !node.parentElement.closest("select, script, style")) nodes.push([node, node.nodeValue]);
        }
        const attributes = Array.from(document.querySelectorAll("[aria-label]"), (element) => [element, element.getAttribute("aria-label")]);
        const footer = ["sd-ft-brand-slogan", "sd-ft-brand-vision", "sd-ft-social-label"].flatMap((id) => {
            const element = document.getElementById(id);
            return element ? [[element, element.textContent]] : [];
        });
        const theme = document.documentElement.dataset.theme;
        const themeButton = document.getElementById("theme-toggle");
        const icon = themeButton.innerHTML;
        const themePressed = themeButton.getAttribute("aria-pressed");
        runInNewContext(generated, { document, NodeFilter: window.NodeFilter, localStorage: window.localStorage, URLSearchParams, location: window.location });
        document.documentElement.dataset.theme = theme;
        themeButton.innerHTML = icon;
        if (themePressed === null) themeButton.removeAttribute("aria-pressed");
        else themeButton.setAttribute("aria-pressed", themePressed);
        for (const [node, source] of nodes) {
            if (node.nodeValue === source || node.previousSibling?.nodeValue?.startsWith("pricing-source:")) continue;
            const encoded = encodeURIComponent(source).replaceAll("-", "%2D");
            node.parentNode.insertBefore(document.createComment("pricing-source:" + encoded), node);
        }
        for (const [element, source] of attributes) {
            if (element.getAttribute("aria-label") !== source && !element.hasAttribute("data-pricing-aria-source")) element.setAttribute("data-pricing-aria-source", source);
        }
        for (const [element, source] of footer) {
            if (element.textContent !== source && !element.hasAttribute("data-pricing-footer-source")) element.setAttribute("data-pricing-footer-source", source);
        }
        for (const option of document.querySelectorAll("#language-select option")) option.toggleAttribute("selected", option.getAttribute("value") === "en-US");
        writeFileSync(page, await format("<!doctype html>\n" + document.documentElement.outerHTML, { ...(await resolveConfig(page)), filepath: page }));
    } finally {
        await window.happyDOM.close();
    }
    console.log("Standalone pricing HTML renders English before JavaScript");
}
