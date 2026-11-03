import { beforeAll, beforeEach, afterEach, describe, expect, test } from "bun:test";
import { STATIC_MODEL_CAPABILITIES, useMusicStore } from "../src/supdance/plugins/music-generation/stores/use-music-store";
import { BUILTIN_SUPDANCE_I18N_ENTRIES, SUPPORTED_LOCALE_CODES, loadAllLocalePacks } from "../src/supdance/plugins/i18n/locales";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

describe("SupDance Music Plugin — Real Store & Controller Integration Suite", () => {
    let previousState: ReturnType<typeof useMusicStore.getState>;
    beforeEach(() => {
        previousState = useMusicStore.getState();
        useMusicStore.setState(useMusicStore.getInitialState(), true);
    });
    afterEach(() => useMusicStore.setState(previousState, true));
    beforeAll(async () => {
        await loadAllLocalePacks();
    });

    test("Static model capabilities contains all 4 required models with valid constraints", () => {
        expect(STATIC_MODEL_CAPABILITIES.length).toBe(4);

        const mureka = STATIC_MODEL_CAPABILITIES.find((m) => m.id === "mureka-9.5");
        expect(mureka).toBeDefined();
        expect(mureka?.formats).toContain("flac");
        expect(mureka?.formats).toContain("mp3");
        expect(mureka?.vocalGenders).toContain("male");

        const suno = STATIC_MODEL_CAPABILITIES.find((m) => m.id === "suno-v6");
        expect(suno).toBeDefined();
        expect(suno?.formats).not.toContain("flac"); // Suno strictly forbids FLAC
        expect(suno?.formats).toContain("mp3");
        expect(suno?.formats).toContain("wav");

        const lyria = STATIC_MODEL_CAPABILITIES.find((m) => m.id === "lyria-3.5");
        expect(lyria).toBeDefined();
        expect(lyria?.tempoBpmRange).toEqual([40, 240]);
        expect(lyria?.synthIdWatermarking).toBe(true);

        const eleven = STATIC_MODEL_CAPABILITIES.find((m) => m.id === "music_v2_5");
        expect(eleven).toBeDefined();
        expect(eleven?.modes).toEqual(["custom"]); // Eleven Music is custom mode only
        expect(eleven?.stemSeparation).toBe(true);
        expect(eleven?.supportedStems).toContain("vocals");
    });

    test("useMusicStore setModel automatically clamps duration and adjusts mode", () => {
        const store = useMusicStore.getState();

        // Switch to Eleven Music which is custom-only
        store.setModel("music_v2_5");
        expect(useMusicStore.getState().draft.model).toBe("music_v2_5");
        expect(useMusicStore.getState().draft.mode).toBe("custom");

        // Switch to Lyria 3.5 which has maxDuration 180
        store.setDraftField("duration", 240);
        store.setModel("lyria-3.5");
        expect(useMusicStore.getState().draft.model).toBe("lyria-3.5");
        expect(useMusicStore.getState().draft.duration).toBeLessThanOrEqual(180);
    });

    test("Single-instance playback controller controls and synchronizes audio state", () => {
        const store = useMusicStore.getState();

        // Initial audio state
        expect(store.playingTaskId).toBeNull();
        expect(store.isPlaying).toBe(false);

        // Seek audio
        store.seekAudio(45.5);
        expect(useMusicStore.getState().currentTime).toBe(45.5);

        // Set audio volume and clamp
        store.setAudioVolume(0.5);
        expect(useMusicStore.getState().volume).toBe(0.5);
        expect(useMusicStore.getState().isMuted).toBe(false);

        store.setAudioVolume(0);
        expect(useMusicStore.getState().isMuted).toBe(true);

        // Toggle mute
        store.toggleAudioMute();
        expect(useMusicStore.getState().isMuted).toBe(false);

        // Toggle loop
        expect(useMusicStore.getState().isLoop).toBe(false);
        store.toggleAudioLoop();
        expect(useMusicStore.getState().isLoop).toBe(true);
        store.toggleAudioLoop();
        expect(useMusicStore.getState().isLoop).toBe(false);

        // Pause
        store.pauseAudio();
        expect(useMusicStore.getState().isPlaying).toBe(false);
    });

    test("All music.* i18n keys are translated across all 6 supported locales", () => {
        const musicEntries = BUILTIN_SUPDANCE_I18N_ENTRIES.filter((item) => item.namespace === "music");
        expect(musicEntries.length).toBeGreaterThanOrEqual(40);

        for (const entry of musicEntries) {
            for (const locale of SUPPORTED_LOCALE_CODES) {
                const translation = entry.translations[locale];
                expect(translation).toBeDefined();
                expect(typeof translation).toBe("string");
                expect(translation.length).toBeGreaterThan(0);
            }
        }
    });

    test("Zero window.alert or window.confirm across all music plugin source files", () => {
        const musicPluginDir = join(import.meta.dir, "../src/supdance/plugins/music-generation");

        function scanDir(dir: string): string[] {
            const files: string[] = [];
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    files.push(...scanDir(fullPath));
                } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
                    files.push(fullPath);
                }
            }
            return files;
        }

        const sourceFiles = scanDir(musicPluginDir);
        expect(sourceFiles.length).toBeGreaterThanOrEqual(6);

        for (const file of sourceFiles) {
            const content = readFileSync(file, "utf-8");
            expect(content.includes("window.alert")).toBe(false);
            expect(content.includes("window.confirm")).toBe(false);
            // Verify no raw alert(...) call
            const alertMatch = content.match(/\balert\s*\(/);
            expect(alertMatch).toBeNull();
        }
    });

    test("use-music-store.ts uses lazy getter for localforage drafts storage", () => {
        const storeFile = join(import.meta.dir, "../src/supdance/plugins/music-generation/stores/use-music-store.ts");
        const content = readFileSync(storeFile, "utf-8");

        expect(content).toContain("function getDraftStorage()");
        expect(content).not.toMatch(/^const draftStorage\s*=\s*localforage\.createInstance/m);
        expect(content).toContain("getDraftStorage().setItem");
        expect(content).toContain("getDraftStorage().getItem");
    });

    test("waveform-player.tsx uses fine-grained atomic selectors to prevent 4Hz playback churn", () => {
        const playerFile = join(import.meta.dir, "../src/supdance/plugins/music-generation/components/waveform-player.tsx");
        const content = readFileSync(playerFile, "utf-8");

        // Verify fine-grained selectors are used instead of monolithic useMusicStore()
        expect(content).not.toContain("const {\n        playingTaskId,");
        expect(content).toContain("useMusicStore((s) => s.playingTaskId === taskId && s.isPlaying)");
        expect(content).toContain("useMusicStore((s) => (s.playingTaskId === taskId ? s.currentTime : 0))");
        expect(content).toContain("export default WaveformPlayer");
    });

    test("creation-workspace-messages.tsx dynamically loads WaveformPlayer with lazy & Suspense", () => {
        const messagesFile = join(import.meta.dir, "../src/pages/create/creation-workspace-messages.tsx");
        const content = readFileSync(messagesFile, "utf-8");

        expect(content).not.toMatch(/^import\s*\{\s*WaveformPlayer\s*\}\s*from/m);
        expect(content).toContain("lazy(() =>");
        expect(content).toContain("waveform-player");
        expect(content).toContain("<Suspense");
    });
});
