import { useEffect, useId, useMemo, useRef, useState } from "react";
import { LocateFixed, Maximize2 } from "lucide-react";
import { IconButton } from "@/components/ui/base/buttons";
import { useI18n } from "@/supdance/plugins/i18n";
import { musicLyricTimeline } from "../services/music-lyric-timeline";
import type { MusicOutput } from "../services/music-api";
import { useMusicStore } from "../stores/use-music-store";
import "../styles/music-lyrics-display.css";

function lyricTime(seconds: number) {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function MusicLyricsDisplay({ lyrics, instrumental, output, expanded, onExpand }: { lyrics: string; instrumental: boolean; output: MusicOutput; expanded?: boolean; onExpand?: () => void }) {
    const { t } = useI18n();
    const expandLabel = t("music.track_expand_lyrics", undefined, "Expand lyrics");
    const headingId = useId();
    const viewport = useRef<HTMLDivElement>(null);
    const currentRow = useRef<HTMLDivElement>(null);
    const drag = useRef<{ pointer: number; y: number; scroll: number; touch: boolean } | null>(null);
    const didDrag = useRef(false);
    const pendingSeek = useRef<number | null>(null);
    const [following, setFollowing] = useState(true);
    const [activeIndex, setActiveIndex] = useState(-1);
    const active = useMusicStore((state) => state.playingTaskId === output.id && !state.playbackError);
    const measured = useMusicStore((state) => (state.playingTaskId === output.id ? state.duration : 0));
    const duration = measured || Math.max(0, output.durationMs || 0) / 1000;
    const timeline = useMemo(() => musicLyricTimeline(lyrics, duration), [lyrics, duration]);
    const hasLyrics = timeline.some((row) => !row.section);

    useEffect(() => {
        if (!hasLyrics) return;
        let frame = 0;
        let lastIndex = -2;
        const paint = () => {
            const playback = useMusicStore.getState();
            const selected = playback.playingTaskId === output.id && !playback.playbackError;
            const current = selected ? (playback.audioElement?.currentTime ?? playback.currentTime) : 0;
            const index = selected ? timeline.findLastIndex((row) => row.start !== null && row.start <= current) : -1;
            if (index !== lastIndex) {
                lastIndex = index;
                setActiveIndex(index);
            }
            const cue = timeline[index];
            const start = cue?.start;
            const end = cue?.end;
            if (cue?.timestamped && start != null && end != null && end > start && currentRow.current?.dataset.index === String(index)) {
                currentRow.current.style.setProperty("--music-lyric-progress", `${Math.min(100, Math.max(0, ((current - start) / (end - start)) * 100))}%`);
            }
        };
        const stop = () => {
            cancelAnimationFrame(frame);
            frame = 0;
        };
        const tick = () => {
            paint();
            frame = requestAnimationFrame(tick);
        };
        const sync = () => {
            paint();
            const playback = useMusicStore.getState();
            if (playback.isPlaying && playback.playingTaskId === output.id) {
                if (!frame) frame = requestAnimationFrame(tick);
            } else {
                stop();
            }
        };
        sync();
        const unsubscribe = useMusicStore.subscribe(sync);
        return () => {
            stop();
            unsubscribe();
        };
    }, [activeIndex, hasLyrics, output.id, timeline]);

    useEffect(() => {
        if (!measured || pendingSeek.current === null) return;
        useMusicStore.getState().seekAudio(Math.min(measured, pendingSeek.current));
        pendingSeek.current = null;
    }, [measured]);

    const seek = (seconds: number) => {
        const playback = useMusicStore.getState();
        if (measured && active) {
            playback.seekAudio(Math.min(measured, seconds));
        } else if (output.audioUrl) {
            pendingSeek.current = seconds;
            if (!active) playback.playAudio(output.id, output.audioUrl);
        }
    };

    useEffect(() => {
        const panel = viewport.current;
        const row = currentRow.current;
        if (!following || !panel || !row) return;
        const offset = row.getBoundingClientRect().top - panel.getBoundingClientRect().top;
        panel.scrollTo({
            top: panel.scrollTop + offset - (panel.clientHeight - row.clientHeight) / 2,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        });
    }, [activeIndex, following, timeline]);

    return (
        <section className={expanded ? "music-lyrics-display music-lyrics-expanded" : "creation-music-card plugin-music-track-lyrics music-lyrics-display"} aria-labelledby={headingId}>
            <header className="music-lyrics-heading">
                <div>
                    <h2 id={headingId}>{t("music.track_lyrics")}</h2>
                    {timeline.some((row) => row.start !== null && !row.timestamped) && <p className="creation-music-card-meta">{t("music.track_estimated_lyrics")}</p>}
                </div>
                <div className="music-lyrics-actions">
                    {hasLyrics && active && <IconButton icon={LocateFixed} className="size-11" aria-label={t("music.track_lyrics_follow")} title={t("music.track_lyrics_follow")} aria-pressed={following} onClick={() => setFollowing(!following)} />}
                    {onExpand && <IconButton icon={Maximize2} className="size-11" aria-label={expandLabel} title={expandLabel} aria-haspopup="dialog" onClick={onExpand} />}
                </div>
            </header>
            {hasLyrics ? (
                <div
                    ref={viewport}
                    className="music-lyrics-viewport creation-scrollbar"
                    tabIndex={0}
                    aria-labelledby={headingId}
                    onWheel={() => setFollowing(false)}
                    onKeyDown={(event) => {
                        if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) setFollowing(false);
                    }}
                    onPointerDown={(event) => {
                        didDrag.current = false;
                        if (event.button === 0) {
                            drag.current = { pointer: event.pointerId, y: event.clientY, scroll: event.currentTarget.scrollTop, touch: event.pointerType === "touch" };
                        }
                    }}
                    onPointerMove={(event) => {
                        const start = drag.current;
                        if (!start || start.pointer !== event.pointerId || (!start.touch && event.buttons !== 1)) return;
                        const delta = start.y - event.clientY;
                        if (!didDrag.current && Math.abs(delta) < 5) return;
                        if (!didDrag.current) {
                            didDrag.current = true;
                            if (!start.touch) event.currentTarget.setPointerCapture(event.pointerId);
                            setFollowing(false);
                        }
                        if (!start.touch) event.currentTarget.scrollTop = start.scroll + delta;
                    }}
                    onPointerUp={() => {
                        drag.current = null;
                    }}
                    onPointerCancel={() => {
                        if (drag.current?.touch) setFollowing(false);
                        drag.current = null;
                    }}
                    onClickCapture={(event) => {
                        if (!didDrag.current) return;
                        didDrag.current = false;
                        event.stopPropagation();
                        event.preventDefault();
                    }}
                    translate="no"
                >
                    {timeline.map((row, index) => {
                        const current = index === activeIndex;
                        const seconds = row.start;
                        const time = seconds === null ? "" : lyricTime(seconds);
                        return (
                            <div key={index} data-index={index} ref={current ? currentRow : null} className={row.section ? "music-lyric-section" : "music-lyric-line"} aria-current={current ? "true" : undefined}>
                                <span className="music-lyric-text">
                                    {row.text}
                                    {current && row.timestamped && (
                                        <span className="music-lyric-fill" aria-hidden="true">
                                            {row.text}
                                        </span>
                                    )}
                                </span>
                                {seconds !== null && output.audioUrl ? (
                                    <button
                                        type="button"
                                        className="music-lyric-time"
                                        aria-label={`${t("music.player_progress")} ${time}`}
                                        onClick={() => {
                                            setFollowing(true);
                                            seek(seconds);
                                        }}
                                    >
                                        {time}
                                    </button>
                                ) : time ? (
                                    <span className="music-lyric-time">{time}</span>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="music-lyrics-empty">{t(instrumental ? "music.track_instrumental" : "music.track_no_lyrics")}</p>
            )}
        </section>
    );
}
