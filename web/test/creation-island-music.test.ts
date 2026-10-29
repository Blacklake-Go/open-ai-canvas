import { describe, expect, it } from "bun:test";
import { modeLabels, shotScriptLabels, type CreationMode } from "@/pages/create/creation-types";
import { creationUploadAccept, creationFileAccepted } from "@/pages/create/creation-assets";
import { creationMusicEmptySuggestions } from "@/pages/create/creation-workspace-empty";
import { MUSIC_MODELS } from "@/pages/create/creation-workspace";
import { thinkingFor } from "@/pages/create/creation-workspace-messages";
import { creationLibraryDisabledReason } from "@/pages/create/creation-library";

describe("Creation Island Music Integration Suite", () => {
    it("CreationMode supports music with complete label dictionaries", () => {
        const musicMode: CreationMode = "music";
        expect(modeLabels[musicMode]).toBe("音乐");
        expect(shotScriptLabels[musicMode]).toBe("音乐提示");
    });

    it("MUSIC_MODELS declares all 4 target models with valid constraints", () => {
        expect(MUSIC_MODELS).toHaveLength(4);
        const ids = MUSIC_MODELS.map((m) => m.id);
        expect(ids).toContain("mureka-9.5");
        expect(ids).toContain("suno-v6");
        expect(ids).toContain("lyria-3.5");
        expect(ids).toContain("music_v2_5");

        MUSIC_MODELS.forEach((model) => {
            expect(model.credits).toBeGreaterThan(0);
            expect(model.maxDuration).toBeGreaterThanOrEqual(180);
            expect(model.tag.length).toBeGreaterThan(0);
        });
    });

    it("Music upload and file filters restrict attachments appropriately", () => {
        expect(creationUploadAccept("music")).toBe("audio/*");
        expect(creationFileAccepted("music", { type: "audio/mp3", name: "song.mp3" })).toBe(true);
        expect(creationFileAccepted("music", { type: "audio/wav", name: "song.wav" })).toBe(true);
        expect(creationFileAccepted("music", { type: "text/plain", name: "lyrics.txt" })).toBe(true);
        expect(creationFileAccepted("music", { type: "text/plain", name: "lyrics.lrc" })).toBe(true);
        expect(creationFileAccepted("music", { type: "image/png", name: "cover.png" })).toBe(true);
        expect(creationFileAccepted("music", { type: "video/mp4", name: "movie.mp4" })).toBe(false);
    });

    it("Music library restriction validates audio material only", () => {
        expect(creationLibraryDisabledReason("music", "audio")).toBeUndefined();
        expect(creationLibraryDisabledReason("music", "video")).toBe("音乐创作仅支持参考音频");
        expect(creationLibraryDisabledReason("music", "image")).toBe("音乐创作仅支持参考音频");
    });

    it("Creation empty suggestions provide 4 dedicated music presets", () => {
        expect(creationMusicEmptySuggestions).toHaveLength(4);
        creationMusicEmptySuggestions.forEach((preset) => {
            expect(preset.mode).toBe("music");
            expect(preset.title.length).toBeGreaterThan(0);
            expect(preset.prompt.length).toBeGreaterThan(10);
        });
    });

    it("thinkingFor returns dedicated music composer phase text", () => {
        const thinking = thinkingFor("music", "SupDance");
        expect(thinking.title).toContain("乐曲");
        expect(thinking.hint).toContain("SupDance");
        expect(thinking.steps).toContain("合成母带");
    });
});
