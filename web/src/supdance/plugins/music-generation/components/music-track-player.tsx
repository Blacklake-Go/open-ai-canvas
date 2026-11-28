import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Download, FastForward, Rewind } from "lucide-react";
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

export function MusicTrackPlayer({ task, output, onRefresh, refreshing, studio = false, onExpand }: { task: MusicTask; output: MusicOutput; onRefresh: () => void; refreshing: boolean; studio?: boolean; onExpand?: () => void }) {
    const { t, locale } = useI18n();
    const outputId = output.id;
    const cover = useMusicCover(task.userId, task.taskId, Boolean(task.coverSupported), task.cover);
    const queryClient = useQueryClient();
    const title = task.title || t("music.default_track_title");
    const audio = useMusicStore((s) => (s.playingTaskId === outputId ? s.audioElement : null));
    const measuredDuration = useMusicStore((s) => (s.playingTaskId === outputId && Number.isFinite(s.duration) ? s.duration : 0));
    const [rate, setRate] = useState("1");
    const [download, setDownload] = useState<"idle" | "busy" | "error">("idle");
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

    const seekBy = (delta: number) => {
        const playback = useMusicStore.getState();
        const current = playback.audioElement?.currentTime ?? playback.currentTime;
        playback.seekAudio(Math.max(0, Math.min(measuredDuration, current + delta)));
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
                    <IconButton icon={Rewind} disabled={!measuredDuration} className="size-11" aria-label={t("music.track_rewind")} title={t("music.track_rewind")} onClick={() => seekBy(-15)} />
                    <IconButton icon={FastForward} disabled={!measuredDuration} className="size-11" aria-label={t("music.track_forward")} title={t("music.track_forward")} onClick={() => seekBy(15)} />
                    <Select<string> ariaLabel={t("music.track_rate")} options={rateOptions} value={rate} onChange={setRate} className="min-h-11" />
                    {cover.data && <MusicCoverControls key={task.taskId} userId={task.userId} taskId={task.taskId} cover={cover.data} onChange={(view) => queryClient.setQueryData(["music-cover", task.userId, task.taskId], view)} />}
                    {!studio && (
                        <IconButton
                            icon={Download}
                            className="ms-auto size-11"
                            disabled={!output.audioUrl && !output.storageKey}
                            loading={download === "busy"}
                            aria-label={t("music.original_download")}
                            title={t("music.original_download")}
                            onClick={() => void downloadAudio()}
                        />
                    )}
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
            <MusicLyricsDisplay lyrics={lyrics} instrumental={instrumental} output={output} onExpand={onExpand} />
        </>
    );
}
