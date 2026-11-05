import { beforeAll, beforeEach, afterEach, describe, expect, test } from "bun:test";
import { useMusicStore } from "../src/supdance/plugins/music-generation/stores/use-music-store";
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

    test("starts without invented models or prices", () => {
        expect(useMusicStore.getState().capabilities).toEqual([]);
        expect(useMusicStore.getState().draft.model).toBe("");
    });

    test("configured capabilities clamp duration and restrict creation modes", () => {
        useMusicStore.setState({
            capabilities: [
                {
                    id: "configured-music",
                    name: "Configured",
                    version: "",
                    modes: ["custom"],
                    minDuration: 30,
                    maxDuration: 180,
                    formats: ["mp3"],
                    maxPromptChars: 1500,
                    maxLyricsChars: 3000,
                    costPerSecondMicrocredits: 0,
                    stemSeparation: false,
                    available: true,
                },
            ],
        });
        useMusicStore.getState().setDraftField("duration", 240);
        useMusicStore.getState().setModel("configured-music");
        expect(useMusicStore.getState().draft.mode).toBe("custom");
        expect(useMusicStore.getState().draft.duration).toBe(180);
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

    test("a rejected old play request cannot stop the next track or leave two players running", async () => {
        const previousAudio = globalThis.Audio;
        const instances: FakeAudio[] = [];
        class FakeAudio {
            src: string;
            duration = 0;
            volume = 1;
            muted = false;
            loop = false;
            paused = false;
            reject!: (reason?: unknown) => void;
            promise: Promise<void>;
            constructor(src: string) {
                this.src = src;
                this.promise = new Promise((resolve, reject) => {
                    this.reject = reject;
                    if (instances.length) resolve();
                });
                instances.push(this);
            }
            play() {
                return this.promise;
            }
            pause() {
                this.paused = true;
            }
        }
        Object.defineProperty(globalThis, "Audio", { configurable: true, writable: true, value: FakeAudio });
        try {
            useMusicStore.getState().playAudio("first", "/one.mp3");
            useMusicStore.getState().playAudio("second", "/two.mp3");
            await Promise.resolve();
            instances[0].reject(new Error("previous request aborted"));
            await Promise.resolve();
            await Promise.resolve();
            expect(instances[0].paused).toBe(true);
            expect(instances[0].src).toBe("");
            expect(useMusicStore.getState().playingTaskId).toBe("second");
            expect(useMusicStore.getState().isPlaying).toBe(true);
            expect(useMusicStore.getState().playbackError).toBe("");
            expect(useMusicStore.getState().duration).toBe(0);
        } finally {
            useMusicStore.getState().pauseAudio();
            Object.defineProperty(globalThis, "Audio", { configurable: true, writable: true, value: previousAudio });
        }
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
