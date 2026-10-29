import React, { useMemo, useRef } from "react";
import { Play, Pause, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { useI18n } from "@/supdance/plugins/i18n";
import { useMusicStore } from "../stores/use-music-store";

interface WaveformPlayerProps {
    taskId: string;
    audioUrl: string;
    durationSeconds?: number;
    title?: string;
}

export function WaveformPlayer({ taskId, audioUrl, durationSeconds = 180, title }: WaveformPlayerProps) {
    const { t } = useI18n();
    const {
        playingTaskId,
        isPlaying,
        currentTime: storeTime,
        duration: storeDur,
        volume,
        isMuted,
        isLoop,
        togglePlayback,
        seekAudio,
        setAudioVolume,
        toggleAudioMute,
        toggleAudioLoop,
    } = useMusicStore();

    const isThisPlaying = playingTaskId === taskId && isPlaying;
    const isThisTrack = playingTaskId === taskId;
    const currentTime = isThisTrack ? storeTime : 0;
    const duration = isThisTrack && storeDur > 0 ? storeDur : durationSeconds;

    const waveformContainerRef = useRef<HTMLDivElement | null>(null);

    // Feature 26: 64-bar Web Audio frequency peak simulation for waveform bars
    const bars = useMemo(() => {
        const count = 64;
        const peaks: number[] = [];
        let seed = 0;
        for (let i = 0; i < taskId.length; i++) {
            seed = (seed << 5) - seed + taskId.charCodeAt(i);
            seed |= 0;
        }

        for (let i = 0; i < count; i++) {
            const x = Math.sin((i / count) * Math.PI * 4 + Math.abs(seed)) * 0.4 + 0.5;
            const variance = Math.abs(Math.cos(i * 1.3)) * 0.3;
            peaks.push(Math.min(1.0, Math.max(0.15, Number((x + variance).toFixed(3)))));
        }
        return peaks;
    }, [taskId]);

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!waveformContainerRef.current) return;
        const rect = waveformContainerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        const newTime = ratio * duration;
        if (!isThisTrack) {
            togglePlayback(taskId, audioUrl);
        }
        seekAudio(newTime);
    };

    const togglePlay = () => {
        togglePlayback(taskId, audioUrl);
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const progressRatio = duration > 0 ? currentTime / duration : 0;

    return (
        <div className="plugin-music-player flex flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur-sm transition-all hover:border-border">
            <div className="flex items-center justify-between text-sm font-medium">
                <span className="truncate text-foreground/90">{title || t("music.default_track_title", undefined, "AI 生成音乐")}</span>
                <span className="font-mono text-xs text-muted-foreground">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </span>
            </div>

            {/* 64-Bar Waveform Display with Pointer Scrubbing */}
            <div
                ref={waveformContainerRef}
                onClick={handleSeek}
                className="group relative flex h-14 cursor-pointer items-end gap-0.5 rounded-lg bg-muted/40 p-1.5 transition-colors hover:bg-muted/60"
                role="slider"
                aria-label={t("music.player_progress", undefined, "音频播放进度")}
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={currentTime}
            >
                {bars.map((peak, idx) => {
                    const barRatio = idx / bars.length;
                    const isPlayed = barRatio <= progressRatio;
                    return (
                        <div
                            key={idx}
                            style={{ height: `${Math.round(peak * 100)}%` }}
                            className={`w-full rounded-xs transition-colors duration-150 ${
                                isPlayed
                                    ? "bg-primary group-hover:bg-primary/90"
                                    : "bg-muted-foreground/30 group-hover:bg-muted-foreground/45"
                            }`}
                        />
                    );
                })}
            </div>

            {/* Playback Controls (Min 44x44px for WCAG 2.2 AA A11y Standards) */}
            <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={togglePlay}
                        className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary"
                        aria-label={isThisPlaying ? t("music.player_pause", undefined, "暂停播放") : t("music.player_play", undefined, "开始播放")}
                    >
                        {isThisPlaying ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
                    </button>

                    <button
                        type="button"
                        onClick={toggleAudioLoop}
                        className={`flex size-11 items-center justify-center rounded-lg transition-colors ${
                            isThisTrack && isLoop ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"
                        }`}
                        aria-label={t("music.player_loop", undefined, "循环播放")}
                        aria-pressed={isThisTrack && isLoop}
                    >
                        <RotateCcw className="size-4" />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={toggleAudioMute}
                        className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                        aria-label={isMuted ? t("music.player_unmute", undefined, "取消静音") : t("music.player_mute", undefined, "静音")}
                    >
                        {isMuted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                    </button>

                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                        className="h-1.5 w-20 cursor-pointer accent-primary"
                        aria-label={t("music.player_volume", undefined, "音量调节")}
                    />
                </div>
            </div>
        </div>
    );
}
