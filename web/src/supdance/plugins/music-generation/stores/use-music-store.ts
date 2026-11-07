import { create } from "zustand";
import localforage from "localforage";
import { fetchMusicCapabilities, listUserMusicTasks, queryMusicTask, submitMusicTask, type AudioFormat, type ModelCapabilities, type MusicTask, type SubmitMusicTaskPayload } from "../services/music-api";

let draftStorageInstance: LocalForage | null = null;

function getDraftStorage(): LocalForage {
    if (!draftStorageInstance) {
        draftStorageInstance = localforage.createInstance({
            name: "supdance_music_drafts",
            storeName: "drafts",
        });
    }
    return draftStorageInstance;
}

export type MusicDraft = {
    model: string;
    mode: "simple" | "custom";
    prompt: string;
    title: string;
    lyrics: string;
    tags: string;
    songLanguage: string;
    instrumental: boolean;
    duration: number;
    format: AudioFormat;
    vocalGender: string;
    tempoBpm: number;
    keySignature: string;
    synthIdWatermark: boolean;
    stems: string[];
};

const DEFAULT_DRAFT: MusicDraft = {
    model: "",
    mode: "simple",
    prompt: "",
    title: "",
    lyrics: "",
    tags: "",
    songLanguage: "",
    instrumental: false,
    duration: 180,
    format: "mp3",
    vocalGender: "auto",
    tempoBpm: 120,
    keySignature: "C",
    synthIdWatermark: false,
    stems: [],
};

type MusicState = {
    // Form & Draft
    draft: MusicDraft;
    capabilities: ModelCapabilities[];
    loadingCaps: boolean;
    loadError: string;
    resetUser: () => void;
    submitting: boolean;

    // Task & History
    tasks: MusicTask[];
    historyPage: number;
    historyTotal: number;
    loadingTasks: boolean;
    activeTaskIds: Set<string>;
    activeTrackId: string | null;
    activeTrack: MusicTask | null;

    // Audio Playback Controller (Single Instance Guard & Zero Autoplay)
    playingTaskId: string | null;
    playingWork: MusicTask | null;
    audioElement: HTMLAudioElement | null;
    isPlaying: boolean;
    buffering: boolean;
    playbackError: string;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    isLoop: boolean;

    // Actions
    setActiveTrack: (task: MusicTask | null) => void;
    setDraftField: <K extends keyof MusicDraft>(field: K, value: MusicDraft[K], userId?: string) => void;
    setModel: (model: string, userId?: string) => void;
    loadUserDraft: (userId: string) => Promise<void>;
    loadCapabilities: () => Promise<void>;
    loadTasks: (page?: number) => Promise<void>;
    submitGeneration: (userId: string, quotedMicrocredits?: number) => Promise<{ taskId: string } | null>;
    playAudio: (taskId: string, audioUrl: string) => void;
    pauseAudio: () => void;
    togglePlayback: (taskId: string, audioUrl: string) => void;
    seekAudio: (seconds: number) => void;
    setAudioVolume: (volume: number) => void;
    toggleAudioMute: () => void;
    toggleAudioLoop: () => void;
};

let pollInterval: ReturnType<typeof setInterval> | null = null;
let userScopeSequence = 0;
let pendingSubmission: { fingerprint: string; nonce: string } | null = null;
const pollingTasks = new Set<string>();

export function selectPlayerWork(state: MusicState) {
    if (!state.playingTaskId) return state.activeTrack;
    return state.tasks.find((task) => task.outputs?.some((output) => output.id === state.playingTaskId && output.audioUrl)) ?? state.playingWork;
}

export const useMusicStore = create<MusicState>((set, get) => ({
    draft: { ...DEFAULT_DRAFT },
    capabilities: [],
    loadingCaps: false,
    loadError: "",
    resetUser: () => {
        pendingSubmission = null;
        pollingTasks.clear();
        userScopeSequence += 1;
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = null;
        get().pauseAudio();
        const audio = get().audioElement;
        if (audio) {
            audio.ontimeupdate = null;
            audio.onloadedmetadata = null;
            audio.onended = null;
            audio.onerror = null;
            audio.onwaiting = null;
            audio.onplaying = null;
            audio.src = "";
        }
        set({
            draft: { ...DEFAULT_DRAFT },
            capabilities: [],
            loadingCaps: false,
            tasks: [],
            historyPage: 0,
            historyTotal: 0,
            activeTaskIds: new Set(),
            activeTrack: null,
            activeTrackId: null,
            playingTaskId: null,
            playingWork: null,
            audioElement: null,
            currentTime: 0,
            duration: 0,
            buffering: false,
            playbackError: "",
            submitting: false,
            loadingTasks: false,
            loadError: "",
        });
    },
    submitting: false,
    tasks: [],
    historyPage: 0,
    historyTotal: 0,
    loadingTasks: false,
    activeTaskIds: new Set<string>(),
    activeTrackId: null,
    activeTrack: null,

    playingTaskId: null,
    playingWork: null,
    audioElement: null,
    isPlaying: false,
    buffering: false,
    playbackError: "",
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isMuted: false,
    isLoop: false,

    setActiveTrack: (task) => {
        set({
            activeTrack: task,
            activeTrackId: task ? task.taskId || task.id : null,
        });
    },

    setDraftField: (field, value, userId) => {
        set((state) => {
            const updated = { ...state.draft, [field]: value };
            if (userId) {
                void getDraftStorage().setItem(`draft_${userId}`, updated);
            }
            return { draft: updated };
        });
    },

    setModel: (model, userId) => {
        set((state) => {
            const caps = state.capabilities.find((c) => c.id === model);
            const modes = caps?.modes || ["simple", "custom"];
            let mode = state.draft.mode;
            if (!modes.includes(mode)) {
                mode = modes[0];
            }
            const updated: MusicDraft = {
                ...state.draft,
                model,
                mode,
                duration: Math.min(Math.max(state.draft.duration, caps?.minDuration || 30), caps?.maxDuration || 240),
            };
            if (userId) {
                void getDraftStorage().setItem(`draft_${userId}`, updated);
            }
            return { draft: updated };
        });
    },

    loadUserDraft: async (userId: string) => {
        if (!userId) return;
        const sequence = userScopeSequence;
        try {
            const saved = await getDraftStorage().getItem<MusicDraft>(`draft_${userId}`);
            if (saved && sequence === userScopeSequence) {
                set({ draft: { ...DEFAULT_DRAFT, ...saved } });
            }
        } catch {
            // ignore storage failure
        }
    },

    loadCapabilities: async () => {
        const sequence = userScopeSequence;
        set({ loadingCaps: true });
        try {
            const caps = await fetchMusicCapabilities();
            if (sequence !== userScopeSequence) return;
            set({ capabilities: caps, loadingCaps: false, loadError: "" });
            const model = caps.find((item) => item.id === get().draft.model && item.available) || caps.find((item) => item.available);
            if (model) get().setModel(model.id);
        } catch (error) {
            if (sequence === userScopeSequence) set({ capabilities: [], loadingCaps: false, loadError: error instanceof Error ? error.message : String(error) });
        }
    },

    loadTasks: async (page = 1) => {
        const sequence = userScopeSequence;
        set({ loadingTasks: true });
        try {
            const res = await listUserMusicTasks(page, 50);
            if (sequence !== userScopeSequence) return;
            const items = page > 1 ? [...new Map([...get().tasks, ...res.items].map((task) => [task.taskId || task.id, task])).values()] : res.items;
            const activeIds = new Set<string>();
            items.forEach((t) => {
                if (t.status === "submitted" || t.status === "queued" || t.status === "generating" || t.status === "transcoding") {
                    activeIds.add(t.taskId || t.id);
                }
            });

            const currentActiveTrack = get().activeTrack;
            // 若当前未选定播放曲目，默认载入最新一条完成作品（或第一条作品）
            let nextActiveTrack = items.find((item) => item.taskId === currentActiveTrack?.taskId) || null;
            if (!nextActiveTrack && items.length > 0) {
                nextActiveTrack = items.find((item) => item.status === "completed" && item.resultAudioUrl) || items[0];
            }

            set({
                tasks: items,
                historyPage: page,
                historyTotal: res.total,
                loadingTasks: false,
                activeTaskIds: activeIds,
                activeTrack: nextActiveTrack,
                activeTrackId: nextActiveTrack ? nextActiveTrack.taskId || nextActiveTrack.id : null,
            });

            // 启动自适应退避轮询
            if (activeIds.size > 0 && !pollInterval) {
                let pollCycles = 0;
                pollInterval = setInterval(() => {
                    pollCycles += 1;
                    const currentActive = get().activeTaskIds;
                    if (currentActive.size === 0) {
                        if (pollInterval) {
                            clearInterval(pollInterval);
                            pollInterval = null;
                        }
                        return;
                    }

                    // 自适应轮询间隔：前 5 次 (约 10s) 每次执行，后续每 2 次执行一次，超过 15 次每 3 次执行一次
                    if (pollCycles > 15 && pollCycles % 3 !== 0) return;
                    if (pollCycles > 5 && pollCycles % 2 !== 0) return;

                    currentActive.forEach(async (tid) => {
                        const key = `${sequence}:${tid}`;
                        if (pollingTasks.has(key)) return;
                        pollingTasks.add(key);
                        try {
                            const updated = await queryMusicTask(tid);
                            if (sequence !== userScopeSequence) return;
                            set((state) => {
                                const newActive = new Set(state.activeTaskIds);
                                if (updated.status === "completed" || updated.status === "failed" || updated.status === "cancelled") {
                                    newActive.delete(tid);
                                }
                                const updatedTasks = state.tasks.map((item) => ((item.taskId || item.id) === tid ? updated : item));
                                const currentTrackId = state.activeTrackId;
                                const isCur = currentTrackId === tid || (!currentTrackId && updated.status === "completed");
                                return {
                                    tasks: updatedTasks,
                                    activeTaskIds: newActive,
                                    activeTrack: isCur ? updated : state.activeTrack,
                                    activeTrackId: isCur ? updated.taskId || updated.id : state.activeTrackId,
                                };
                            });
                        } catch (error) {
                            if (sequence === userScopeSequence) set({ loadError: error instanceof Error ? error.message : String(error) });
                        } finally {
                            pollingTasks.delete(key);
                        }
                    });
                }, 2000);
            }
        } catch (error) {
            if (sequence === userScopeSequence) set({ loadingTasks: false, loadError: error instanceof Error ? error.message : String(error) });
        }
    },

    submitGeneration: async (userId: string, quotedMicrocredits?: number) => {
        const sequence = userScopeSequence;
        const { draft, submitting } = get();
        if (!userId) throw new Error("Login is required to generate music");
        if (submitting) return null;
        const cap = get().capabilities.find((item) => item.id === draft.model);
        if (!cap?.available || quotedMicrocredits === undefined) throw new Error("Refresh the model and quote before creating music");

        set({ submitting: true });
        try {
            const fingerprint = JSON.stringify({ draft, quotedMicrocredits });
            if (pendingSubmission?.fingerprint !== fingerprint) pendingSubmission = { fingerprint, nonce: crypto.randomUUID() };
            const payload: SubmitMusicTaskPayload = {
                quotedMicrocredits,
                model: draft.model,
                mode: draft.mode,
                prompt: draft.mode === "simple" ? draft.prompt.trim() : "",
                title: cap.titleSupported ? draft.title.trim() || undefined : undefined,
                lyrics: cap.lyricsSupported && draft.mode === "custom" ? draft.lyrics : undefined,
                tags: cap.styleSupported ? draft.tags.trim() || undefined : undefined,
                songLanguage: cap.styleSupported ? draft.songLanguage.trim() || undefined : undefined,
                instrumental: cap.instrumentalSupported && draft.instrumental,
                format: "mp3",
                idempotencyNonce: pendingSubmission!.nonce,
            };

            const result = await submitMusicTask(payload);
            if (sequence !== userScopeSequence) return null;
            pendingSubmission = null;
            set({ submitting: false });

            // Refresh tasks list
            void get().loadTasks();
            return result;
        } catch (error) {
            if (sequence !== userScopeSequence) return null;
            set({ submitting: false });
            throw error;
        }
    },

    // Single-Instance Playback Guard (Feature 27): Stops any playing audio before starting new track
    playAudio: (taskId: string, audioUrl: string) => {
        const { audioElement } = get();

        if (audioElement) {
            audioElement.pause();
            audioElement.onended = null;
            audioElement.onerror = null;
            audioElement.ontimeupdate = null;
            audioElement.onloadedmetadata = null;
            audioElement.onwaiting = null;
            audioElement.onplaying = null;
            audioElement.src = "";
        }

        const audio = new Audio(audioUrl);
        const { volume, isMuted, isLoop } = get();
        audio.volume = isMuted ? 0 : volume;
        audio.muted = isMuted;
        audio.loop = isLoop;

        audio.ontimeupdate = () => {
            set({ currentTime: audio.currentTime });
        };
        audio.onloadedmetadata = () => {
            if (audio.duration && !isNaN(audio.duration)) {
                set({ duration: audio.duration });
            }
        };
        audio.onended = () => {
            if (!get().isLoop) {
                set({ isPlaying: false, currentTime: 0 });
            }
        };
        audio.onerror = () => {
            if (get().audioElement === audio) set({ isPlaying: false, buffering: false, playbackError: "music.playback_failed" });
        };
        audio.onwaiting = () => {
            if (get().audioElement === audio) set({ buffering: true });
        };
        audio.onplaying = () => {
            if (get().audioElement === audio) set({ buffering: false, isPlaying: true });
        };

        const task = get().tasks.find((item) => item.outputs?.some((output) => output.id === taskId));
        set({
            playingTaskId: taskId,
            playingWork: task ?? (get().playingTaskId === taskId ? get().playingWork : null),
            audioElement: audio,
            isPlaying: false,
            buffering: true,
            playbackError: "",
            currentTime: 0,
            duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        });
        if (task) get().setActiveTrack(task);
        void audio
            .play()
            .then(() => {
                if (get().audioElement === audio) set({ isPlaying: true, buffering: false });
            })
            .catch(() => {
                if (get().audioElement === audio) set({ isPlaying: false, buffering: false, playbackError: "music.playback_failed" });
            });
    },

    pauseAudio: () => {
        const { audioElement } = get();
        if (audioElement) {
            audioElement.pause();
        }
        set({ isPlaying: false });
    },

    togglePlayback: (taskId: string, audioUrl: string) => {
        const { playingTaskId, isPlaying, playAudio, pauseAudio, audioElement } = get();
        const source = audioElement?.getAttribute?.("src") || audioElement?.src;
        if (playingTaskId === taskId && audioElement && source !== audioUrl) {
            playAudio(taskId, audioUrl);
            return;
        }
        if (playingTaskId === taskId) {
            if (isPlaying) {
                pauseAudio();
            } else if (audioElement) {
                void audioElement
                    .play()
                    .then(() => {
                        if (get().audioElement === audioElement) set({ isPlaying: true, playbackError: "" });
                    })
                    .catch(() => {
                        if (get().audioElement === audioElement) set({ isPlaying: false, playbackError: "music.playback_failed" });
                    });
            } else {
                playAudio(taskId, audioUrl);
            }
        } else {
            playAudio(taskId, audioUrl);
        }
    },

    seekAudio: (seconds: number) => {
        const { audioElement } = get();
        if (audioElement) {
            audioElement.currentTime = seconds;
        }
        set({ currentTime: seconds });
    },

    setAudioVolume: (volume: number) => {
        const { audioElement } = get();
        const clamped = Math.max(0, Math.min(1, volume));
        if (audioElement) {
            audioElement.volume = clamped;
            audioElement.muted = clamped === 0;
        }
        set({ volume: clamped, isMuted: clamped === 0 });
    },

    toggleAudioMute: () => {
        const { audioElement, isMuted, volume } = get();
        const nextMute = !isMuted;
        if (audioElement) {
            audioElement.muted = nextMute;
            if (!nextMute && volume === 0) {
                audioElement.volume = 0.5;
            }
        }
        set({
            isMuted: nextMute,
            volume: !nextMute && volume === 0 ? 0.5 : volume,
        });
    },

    toggleAudioLoop: () => {
        const { audioElement, isLoop } = get();
        const nextLoop = !isLoop;
        if (audioElement) {
            audioElement.loop = nextLoop;
        }
        set({ isLoop: nextLoop });
    },
}));
