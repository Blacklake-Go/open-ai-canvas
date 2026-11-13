/**
 * 灵感目录分类标签的六语映射。
 *
 * 目录 JSON 与 manifest 里的分类标签是简中原文，且同一分类码在不同来源下可能对应不同标签，
 * 因此这里按“简中标签”建表而不是按分类码，避免跨来源的同码不同名互相覆盖。
 * 不走 i18n 词典的原文匹配：像“角色”“其他”这类词在后台与技能命名空间已有另一套释义，
 * 按原文整站替换会把灵感分类译成管理后台的说法。
 */
import type { SupDanceLocaleCode } from "@/supdance/plugins/i18n/types";

import categoryLocales from "./category-locales.json";

const INSPIRATION_CATEGORY_LABELS: Record<string, Partial<Record<SupDanceLocaleCode, string>>> = Object.fromEntries(
    Object.keys(categoryLocales["zh-CN"]).map((source) => [source, Object.fromEntries(Object.entries(categoryLocales).map(([code, labels]) => [code, (labels as Record<string, string>)[source]]))]),
);

const FALLBACK_LOCALE: SupDanceLocaleCode = "zh-CN";

/** 把 manifest 的简中分类标签解析成当前语种标签；未收录时原样返回，不猜测译文。 */
export function resolveInspirationCategoryLabel(zhLabel: string | undefined, locale: SupDanceLocaleCode): string {
    const label = zhLabel?.trim();
    if (!label) return "";
    if (locale === FALLBACK_LOCALE) return label;
    return INSPIRATION_CATEGORY_LABELS[label]?.[locale] ?? label;
}

export const INSPIRATION_CATEGORY_LOCALE_COUNT = Object.keys(INSPIRATION_CATEGORY_LABELS).length;
