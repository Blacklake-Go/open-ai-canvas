import { useState } from "react";
import { Play, Pause, Download, Disc3 } from "lucide-react";
import { useI18n } from "@/supdance/plugins/i18n";
import { useMusicStore } from "../stores/use-music-store";
import { recoverGenerationTaskMedia } from "@/services/api/task-center";
import { downloadMusicOutput } from "../services/music-site-api";
import type { MusicTask } from "../services/music-api";

export function TaskCard({ task, onDetails }: { task: MusicTask; onDetails?: () => void }) {
    const { t } = useI18n();
    const playing = useMusicStore((s) => s.playingTaskId);
    const isPlaying = useMusicStore((s) => s.isPlaying);
    const toggle = useMusicStore((s) => s.togglePlayback);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const title = task.title || t("music.default_track_title");
    return (
        <article className="music-work-card">
            <div className="music-work-heading">
                <Disc3 aria-hidden size={28} />
                <button
                    type="button"
                    className="music-work-title"
                    onClick={() => {
                        useMusicStore.getState().setActiveTrack(task);
                        onDetails?.();
                    }}
                >
                    <strong translate="no" data-i18n-ignore="true">
                        {title}
                    </strong>
                    <span translate="no" data-i18n-ignore="true">
                        {task.model} · {new Date(task.createdAt).toLocaleString()}
                    </span>
                </button>
                <span className="music-state">{t("music.status_" + task.status, undefined, task.status)}</span>
            </div>
            {task.status !== "completed" && task.status !== "failed" && task.status !== "cancelled" && (
                <p role="status">
                    {t("music.stage_label", undefined, "Current stage")}: {t("music.status_" + task.status, undefined, task.status)}
                </p>
            )}
            {task.errorMessage && <p className="text-destructive">{task.errorMessage}</p>}
            {task.outputs?.map((output, index) => (
                <div className="music-output-row" key={output.id}>
                    <button type="button" disabled={!output.audioUrl} onClick={() => output.audioUrl && toggle(output.id, output.audioUrl)} aria-label={t(playing === output.id && isPlaying ? "music.player_pause" : "music.player_play")}>
                        {playing === output.id && isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <span>{t("music.track_number", { number: index + 1 }, "Track {number}")}</span>
                    <span>{output.durationMs ? (output.durationMs / 1000).toFixed(1) + "s" : "—"}</span>
                    <button
                        type="button"
                        disabled={!output.storageKey && !output.audioUrl}
                        onClick={async () => {
                            try {
                                await downloadMusicOutput(output, title + "-" + (index + 1));
                            } catch (cause) {
                                setError(cause instanceof Error ? cause.message : String(cause));
                            }
                        }}
                        aria-label={t("music.original_download")}
                    >
                        <Download size={18} />
                    </button>
                </div>
            ))}
            {task.canRecoverMedia && (
                <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                        setSaving(true);
                        setError("");
                        try {
                            await recoverGenerationTaskMedia(task.taskId);
                            await useMusicStore.getState().loadTasks();
                        } catch (cause) {
                            setError(cause instanceof Error ? cause.message : String(cause));
                        } finally {
                            setSaving(false);
                        }
                    }}
                >
                    {t("music.retry_archive", undefined, "Retry saving audio")}
                </button>
            )}
            <div className="music-work-meta">
                <span>{task.upstreamTaskId || task.taskId}</span>
                <span>
                    {task.billingStatus ? t("music.billing_" + task.billingStatus, undefined, task.billingStatus) : "—"}
                    {task.microcreditsCost !== undefined ? " · " + (task.microcreditsCost / 1_000_000).toLocaleString() : ""}
                </span>
            </div>
            {error && (
                <p role="alert" className="text-destructive">
                    {error}
                </p>
            )}
        </article>
    );
}
