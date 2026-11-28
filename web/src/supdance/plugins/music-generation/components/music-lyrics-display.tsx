import { useEffect, useId, useMemo, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { IconButton } from "@/components/ui/base/buttons";
import { useI18n } from "@/supdance/plugins/i18n";
import { musicLyricTimeline } from "../services/music-lyric-timeline";
import "../styles/music-lyrics-display.css";

function lyricTime(seconds: number) {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function MusicLyricsDisplay({ lyrics, instrumental, current, duration, active, canSeek, onSeek }: { lyrics: string; instrumental: boolean; current: number; duration: number; active: boolean; canSeek: boolean; onSeek: (seconds: number) => void }) {
    const { t } = useI18n();
    const headingId = useId();
    const viewport = useRef<HTMLDivElement>(null);
    const currentRow = useRef<HTMLDivElement>(null);
    const drag = useRef<{ pointer: number; y: number; scroll: number } | null>(null);
    const didDrag = useRef(false);
    const [following, setFollowing] = useState(true);
    const timeline = useMemo(() => musicLyricTimeline(lyrics, duration), [lyrics, duration]);
    const hasLyrics = timeline.some((row) => !row.section);
    const activeIndex = active ? timeline.findLastIndex((row) => row.start !== null && row.start <= current) : -1;

    useEffect(() => {
        const panel = viewport.current;
        const row = currentRow.current;
        if (!following || !panel || !row) return;
        const offset = row.getBoundingClientRect().top - panel.getBoundingClientRect().top;
        panel.scrollTop += offset - (panel.clientHeight - row.clientHeight) / 2;
    }, [activeIndex, following]);

    return (
        <section className="creation-music-card plugin-music-track-lyrics music-lyrics-display" aria-labelledby={headingId}>
            <header className="music-lyrics-heading">
                <div>
                    <h2 id={headingId}>{t("music.track_lyrics")}</h2>
                    {timeline.some((row) => row.start !== null && !row.timestamped) && <p className="creation-music-card-meta">{t("music.track_estimated_lyrics")}</p>}
                </div>
                {hasLyrics && active && <IconButton icon={LocateFixed} className="size-11" aria-label={t("music.track_lyrics_follow")} title={t("music.track_lyrics_follow")} aria-pressed={following} onClick={() => setFollowing(!following)} />}
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
                        if (event.pointerType === "touch") {
                            setFollowing(false);
                        } else if (event.button === 0) {
                            drag.current = { pointer: event.pointerId, y: event.clientY, scroll: event.currentTarget.scrollTop };
                        }
                    }}
                    onPointerMove={(event) => {
                        const start = drag.current;
                        if (!start || start.pointer !== event.pointerId || event.buttons !== 1) return;
                        const delta = start.y - event.clientY;
                        if (!didDrag.current && Math.abs(delta) < 5) return;
                        if (!didDrag.current) {
                            didDrag.current = true;
                            event.currentTarget.setPointerCapture(event.pointerId);
                            setFollowing(false);
                        }
                        event.currentTarget.scrollTop = start.scroll + delta;
                    }}
                    onPointerUp={() => {
                        drag.current = null;
                    }}
                    onPointerCancel={() => {
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
                            <div key={index} ref={current ? currentRow : null} className={row.section ? "music-lyric-section" : "music-lyric-line"} aria-current={current ? "true" : undefined}>
                                <span>{row.text}</span>
                                {seconds !== null && canSeek ? (
                                    <button
                                        type="button"
                                        className="music-lyric-time"
                                        aria-label={`${t("music.player_progress")} ${time}`}
                                        onClick={() => {
                                            setFollowing(true);
                                            onSeek(seconds);
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
