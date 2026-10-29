import { create } from "zustand";
import localforage from "localforage";
import {
    fetchMusicCapabilities,
    listUserMusicTasks,
    queryMusicTask,
    submitMusicTask,
    type AudioFormat,
    type ModelCapabilities,
    type MusicTask,
    type SubmitMusicTaskPayload,
} from "../services/music-api";
import { syncMusicTaskToAssetStore } from "../services/music-asset-bridge";

const draftStorage = localforage.createInstance({
    name: "supdance_music_drafts",
    storeName: "drafts",
});

export type MusicDraft = {
    model: string;
    mode: "simple" | "custom";
    prompt: string;
    title: string;
    lyrics: string;
    tags: string;
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
    model: "suno-v6",
    mode: "simple",
    prompt: "",
    title: "",
    lyrics: "",
    tags: "",
    instrumental: false,
    duration: 180,
    format: "mp3",
    vocalGender: "auto",
    tempoBpm: 120,
    keySignature: "C",
    synthIdWatermark: false,
    stems: [],
};

export const STATIC_MODEL_CAPABILITIES: ModelCapabilities[] = [
    {
        id: "mureka-9.5",
        name: "Mureka V9.5",
        version: "9.5.2",
        modes: ["simple", "custom"],
        minDuration: 30,
        maxDuration: 300,
        formats: ["mp3", "wav", "flac"] as AudioFormat[],
        maxPromptChars: 2000,
        maxLyricsChars: 5000,
        costPerSecondMicrocredits: 50,
        vocalGenders: ["male", "female", "auto"],
        stemSeparation: false,
        available: true,
    },
    {
        id: "suno-v6",
        name: "Suno v6",
        version: "6.0.1",
        modes: ["simple", "custom"],
        minDuration: 15,
        maxDuration: 240,
        formats: ["mp3", "wav"] as AudioFormat[],
        maxPromptChars: 1500,
        maxLyricsChars: 3000,
        costPerSecondMicrocredits: 60,
        continuationSupported: true,
        stemSeparation: false,
        available: true,
    },
    {
        id: "lyria-3.5",
        name: "Google Lyria 3.5",
        version: "3.5.0",
        modes: ["simple", "custom"],
        minDuration: 10,
        maxDuration: 180,
        formats: ["mp3", "wav", "flac"] as AudioFormat[],
        maxPromptChars: 1000,
        maxLyricsChars: 2000,
        costPerSecondMicrocredits: 80,
        tempoBpmRange: [40, 240],
        keySignatures: [
            "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B",
            "F# Minor", "A Minor", "D Minor",
        ],
        synthIdWatermarking: true,
        stemSeparation: false,
        available: true,
    },
    {
        id: "music_v2_5",
        name: "Eleven Music v2.5",
        version: "2.5.4",
        modes: ["custom"],
        minDuration: 30,
        maxDuration: 240,
        formats: ["mp3", "wav", "flac"] as AudioFormat[],
        maxPromptChars: 1000,
        maxLyricsChars: 4000,
        costPerSecondMicrocredits: 100,
        highFidelityVocal: true,
        stemSeparation: true,
        supportedStems: ["vocals", "drums", "bass", "other"],
        available: true,
    },
];

type MusicState = {
    // Form & Draft
    draft: MusicDraft;
    capabilities: ModelCapabilities[];
    loadingCaps: boolean;
    submitting: boolean;

    // Task & History
    tasks: MusicTask[];
    loadingTasks: boolean;
    activeTaskIds: Set<string>;
    activeTrackId: string | null;
    activeTrack: MusicTask | null;

    // Audio Playback Controller (Single Instance Guard & Zero Autoplay)
    playingTaskId: string | null;
    audioElement: HTMLAudioElement | null;
    isPlaying: boolean;
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
    loadTasks: () => Promise<void>;
    submitGeneration: (userId: string) => Promise<{ taskId: string } | null>;
    playAudio: (taskId: string, audioUrl: string) => void;
    pauseAudio: () => void;
    togglePlayback: (taskId: string, audioUrl: string) => void;
    seekAudio: (seconds: number) => void;
    setAudioVolume: (volume: number) => void;
    toggleAudioMute: () => void;
    toggleAudioLoop: () => void;
};

let pollInterval: ReturnType<typeof setInterval> | null = null;

export const useMusicStore = create<MusicState>((set, get) => ({
    draft: { ...DEFAULT_DRAFT },
    capabilities: [...STATIC_MODEL_CAPABILITIES],
    loadingCaps: false,
    submitting: false,
    tasks: [],
    loadingTasks: false,
    activeTaskIds: new Set<string>(),
    activeTrackId: null,
    activeTrack: null,

    playingTaskId: null,
    audioElement: null,
    isPlaying: false,
    currentTime: 0,
    duration: 180,
    volume: 0.8,
    isMuted: false,
    isLoop: false,

    setActiveTrack: (task) => {
        set({
            activeTrack: task,
            activeTrackId: task ? (task.taskId || task.id) : null,
        });
    },

    setDraftField: (field, value, userId) => {
        set((state) => {
            const updated = { ...state.draft, [field]: value };
            if (userId) {
                void draftStorage.setItem(`draft_${userId}`, updated);
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
                void draftStorage.setItem(`draft_${userId}`, updated);
            }
            return { draft: updated };
        });
    },

    loadUserDraft: async (userId: string) => {
        if (!userId) return;
        try {
            const saved = await draftStorage.getItem<MusicDraft>(`draft_${userId}`);
            if (saved) {
                set({ draft: { ...DEFAULT_DRAFT, ...saved } });
            }
        } catch {
            // ignore storage failure
        }
    },

    loadCapabilities: async () => {
        set({ loadingCaps: true });
        try {
            const caps = await fetchMusicCapabilities();
            set({ capabilities: caps, loadingCaps: false });
        } catch {
            set({ loadingCaps: false });
        }
    },

    loadTasks: async () => {
        set({ loadingTasks: true });
        try {
            const res = await listUserMusicTasks(1, 50);
            const activeIds = new Set<string>();
            res.items.forEach((t) => {
                if (t.status === "submitted" || t.status === "queued" || t.status === "generating" || t.status === "transcoding") {
                    activeIds.add(t.taskId || t.id);
                }
                // 资产桥接：如果任务已完成，自动同步入库至平台全局素材库 (AssetStore)
                if (t.status === "completed" && t.resultAudioUrl) {
                    syncMusicTaskToAssetStore(t);
                }
            });

            const currentActiveTrack = get().activeTrack;
            // 若当前未选定播放曲目，默认载入最新一条完成作品（或第一条作品）
            let nextActiveTrack = currentActiveTrack;
            if (!nextActiveTrack && res.items.length > 0) {
                nextActiveTrack = res.items.find((item) => item.status === "completed" && item.resultAudioUrl) || res.items[0];
            }

            set({
                tasks: res.items,
                loadingTasks: false,
                activeTaskIds: activeIds,
                activeTrack: nextActiveTrack,
                activeTrackId: nextActiveTrack ? (nextActiveTrack.taskId || nextActiveTrack.id) : null,
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
                        try {
                            const updated = await queryMusicTask(tid);
                            if (updated.status === "completed" && updated.resultAudioUrl) {
                                syncMusicTaskToAssetStore(updated);
                            }
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
                                    activeTrackId: isCur ? (updated.taskId || updated.id) : state.activeTrackId,
                                };
                            });
                        } catch {
                            // ignore transient polling error
                        }
                    });
                }, 2000);
            }
        } catch {
            set({ loadingTasks: false });
        }
    },

    submitGeneration: async (userId: string) => {
        const { draft, submitting } = get();
        if (submitting || !draft.prompt.trim()) return null;

        set({ submitting: true });
        try {
            const nonce = `nonce_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const payload: SubmitMusicTaskPayload = {
                model: draft.model,
                mode: draft.mode,
                prompt: draft.prompt.trim(),
                title: draft.title.trim() || undefined,
                lyrics: draft.instrumental ? undefined : (draft.lyrics.trim() || undefined),
                tags: draft.tags.trim() || undefined,
                instrumental: draft.instrumental,
                duration: draft.duration,
                format: draft.format,
                vocalGender: draft.vocalGender !== "auto" ? draft.vocalGender : undefined,
                tempoBpm: draft.tempoBpm,
                keySignature: draft.keySignature,
                synthIdWatermark: draft.synthIdWatermark,
                stems: draft.stems.length > 0 ? draft.stems : undefined,
                idempotencyNonce: nonce,
            };

            const result = await submitMusicTask(payload);
            set({ submitting: false });

            // Refresh tasks list
            void get().loadTasks();
            return result;
        } catch (error) {
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
            set({ isPlaying: false });
        };

        void audio.play().catch(() => {
            set({ isPlaying: false });
        });

        set({
            playingTaskId: taskId,
            audioElement: audio,
            isPlaying: true,
            currentTime: 0,
            duration: audio.duration && !isNaN(audio.duration) ? audio.duration : 180,
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
        if (playingTaskId === taskId) {
            if (isPlaying) {
                pauseAudio();
            } else if (audioElement) {
                void audioElement.play().catch(() => {});
                set({ isPlaying: true });
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
