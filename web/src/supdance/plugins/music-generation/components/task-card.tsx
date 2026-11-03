import React, { useState } from "react";
import { Download, AlertCircle, Disc3 } from "lucide-react";
import { useI18n } from "@/supdance/plugins/i18n";
import { startBrowserDownload } from "@/services/browser-download";
import { useMusicStore } from "../stores/use-music-store";
import { WaveformPlayer } from "./waveform-player";
import { getAudioDownloadUrl, type AudioFormat, type MusicTask } from "../services/music-api";

interface TaskCardProps {
    task: MusicTask;
}

export function TaskCard({ task }: TaskCardProps) {
    const { t } = useI18n();
    const [downloadingFormat, setDownloadingFormat] = useState<AudioFormat | null>(null);

    const activeTrackId = useMusicStore((state) => state.activeTrackId);
    const setActiveTrack = useMusicStore((state) => state.setActiveTrack);
    const taskId = task.taskId || task.id;
    const isSelected = activeTrackId === taskId;

    const isTerminal = task.status === "completed" || task.status === "failed" || task.status === "cancelled";
    const isCompleted = task.status === "completed" && task.resultAudioUrl;

    const handleDownload = (fmt: AudioFormat) => {
        setDownloadingFormat(fmt);
        const url = getAudioDownloadUrl(task.taskId || task.id, fmt);
        const fileName = `${task.title || task.taskId || "track"}.${fmt}`;
        startBrowserDownload(url, fileName);
        setTimeout(() => setDownloadingFormat(null), 1000);
    };

    return (
        <div
            onClick={() => setActiveTrack(task)}
            className={`plugin-task-card flex flex-col gap-3 rounded-xl border p-4 shadow-xs transition-all cursor-pointer ${
                isSelected
                    ? "border-emerald-500/80 bg-emerald-500/[0.04] shadow-sm ring-1 ring-emerald-500/30"
                    : "border-border/60 bg-card hover:border-border hover:bg-muted/20"
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Disc3 className={`size-4 ${!isTerminal ? "animate-spin" : ""}`} />
                    </span>
                    <div className="min-w-0">
                        <h4 className="truncate font-semibold text-sm text-foreground">
                            {task.title || task.prompt.slice(0, 30) || t("music.default_track_title", undefined, "AI 音乐作品")}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{task.model}</span>
                            <span>·</span>
                            <span>{task.durationTargetSeconds || 180}s</span>
                            <span>·</span>
                            <span>{new Date(task.createdAt).toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>

                {/* Stage Badge (Realistic stage milestone, zero fake percentages) */}
                <div className="shrink-0">
                    {task.status === "submitted" && (
                        <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-500">
                            {t("music.status_submitted", undefined, "正在提交")}
                        </span>
                    )}
                    {task.status === "queued" && (
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500">
                            {t("music.status_queued", undefined, "排队处理中")}
                        </span>
                    )}
                    {task.status === "generating" && (
                        <span className="flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-500">
                            <span className="size-1.5 animate-pulse rounded-full bg-purple-500" />
                            {t("music.status_generating", undefined, "正在生成音轨")}
                        </span>
                    )}
                    {task.status === "transcoding" && (
                        <span className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-500">
                            <span className="size-1.5 animate-pulse rounded-full bg-indigo-500" />
                            {t("music.status_transcoding", undefined, "服务端音频转码")}
                        </span>
                    )}
                    {task.status === "completed" && (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
                            {t("music.status_completed", undefined, "生成完成")}
                        </span>
                    )}
                    {task.status === "failed" && (
                        <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                            <AlertCircle className="size-3" /> {t("music.status_failed", undefined, "生成失败")}
                        </span>
                    )}
                </div>
            </div>

            {/* In-Flight Realistic Stage Animation (No Fake 37%, 78% Percentages) */}
            {!isTerminal && (
                <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>当前阶段: {task.stage || task.status}</span>
                        <span className="animate-pulse">实时合成中...</span>
                    </div>
                    {/* Pulsing Audio Visualizer Animation */}
                    <div className="flex h-6 items-center justify-center gap-1">
                        {[40, 75, 55, 90, 60, 80, 45, 95, 50, 70].map((h, i) => (
                            <div
                                key={i}
                                style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }}
                                className="w-1 animate-pulse rounded-full bg-primary/70"
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Error Message */}
            {task.status === "failed" && task.errorMessage && (
                <div className="rounded-lg bg-destructive/5 p-3 text-xs text-destructive">
                    <p className="font-medium">错误信息：{task.errorMessage}</p>
                    <p className="mt-1 text-muted-foreground">
                        {t("music.refund_tip", undefined, "已为您安全原路退回预留积分。")}
                    </p>
                </div>
            )}

            {/* Completed Result Audio Player & Download Actions */}
            {isCompleted && task.resultAudioUrl && (
                <div className="flex flex-col gap-3">
                    <WaveformPlayer
                        taskId={task.taskId || task.id}
                        audioUrl={task.resultAudioUrl}
                        durationSeconds={task.resultDurationMs ? Math.round(task.resultDurationMs / 1000) : task.durationTargetSeconds}
                        title={task.title}
                    />

                    <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                        <span className="text-muted-foreground">
                            {t("music.lossless_download", undefined, "无损转码下载:")}
                        </span>
                        <div className="flex items-center gap-1.5">
                            {(["mp3", "wav", "flac"] as AudioFormat[]).map((fmt) => (
                                <button
                                    key={fmt}
                                    type="button"
                                    onClick={() => handleDownload(fmt)}
                                    disabled={downloadingFormat === fmt}
                                    className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium uppercase text-foreground hover:bg-muted disabled:opacity-50"
                                >
                                    <Download className="size-3" />
                                    <span>{fmt}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
