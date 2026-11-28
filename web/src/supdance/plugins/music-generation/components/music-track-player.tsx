import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FastForward, Rewind } from "lucide-react";
import { Button } from "antd";
import { IconButton } from "@/components/ui/base/buttons";
import { Select } from "@/components/ui/base/select";
import { useI18n } from "@/supdance/plugins/i18n";
import type { MusicOutput, MusicTask } from "../services/music-api";
import { musicLyricTimeline } from "../services/music-lyric-timeline";
import { downloadMusicOutput } from "../services/music-site-api";
import { musicOutputLabel } from "../services/music-tools";
import { useMusicStore } from "../stores/use-music-store";
import { CreationMusicCard } from "./creation-music-card";

const playbackRates = [0.75, 1, 1.25, 1.5, 2];

export function MusicTrackPlayer({ task, output, onRefresh, refreshing }: { task: MusicTask; output: MusicOutput; onRefresh: () => void; refreshing: boolean }) {
    const { t, locale } = useI18n();
    const outputId = output.id;
    const title = task.title || t("music.default_track_title");
    const active = useMusicStore((s) => s.playingTaskId === outputId);
    const audio = useMusicStore((s) => (s.playingTaskId === outputId ? s.audioElement : null));
    const current = useMusicStore((s) => (s.playingTaskId === outputId ? s.currentTime : 0));
    const measuredDuration = useMusicStore((s) => (s.playingTaskId === outputId && Number.isFinite(s.duration) ? s.duration : 0));
    const playbackError = useMusicStore((s) => (s.playingTaskId === outputId ? s.playbackError : ""));
    const [rate, setRate] = useState("1");
    const [download, setDownload] = useState<"idle" | "busy" | "error">("idle");
    const lyricScroll = useRef<HTMLDivElement>(null);
    const duration = measuredDuration || Math.max(0, output.durationMs || 0) / 1000;
    const instrumental = task.instrumental || /^(instrumental|accompaniment)$/i.test(output.stemName?.trim() || "");
    const lyrics = instrumental ? "" : task.lyrics?.trim() || "";
    const timeline = useMemo(() => musicLyricTimeline(lyrics, duration), [lyrics, duration]);
    const hasLyrics = timeline.some((line) => !line.section);
    const activeLine = active && !playbackError ? timeline.findLastIndex((line) => line.start !== null && line.start <= current) : -1;
    const created = useMemo(() => {
        const date = new Date(task.createdAt);
        return Number.isFinite(date.valueOf()) ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date) : "";
    }, [locale, task.createdAt]);
    const rateOptions = useMemo(() => {
        const format = new Intl.NumberFormat(locale);
        return playbackRates.map((option) => ({ value: String(option), label: `${format.format(option)}×` }));
    }, [locale]);

    useEffect(() => {
        const playback = useMusicStore.getState();
        if (playback.playingTaskId !== outputId && playback.playingTaskId) playback.pauseAudio();
        return () => {
            const playback = useMusicStore.getState();
            if (playback.playingTaskId !== outputId) return;
            playback.pauseAudio();
            if (playback.audioElement) playback.audioElement.playbackRate = 1;
        };
    }, [outputId]);

    useEffect(() => {
        if (audio) audio.playbackRate = Number(rate);
    }, [audio, rate]);

    useEffect(() => {
        const panel = lyricScroll.current;
        const line = panel?.querySelector<HTMLElement>('[aria-current="true"]');
        if (!panel || !line) return;
        const bounds = panel.getBoundingClientRect();
        const lineBounds = line.getBoundingClientRect();
        if (lineBounds.top < bounds.top || lineBounds.bottom > bounds.bottom) panel.scrollTop += lineBounds.top - bounds.top - panel.clientHeight / 3;
    }, [activeLine]);

    const seek = (seconds: number) => useMusicStore.getState().seekAudio(Math.max(0, Math.min(measuredDuration, seconds)));
    const downloadAudio = async () => {
        setDownload("busy");
        try {
            await downloadMusicOutput(output, task.outputs && task.outputs.length > 1 ? `${title}-${output.outputIndex + 1}` : title);
            setDownload("idle");
        } catch {
            setDownload("error");
        }
    };

    return (
        <>
            <CreationMusicCard
                messageId={task.taskId}
                title={title}
                pageTitle
                instrumental={instrumental}
                metadata={[(task.outputs?.length || 0) > 1 ? musicOutputLabel(output, t) : "", created, output.format?.toUpperCase() || ""]}
                tracks={[{ key: output.id, identity: { taskId: task.taskId, outputIndex: output.outputIndex }, url: output.audioUrl || "", storageKey: output.storageKey, durationMs: output.durationMs }]}
                onRefreshResult={onRefresh}
                refreshingResult={refreshing}
            >
                <div className="plugin-music-track-toolbar">
                    <IconButton icon={Rewind} disabled={!measuredDuration} className="size-11" aria-label={t("music.track_rewind")} title={t("music.track_rewind")} onClick={() => seek(current - 15)} />
                    <IconButton icon={FastForward} disabled={!measuredDuration} className="size-11" aria-label={t("music.track_forward")} title={t("music.track_forward")} onClick={() => seek(current + 15)} />
                    <Select<string> ariaLabel={t("music.track_rate")} options={rateOptions} value={rate} onChange={setRate} className="min-h-11" />
                    <IconButton
                        icon={Download}
                        className="ms-auto size-11"
                        disabled={!output.audioUrl && !output.storageKey}
                        loading={download === "busy"}
                        aria-label={t("music.original_download")}
                        title={t("music.original_download")}
                        onClick={() => void downloadAudio()}
                    />
                </div>
                {!output.audioUrl && (
                    <div className="creation-music-track-error" role="alert">
                        <span>{t("music.playback_failed")}</span>
                        <Button htmlType="button" disabled={refreshing} onClick={onRefresh}>
                            {t("common.reload")}
                        </Button>
                    </div>
                )}
                {download === "error" && (
                    <p className="creation-music-track-error" role="alert">
                        {t("music.download_failed")}
                    </p>
                )}
            </CreationMusicCard>
            <section className="creation-music-card plugin-music-track-lyrics" aria-labelledby="music-track-lyrics-heading">
                <header>
                    <h2 id="music-track-lyrics-heading" className="creation-music-card-title">
                        {t("music.track_lyrics")}
                    </h2>
                    {duration > 0 && hasLyrics && <p className="creation-music-card-meta">{t("music.track_estimated_lyrics")}</p>}
                </header>
                {hasLyrics ? (
                    <div ref={lyricScroll} className="plugin-music-track-lyric-scroll" translate="no">
                        {timeline.map((line, index) => (
                            <p key={index} className={line.section ? "creation-music-card-title" : undefined} aria-current={index === activeLine ? "true" : undefined}>
                                {line.text}
                            </p>
                        ))}
                    </div>
                ) : (
                    <p className="creation-music-card-meta">{t(instrumental ? "music.track_instrumental" : "music.track_no_lyrics")}</p>
                )}
            </section>
        </>
    );
}
