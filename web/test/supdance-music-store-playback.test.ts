import { beforeAll, beforeEach, afterEach, describe, expect, spyOn, test } from "bun:test";
import { selectPlayerWork, useMusicStore } from "../src/supdance/plugins/music-generation/stores/use-music-store";
import * as musicApi from "../src/supdance/plugins/music-generation/services/music-api";
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

    test.each(["success", "failure"])("a previous account's %s cannot unlock a submission or clear its retry nonce", async (settlement) => {
        type Receipt = Awaited<ReturnType<typeof musicApi.submitMusicTask>>;
        const a = Promise.withResolvers<Receipt>();
        const b = Promise.withResolvers<Receipt>();
        const api = spyOn(musicApi, "submitMusicTask").mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise).mockRejectedValueOnce(new Error("offline"));
        const enterAccount = () => {
            useMusicStore.getState().resetUser();
            const capability: musicApi.ModelCapabilities = {
                id: "model",
                name: "Model",
                version: "",
                modes: ["simple"],
                minDuration: 0,
                maxDuration: 0,
                formats: ["mp3"],
                maxPromptChars: 100,
                maxLyricsChars: 0,
                costPerSecondMicrocredits: 0,
                stemSeparation: false,
                available: true,
            };
            useMusicStore.setState({ capabilities: [capability] });
            useMusicStore.getState().setModel("model");
            useMusicStore.getState().setDraftField("prompt", "piano");
        };
        try {
            enterAccount();
            const old = useMusicStore.getState().submitGeneration("a", 10);
            enterAccount();
            const current = useMusicStore.getState().submitGeneration("b", 10);
            if (settlement === "success") a.resolve({ taskId: "old", status: "queued" });
            else a.reject(new Error("old network error"));
            await expect(old).resolves.toBeNull();
            expect(useMusicStore.getState().submitting).toBe(true);
            await expect(useMusicStore.getState().submitGeneration("b", 10)).resolves.toBeNull();
            b.reject(new Error("unknown outcome"));
            await expect(current).rejects.toThrow("unknown outcome");
            await expect(useMusicStore.getState().submitGeneration("b", 10)).rejects.toThrow("offline");
            const nonces = api.mock.calls.map(([payload]) => payload.idempotencyNonce);
            expect(nonces).toHaveLength(3);
            expect(nonces[1]).not.toBe(nonces[0]);
            expect(nonces[2]).toBe(nonces[1]);
        } finally {
            api.mockRestore();
            useMusicStore.getState().resetUser();
        }
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

    test("refreshing page one preserves the player and selected second take from an older page", async () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, "Audio");
        class FakeAudio {
            duration = 180;
            constructor(public src: string) {}
            async play() {}
            pause() {}
        }
        Object.defineProperty(globalThis, "Audio", { configurable: true, value: FakeAudio });
        const makeTask = (id: string): musicApi.MusicTask => ({
            id,
            taskId: id,
            userId: "owner",
            title: id,
            model: "music",
            mode: "simple",
            prompt: "piano",
            instrumental: false,
            durationTargetSeconds: 0,
            status: "completed",
            stage: "",
            createdAt: "",
            updatedAt: "",
            resultAudioUrl: "/" + id + "-0.mp3",
            outputs: [0, 1].map((index) => ({ id: id + ":" + index, outputIndex: index, audioUrl: "/" + id + "-" + index + ".mp3" })),
        });
        const old = makeTask("older");
        const recent = makeTask("recent");
        const list = spyOn(musicApi, "listUserMusicTasks")
            .mockResolvedValueOnce({ items: [old], page: 2, pageSize: 50, total: 52 })
            .mockResolvedValueOnce({ items: [recent], page: 1, pageSize: 50, total: 52 });
        try {
            await useMusicStore.getState().loadTasks(2);
            const take = old.outputs![1];
            useMusicStore.getState().playAudio(take.id, take.audioUrl!);
            await Promise.resolve();
            const player = useMusicStore.getState().audioElement;
            await useMusicStore.getState().loadTasks();
            const state = useMusicStore.getState();
            expect(state.tasks).toEqual([recent]);
            expect(selectPlayerWork(state)).toBe(old);
            expect(selectPlayerWork(state)?.outputs?.find((output) => output.id === state.playingTaskId)).toBe(take);
            expect(state.audioElement).toBe(player);
            expect(state.audioElement?.src).toBe(take.audioUrl!);
            expect(state.isPlaying).toBe(true);
            state.resetUser();
            expect(selectPlayerWork(useMusicStore.getState())).toBeNull();
        } finally {
            list.mockRestore();
            if (original) Object.defineProperty(globalThis, "Audio", original);
            else Reflect.deleteProperty(globalThis, "Audio");
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
