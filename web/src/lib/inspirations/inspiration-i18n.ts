/**
 * 灵感大厅素材多语言运行时加载与解析器。
 *
 * 遵循系统当前语言（支持 zh-CN, en-US, zh-TW, ja-JP, ko-KR, es-ES 六大语种）。
 * 1. 中文（zh-CN）直接使用本地高质量已校对文案，零网络请求。
 * 2. 其它语种按需拉取对应语言包 /inspirations/translations/<locale>.json 并做内存缓存。
 * 3. 严格保留素材原本的所有元数据与 sourceUrl 跳转链接，不修改或丢失任何素材。
 */
import { useEffect, useMemo, useState } from "react";
import type { SupDanceLocaleCode } from "@/supdance/plugins/i18n/types";
import type { CreationInspiration } from "./catalog";

export type LocalizedInspirationData = {
    title?: string;
    description?: string;
    prompt?: string;
};

type TranslationPack = Record<string, LocalizedInspirationData>;

const translationCache = new Map<SupDanceLocaleCode, TranslationPack>();
const pendingLoads = new Map<SupDanceLocaleCode, Promise<TranslationPack>>();
const listeners = new Set<() => void>();

export function subscribeInspirationTranslations(callback: () => void): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

function notifyListeners(): void {
    for (const callback of listeners) {
        try {
            callback();
        } catch (error) {
            console.error("Inspiration i18n subscriber error", error);
        }
    }
}

export async function loadInspirationTranslations(locale: SupDanceLocaleCode): Promise<TranslationPack> {
    if (locale === "zh-CN") return {};
    const cached = translationCache.get(locale);
    if (cached) return cached;
    const inflight = pendingLoads.get(locale);
    if (inflight) return inflight;

    const promise = (async () => {
        try {
            const response = await fetch(`/inspirations/translations/${locale}.json`, {
                headers: { Accept: "application/json" },
            });
            if (!response.ok) {
                return {};
            }
            const data = (await response.json()) as TranslationPack;
            translationCache.set(locale, data);
            notifyListeners();
            return data;
        } catch (error) {
            console.warn(`Error loading inspiration translations for ${locale}`, error);
            return {};
        } finally {
            pendingLoads.delete(locale);
        }
    })();

    pendingLoads.set(locale, promise);
    return promise;
}

export function setInspirationTranslations(locale: SupDanceLocaleCode, pack: TranslationPack): void {
    translationCache.set(locale, pack);
    notifyListeners();
}

export function resolveInspirationItem(item: CreationInspiration, locale: SupDanceLocaleCode): CreationInspiration {
    if (locale === "zh-CN" || !item) return item;
    if (!translationCache.has(locale) && !pendingLoads.has(locale)) {
        void loadInspirationTranslations(locale);
    }
    const pack = translationCache.get(locale);
    const key = item.id ?? item.title;
    const localized = pack?.[key];
    if (!localized) return item;

    return {
        ...item,
        title: localized.title?.trim() || item.title,
        description: localized.description?.trim() || item.description,
        prompt: localized.prompt?.trim() || item.prompt,
    };
}

export function useLocalizedInspirations(entries: CreationInspiration[], locale: SupDanceLocaleCode): CreationInspiration[] {
    const [, setTick] = useState(0);
    useEffect(() => {
        if (locale === "zh-CN") return;
        void loadInspirationTranslations(locale);
        return subscribeInspirationTranslations(() => setTick((v) => v + 1));
    }, [locale]);

    return useMemo(() => {
        if (locale === "zh-CN") return entries;
        return entries.map((item) => resolveInspirationItem(item, locale));
    }, [entries, locale]);
}
