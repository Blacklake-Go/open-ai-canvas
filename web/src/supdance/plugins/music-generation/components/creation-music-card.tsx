import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Disc3, Download, LoaderCircle, Pause, Play, Repeat1, Volume2, VolumeX } from "lucide-react";
import { Link, useLocation } from "react-router";

import { CachedResourceImage } from "@/components/cached-resource-image";
import { Tooltip } from "@/components/ui/base/tooltip";
import { translate } from "@/i18n";
import { loadAudioWaveform } from "@/lib/canvas/canvas-audio-waveform";
import { useI18n } from "@/supdance/plugins/i18n";
import { useMusicStore } from "../stores/use-music-store";
import { musicTrackHref, type MusicTrackIdentity } from "../services/music-track-route";
import "../styles/creation-music-card.css";

const INLINE_WAVEFORM_BARS = 56;

export type CreationMusicTrackEntry = {
    key: string;
    url: string;
    storageKey?: string;
    durationMs?: number;
    identity?: MusicTrackIdentity;
};

export type CreationMusicCardProps = {
    messageId: string;
    taskIds?: string[];
    title: string;
    modelLabel?: string;
    targetDurationSeconds?: number;
    instrumental?: boolean;
    tracks: CreationMusicTrackEntry[];
    onRefreshResult?: () => void;
    refreshingResult?: boolean;
    pageTitle?: boolean;
    coverStorageKey?: string;
    metadata?: string[];
    children?: ReactNode;
};

function formatClock(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const whole = Math.floor(seconds);
    const mins = Math.floor(whole / 60);
    const secs = String(whole % 60).padStart(2, "0");
    return `${mins}:${secs}`;
}

function createFallbackWaveform(seedKey: string, count = INLINE_WAVEFORM_BARS): number[] {
    let hash = 2166136261;
    for (let i = 0; i < seedKey.length; i += 1) {
        hash ^= seedKey.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    const bars: number[] = [];
    for (let i = 0; i < count; i += 1) {
        hash = Math.imul(hash ^ (i + 17), 16777619) >>> 0;
        const t = i / Math.max(1, count - 1);
        const envelope = 0.55 + 0.45 * Math.sin(t * Math.PI);
        const random = ((hash % 1000) / 1000) * 0.68 + 0.2;
        bars.push(Math.round(Math.min(1, Math.max(0.14, random * envelope)) * 1000) / 1000);
    }
    return bars;
}

function resolveInlineTrackId(messageId: string, taskId: string | undefined, trackKey: string, index: number) {
    const base = taskId || messageId;
    return `create:${base}:${trackKey || index}`;
}

function SongCardLink({ identity, title, children }: { identity: MusicTrackIdentity; title: string; children: React.ReactNode }) {
    const { pathname, search } = useLocation();
    return (
        <Link to={musicTrackHref(identity)} state={{ from: pathname + search }} className="product-collection-card creation-music-song-card" title={title}>
            {children}
            <ChevronRight className="creation-music-song-chevron" aria-hidden />
        </Link>
    );
}

function CreationMusicTrackRow({
    trackId,
    track,
    index,
    totalTracks,
    title,
    targetDurationSeconds,
    onRefreshResult,
    refreshingResult,
}: {
    trackId: string;
    track: CreationMusicTrackEntry;
    index: number;
    totalTracks: number;
    title: string;
    targetDurationSeconds?: number;
    onRefreshResult?: () => void;
    refreshingResult?: boolean;
}) {
    const { t } = useI18n();
    const isCurrentTrack = useMusicStore((s) => s.playingTaskId === trackId);
    const isPlaying = useMusicStore((s) => s.playingTaskId === trackId && s.isPlaying);
    const isBuffering = useMusicStore((s) => s.playingTaskId === trackId && s.buffering);
    const measuredDuration = useMusicStore((s) => (s.playingTaskId === trackId ? s.duration : 0));
    const playbackError = useMusicStore((s) => (s.playingTaskId === trackId ? s.playbackError : ""));
    const isLoop = useMusicStore((s) => s.isLoop);
    const isMuted = useMusicStore((s) => s.isMuted);
    const togglePlayback = useMusicStore((s) => s.togglePlayback);
    const playAudio = useMusicStore((s) => s.playAudio);
    const pauseAudio = useMusicStore((s) => s.pauseAudio);
    const seekAudio = useMusicStore((s) => s.seekAudio);
    const toggleAudioLoop = useMusicStore((s) => s.toggleAudioLoop);
    const toggleAudioMute = useMusicStore((s) => s.toggleAudioMute);

    const [probedDuration, setProbedDuration] = useState<number>(() => (track.durationMs && track.durationMs > 0 ? track.durationMs / 1000 : 0));
    const fallbackWaveform = useMemo(() => createFallbackWaveform(track.storageKey || track.key || trackId), [track.key, track.storageKey, trackId]);
    const [realWaveform, setRealWaveform] = useState<number[] | null>(null);
    const [scrubbingPct, setScrubbingPct] = useState<number | null>(null);

    const waveformRef = useRef<HTMLDivElement>(null);
    const barsRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);
    const timeRef = useRef<HTMLSpanElement>(null);
    const pendingSeekPctRef = useRef<number | null>(null);

    const duration = measuredDuration > 0 ? measuredDuration : probedDuration;

    useEffect(() => {
        if (track.durationMs && track.durationMs > 0) {
            setProbedDuration(track.durationMs / 1000);
            return;
        }
        if (!track.url || typeof Audio === "undefined") return;
        let cancelled = false;
        const probe = new Audio();
        probe.preload = "metadata";
        const onMetadata = () => {
            if (!cancelled && Number.isFinite(probe.duration) && probe.duration > 0) {
                setProbedDuration(probe.duration);
            }
        };
        probe.addEventListener("loadedmetadata", onMetadata);
        probe.src = track.url;
        return () => {
            cancelled = true;
            probe.removeEventListener("loadedmetadata", onMetadata);
            probe.src = "";
        };
    }, [track.durationMs, track.url]);

    useEffect(() => {
        if (!track.url && !track.storageKey) return;
        let cancelled = false;
        void loadAudioWaveform(
            {
                nodeId: trackId,
                content: track.url,
                storageKey: track.storageKey,
            },
            INLINE_WAVEFORM_BARS,
        )
            .then((peaks) => {
                if (!cancelled && peaks.length) setRealWaveform(peaks);
            })
            .catch(() => {
                // 解码失败或跨域受限时保留确定性兜底波形
            });
        return () => {
            cancelled = true;
        };
    }, [track.storageKey, track.url, trackId]);

    const waveform = realWaveform || fallbackWaveform;

    const paintProgress = useCallback((currentSec: number, totalSec: number) => {
        const pct = totalSec > 0 ? Math.min(1, Math.max(0, currentSec / totalSec)) : 0;
        if (playheadRef.current) {
            playheadRef.current.style.left = `calc(8px + (100% - 16px) * ${pct})`;
        }
        if (timeRef.current) {
            timeRef.current.textContent = `${formatClock(currentSec)} / ${totalSec > 0 ? formatClock(totalSec) : "--:--"}`;
        }
        if (barsRef.current) {
            const slots = barsRef.current.children;
            const totalBars = slots.length;
            for (let i = 0; i < totalBars; i += 1) {
                const bar = slots[i]?.firstElementChild as HTMLElement | null;
                if (!bar) continue;
                const played = totalSec > 0 && pct > 0 && i / totalBars <= pct ? "true" : "false";
                if (bar.dataset.played !== played) bar.dataset.played = played;
            }
        }
    }, []);

    // 播放中按 60fps 直接更新游标与时间文本，未播放音轨保持零重渲染。
    useEffect(() => {
        if (!isCurrentTrack) {
            paintProgress(0, duration);
            return;
        }
        const applyCurrent = () => {
            const state = useMusicStore.getState();
            const liveTime = state.audioElement?.currentTime ?? state.currentTime;
            const liveDuration = state.duration > 0 ? state.duration : duration;
            paintProgress(scrubbingPct !== null && liveDuration > 0 ? scrubbingPct * liveDuration : liveTime, liveDuration);
        };
        applyCurrent();
        if (!isPlaying) {
            return useMusicStore.subscribe((state, prev) => {
                if (state.playingTaskId !== trackId) return;
                if (state.currentTime !== prev.currentTime || state.duration !== prev.duration) {
                    applyCurrent();
                }
            });
        }
        let rafId = 0;
        const tick = () => {
            applyCurrent();
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [duration, isCurrentTrack, isPlaying, paintProgress, scrubbingPct, trackId]);

    // 如果用户在未播放时拖拽/点击了波形，在音频元数据就绪后自动跳到目标位置。
    useEffect(() => {
        if (!isCurrentTrack || pendingSeekPctRef.current === null || measuredDuration <= 0) return;
        const targetSec = Math.max(0, Math.min(measuredDuration, pendingSeekPctRef.current * measuredDuration));
        pendingSeekPctRef.current = null;
        seekAudio(targetSec);
    }, [isCurrentTrack, measuredDuration, seekAudio]);

    const seekAtClientX = (clientX: number, commit: boolean) => {
        const el = waveformRef.current;
        if (!el || !track.url) return;
        const rect = el.getBoundingClientRect();
        const innerWidth = Math.max(1, rect.width - 16);
        const offset = Math.max(0, Math.min(innerWidth, clientX - rect.left - 8));
        const pct = offset / innerWidth;
        if (duration > 0) paintProgress(pct * duration, duration);
        if (!commit) return;
        if (isCurrentTrack && measuredDuration > 0) {
            seekAudio(pct * measuredDuration);
        } else if (isCurrentTrack) {
            pendingSeekPctRef.current = pct;
        } else {
            pendingSeekPctRef.current = pct;
            playAudio(trackId, track.url);
        }
    };

    const handleWaveformPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!track.url) return;
        event.preventDefault();
        const el = waveformRef.current;
        if (el) {
            const rect = el.getBoundingClientRect();
            const innerWidth = Math.max(1, rect.width - 16);
            setScrubbingPct(Math.max(0, Math.min(1, (event.clientX - rect.left - 8) / innerWidth)));
        }
        seekAtClientX(event.clientX, false);

        const handleMove = (moveEvent: PointerEvent) => {
            const el = waveformRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const innerWidth = Math.max(1, rect.width - 16);
            const pct = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left - 8) / innerWidth));
            setScrubbingPct(pct);
            if (duration > 0) paintProgress(pct * duration, duration);
        };

        const handleUp = (upEvent: PointerEvent) => {
            setScrubbingPct(null);
            seekAtClientX(upEvent.clientX, true);
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
    };

    const handleWaveformKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!isCurrentTrack || duration <= 0) return;
        const currentSec = useMusicStore.getState().audioElement?.currentTime ?? useMusicStore.getState().currentTime;
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            seekAudio(Math.max(0, currentSec - 5));
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            seekAudio(Math.min(duration, currentSec + 5));
        }
    };

    const targetDurationHint = targetDurationSeconds && targetDurationSeconds > 0 ? t("music.target_duration_hint", { seconds: targetDurationSeconds }, "目标时长 {seconds} 秒，实际时长以音频为准") : undefined;

    const initialDurationText = duration > 0 ? formatClock(duration) : "--:--";
    const downloadFileName = totalTracks > 1 ? `${title}-${index + 1}.mp3` : `${title}.mp3`;

    return (
        <div className="creation-music-track">
            {totalTracks > 1 ? (
                <div className="creation-music-track-subhead">
                    {track.identity ? (
                        <SongCardLink identity={track.identity} title={title}>
                            <span>{t("music.track_number", { number: track.identity.outputIndex + 1 })}</span>
                        </SongCardLink>
                    ) : (
                        <span>{t("music.track_number", { number: index + 1 }, "作品 {number}")}</span>
                    )}
                    <a href={track.url} download={downloadFileName} className="creation-music-track-download" aria-label={t("music.original_download")} title={t("music.original_download")}>
                        <Download className="size-3" aria-hidden="true" />
                    </a>
                </div>
            ) : null}

            <div className="creation-music-track-controls">
                <button
                    type="button"
                    className="creation-music-play-btn"
                    disabled={!track.url}
                    onClick={() => {
                        if (!track.url) return;
                        if (isPlaying) pauseAudio();
                        else if (playbackError) playAudio(trackId, track.url);
                        else togglePlayback(trackId, track.url);
                    }}
                    aria-label={t(isPlaying ? "music.player_pause" : "music.player_play", undefined, isPlaying ? "暂停播放" : "开始播放")}
                >
                    {isBuffering ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : isPlaying ? <Pause className="size-4 fill-current" aria-hidden="true" /> : <Play className="ml-0.5 size-4 fill-current" aria-hidden="true" />}
                </button>

                <div
                    ref={waveformRef}
                    role="slider"
                    tabIndex={0}
                    aria-label={t("music.player_progress", undefined, "音频播放进度")}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(1, Math.round(duration))}
                    aria-valuenow={isCurrentTrack ? Math.round(useMusicStore.getState().currentTime) : 0}
                    className="creation-music-waveform"
                    onPointerDown={handleWaveformPointerDown}
                    onKeyDown={handleWaveformKeyDown}
                >
                    <div className="creation-music-waveform-axis" aria-hidden="true" />
                    <div ref={barsRef} className="creation-music-waveform-bars" aria-hidden="true">
                        {waveform.map((peak, barIndex) => (
                            <div key={`${trackId}-bar-${barIndex}`} className="creation-music-waveform-slot">
                                <span className="creation-music-waveform-bar" data-played="false" style={{ height: `${Math.max(14, Math.round(peak * 78))}%` }} />
                            </div>
                        ))}
                    </div>
                    <div ref={playheadRef} className={`creation-music-playhead${isCurrentTrack && duration > 0 ? " is-visible" : ""}`} aria-hidden="true" />
                </div>

                <div className="creation-music-track-right">
                    {targetDurationHint ? (
                        <Tooltip title={targetDurationHint}>
                            <span ref={timeRef} className="creation-music-time">
                                0:00 / {initialDurationText}
                            </span>
                        </Tooltip>
                    ) : (
                        <span ref={timeRef} className="creation-music-time">
                            0:00 / {initialDurationText}
                        </span>
                    )}

                    <Tooltip title={t("music.loop_one", undefined, "单曲循环")}>
                        <button type="button" className="creation-music-util-btn" aria-pressed={isLoop} aria-label={t("music.loop_one", undefined, "单曲循环")} onClick={toggleAudioLoop}>
                            <Repeat1 className="size-3.5" aria-hidden="true" />
                        </button>
                    </Tooltip>

                    <Tooltip title={t(isMuted ? "music.player_unmute" : "music.player_mute", undefined, isMuted ? "取消静音" : "静音")}>
                        <button type="button" className="creation-music-util-btn" aria-pressed={isMuted} aria-label={t(isMuted ? "music.player_unmute" : "music.player_mute", undefined, isMuted ? "取消静音" : "静音")} onClick={toggleAudioMute}>
                            {isMuted ? <VolumeX className="size-3.5" aria-hidden="true" /> : <Volume2 className="size-3.5" aria-hidden="true" />}
                        </button>
                    </Tooltip>
                </div>
            </div>

            {playbackError ? (
                <div className="creation-music-track-error" role="alert">
                    <span>{t(playbackError, undefined, "音频暂时无法播放")}</span>
                    {onRefreshResult ? (
                        <button type="button" disabled={refreshingResult} onClick={onRefreshResult}>
                            {t("music.refresh_audio", undefined, "刷新音频链接")}
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export function CreationMusicCard({ messageId, taskIds, title, modelLabel, targetDurationSeconds, instrumental, tracks, onRefreshResult, refreshingResult, pageTitle, coverStorageKey, metadata = [], children }: CreationMusicCardProps) {
    const { t } = useI18n();
    const playingTaskId = useMusicStore((s) => (s.isPlaying ? s.playingTaskId : null));
    const trackIds = tracks.map(({ identity, key }, index) => (identity ? `${identity.taskId}:${identity.outputIndex}` : resolveInlineTrackId(messageId, taskIds?.[index] || taskIds?.[0], key, index)));
    const anyPlaying = Boolean(playingTaskId && trackIds.includes(playingTaskId));

    const metaParts = [modelLabel?.trim(), ...metadata].filter((part): part is string => Boolean(part));

    const identity = !pageTitle && tracks.length === 1 ? tracks[0].identity : undefined;
    const Title = pageTitle ? "h1" : "strong";
    const heading = (
        <div className="creation-music-card-identity">
            <span className={`creation-music-card-cover${anyPlaying ? " is-playing" : ""}`} aria-hidden="true">
                {coverStorageKey ? <CachedResourceImage storageKey={coverStorageKey} alt="" className="size-full object-cover" fallback={<Disc3 />} /> : <Disc3 />}
            </span>
            <div className="creation-music-card-title-group">
                <Title className="creation-music-card-title" title={title} translate="no">
                    {title}
                </Title>
                {metaParts.length || instrumental ? (
                    <span className="creation-music-card-meta">
                        {metaParts.map((part, idx) => (
                            <span key={`${part}-${idx}`} className="creation-music-card-model" title={part}>
                                {idx > 0 ? <span className="creation-music-card-sep">· </span> : null}
                                {part}
                            </span>
                        ))}
                        {instrumental ? (
                            <>
                                {metaParts.length ? <span className="creation-music-card-sep">·</span> : null}
                                <span className="creation-music-card-badge">{translate("create.music.instrumentalBadge")}</span>
                            </>
                        ) : null}
                    </span>
                ) : null}
            </div>
        </div>
    );

    return (
        <div className="creation-music-card" data-playing={anyPlaying ? "true" : "false"}>
            <div className="creation-music-card-head">
                {identity ? (
                    <SongCardLink identity={identity} title={title}>
                        {heading}
                    </SongCardLink>
                ) : (
                    heading
                )}
            </div>

            <div className="creation-music-card-tracks">
                {tracks.map((track, index) => (
                    <CreationMusicTrackRow
                        key={track.key || `${messageId}-${index}`}
                        trackId={trackIds[index]}
                        track={track}
                        index={index}
                        totalTracks={tracks.length}
                        title={title}
                        targetDurationSeconds={targetDurationSeconds}
                        onRefreshResult={onRefreshResult}
                        refreshingResult={refreshingResult}
                    />
                ))}
            </div>
            {children}
        </div>
    );
}

export default CreationMusicCard;
