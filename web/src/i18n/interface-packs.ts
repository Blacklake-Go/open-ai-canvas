import type { i18n as I18n } from "i18next";
import type { AppLocale } from "./locales";

export const INTERFACE_NAMESPACE = "static-ui";
export type InterfacePack = Record<AppLocale, string>;

const packs = new Set<InterfacePack>();
const downloads = new Map<string, Promise<void>>();
const pendingDownloads = new Set<Promise<void>>();
const builtin = new Map<AppLocale, Record<string, string>>();
const published = new Map<AppLocale, Record<string, string>>();

function applyInterfaceMessages(i18n: I18n, locale: AppLocale) {
    i18n.addResourceBundle(locale, INTERFACE_NAMESPACE, { managedUi: { ...builtin.get(locale), ...published.get(locale) } });
}

export function setPublishedInterfaceMessages(i18n: I18n, locale: AppLocale, messages: Record<string, string>) {
    if (!published.has(locale) && !Object.keys(messages).length) return;
    published.set(locale, messages);
    applyInterfaceMessages(i18n, locale);
}

function loadInterfacePack(i18n: I18n, pack: InterfacePack, locale: AppLocale) {
    const url = pack[locale];
    const existing = downloads.get(url);
    if (existing) return existing;

    const download = (async () => {
        const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const messages = (await response.json()) as Record<string, string>;
        const current = builtin.get(locale) ?? {};
        Object.assign(current, messages);
        builtin.set(locale, current);
        applyInterfaceMessages(i18n, locale);
    })().catch((error: unknown) => {
        downloads.delete(url);
        // Keep the page usable with its source phrases and retry on the next locale preparation.
        console.warn("Could not load interface translations", locale, url, error);
    });
    downloads.set(url, download);
    pendingDownloads.add(download);
    void download.finally(() => pendingDownloads.delete(download));
    return download;
}

export function waitForInterfacePackDownloads() {
    if (pendingDownloads.size) return Promise.all(pendingDownloads);
}

export function registerInterfacePack(i18n: I18n, pack: InterfacePack, locale: AppLocale) {
    packs.add(pack);
    return loadInterfacePack(i18n, pack, locale);
}

export function prepareInterfaceLocale(i18n: I18n, locale: AppLocale) {
    if (packs.size) return Promise.all(Array.from(packs, (pack) => loadInterfacePack(i18n, pack, locale)));
}
