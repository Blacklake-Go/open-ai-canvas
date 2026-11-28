import { useState } from "react";
import { Link } from "react-router";
import { recoverGenerationTaskMedia } from "@/services/api/task-center";
import { ChevronRight, Disc3, Download, FolderOpen, Heart, Info, Music2, Pause, Play, Scissors, Share2, SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/supdance/plugins/i18n";
import { useMusicStore } from "../stores/use-music-store";
import { musicOutputLabel } from "../services/music-tools";
import { canLocateMusicAsset } from "../services/music-assets";
import { downloadMusicOutput } from "../services/music-site-api";
import type { MusicTask, MusicOutput } from "../services/music-api";
import { TaskCard } from "./task-card";
import { musicTrackHref } from "../services/music-track-route";

export function musicTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return "—";
    return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
}

type Props = {
    task: MusicTask;
    favorites: ReadonlySet<string>;
    onlyFavorites: boolean;
    onFavorite: (output: MusicOutput) => void;
    onDetails: (output?: MusicOutput) => void;
    onTrim: (output: MusicOutput) => void;
    onAdvanced?: (output: MusicOutput) => void;
    onAsset: (output: MusicOutput) => Promise<void>;
};

export function TrackList({ task, favorites, onlyFavorites, onFavorite, onDetails, onTrim, onAsset, onAdvanced }: Props) {
    const { t } = useI18n();
    const currentlyPlaying = useMusicStore((s) => (s.isPlaying ? s.playingTaskId : null));
    const toggle = useMusicStore((s) => s.togglePlayback);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const title = task.title || t("music.default_track_title");
    const model = task.model.split("::").at(-1);
    const description = (task.prompt || task.lyrics || "")
        .replace(/\[[^\]]+\]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 140);
    const share = async (href: string) => {
        setError("");
        setCopied(false);
        try {
            await navigator.clipboard.writeText(new URL(href, window.location.origin).href);
            setCopied(true);
        } catch {
            setError(t("music.track_copy_failed"));
        }
    };
    if (task.status !== "completed" || !task.outputs?.length) return <TaskCard task={task} onDetails={onDetails} />;
    const run = async (id: string, action: () => Promise<unknown>) => {
        setError("");
        setBusy(id);
        try {
            await action();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("music.download_failed"));
        } finally {
            setBusy(null);
        }
    };
    return (
        <div className="music-record-group">
            {task.outputs
                .filter((output) => !onlyFavorites || favorites.has(output.id))
                .map((output) => {
                    const number = output.outputIndex + 1;
                    const variant = musicOutputLabel(output, t);
                    const active = currentlyPlaying === output.id;
                    const liked = favorites.has(output.id);
                    const canOpen = canLocateMusicAsset(output);
                    const trackHref = musicTrackHref({ taskId: task.taskId, outputIndex: output.outputIndex });
                    return (
                        <article key={output.id} aria-label={title + " · " + variant} data-output-id={output.id} className={"music-record" + (active ? " is-playing" : "")}>
                            <button
                                className="music-cover"
                                type="button"
                                aria-label={t(active ? "music.player_pause" : "music.player_play") + " · " + variant}
                                disabled={!output.audioUrl}
                                onClick={() => output.audioUrl && toggle(output.id, output.audioUrl)}
                            >
                                <Disc3 size={34} className="music-disc" aria-hidden />
                                <span className="music-cover-control">{active ? <Pause size={14} /> : <Play size={14} />}</span>
                            </button>
                            <Link className="music-record-title" to={trackHref}>
                                <strong>{title}</strong>
                                <span>
                                    {variant} <i>·</i> {model}{" "}
                                    {task.instrumental && (
                                        <>
                                            {" "}
                                            <i>·</i> <Music2 size={12} aria-label={t("music.instrumental_label")} />
                                        </>
                                    )}
                                </span>
                                {description && <span className="music-record-desc">{description}</span>}
                                <ChevronRight className="music-record-chevron" size={16} aria-hidden />
                            </Link>
                            <span className="music-record-length">{output.durationMs ? musicTime(output.durationMs / 1000) : "—"}</span>
                            <div className="music-record-actions">
                                <button type="button" aria-pressed={liked} title={t("music.favorite_local")} aria-label={t("music.favorite_local")} onClick={() => onFavorite(output)}>
                                    <Heart size={16} fill={liked ? "currentColor" : "none"} />
                                </button>
                                {onAdvanced && (
                                    <button type="button" aria-label={t("music.adv_tools")} title={t("music.adv_tools")} disabled={!canOpen} onClick={() => onAdvanced(output)}>
                                        <SlidersHorizontal size={16} />
                                    </button>
                                )}
                                <button type="button" aria-label={t("music.track_copy")} title={t("music.track_copy")} onClick={() => void share(trackHref)}>
                                    <Share2 size={16} />
                                </button>
                                <button type="button" aria-label={t("music.track_details")} title={t("music.track_details")} onClick={() => onDetails(output)}>
                                    <Info size={16} />
                                </button>
                                <button type="button" className="music-trim-trigger" disabled={!output.audioUrl && !output.storageKey} aria-label={t("music.trim_track")} title={t("music.trim_track")} onClick={() => onTrim(output)}>
                                    <Scissors size={16} />
                                </button>
                                <button
                                    type="button"
                                    disabled={!canOpen || busy === output.id}
                                    aria-label={t("music.manage_in_assets")}
                                    title={t(canOpen ? "music.manage_in_assets" : "music.asset_unavailable")}
                                    onClick={() => void run(output.id, () => onAsset(output))}
                                >
                                    <FolderOpen size={16} />
                                </button>
                                <button
                                    type="button"
                                    disabled={busy === output.id || (!output.audioUrl && !output.storageKey)}
                                    title={t("music.original_download")}
                                    aria-label={t("music.original_download")}
                                    onClick={() => void run(output.id, () => downloadMusicOutput(output, title + "-" + number))}
                                >
                                    <Download size={16} />
                                </button>
                            </div>
                        </article>
                    );
                })}
            {task.canRecoverMedia && (
                <button
                    type="button"
                    disabled={busy !== null}
                    className="music-asset-link"
                    onClick={() =>
                        void run(task.taskId, async () => {
                            await recoverGenerationTaskMedia(task.taskId);
                            await useMusicStore.getState().loadTasks();
                        })
                    }
                >
                    {t("music.retry_archive")}
                </button>
            )}
            {copied && (
                <p className="music-copy-status" role="status">
                    {t("music.track_copied")}
                </p>
            )}
            {error && (
                <p className="music-list-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
