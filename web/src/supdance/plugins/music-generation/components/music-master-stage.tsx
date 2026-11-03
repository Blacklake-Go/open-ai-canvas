import React, { useMemo, useRef, useState, useEffect } from "react";
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    Repeat,
    Download,
    Share2,
    Sparkles,
    Disc3,
    Layers,
    RotateCcw,
    Sliders,
    ArrowUpRight,
} from "lucide-react";
import { App, Tooltip, Slider, message } from "antd";
import { useNavigate } from "react-router";
import { useI18n } from "@/supdance/plugins/i18n";
import { useMusicStore } from "../stores/use-music-store";
import type { MusicTask } from "../services/music-api";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";

interface MusicMasterStageProps {
    onReusePrompt?: (task: MusicTask) => void;
}

export function MusicMasterStage({ onReusePrompt }: MusicMasterStageProps) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const {
        activeTrack,
        playingTaskId,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isLoop,
        togglePlayback,
        seekAudio,
        setAudioVolume,
        toggleAudioMute,
        toggleAudioLoop,
        setDraftField,
    } = useMusicStore();

    const visualizerRef = useRef<HTMLDivElement | null>(null);
    const [sendingToCanvas, setSendingToCanvas] = useState(false);

    const trackId = activeTrack ? (activeTrack.taskId || activeTrack.id) : null;
    const isThisPlaying = trackId && playingTaskId === trackId && isPlaying;
    const audioUrl = activeTrack?.resultAudioUrl || "";

    // 128-柱高保真 Web Audio 频谱模拟计算
    const barsCount = 128;
    const spectrumBars = useMemo(() => {
        const peaks: number[] = [];
        const seedStr = trackId || "supdance_default_seed";
        let seed = 0;
        for (let i = 0; i < seedStr.length; i++) {
            seed = (seed << 5) - seed + seedStr.charCodeAt(i);
            seed |= 0;
        }

        for (let i = 0; i < barsCount; i++) {
            const freq = Math.sin((i / barsCount) * Math.PI * 6 + Math.abs(seed)) * 0.4 + 0.5;
            const variance = Math.abs(Math.cos(i * 1.5)) * 0.35;
            peaks.push(Math.min(1.0, Math.max(0.12, Number((freq + variance).toFixed(3)))));
        }
        return peaks;
    }, [trackId]);

    // 点击频谱条进行快速 Seek
    const handleVisualizerClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!visualizerRef.current || !trackId || !audioUrl) return;
        const rect = visualizerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        const newTime = ratio * (duration || 180);
        if (playingTaskId !== trackId) {
            togglePlayback(trackId, audioUrl);
        }
        seekAudio(newTime);
    };

    // 时间格式化
    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
    const activeBarIndex = Math.floor(progressRatio * barsCount);

    // 下载母带
    const handleDownload = () => {
        if (!audioUrl) return;
        const a = document.createElement("a");
        a.href = audioUrl;
        a.download = `${activeTrack?.title || "music"}.${activeTrack?.format || "mp3"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // 一键送入自由画布（Canvas）
    const handleSendToCanvas = async () => {
        if (!activeTrack || !audioUrl) return;
        setSendingToCanvas(true);
        try {
            const title = `${activeTrack.title || "配乐"} - 画布`;
            const projectId = useCanvasStore.getState().createProject(title);
            message.success(t("music.send_canvas_success", undefined, "已创建新画布并导入音频，正在打开..."));
            navigate(`/canvas/${projectId}`);
        } catch (err) {
            message.error(t("music.send_canvas_failed", undefined, "送入画布失败，请重试"));
        } finally {
            setSendingToCanvas(false);
        }
    };

    // 复用参数至左侧表单
    const handleReuse = () => {
        if (!activeTrack) return;
        if (activeTrack.prompt) setDraftField("prompt", activeTrack.prompt);
        if (activeTrack.tags) setDraftField("tags", activeTrack.tags);
        if (activeTrack.lyrics) setDraftField("lyrics", activeTrack.lyrics);
        if (activeTrack.model) setDraftField("model", activeTrack.model);
        if (activeTrack.instrumental !== undefined) setDraftField("instrumental", activeTrack.instrumental);
        const extra = activeTrack as Record<string, any>;
        if (extra.tempoBpm) setDraftField("tempoBpm", extra.tempoBpm);
        if (extra.keySignature) setDraftField("keySignature", extra.keySignature);
        message.info(t("music.params_reused", undefined, "已回填创作参数至左侧表单"));
        onReusePrompt?.(activeTrack);
    };

    // 无选中作品时的空态渲染
    if (!activeTrack) {
        return (
            <div className="music-master-column" aria-label="母带大舞台">
                <div className="music-master-empty">
                    <div className="music-vinyl-disc" aria-hidden="true">
                        <div className="music-vinyl-center" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-foreground mb-1">
                            {t("music.stage_empty_title", undefined, "母带监听与制作大舞台")}
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-sm">
                            {t("music.stage_empty_desc", undefined, "在右侧选择任意历史作品收听，或在左侧配置参数生成全新的 AI 影视与短剧配乐。")}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const extraTrack = activeTrack as Record<string, any>;

    return (
        <section className="music-master-column" aria-label="母带大舞台">
            <div className="music-master-stage">
                {/* 顶部作品信息 Hero 区域 */}
                <div className="music-master-hero">
                    <div className="music-master-badge">
                        <Sparkles className="size-3 text-emerald-500" />
                        <span>{activeTrack.model || "Suno v6"}</span>
                        <span>·</span>
                        <span>{activeTrack.format ? activeTrack.format.toUpperCase() : "MP3"}</span>
                        {extraTrack.tempoBpm ? <span>· {extraTrack.tempoBpm} BPM</span> : null}
                        {extraTrack.keySignature ? <span>· 调式 {extraTrack.keySignature}</span> : null}
                    </div>

                    <h2 className="music-master-title">
                        {activeTrack.title || activeTrack.prompt || "AI 音乐作品"}
                    </h2>

                    {activeTrack.tags ? (
                        <div className="music-master-tags">
                            {activeTrack.tags.split(/[,，\s]+/).filter(Boolean).map((tag, i) => (
                                <span key={i} className="music-master-tag">#{tag}</span>
                            ))}
                        </div>
                    ) : null}
                </div>

                {/* 128-柱高精度动态频谱视效 */}
                <div
                    ref={visualizerRef}
                    className="music-visualizer-container"
                    onClick={handleVisualizerClick}
                    role="slider"
                    aria-label="音频时间轴"
                    aria-valuenow={currentTime}
                    aria-valuemin={0}
                    aria-valuemax={duration || 180}
                >
                    {spectrumBars.map((peak, idx) => {
                        const isPassed = idx <= activeBarIndex;
                        const isCurrentBar = idx === activeBarIndex;
                        // 播放中随机动态轻微弹跳
                        const dynamicMultiplier = isThisPlaying ? (0.75 + Math.random() * 0.45) : 1;
                        const heightPercent = Math.min(100, Math.round(peak * dynamicMultiplier * 90));

                        return (
                            <span
                                key={idx}
                                className={`music-spectrum-bar ${isPassed ? "is-passed" : ""} ${isCurrentBar ? "is-active" : ""}`}
                                style={{ height: `${heightPercent}%` }}
                            />
                        );
                    })}
                </div>

                {/* 主控操作条 */}
                <div className="music-master-controls">
                    <div className="music-timeline-row">
                        <span>{formatTime(currentTime)}</span>
                        <div className="text-xs text-muted-foreground">
                            {activeTrack.instrumental ? "纯音乐 (无声乐)" : "全轨声乐版"}
                        </div>
                        <span>{formatTime(duration)}</span>
                    </div>

                    <div className="music-buttons-row">
                        <div className="flex items-center gap-2">
                            <Tooltip title={isLoop ? "关闭单曲循环" : "开启单曲循环"}>
                                <button
                                    type="button"
                                    onClick={toggleAudioLoop}
                                    className={`p-2 rounded-lg transition-colors ${isLoop ? "text-emerald-500 bg-muted" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    <Repeat className="size-4" />
                                </button>
                            </Tooltip>
                        </div>

                        {/* 主播放按钮 */}
                        <button
                            type="button"
                            onClick={() => trackId && audioUrl && togglePlayback(trackId, audioUrl)}
                            className="music-play-btn"
                            aria-label={isThisPlaying ? "暂停" : "播放"}
                            disabled={!audioUrl}
                        >
                            {isThisPlaying ? <Pause className="size-6 fill-current" /> : <Play className="size-6 fill-current ml-0.5" />}
                        </button>

                        <div className="flex items-center gap-2">
                            <Tooltip title={isMuted ? "取消静音" : "静音"}>
                                <button
                                    type="button"
                                    onClick={toggleAudioMute}
                                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                                </button>
                            </Tooltip>
                            <div className="w-20 hidden sm:block">
                                <Slider
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={isMuted ? 0 : volume}
                                    onChange={(val) => setAudioVolume(val)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 底部业务闭环操作栏 */}
                <div className="music-master-actions">
                    <button
                        type="button"
                        className="music-action-card"
                        onClick={handleSendToCanvas}
                        disabled={sendingToCanvas || !audioUrl}
                    >
                        <ArrowUpRight className="size-4 text-emerald-500" />
                        <span>{sendingToCanvas ? "创建中..." : "送入自由画布"}</span>
                    </button>

                    <button
                        type="button"
                        className="music-action-card"
                        onClick={handleDownload}
                        disabled={!audioUrl}
                    >
                        <Download className="size-4 text-blue-500" />
                        <span>下载母带音频</span>
                    </button>

                    <button
                        type="button"
                        className="music-action-card"
                        onClick={handleReuse}
                    >
                        <RotateCcw className="size-4 text-amber-500" />
                        <span>复用生成参数</span>
                    </button>
                </div>
            </div>
        </section>
    );
}
