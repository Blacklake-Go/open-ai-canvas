import { useState } from "react";
import { useNavigate } from "react-router";
import { Dropdown, type MenuProps } from "antd";
import { recoverGenerationTaskMedia } from "@/services/api/task-center";
import { Disc3, Download, ExternalLink, FolderOpen, Heart, Info, MoreHorizontal, Pause, Play, Scissors, Share2, SlidersHorizontal } from "lucide-react";
import { IconButton } from "@/components/ui/base/buttons";
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
    selectedOutputId?: string;
    onSelect: (output: MusicOutput) => void;
    onFavorite: (output: MusicOutput) => void;
    onDetails: (output?: MusicOutput) => void;
    onTrim: (output: MusicOutput) => void;
    onAdvanced?: (output: MusicOutput) => void;
    onAsset: (output: MusicOutput) => Promise<void>;
};

export function TrackList({ task, favorites, onlyFavorites, selectedOutputId, onSelect, onFavorite, onDetails, onTrim, onAsset, onAdvanced }: Props) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const currentlyPlaying = useMusicStore((s) => (s.isPlaying ? s.playingTaskId : null));
    const toggle = useMusicStore((s) => s.togglePlayback);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const title = task.title || t("music.default_track_title");
    const model = task.model.split("::").at(-1);
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
                    const actions: MenuProps["items"] = [
                        { key: "open", icon: <ExternalLink size={16} />, label: t("music.track_open_page"), onClick: () => void navigate(trackHref) },
                        { key: "favorite", icon: <Heart size={16} fill={liked ? "currentColor" : "none"} />, label: t(liked ? "music.track_unfavorite" : "music.favorite_local"), onClick: () => onFavorite(output) },
                        { key: "copy", icon: <Share2 size={16} />, label: t("music.track_copy"), onClick: () => void share(trackHref) },
                        { key: "details", icon: <Info size={16} />, label: t("music.track_details"), onClick: () => onDetails(output) },
                        { key: "trim", icon: <Scissors size={16} />, label: t("music.trim_track"), disabled: !output.audioUrl && !output.storageKey, onClick: () => onTrim(output) },
                        { key: "asset", icon: <FolderOpen size={16} />, label: t("music.manage_in_assets"), disabled: !canOpen || busy === output.id, onClick: () => void run(output.id, () => onAsset(output)) },
                        {
                            key: "download",
                            icon: <Download size={16} />,
                            label: t("music.original_download"),
                            disabled: busy === output.id || (!output.audioUrl && !output.storageKey),
                            onClick: () => void run(output.id, () => downloadMusicOutput(output, title + "-" + number)),
                        },
                    ];
                    if (onAdvanced) actions.splice(4, 0, { key: "tools", icon: <SlidersHorizontal size={16} />, label: t("music.adv_tools"), disabled: !canOpen, onClick: () => onAdvanced(output) });
                    return (
                        <article key={output.id} aria-label={title + " · " + variant} data-output-id={output.id} className={"music-record" + (selectedOutputId === output.id ? " is-selected" : "")}>
                            <button
                                className="music-cover"
                                type="button"
                                aria-label={t(active ? "music.player_pause" : "music.player_play") + " · " + variant}
                                disabled={!output.audioUrl}
                                onClick={() => {
                                    if (output.audioUrl) {
                                        onSelect(output);
                                        toggle(output.id, output.audioUrl);
                                    }
                                }}
                            >
                                <Disc3 size={20} className="music-disc" aria-hidden />
                                <span className="music-cover-control">{active ? <Pause size={16} /> : <Play size={16} />}</span>
                            </button>
                            <button type="button" className="music-record-title" aria-current={selectedOutputId === output.id ? "true" : undefined} onClick={() => onSelect(output)}>
                                <strong>{title}</strong>
                                <span>{[variant, output.durationMs ? musicTime(output.durationMs / 1000) : "", model].filter(Boolean).join(" · ")}</span>
                            </button>
                            <Dropdown menu={{ items: actions }} trigger={["click"]} placement="bottomRight">
                                <IconButton icon={MoreHorizontal} className="music-track-actions-trigger size-11" aria-label={t("music.track_actions")} title={t("music.track_actions")} />
                            </Dropdown>
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
