import { useState } from "react";
import { useI18n } from "@/supdance/plugins/i18n";
import type { MusicOutput, MusicTask } from "../services/music-api";
import { canLocateMusicAsset } from "../services/music-assets";
import { downloadMusicOutput } from "../services/music-site-api";
import { useMusicStore } from "../stores/use-music-store";

export function MusicTaskDetails({ task, onReuse, onTrim, onAsset, selectedOutputId }: { task: MusicTask; selectedOutputId?: string; onReuse?: () => void; onTrim?: (output: MusicOutput) => void; onAsset?: (output: MusicOutput) => Promise<void> }) {
    const { t } = useI18n();
    const [downloadFailed, setDownloadFailed] = useState(false);
    const [assetError, setAssetError] = useState("");
    const playingId = useMusicStore((state) => state.playingTaskId);
    const playing = useMusicStore((state) => state.isPlaying);
    const toggle = useMusicStore((state) => state.togglePlayback);
    return (
        <div className="music-detail" translate="no" data-i18n-ignore="true">
            <p>
                {task.model} · {new Date(task.createdAt).toLocaleString()}
            </p>
            <p>
                {t("music.status_" + task.status)} · {task.mediaStage ? t("music.media_" + task.mediaStage, undefined, task.mediaStage) : "—"} · {task.billingStatus ? t("music.billing_" + task.billingStatus, undefined, task.billingStatus) : "—"}
            </p>
            <p>
                {t("music.task_id")}: {task.taskId}
            </p>
            {task.upstreamTaskId && (
                <p>
                    {t("music.upstream_id")}: {task.upstreamTaskId}
                </p>
            )}
            <pre>{task.lyrics || task.prompt}</pre>
            {task.tags && <p>{task.tags}</p>}
            {task.songLanguage && (
                <p>
                    {t("music.song_language")}: {task.songLanguage}
                </p>
            )}
            {task.instrumental && <p>{t("music.instrumental_label")}</p>}
            {task.outputs
                ?.filter((output) => !selectedOutputId || selectedOutputId === output.id)
                .map((output) => (
                    <section key={output.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                        <p>
                            {t("music.track_number", { number: output.outputIndex + 1 })} · {output.format || output.mimeType || "—"} · {output.durationMs ? (output.durationMs / 1000).toFixed(1) + "s" : "—"} ·{" "}
                            {output.bytes ? (output.bytes / 1024 / 1024).toFixed(2) + " MB" : "—"}
                        </p>
                        {output.audioUrl && (
                            <div className="flex flex-wrap gap-2">
                                <button type="button" className="min-h-11 rounded-lg border border-border px-4" onClick={() => toggle(output.id, output.audioUrl!)}>
                                    {t(playing && playingId === output.id ? "music.player_pause" : "music.player_play")}
                                </button>
                                <button
                                    type="button"
                                    className="min-h-11 rounded-lg border border-border px-4"
                                    onClick={async () => {
                                        setDownloadFailed(false);
                                        try {
                                            await downloadMusicOutput(output, task.title || t("music.default_track_title"));
                                        } catch {
                                            setDownloadFailed(true);
                                        }
                                    }}
                                >
                                    {t("music.original_download")}
                                </button>
                            </div>
                        )}
                        {onTrim && task.status === "completed" && (output.audioUrl || output.storageKey) && (
                            <button type="button" onClick={() => onTrim(output)}>
                                {t("music.trim_track")}
                            </button>
                        )}
                        {onAsset && task.status === "completed" && canLocateMusicAsset(output) && (
                            <button
                                type="button"
                                onClick={async () => {
                                    setAssetError("");
                                    try {
                                        await onAsset(output);
                                    } catch (cause) {
                                        setAssetError(cause instanceof Error ? cause.message : t("music.asset_unavailable"));
                                    }
                                }}
                            >
                                {t("music.manage_in_assets")}
                            </button>
                        )}
                    </section>
                ))}
            {assetError && <p role="alert">{assetError}</p>}
            {downloadFailed && (
                <p role="alert" className="text-destructive">
                    {t("music.download_failed")}
                </p>
            )}
            {onReuse && (
                <button type="button" className="min-h-11 rounded-lg border border-border px-4" onClick={onReuse}>
                    {t("music.reuse_settings")}
                </button>
            )}
        </div>
    );
}
