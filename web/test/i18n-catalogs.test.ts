import { afterEach, describe, expect, test } from "bun:test";

import { i18n, switchLocale } from "@/i18n";
import { AREA_CATALOGS } from "@/i18n/areas";
import { NATIVE_CATALOGS } from "@/i18n/catalogs";
import { detectBrowserLocale, matchAppLocale, SUPPORTED_LOCALES } from "@/i18n/locales";
import { deDE } from "@/i18n/messages/de-DE";
import { enUS } from "@/i18n/messages/en-US";
import { frFR } from "@/i18n/messages/fr-FR";
import { jaJP } from "@/i18n/messages/ja-JP";
import { koKR } from "@/i18n/messages/ko-KR";
import { zhCN } from "@/i18n/messages/zh-CN";
import { formatRelativeTime } from "@/lib/relative-time";
import { localizedApiErrorMessage } from "@/services/api/error-codes";
import { useLocaleStore } from "@/stores/use-locale-store";

function flatten(value: unknown, prefix = "", result: Record<string, string> = {}): Record<string, string> {
    if (typeof value === "string") result[prefix] = value;
    else for (const [key, child] of Object.entries(value as Record<string, unknown>)) flatten(child, prefix ? `${prefix}.${key}` : key, result);
    return result;
}

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();

afterEach(() => useLocaleStore.getState().setLocale("zh-CN"));

describe("i18n catalogs", () => {
    test("legal language selection updates the explicit link language and retains its other parameters and anchor", () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, "window");
        let destination = "";
        Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: {
                location: {
                    href: "https://supdance.com/privacy?lang=fr&return=%2Fcreate#rights",
                    assign: (value: string) => (destination = value),
                    reload: () => {
                        throw new Error("Legal deep link was not updated");
                    },
                },
            },
        });
        try {
            useLocaleStore.getState().setLocale("fr-FR");
            switchLocale("es-ES", { updateLanguageQuery: true });
            const url = new URL(destination);
            expect(url.searchParams.get("lang")).toBe("es-ES");
            expect(url.searchParams.get("return")).toBe("/create");
            expect(url.hash).toBe("#rights");
            expect(useLocaleStore.getState().locale).toBe("es-ES");
        } finally {
            if (original) Object.defineProperty(globalThis, "window", original);
            else Reflect.deleteProperty(globalThis, "window");
        }
    });
    const source = NATIVE_CATALOGS["zh-CN"];
    const catalogs = NATIVE_CATALOGS;

    test("every locale is registered and has the same keys and placeholders as zh-CN", () => {
        expect(SUPPORTED_LOCALES.map((locale) => locale.code).sort()).toEqual(["de-DE", "en-US", "es-ES", "fr-FR", "ja-JP", "ko-KR", "zh-CN", "zh-TW"]);
        for (const [code, catalog] of Object.entries(catalogs)) {
            const flat = flatten(catalog);
            expect(Object.keys(flat).sort(), code).toEqual(Object.keys(source).sort());
            for (const [key, text] of Object.entries(flat)) {
                expect(text.trim().length, `${code} ${key}`).toBeGreaterThan(0);
                expect(placeholders(text), `${code} ${key}`).toEqual(placeholders(source[key]));
            }
        }
    });

    test("every page-area catalog matches its zh-CN keys and placeholders in all locales", () => {
        for (const [area, catalog] of Object.entries(AREA_CATALOGS)) {
            const areaSource = flatten(catalog["zh-CN"]);
            for (const { code } of SUPPORTED_LOCALES) {
                const flat = flatten(catalog[code]);
                expect(Object.keys(flat).sort(), `${area} ${code}`).toEqual(Object.keys(areaSource).sort());
                for (const [key, text] of Object.entries(flat)) {
                    expect(text.trim().length, `${area} ${code} ${key}`).toBeGreaterThan(0);
                    expect(placeholders(text), `${area} ${code} ${key}`).toEqual(placeholders(areaSource[key]));
                }
            }
        }
    });

    test("page-area namespaces do not collide with core namespaces", () => {
        for (const area of Object.keys(AREA_CATALOGS)) expect(Object.keys(zhCN)).not.toContain(area);
    });

    test("browser languages map to supported locales", () => {
        expect(matchAppLocale("en")).toBe("en-US");
        expect(matchAppLocale("ja-jp")).toBe("ja-JP");
        expect(matchAppLocale("zh-TW")).toBe("zh-TW");
        expect(matchAppLocale("zh-Hant-HK")).toBe("zh-TW");
        expect(matchAppLocale("zh_HK")).toBe("zh-TW");
        expect(matchAppLocale("es-ES")).toBe("es-ES");
        expect(detectBrowserLocale(["es-MX", "de-AT"])).toBe("es-ES");
        expect(detectBrowserLocale(["pt-BR"])).toBe("zh-CN");
        expect(detectBrowserLocale(undefined)).toBe("zh-CN");
    });

    test("switching locale updates i18next and rejects unsupported values", () => {
        useLocaleStore.getState().setLocale("ko-KR");
        expect(i18n.language).toBe("ko-KR");
        expect(i18n.t("nav.tools.canvas")).toBe("캔버스");
        useLocaleStore.getState().setLocale("xx-XX" as never);
        expect(useLocaleStore.getState().locale).toBe("ko-KR");
    });
});

describe("localized API errors", () => {
    test("Chinese keeps the backend message; other locales translate well-defined reasons only", () => {
        expect(localizedApiErrorMessage("rate_limited", "操作太频繁")).toBe("操作太频繁");
        useLocaleStore.getState().setLocale("en-US");
        expect(localizedApiErrorMessage("rate_limited", "操作太频繁")).toBe("Too many requests. Try again later.");
        expect(localizedApiErrorMessage("invalid_argument", "名称不能为空")).toBe("名称不能为空");
        expect(localizedApiErrorMessage(undefined, "原文")).toBe("原文");
    });

    test("relative time follows the interface language", () => {
        const now = Date.parse("2026-11-04T12:00:00Z");
        expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5 分钟前");
        useLocaleStore.getState().setLocale("en-US");
        expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5 min ago");
        expect(formatRelativeTime(undefined, now)).toBe("Unknown time");
    });
});
