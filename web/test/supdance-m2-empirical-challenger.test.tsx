import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import localforage from "localforage";

// Setup Happy-DOM environment for React client-side rendering
const dom = new Window({ url: "http://localhost/" });
const originals = new Map<string, PropertyDescriptor | undefined>();
for (const [key, value] of Object.entries({
    window: dom,
    document: dom.document,
    navigator: dom.navigator,
    HTMLElement: dom.HTMLElement,
    Element: dom.Element,
    Node: dom.Node,
    SVGElement: dom.SVGElement,
    getComputedStyle: dom.getComputedStyle.bind(dom),
    IS_REACT_ACT_ENVIRONMENT: true,
})) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}

afterAll(() => {
    dom.happyDOM.abort();
    for (const [key, value] of originals) {
        if (value) Object.defineProperty(globalThis, key, value);
        else Reflect.deleteProperty(globalThis, key);
    }
});

describe("M2 Empirical Challenger: supdance-music-generation & supdance-social-auth", () => {
    test("Adversarial 1: localforage music draft storage is lazy and strictly deferred until draft access", async () => {
        // Track all instances created by localforage
        const instancesCreated: Array<{ name?: string; storeName?: string }> = [];
        const origCreateInstance = localforage.createInstance.bind(localforage);

        localforage.createInstance = function (options: any) {
            instancesCreated.push(options);
            return {
                getItem: async () => null,
                setItem: async (_k: string, v: any) => v,
                removeItem: async () => {},
            } as any;
        };

        try {
            // Import useMusicStore
            const { useMusicStore } = await import(
                "../src/supdance/plugins/music-generation/stores/use-music-store"
            );

            // 1. Verify that upon store import, supdance_music_drafts is NOT instantiated
            const draftInstancesAfterImport = instancesCreated.filter(
                (o) => o.name === "supdance_music_drafts"
            );
            expect(draftInstancesAfterImport.length).toBe(0);

            // 2. Perform various non-draft operations (playback controls, seeking, volume, model change without userId)
            useMusicStore.getState().seekAudio(42);
            useMusicStore.getState().setAudioVolume(0.65);
            useMusicStore.getState().toggleAudioLoop();
            useMusicStore.getState().setModel("lyria-3.5"); // no userId passed -> draft not written to IDB

            const draftInstancesAfterNonDraft = instancesCreated.filter(
                (o) => o.name === "supdance_music_drafts"
            );
            expect(draftInstancesAfterNonDraft.length).toBe(0);

            // 3. Perform draft read (loadUserDraft)
            await useMusicStore.getState().loadUserDraft("emp_user_alpha");
            const draftInstancesAfterLoad = instancesCreated.filter(
                (o) => o.name === "supdance_music_drafts"
            );
            expect(draftInstancesAfterLoad.length).toBe(1);
            expect(draftInstancesAfterLoad[0].storeName).toBe("drafts");

            // 4. Perform draft write (setDraftField with userId)
            useMusicStore.getState().setDraftField("prompt", "Adversarial test prompt", "emp_user_alpha");

            // Must reuse the singleton instance without creating a second storage instance
            const draftInstancesAfterSave = instancesCreated.filter(
                (o) => o.name === "supdance_music_drafts"
            );
            expect(draftInstancesAfterSave.length).toBe(1);
        } finally {
            localforage.createInstance = origCreateInstance;
        }
    });

    test("Adversarial 2: Rapid audio playback timeupdates cause 0 re-renders on unplayed players and workbench", async () => {
        const { act, Profiler } = await import("react");
        const { createRoot } = await import("react-dom/client");
        const { useMusicStore } = await import(
            "../src/supdance/plugins/music-generation/stores/use-music-store"
        );
        const { WaveformPlayer } = await import(
            "../src/supdance/plugins/music-generation/components/waveform-player"
        );

        let activeCommits = 0;
        let idle1Commits = 0;
        let idle2Commits = 0;
        let workbenchCommits = 0;

        // Represents the exact store subscription profile of MusicWorkbenchPage
        function WorkbenchSubscriptionProbe() {
            const loadCapabilities = useMusicStore((s) => s.loadCapabilities);
            const loadTasks = useMusicStore((s) => s.loadTasks);
            const loadUserDraft = useMusicStore((s) => s.loadUserDraft);
            const tasks = useMusicStore((s) => s.tasks);
            const loadingTasks = useMusicStore((s) => s.loadingTasks);
            return (
                <div
                    data-testid="workbench-probe"
                    data-task-count={tasks.length}
                    data-loading={loadingTasks}
                />
            );
        }

        // Initialize playback state
        useMusicStore.setState({
            playingTaskId: "track-playing-live",
            isPlaying: true,
            currentTime: 0,
            duration: 180,
            tasks: [],
            loadingTasks: false,
        });

        const host = document.createElement("div");
        document.body.appendChild(host);
        const root = createRoot(host);

        await act(async () => {
            root.render(
                <div>
                    <Profiler id="active-player" onRender={() => activeCommits++}>
                        <WaveformPlayer
                            taskId="track-playing-live"
                            audioUrl="https://cdn.example.com/audio/active.mp3"
                            durationSeconds={180}
                        />
                    </Profiler>
                    <Profiler id="idle-player-1" onRender={() => idle1Commits++}>
                        <WaveformPlayer
                            taskId="track-idle-1"
                            audioUrl="https://cdn.example.com/audio/idle1.mp3"
                            durationSeconds={120}
                        />
                    </Profiler>
                    <Profiler id="idle-player-2" onRender={() => idle2Commits++}>
                        <WaveformPlayer
                            taskId="track-idle-2"
                            audioUrl="https://cdn.example.com/audio/idle2.mp3"
                            durationSeconds={240}
                        />
                    </Profiler>
                    <Profiler id="workbench-probe" onRender={() => workbenchCommits++}>
                        <WorkbenchSubscriptionProbe />
                    </Profiler>
                </div>
            );
        });

        expect(activeCommits).toBe(1);
        expect(idle1Commits).toBe(1);
        expect(idle2Commits).toBe(1);
        expect(workbenchCommits).toBe(1);

        const initialIdle1 = idle1Commits;
        const initialIdle2 = idle2Commits;
        const initialWorkbench = workbenchCommits;

        // Simulate 40 rapid timeupdate ticks (20Hz simulation across 2 seconds)
        const totalTicks = 40;
        for (let i = 1; i <= totalTicks; i++) {
            await act(async () => {
                useMusicStore.setState({ currentTime: i * 0.05 });
            });
        }

        // Active player must have re-rendered on every playback tick
        expect(activeCommits).toBe(1 + totalTicks);

        // Idle players and workbench page must have ZERO extra commits/re-renders
        expect(idle1Commits - initialIdle1).toBe(0);
        expect(idle2Commits - initialIdle2).toBe(0);
        expect(workbenchCommits - initialWorkbench).toBe(0);

        await act(async () => {
            root.unmount();
        });
        host.remove();
    });

    test("Adversarial 3: Parent form re-renders from user typing trigger 0 aborts and 0 duplicate network requests", async () => {
        const { act, useState } = await import("react");
        const { createRoot } = await import("react-dom/client");
        const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
        const { http } = await import("../src/services/api/request");
        const { SocialLoginButtons } = await import(
            "../src/supdance/plugins/social-auth/components/social-login-buttons"
        );

        let networkCalls = 0;
        let abortCount = 0;
        const signals: AbortSignal[] = [];

        const origGet = http.get;
        http.get = (async (url: string, config?: any) => {
            if (url.includes("/auth/social/providers")) {
                networkCalls++;
                if (config?.signal) {
                    signals.push(config.signal);
                    config.signal.addEventListener("abort", () => {
                        abortCount++;
                    });
                }
                return {
                    providers: [
                        { id: "qq", name: "QQ", enabled: true, region: "cn", icon: "qq", sandboxEnabled: false },
                        { id: "bilibili", name: "Bilibili", enabled: true, region: "cn", icon: "bilibili", sandboxEnabled: true },
                    ],
                    region: "cn",
                };
            }
            return origGet(url, config);
        }) as typeof http.get;

        const queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });

        let triggerParentKeystroke: ((text: string) => void) | null = null;
        let parentRenderCount = 0;
        const receivedProvidersHistory: any[][] = [];

        function MockParentLoginForm() {
            parentRenderCount++;
            const [username, setUsername] = useState("");
            triggerParentKeystroke = setUsername;

            return (
                <div data-testid="login-form">
                    <input
                        id="username-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <SocialLoginButtons
                        // Deliberately pass a brand-new inline callback on every render to test ref stabilization
                        onProvidersChange={(providers) => {
                            receivedProvidersHistory.push(providers);
                        }}
                    />
                </div>
            );
        }

        const host = document.createElement("div");
        document.body.appendChild(host);
        const root = createRoot(host);

        try {
            await act(async () => {
                root.render(
                    <QueryClientProvider client={queryClient}>
                        <MockParentLoginForm />
                    </QueryClientProvider>
                );
            });

            expect(parentRenderCount).toBe(1);
            expect(networkCalls).toBe(1);
            expect(abortCount).toBe(0);

            // Simulate rapid typing: 15 keystrokes into the username field
            const sampleKeystrokes = "superadmin@test".split("");
            let currentText = "";
            for (const char of sampleKeystrokes) {
                currentText += char;
                await act(async () => {
                    triggerParentKeystroke?.(currentText);
                });
            }

            // Verify parent rendered for all 15 keystrokes
            expect(parentRenderCount).toBe(1 + sampleKeystrokes.length);

            // Empirical proof: React Query cached queryKey and ref-stabilized callbacks
            // prevented ANY new network calls or aborts
            expect(networkCalls).toBe(1);
            expect(abortCount).toBe(0);
            expect(signals.every((s) => !s.aborted)).toBe(true);
        } finally {
            http.get = origGet;
            await act(async () => {
                root.unmount();
            });
            host.remove();
        }
    });
});
