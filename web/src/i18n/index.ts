import i18next, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import { useLocaleStore } from "@/stores/use-locale-store";
import { NATIVE_CATALOGS, expandCatalog } from "./catalogs";
import { CREATION_CATALOGS, CREATION_NAMESPACE } from "@/supdance/plugins/i18n/creation-catalogs";
import { MODEL_CATALOGS, MODEL_NAMESPACE } from "@/supdance/plugins/i18n/model-catalogs";
import { toI18nextTemplate } from "./interpolation";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type AppLocale } from "./locales";

/** 每种语言 = 公共目录 + 各页面区域目录（区域名作为顶级命名空间）。 */
function buildResources(): Resource {
    return Object.fromEntries(
        SUPPORTED_LOCALES.map(({ code }) => [
            code,
            {
                translation: expandCatalog(NATIVE_CATALOGS[code]),
                [MODEL_NAMESPACE]: { ...MODEL_CATALOGS[code] },
                [CREATION_NAMESPACE]: Object.fromEntries(Object.entries(CREATION_CATALOGS[code]).map(([key, text]) => [key, toI18nextTemplate(text)])),
            },
        ]),
    );
}

/**
 * 应用唯一的 i18next 实例。语言来自 useLocaleStore（本设备偏好，首次按浏览器语言），
 * 缺失的键回退到简体中文，保证未翻译的页面仍可用。资源随包内联，初始化同步完成。
 */
export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
    resources: buildResources(),
    lng: useLocaleStore.getState().locale,
    fallbackLng: DEFAULT_LOCALE,
    initAsync: false,
    returnNull: false,
    interpolation: { escapeValue: false },
    react: { bindI18nStore: "added removed" },
});

useLocaleStore.subscribe((state, previous) => {
    if (state.locale !== previous.locale) void i18n.changeLanguage(state.locale);
});

/** 当前界面语言；用于 Intl 日期与数字格式化。 */
export function currentLocale(): AppLocale {
    return useLocaleStore.getState().locale;
}

/** 非组件代码（服务层、工具函数）使用的翻译函数。 */
export function translate(key: string, options?: Record<string, unknown>): string {
    return i18n.t(key, options) as string;
}

/**
 * 用户切换界面语言：保存偏好后整页刷新。部分文案在模块加载或缓存数据里生成，
 * 只靠组件重渲染会出现新旧语言混排；刷新保证整页使用同一种语言。
 */
export function switchLocale(next: AppLocale, options: { updateLanguageQuery?: boolean } = {}) {
    if (next === currentLocale()) return;
    useLocaleStore.getState().setLocale(next);
    if (typeof window !== "undefined") {
        if (options.updateLanguageQuery) {
            const url = new URL(window.location.href);
            url.searchParams.set("lang", next);
            window.location.assign(url.href);
        } else window.location.reload();
    }
}
