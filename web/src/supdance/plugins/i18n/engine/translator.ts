import type { SupDanceI18nEntry, SupDanceLocaleCode } from "../types";

export type CompiledI18nDictionary = {
    byKey: Map<string, SupDanceI18nEntry>;
    bySourceText: Map<string, SupDanceI18nEntry>;
};

type DynamicPatternRule = {
    regex: RegExp;
    format: Record<SupDanceLocaleCode, (...groups: string[]) => string>;
};

const DYNAMIC_PATTERN_RULES: readonly DynamicPatternRule[] = [
    {
        regex: /^共\s*(\d+)\s*条$/,
        format: {
            "zh-CN": (total) => `共 ${total} 条`,
            "en-US": (total) => `Total ${total}`,
            "zh-TW": (total) => `共 ${total} 條`,
            "ja-JP": (total) => `全 ${total} 件`,
            "ko-KR": (total) => `총 ${total}개`,
            "es-ES": (total) => `Total ${total}`,
        },
    },
    {
        regex: /^(\d+)-(\d+)\s*\/\s*共\s*(\d+)\s*条$/,
        format: {
            "zh-CN": (start, end, total) => `${start}-${end} / 共 ${total} 条`,
            "en-US": (start, end, total) => `${start}-${end} of ${total}`,
            "zh-TW": (start, end, total) => `${start}-${end} / 共 ${total} 條`,
            "ja-JP": (start, end, total) => `${start}-${end} / 全 ${total} 件`,
            "ko-KR": (start, end, total) => `${start}-${end} / 총 ${total}개`,
            "es-ES": (start, end, total) => `${start}-${end} de ${total}`,
        },
    },
    {
        regex: /^(\d+)\s*条\/页$/,
        format: {
            "zh-CN": (size) => `${size} 条/页`,
            "en-US": (size) => `${size} / page`,
            "zh-TW": (size) => `${size} 條/頁`,
            "ja-JP": (size) => `${size} 件/ページ`,
            "ko-KR": (size) => `${size}개/페이지`,
            "es-ES": (size) => `${size} / pág.`,
        },
    },
    {
        regex: /^(\d+)\s*位已启用$/,
        format: {
            "zh-CN": (count) => `${count} 位已启用`,
            "en-US": (count) => `${count} users enabled`,
            "zh-TW": (count) => `${count} 位已啟用`,
            "ja-JP": (count) => `${count} 名が有効化`,
            "ko-KR": (count) => `${count}명 활성화됨`,
            "es-ES": (count) => `${count} usuarios activos`,
        },
    },
    {
        regex: /^已选择\s*(\d+)\s*项$/,
        format: {
            "zh-CN": (count) => `已选择 ${count} 项`,
            "en-US": (count) => `${count} selected`,
            "zh-TW": (count) => `已選擇 ${count} 項`,
            "ja-JP": (count) => `${count} 件を選択中`,
            "ko-KR": (count) => `${count}개 선택됨`,
            "es-ES": (count) => `${count} seleccionados`,
        },
    },
    {
        regex: /^打开积分中心，可用\s*([\d,.+-]+|--)\s*积分$/,
        format: {
            "zh-CN": (bal) => `打开积分中心，可用 ${bal} 积分`,
            "en-US": (bal) => `Open Credits Center, ${bal} available`,
            "zh-TW": (bal) => `打開積分中心，可用 ${bal} 積分`,
            "ja-JP": (bal) => `クレジットセンターを開く（利用可能: ${bal}）`,
            "ko-KR": (bal) => `크레딧 센터 열기 (사용 가능: ${bal})`,
            "es-ES": (bal) => `Abrir centro de créditos, ${bal} disponibles`,
        },
    },
];

export function compileI18nDictionary(entries: readonly SupDanceI18nEntry[]): CompiledI18nDictionary {
    const byKey = new Map<string, SupDanceI18nEntry>();
    const bySourceText = new Map<string, SupDanceI18nEntry>();

    for (const entry of entries) {
        byKey.set(entry.key, entry);
        const source = entry.sourceText.trim();
        if (source) {
            bySourceText.set(source, entry);
        }
        const zhCN = entry.translations["zh-CN"]?.trim();
        if (zhCN && !bySourceText.has(zhCN)) {
            bySourceText.set(zhCN, entry);
        }
    }

    return { byKey, bySourceText };
}

export function interpolateTemplate(template: string, vars?: Record<string, string | number>): string {
    if (!vars) return template;
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (full, key: string) => {
        const value = vars[key];
        return value === undefined || value === null ? full : String(value);
    });
}

export function resolveEntryTranslation(entry: SupDanceI18nEntry, locale: SupDanceLocaleCode, fallbackLocale: SupDanceLocaleCode = "zh-CN"): string {
    const direct = entry.translations[locale]?.trim();
    if (direct) return direct;
    const fallback = entry.translations[fallbackLocale]?.trim();
    if (fallback) return fallback;
    const zh = entry.translations["zh-CN"]?.trim();
    if (zh) return zh;
    return entry.sourceText;
}

export function translateByKey(dictionary: CompiledI18nDictionary, key: string, locale: SupDanceLocaleCode, fallbackLocale: SupDanceLocaleCode = "zh-CN", vars?: Record<string, string | number>, fallbackText?: string): string {
    const entry = dictionary.byKey.get(key);
    if (!entry) {
        return interpolateTemplate(fallbackText ?? key, vars);
    }
    const resolved = resolveEntryTranslation(entry, locale, fallbackLocale);
    return interpolateTemplate(resolved, vars);
}

export function translateSourceText(dictionary: CompiledI18nDictionary, rawText: string, locale: SupDanceLocaleCode, fallbackLocale: SupDanceLocaleCode = "zh-CN"): string | null {
    if (!rawText) return null;
    const match = rawText.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match) return null;
    const [, leading, core, trailing] = match;
    if (!core) return null;

    const exact = dictionary.bySourceText.get(core);
    if (exact) {
        const translated = resolveEntryTranslation(exact, locale, fallbackLocale);
        return `${leading}${translated}${trailing}`;
    }

    for (const rule of DYNAMIC_PATTERN_RULES) {
        const groups = core.match(rule.regex);
        if (groups) {
            const formatter = rule.format[locale] || rule.format[fallbackLocale] || rule.format["zh-CN"];
            return `${leading}${formatter(...groups.slice(1))}${trailing}`;
        }
    }

    return null;
}
