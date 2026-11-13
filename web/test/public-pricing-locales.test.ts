import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { Window } from "happy-dom";
import { SUPPORTED_LOCALES } from "../src/i18n/locales";
import { HTML_ADMIN_I18N_ENTRIES } from "../src/supdance/plugins/i18n/locales/html-admin";

const html = readFileSync(new URL("../public/pricing.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/pricing-i18n.js", import.meta.url), "utf8");

describe("standalone pricing native languages", () => {
    test("deep links follow language changes even when storage is restricted", async () => {
        const window = new Window({ url: "https://example.com/pricing.html?lang=fr-FR&from=footer#models" });
        try {
            window.document.write(html);
            runInNewContext(script, {
                document: window.document,
                NodeFilter: window.NodeFilter,
                localStorage: {
                    getItem() {
                        throw new Error("blocked");
                    },
                    setItem() {
                        throw new Error("blocked");
                    },
                },
                URL,
                URLSearchParams,
                location: window.location,
                history: window.history,
                navigator: { languages: ["zh-CN"] },
            });
            expect(window.document.documentElement.lang).toBe("fr-FR");
            const selector = window.document.getElementById("language-select") as unknown as HTMLSelectElement;
            selector.value = "es-ES";
            selector.dispatchEvent(new window.Event("change"));
            expect(window.document.documentElement.lang).toBe("es-ES");
            expect(window.location.search).toBe("?lang=es-ES&from=footer");
            expect(window.location.hash).toBe("#models");
        } finally {
            await window.happyDOM.close();
        }
    });
    for (const { code } of SUPPORTED_LOCALES) {
        test(`${code} translates the real page without changing model identifiers or monetary cells`, async () => {
            const window = new Window({ url: "http://localhost/pricing.html" });
            try {
                window.document.write(html);
                const selector = window.document.getElementById("language-select") as unknown as HTMLSelectElement;
                expect(Array.from(selector.options, (option) => option.value)).toEqual(SUPPORTED_LOCALES.map((locale) => locale.code));
                const cells = [...window.document.querySelectorAll("td")];
                const original = cells.map((cell) => cell.textContent);
                window.localStorage.setItem("yingce:locale", JSON.stringify({ state: { locale: code }, version: 0 }));
                runInNewContext(script, {
                    document: window.document,
                    NodeFilter: window.NodeFilter,
                    localStorage: window.localStorage,
                    URLSearchParams,
                    location: { search: "" },
                    navigator: { languages: ["zh-CN"] },
                });
                expect(window.document.documentElement.lang).toBe(code);
                expect(selector.value).toBe(code);
                expect(window.document.querySelector("h1")!.textContent).toContain("SupDance ONE");
                for (const [id, key] of [
                    ["sd-ft-brand-slogan", "public.footer.brand_slogan"],
                    ["sd-ft-brand-vision", "public.footer.brand_vision"],
                    ["sd-ft-social-label", "public.footer.official_channels"],
                ]) {
                    const entry = HTML_ADMIN_I18N_ENTRIES.find((item) => item.key === key)!;
                    const element = window.document.getElementById(id)!;
                    expect(element.textContent).toBe(entry.translations[code]);
                    // The real page applies server footer settings after the initial render.
                    element.textContent = entry.sourceText;
                    window.document.dispatchEvent(new window.Event("supdance:footer-config-applied"));
                    expect(element.textContent).toBe(entry.translations[code]);
                }
                for (let index = 0; index < cells.length; index++) {
                    if (/^[\x20-\x7e\s]+$/.test(original[index] || "")) expect(cells[index]?.textContent).toBe(original[index]);
                }
                if (["en-US", "fr-FR", "de-DE", "ko-KR"].includes(code)) {
                    const walker = window.document.createTreeWalker(window.document.body, window.NodeFilter.SHOW_TEXT);
                    const leftovers: string[] = [];
                    while (walker.nextNode()) {
                        const node = walker.currentNode;
                        if (node.parentElement?.closest("main, header") && !node.parentElement.closest("select, script, style") && /\p{Script=Han}/u.test(node.nodeValue || "")) leftovers.push(node.nodeValue || "");
                    }
                    expect(leftovers).toEqual([]);
                }
                selector.value = "zh-CN";
                selector.dispatchEvent(new window.Event("change"));
                expect(cells.map((cell) => cell.textContent)).toEqual(original);
                const customVision = "工作室自定义介绍 — preserve my wording";
                window.document.getElementById("sd-ft-brand-vision")!.textContent = customVision;
                window.document.dispatchEvent(new window.Event("supdance:footer-config-applied"));
                selector.value = code;
                selector.dispatchEvent(new window.Event("change"));
                expect(window.document.getElementById("sd-ft-brand-vision")!.textContent).toBe(customVision);
            } finally {
                await window.happyDOM.close();
            }
        });
    }
});
