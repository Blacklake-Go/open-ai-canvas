import type { Locale } from "antd/es/locale";
import zhCN from "antd/locale/zh_CN";

import type { SupDanceLocaleCode } from "../types";

const cachedAntdLocales: Partial<Record<SupDanceLocaleCode, Locale>> = {
    "zh-CN": zhCN,
};

const antdLocaleLoaders: Record<Exclude<SupDanceLocaleCode, "zh-CN">, () => Promise<{ default: Locale }>> = {
    "en-US": () => import("antd/locale/en_US"),
    "zh-TW": () => import("antd/locale/zh_TW"),
    "ja-JP": () => import("antd/locale/ja_JP"),
    "ko-KR": () => import("antd/locale/ko_KR"),
    "es-ES": () => import("antd/locale/es_ES"),
};

export async function loadAntdLocale(code: SupDanceLocaleCode): Promise<Locale> {
    if (code === "zh-CN") return zhCN;
    if (cachedAntdLocales[code]) return cachedAntdLocales[code]!;
    const loader = antdLocaleLoaders[code as Exclude<SupDanceLocaleCode, "zh-CN">];
    if (!loader) return zhCN;
    try {
        const mod = await loader();
        const loc = (mod as { default?: Locale }).default || (mod as unknown as Locale);
        cachedAntdLocales[code] = loc;
        return loc;
    } catch {
        return zhCN;
    }
}

export function getAntdLocaleForCode(code: SupDanceLocaleCode, pluginEnabled = true): Locale {
    if (!pluginEnabled || code === "zh-CN") return zhCN;
    return cachedAntdLocales[code] || { ...zhCN, locale: code.toLowerCase() };
}
