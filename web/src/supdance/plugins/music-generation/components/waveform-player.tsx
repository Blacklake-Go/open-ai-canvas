import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/supdance/plugins/i18n";
import { useMusicStore } from "../stores/use-music-store";
import type { MusicOutput } from "../services/music-api";
import { downloadMusicOutput } from "../services/music-site-api";

export function WaveformPlayer({ taskId, audioUrl, title, durationSeconds = 0, output }: { taskId: string; audioUrl: string; title?: string; durationSeconds?: number; output?: MusicOutput }) {
    const { t } = useI18n();
    const [downloadError, setDownloadError] = useState(false);
    const playerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const changed = () => window.dispatchEvent(new Event("workspace-bottom-bar-change"));
        const observer = new ResizeObserver(changed);
        if (playerRef.current) observer.observe(playerRef.current);
        changed();
        return () => {
            observer.disconnect();
            queueMicrotask(changed);
        };
    }, []);
    const playing = useMusicStore((s) => s.playingTaskId === taskId && s.isPlaying);
    const current = useMusicStore((s) => (s.playingTaskId === taskId ? s.currentTime : 0));
    const measuredDuration = useMusicStore((s) => (s.playingTaskId === taskId ? s.duration : 0));
    const volume = useMusicStore((s) => s.volume);
    const muted = useMusicStore((s) => s.isMuted);
    const error = useMusicStore((s) => (s.playingTaskId === taskId ? s.playbackError : ""));
    const buffering = useMusicStore((s) => s.playingTaskId === taskId && s.buffering);
    const tasks = useMusicStore((s) => s.tasks);
    const toggle = useMusicStore((s) => s.togglePlayback);
    const seek = useMusicStore((s) => s.seekAudio);
    const setVolume = useMusicStore((s) => s.setAudioVolume);
    const mute = useMusicStore((s) => s.toggleAudioMute);
    const loadTasks = useMusicStore((s) => s.loadTasks);
    const duration = measuredDuration || durationSeconds;
    const queue = tasks.flatMap((task) => task.outputs || []).filter((item) => item.audioUrl);
    const index = queue.findIndex((item) => item.id === taskId);
    const time = (value: number) =>
        Number.isFinite(value)
            ? Math.floor(value / 60) +
              ":" +
              Math.floor(value % 60)
                  .toString()
                  .padStart(2, "0")
            : "0:00";
    const move = (offset: number) => {
        const next = queue[index + offset];
        if (next?.audioUrl) useMusicStore.getState().playAudio(next.id, next.audioUrl);
    };
    return (
        <div ref={playerRef} data-workspace-bottom-bar className="music-player" translate="no" data-i18n-ignore="true" aria-label={t("music.player_title", undefined, "Music player")}>
            <div className="music-player-title">
                <strong>{title || t("music.default_track_title")}</strong>
                <span>
                    {time(current)} / {duration > 0 ? time(duration) : "—"}
                </span>
            </div>
            <div className="music-player-controls">
                <button type="button" disabled={index <= 0} onClick={() => move(-1)} aria-label={t("music.previous_track", undefined, "Previous track")}>
                    <SkipBack size={18} />
                </button>
                <button type="button" onClick={() => toggle(taskId, audioUrl)} aria-label={t(playing ? "music.player_pause" : "music.player_play")}>
                    {playing ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button type="button" disabled={index < 0 || index >= queue.length - 1} onClick={() => move(1)} aria-label={t("music.next_track", undefined, "Next track")}>
                    <SkipForward size={18} />
                </button>
                <input type="range" min={0} max={Math.max(duration, 0)} step={0.1} value={Math.min(current, duration || 0)} disabled={!measuredDuration} aria-label={t("music.player_progress")} onChange={(event) => seek(Number(event.target.value))} />
                <button type="button" onClick={mute} aria-label={t(muted ? "music.player_unmute" : "music.player_mute")}>
                    {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input className="music-volume" type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label={t("music.player_volume")} />
                {output && (
                    <button
                        type="button"
                        onClick={async () => {
                            setDownloadError(false);
                            try {
                                await downloadMusicOutput(output, title || taskId);
                            } catch {
                                setDownloadError(true);
                            }
                        }}
                        aria-label={t("music.original_download")}
                    >
                        <Download size={18} />
                    </button>
                )}
            </div>
            {buffering && <p role="status">{t("music.buffering", undefined, "Buffering audio…")}</p>}
            {downloadError && <p role="alert">{t("music.download_failed")}</p>}
            {error && (
                <div role="alert">
                    {t(error, undefined, "Audio could not be played.")}{" "}
                    <button type="button" onClick={() => void loadTasks()}>
                        {t("music.refresh_audio", undefined, "Refresh audio link")}
                    </button>
                </div>
            )}
        </div>
    );
}

export default WaveformPlayer;
