import { BUILTIN_SUPDANCE_I18N_ENTRIES } from "../locales";
import type { SupDanceI18nEntry, SupDanceLocaleCode } from "../types";

export type CompiledTemplateRule = {
    key: string;
    regex: RegExp;
    paramNames: string[];
    entry: SupDanceI18nEntry;
};

export type CompiledI18nDictionary = {
    byKey: Map<string, SupDanceI18nEntry>;
    bySourceText: Map<string, SupDanceI18nEntry>;
    templateRules: CompiledTemplateRule[];
};

type DynamicPatternRule = {
    regex: RegExp;
    format: Record<SupDanceLocaleCode, (...groups: string[]) => string>;
};

const BUILTIN_SOURCE_BY_KEY = new Map<string, string>(BUILTIN_SUPDANCE_I18N_ENTRIES.map((item) => [item.key, item.sourceText.trim()]));

const PLACEHOLDER_TOKEN_REGEX = /\{([a-zA-Z0-9_]+)\}/g;
const HAN_CHARACTER_REGEX = /[\u4e00-\u9fff]/;

/** 动态规则里出现的封闭名词，按语种给出对应说法；不在表内的原文保持原样。 */
const MODE_NOUN_BY_LOCALE: Record<string, Record<string, string>> = {
    "en-US": { 图片: "image", 视频: "video", 音乐: "music", 文本: "text", 音频: "audio", 全部: "All" },
    "zh-TW": { 图片: "圖片", 视频: "影片", 音乐: "音樂", 文本: "文字", 音频: "音訊", 全部: "全部" },
    "ja-JP": { 图片: "画像", 视频: "動画", 音乐: "音楽", 文本: "テキスト", 音频: "音声", 全部: "すべて" },
    "ko-KR": { 图片: "이미지", 视频: "비디오", 音乐: "음악", 文本: "텍스트", 音频: "오디오", 全部: "전체" },
    "es-ES": { 图片: "imagen", 视频: "vídeo", 音乐: "música", 文本: "texto", 音频: "audio", 全部: "Todos" },
};

const modeNoun = (locale: string, zh: string) => MODE_NOUN_BY_LOCALE[locale]?.[zh] ?? zh;

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
    {
        regex: /^第\s*(\d+)\s*镜$/,
        format: {
            "zh-CN": (shot) => `第 ${shot} 镜`,
            "en-US": (shot) => `Shot #${shot}`,
            "zh-TW": (shot) => `第 ${shot} 鏡`,
            "ja-JP": (shot) => `カット #${shot}`,
            "ko-KR": (shot) => `샷 #${shot}`,
            "es-ES": (shot) => `Toma #${shot}`,
        },
    },
    {
        regex: /^(\d+)\s*秒$/,
        format: {
            "zh-CN": (sec) => `${sec} 秒`,
            "en-US": (sec) => `${sec}s`,
            "zh-TW": (sec) => `${sec} 秒`,
            "ja-JP": (sec) => `${sec}秒`,
            "ko-KR": (sec) => `${sec}초`,
            "es-ES": (sec) => `${sec}s`,
        },
    },
    {
        regex: /^共\s*(\d+)\s*个镜头$/,
        format: {
            "zh-CN": (count) => `共 ${count} 个镜头`,
            "en-US": (count) => `${count} shots total`,
            "zh-TW": (count) => `共 ${count} 個鏡頭`,
            "ja-JP": (count) => `合計 ${count} カット`,
            "ko-KR": (count) => `총 ${count}개 샷`,
            "es-ES": (count) => `${count} tomas en total`,
        },
    },
    {
        regex: /^(\d+)\s*个节点$/,
        format: {
            "zh-CN": (count) => `${count} 个节点`,
            "en-US": (count) => `${count} ${Number(count) === 1 ? "node" : "nodes"}`,
            "zh-TW": (count) => `${count} 個節點`,
            "ja-JP": (count) => `${count} ノード`,
            "ko-KR": (count) => `${count}개 노드`,
            "es-ES": (count) => `${count} ${Number(count) === 1 ? "nodo" : "nodos"}`,
        },
    },
    {
        regex: /^(\d+)\s*天前$/,
        format: {
            "zh-CN": (d) => `${d} 天前`,
            "en-US": (d) => `${d}d ago`,
            "zh-TW": (d) => `${d} 天前`,
            "ja-JP": (d) => `${d}日前`,
            "ko-KR": (d) => `${d}일 전`,
            "es-ES": (d) => `hace ${d} d`,
        },
    },
    {
        regex: /^(\d+)\s*小时前$/,
        format: {
            "zh-CN": (h) => `${h} 小时前`,
            "en-US": (h) => `${h}h ago`,
            "zh-TW": (h) => `${h} 小時前`,
            "ja-JP": (h) => `${h}時間前`,
            "ko-KR": (h) => `${h}시간 전`,
            "es-ES": (h) => `hace ${h} h`,
        },
    },
    {
        regex: /^(\d+)\s*分钟前$/,
        format: {
            "zh-CN": (m) => `${m} 分钟前`,
            "en-US": (m) => `${m}m ago`,
            "zh-TW": (m) => `${m} 分鐘前`,
            "ja-JP": (m) => `${m}分前`,
            "ko-KR": (m) => `${m}분 전`,
            "es-ES": (m) => `hace ${m} m`,
        },
    },
    {
        regex: /^刚刚$/,
        format: {
            "zh-CN": () => "刚刚",
            "en-US": () => "Just now",
            "zh-TW": () => "剛剛",
            "ja-JP": () => "たった今",
            "ko-KR": () => "방금 전",
            "es-ES": () => "Justo ahora",
        },
    },
    {
        regex: /^选择(图片|视频|音乐|文本|音频)模型$/,
        format: {
            "zh-CN": (mode) => `选择${mode}模型`,
            "en-US": (mode) => `Select ${modeNoun("en-US", mode)} model`,
            "zh-TW": (mode) => `選擇${modeNoun("zh-TW", mode)}模型`,
            "ja-JP": (mode) => `${modeNoun("ja-JP", mode)}モデルを選択`,
            "ko-KR": (mode) => `${modeNoun("ko-KR", mode)} 모델 선택`,
            "es-ES": (mode) => `Selecciona modelo de ${modeNoun("es-ES", mode)}`,
        },
    },
    {
        regex: /^(全部|图片|视频|音乐|文本)\s+([\d,.]+)\s*条$/,
        format: {
            "zh-CN": (mode, count) => `${mode} ${count} 条`,
            "en-US": (mode, count) => `${modeNoun("en-US", mode)} ${count}`,
            "zh-TW": (mode, count) => `${modeNoun("zh-TW", mode)} ${count} 條`,
            "ja-JP": (mode, count) => `${modeNoun("ja-JP", mode)} ${count} 件`,
            "ko-KR": (mode, count) => `${modeNoun("ko-KR", mode)} ${count}개`,
            "es-ES": (mode, count) => `${modeNoun("es-ES", mode)} ${count}`,
        },
    },
    {
        regex: /^已达到当前模型的参考内容上限（(\d+) 个）$/,
        format: {
            "zh-CN": (max) => `已达到当前模型的参考内容上限（${max} 个）`,
            "en-US": (max) => `Reached this model's reference limit (${max})`,
            "zh-TW": (max) => `已達到目前模型的參考內容上限（${max} 個）`,
            "ja-JP": (max) => `このモデルの参照上限に達しました（${max} 件）`,
            "ko-KR": (max) => `이 모델의 참고 자료 한도에 도달했습니다(${max}개)`,
            "es-ES": (max) => `Se alcanzó el límite de referencias de este modelo (${max})`,
        },
    },
    // 灵感卡片的操作无障碍标签把内容标题拼进同一个字符串，词典原文匹配不到，只能按前缀模板整串替换。
    {
        regex: /^查看灵感：(.+)$/,
        format: {
            "zh-CN": (title) => `查看灵感：${title}`,
            "en-US": (title) => `View inspiration: ${title}`,
            "zh-TW": (title) => `檢視靈感：${title}`,
            "ja-JP": (title) => `インスピレーションを見る: ${title}`,
            "ko-KR": (title) => `영감 보기: ${title}`,
            "es-ES": (title) => `Ver inspiración: ${title}`,
        },
    },
    {
        regex: /^收藏：(.+)$/,
        format: {
            "zh-CN": (title) => `收藏：${title}`,
            "en-US": (title) => `Add to favorites: ${title}`,
            "zh-TW": (title) => `收藏：${title}`,
            "ja-JP": (title) => `お気に入りに追加: ${title}`,
            "ko-KR": (title) => `즐겨찾기 추가: ${title}`,
            "es-ES": (title) => `Añadir a favoritos: ${title}`,
        },
    },
    {
        regex: /^更多灵感操作：(.+)$/,
        format: {
            "zh-CN": (title) => `更多灵感操作：${title}`,
            "en-US": (title) => `More inspiration actions: ${title}`,
            "zh-TW": (title) => `更多靈感操作：${title}`,
            "ja-JP": (title) => `その他の操作: ${title}`,
            "ko-KR": (title) => `추가 작업: ${title}`,
            "es-ES": (title) => `Más acciones de inspiración: ${title}`,
        },
    },
    {
        regex: /^生成设置：(.+)$/,
        format: {
            "zh-CN": (summary) => `生成设置：${summary}`,
            "en-US": (summary) => `Generation settings: ${summary}`,
            "zh-TW": (summary) => `生成設定：${summary}`,
            "ja-JP": (summary) => `生成設定: ${summary}`,
            "ko-KR": (summary) => `생성 설정: ${summary}`,
            "es-ES": (summary) => `Ajustes de generación: ${summary}`,
        },
    },
];

function escapeRegexLiteral(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTemplateRule(patternText: string, entry: SupDanceI18nEntry): CompiledTemplateRule | null {
    if (!patternText.includes("{")) return null;
    const paramNames: string[] = [];
    let lastIndex = 0;
    let regexBody = "";
    let match: RegExpExecArray | null;
    const tokenRegex = new RegExp(PLACEHOLDER_TOKEN_REGEX.source, "g");

    while ((match = tokenRegex.exec(patternText)) !== null) {
        const literalSlice = patternText.slice(lastIndex, match.index);
        // Allow flexible whitespace around placeholders when literal has spaces
        regexBody += escapeRegexLiteral(literalSlice).replace(/\s+/g, "\\s*");
        paramNames.push(match[1]!);
        regexBody += "(.+?)";
        lastIndex = match.index + match[0].length;
    }

    if (paramNames.length === 0) return null;
    const trailingLiteral = patternText.slice(lastIndex);
    regexBody += escapeRegexLiteral(trailingLiteral).replace(/\s+/g, "\\s*");

    // Avoid degenerate pattern that is purely `{x}` with no literal anchor
    const strippedLiterals = patternText.replace(PLACEHOLDER_TOKEN_REGEX, "").trim();
    if (!strippedLiterals) return null;

    try {
        return {
            key: entry.key,
            regex: new RegExp(`^${regexBody}$`),
            paramNames,
            entry,
        };
    } catch {
        return null;
    }
}

export function compileI18nDictionary(entries: readonly SupDanceI18nEntry[]): CompiledI18nDictionary {
    const byKey = new Map<string, SupDanceI18nEntry>();
    const bySourceText = new Map<string, SupDanceI18nEntry>();
    const templateRules: CompiledTemplateRule[] = [];
    const seenTemplatePatterns = new Set<string>();

    for (const entry of entries) {
        byKey.set(entry.key, entry);

        const builtinOriginal = BUILTIN_SOURCE_BY_KEY.get(entry.key);
        if (builtinOriginal) {
            bySourceText.set(builtinOriginal, entry);
        }

        const source = entry.sourceText.trim();
        if (source) {
            bySourceText.set(source, entry);
        }

        const zhCN = entry.translations["zh-CN"]?.trim();
        if (zhCN && !bySourceText.has(zhCN)) {
            bySourceText.set(zhCN, entry);
        }

        for (const candidatePattern of [builtinOriginal, source, zhCN]) {
            if (!candidatePattern || seenTemplatePatterns.has(`${entry.key}::${candidatePattern}`)) continue;
            const rule = buildTemplateRule(candidatePattern, entry);
            if (rule) {
                seenTemplatePatterns.add(`${entry.key}::${candidatePattern}`);
                templateRules.push(rule);
            }
        }
    }

    return { byKey, bySourceText, templateRules };
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

    if (dictionary.templateRules?.length) {
        for (const rule of dictionary.templateRules) {
            const groups = core.match(rule.regex);
            if (groups) {
                const vars: Record<string, string> = {};
                for (let i = 0; i < rule.paramNames.length; i++) {
                    const paramName = rule.paramNames[i];
                    if (paramName) {
                        vars[paramName] = (groups[i + 1] ?? "").trim();
                    }
                }
                const resolvedTemplate = resolveEntryTranslation(rule.entry, locale, fallbackLocale);
                const interpolated = interpolateTemplate(resolvedTemplate, vars);
                return `${leading}${interpolated}${trailing}`;
            }
        }
    }

    return null;
}

export function isCandidateUntranslatedChinese(rawText: string): boolean {
    const trimmed = rawText.trim();
    if (trimmed.length < 2 || trimmed.length > 64) return false;
    if (!HAN_CHARACTER_REGEX.test(trimmed)) return false;
    if (/^https?:\/\//i.test(trimmed)) return false;
    if (/^[{[\]<>/\\]+/.test(trimmed)) return false;
    return true;
}
