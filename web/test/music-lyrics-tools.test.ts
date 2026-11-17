import { describe, expect, test } from "bun:test";
import { buildLyricPrompt, buildTopicStarter, insertLyricSkeleton, lyricAIActions, lyricTopics, songSkeletons, validateLyricStructure } from "../src/supdance/plugins/music-generation/components/lyrics-tools";
import { isLyricsAIRuntimeConfigured, resolveLyricsTextConfig } from "../src/supdance/plugins/music-generation/services/lyrics-ai";
import { composerDefinitions } from "../src/supdance/plugins/i18n/locales/music-composer";
import { MUSIC_SITE_I18N_ENTRIES } from "../src/supdance/plugins/i18n/locales/music-site";
import { defaultConfig, type AiConfig } from "../src/stores/use-config-store";

describe("lyric tools data layer", () => {
    test("no duplicate i18n keys inside the aggregated music pack", () => {
        // composerDefinitions 会经 music-site.ts 汇总进 MUSIC_SITE_I18N_ENTRIES，
        // 因此只检查汇总包内部（真正注册的集合）的 key 重复。
        const keys = MUSIC_SITE_I18N_ENTRIES.map((entry) => entry.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    test("local topic starters always produce a usable structured draft", () => {
        for (const topic of lyricTopics) {
            const starter = buildTopicStarter(topic.id);
            expect(starter.startsWith("[Verse")).toBe(true);
            expect(starter).toContain("[Chorus]");
            expect(validateLyricStructure(starter, 5000).issues).not.toContain("missing_chorus");
            expect(validateLyricStructure(starter, 5000).issues).not.toContain("unknown_section");
        }
    });

    test("topics, skeletons and AI actions have unique ids and resolvable 6-language keys", () => {
        const keys = new Set<string>([
            ...composerDefinitions.map(([key]) => `music.${key}`),
            ...MUSIC_SITE_I18N_ENTRIES.map((entry) => entry.key),
        ]);
        for (const collection of [lyricTopics, songSkeletons, lyricAIActions]) {
            expect(new Set(collection.map((item) => item.id)).size).toBe(collection.length);
            for (const item of collection) expect(keys.has(item.labelKey)).toBe(true);
        }
        for (const entry of MUSIC_SITE_I18N_ENTRIES.filter((item) => item.key.startsWith("music.lyric_"))) {
            expect(Object.values(entry.translations).filter(Boolean)).toHaveLength(6);
        }
    });

    test("every skeleton starts with a bracket section and contains a chorus-like section", () => {
        for (const skeleton of songSkeletons) {
            expect(skeleton.outline.startsWith("[")).toBe(true);
            expect(/\[(Chorus|Hook)/.test(skeleton.outline)).toBe(true);
            expect(validateLyricStructure(skeleton.outline, 5000).issues).not.toContain("missing_chorus");
        }
    });

    test("AI actions that need selection are not generate", () => {
        expect(lyricAIActions.find((item) => item.id === "generate")?.needsSelection).toBe(false);
        expect(lyricAIActions.filter((item) => item.needsSelection).map((item) => item.id)).toEqual(["continue", "rewrite", "rhyme"]);
    });

    test("buildLyricPrompt includes selection and language only for relevant actions", () => {
        const generate = buildLyricPrompt({ action: "generate", topic: "雨夜 City Pop", language: "粤语" });
        expect(generate).toContain("雨夜 City Pop");
        expect(generate).toContain("粤语");
        expect(generate).toContain("[Chorus]");
        const rewrite = buildLyricPrompt({ action: "rewrite", lyrics: "[Verse 1]\n旧歌词", selection: "旧歌词" });
        expect(rewrite).toContain("【选中的行】\n旧歌词");
        expect(rewrite).toContain("只输出改写后的这些行");
        expect(rewrite).not.toContain("雨夜 City Pop");
    });

    test("validateLyricStructure reports long text, missing chorus and unknown sections without blocking", () => {
        expect(validateLyricStructure("", 100).issues).toContain("empty");
        expect(validateLyricStructure("[Verse 1]\n两句", 3).issues).toEqual(expect.arrayContaining(["too_long", "missing_chorus"]));
        expect(validateLyricStructure("[Verse 1]\n句子\n[NotARealTag]\n句子", 200).issues).toContain("unknown_section");
        const good = validateLyricStructure("[Verse 1]\n句子\n\n[Chorus]\n副歌", 200);
        expect(good.issues).toEqual([]);
        expect(good.sections).toEqual(["Verse 1", "Chorus"]);
        expect(good.charCount).toBe(Array.from("[Verse 1]\n句子\n\n[Chorus]\n副歌").length);
    });

    test("insertLyricSkeleton respects the Unicode limit and returns a UTF-16 caret", () => {
        const outline = songSkeletons[0].outline;
        expect(insertLyricSkeleton("🌙", 2, 2, outline, 500)?.lyrics).toContain("[Chorus]");
        expect(insertLyricSkeleton("🌙", 2, 2, outline, 3)).toBeNull();
    });

    test("resolveLyricsTextConfig falls back from an image/video model to a configured text channel model", () => {
        const emptyConfig: AiConfig = { ...defaultConfig, model: "", textModel: "", channels: [] };
        expect(isLyricsAIRuntimeConfigured(emptyConfig)).toBe(false);
        expect(resolveLyricsTextConfig(emptyConfig)).toBeNull();

        const mixedConfig: AiConfig = {
            ...defaultConfig,
            model: "ch-img::nano-banana-pro",
            textModel: "ch-txt::gpt-5.5-pro",
            channels: [
                {
                    id: "ch-img",
                    name: "Image",
                    baseUrl: "https://example.com",
                    apiKey: "",
                    apiFormat: "gemini",
                    scope: "system",
                    enabled: true,
                    models: ["nano-banana-pro"],
                    modelCosts: [{ model: "nano-banana-pro", capability: "image", protocol: "gemini-image", logicalModelId: "lm-img", unitPriceMicrocredits: 10 }],
                },
                {
                    id: "ch-txt",
                    name: "Text",
                    baseUrl: "https://example.com",
                    apiKey: "",
                    apiFormat: "openai",
                    scope: "system",
                    enabled: true,
                    models: ["gpt-5.5-pro"],
                    modelCosts: [{ model: "gpt-5.5-pro", capability: "text", protocol: "openai-chat", logicalModelId: "lm-txt", unitPriceMicrocredits: 10 }],
                },
            ],
        };
        expect(isLyricsAIRuntimeConfigured(mixedConfig)).toBe(true);
        const resolved = resolveLyricsTextConfig(mixedConfig);
        expect(resolved?.model).toBe("ch-txt::gpt-5.5-pro");
        expect(resolved?.textModel).toBe("ch-txt::gpt-5.5-pro");

        const fallbackTextConfig: AiConfig = { ...mixedConfig, textModel: "" };
        expect(resolveLyricsTextConfig(fallbackTextConfig)?.model).toBe("ch-txt::gpt-5.5-pro");
    });
});
