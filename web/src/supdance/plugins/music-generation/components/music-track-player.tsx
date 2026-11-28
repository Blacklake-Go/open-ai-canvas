import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FastForward, Rewind, SkipBack, SkipForward } from "lucide-react";
import { Button } from "antd";
import { IconButton } from "@/components/ui/base/buttons";
import { Select } from "@/components/ui/base/select";
import { useI18n } from "@/supdance/plugins/i18n";
import type { MusicOutput, MusicTask } from "../services/music-api";
import { downloadMusicOutput } from "../services/music-site-api";
import { musicOutputLabel } from "../services/music-tools";
import { useMusicStore } from "../stores/use-music-store";
import { CreationMusicCard } from "./creation-music-card";
import { MusicCoverControls, useMusicCover } from "./music-cover-controls";
import { MusicLyricsDisplay } from "./music-lyrics-display";

const playbackRates = [0.75, 1, 1.25, 1.5, 2];

export function MusicTrackPlayer({
    task,
    output,
    onRefresh,
    refreshing,
    studio = false,
    onPrevious,
    onNext,
}: {
    task: MusicTask;
    output: MusicOutput;
    onRefresh: () => void;
    refreshing: boolean;
    studio?: boolean;
    onPrevious?: () => void;
    onNext?: () => void;
}) {
    const { t, locale } = useI18n();
    const outputId = output.id;
    const cover = useMusicCover(task.userId, task.taskId, Boolean(task.coverSupported));
    const queryClient = useQueryClient();
    const title = task.title || t("music.default_track_title");
    const active = useMusicStore((s) => s.playingTaskId === outputId);
    const audio = useMusicStore((s) => (s.playingTaskId === outputId ? s.audioElement : null));
    const current = useMusicStore((s) => (s.playingTaskId === outputId ? s.currentTime : 0));
    const measuredDuration = useMusicStore((s) => (s.playingTaskId === outputId && Number.isFinite(s.duration) ? s.duration : 0));
    const playbackError = useMusicStore((s) => (s.playingTaskId === outputId ? s.playbackError : ""));
    const [rate, setRate] = useState("1");
    const [download, setDownload] = useState<"idle" | "busy" | "error">("idle");
    const pendingLyricSeek = useRef<number | null>(null);
    const duration = measuredDuration || Math.max(0, output.durationMs || 0) / 1000;
    const instrumental = task.instrumental || /^(instrumental|accompaniment)$/i.test(output.stemName?.trim() || "");
    const lyrics = instrumental ? "" : task.lyrics?.trim() || "";
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
        if (!studio && playback.playingTaskId !== outputId && playback.playingTaskId) playback.pauseAudio();
        return () => {
            const playback = useMusicStore.getState();
            if (playback.playingTaskId !== outputId) return;
            if (!studio) playback.pauseAudio();
            if (playback.audioElement) playback.audioElement.playbackRate = 1;
        };
    }, [outputId, studio]);

    useEffect(() => {
        if (audio) audio.playbackRate = Number(rate);
    }, [audio, rate]);

    useEffect(() => {
        if (!measuredDuration || pendingLyricSeek.current === null) return;
        useMusicStore.getState().seekAudio(Math.min(measuredDuration, pendingLyricSeek.current));
        pendingLyricSeek.current = null;
    }, [measuredDuration]);

    const seek = (seconds: number) => useMusicStore.getState().seekAudio(Math.max(0, Math.min(measuredDuration, seconds)));
    const seekLyric = (seconds: number) => {
        if (measuredDuration) {
            seek(seconds);
        } else if (output.audioUrl) {
            pendingLyricSeek.current = seconds;
            if (!active || playbackError) useMusicStore.getState().playAudio(outputId, output.audioUrl);
        }
    };
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
                coverStorageKey={cover.data?.storageKey}
                instrumental={instrumental}
                metadata={[(task.outputs?.length || 0) > 1 ? musicOutputLabel(output, t) : "", created, output.format?.toUpperCase() || ""]}
                tracks={[{ key: output.id, identity: { taskId: task.taskId, outputIndex: output.outputIndex }, url: output.audioUrl || "", storageKey: output.storageKey, durationMs: output.durationMs }]}
                onRefreshResult={onRefresh}
                refreshingResult={refreshing}
            >
                <div className="plugin-music-track-toolbar">
                    {studio && <IconButton icon={SkipBack} className="size-11" aria-label={t("music.previous_track")} title={t("music.previous_track")} disabled={!onPrevious} onClick={onPrevious} />}
                    <IconButton icon={Rewind} disabled={!measuredDuration} className="size-11" aria-label={t("music.track_rewind")} title={t("music.track_rewind")} onClick={() => seek(current - 15)} />
                    <IconButton icon={FastForward} disabled={!measuredDuration} className="size-11" aria-label={t("music.track_forward")} title={t("music.track_forward")} onClick={() => seek(current + 15)} />
                    {studio && <IconButton icon={SkipForward} className="size-11" aria-label={t("music.next_track")} title={t("music.next_track")} disabled={!onNext} onClick={onNext} />}
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
                {!studio && cover.data && <MusicCoverControls userId={task.userId} taskId={task.taskId} cover={cover.data} onChange={(view) => queryClient.setQueryData(["music-cover", task.userId, task.taskId], view)} />}
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
            <MusicLyricsDisplay lyrics={lyrics} instrumental={instrumental} current={current} duration={duration} active={active && !playbackError} canSeek={Boolean(output.audioUrl)} onSeek={seekLyric} />
        </>
    );
}
