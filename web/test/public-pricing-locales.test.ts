import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { Window } from "happy-dom";
import { SUPPORTED_LOCALES } from "../src/i18n/locales";

const html = readFileSync(new URL("../public/pricing.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/pricing-i18n.js", import.meta.url), "utf8");

describe("standalone pricing native languages", () => {
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
            } finally {
                await window.happyDOM.close();
            }
        });
    }
});
