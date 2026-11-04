import React, { useEffect, useState } from "react";
import { Sparkles, Coins, AlertCircle } from "lucide-react";
import { useI18n } from "@/supdance/plugins/i18n";
import { useMusicStore } from "../stores/use-music-store";
import { useEffectiveConfig } from "@/stores/use-config-store";
import { ModelPicker } from "@/components/model-picker";
import type { LogicalModelQuote } from "@/services/api/logical-models";
import { siteMusicQuote } from "../services/music-site-api";
import { LyricsEditor } from "./lyrics-editor";

interface MusicFormProps {
    userId: string;
    onSubmitted?: (taskId: string) => void;
}

export function MusicForm({ userId, onSubmitted }: MusicFormProps) {
    const { t } = useI18n();
    const [submitError, setSubmitError] = useState<string | null>(null);

    const draft = useMusicStore((s) => s.draft);
    const capabilities = useMusicStore((s) => s.capabilities);
    const loadingCaps = useMusicStore((s) => s.loadingCaps);
    const submitting = useMusicStore((s) => s.submitting);
    const setDraftField = useMusicStore((s) => s.setDraftField);
    const setModel = useMusicStore((s) => s.setModel);
    const submitGeneration = useMusicStore((s) => s.submitGeneration);
    const config = useEffectiveConfig();
    const [quote, setQuote] = useState<LogicalModelQuote | null>(null);
    const [quoteError, setQuoteError] = useState("");

    const selectedModelCap = capabilities.find((c) => c.id === draft.model);
    useEffect(() => {
        const controller = new AbortController();
        setQuote(null);
        setQuoteError("");
        if (selectedModelCap?.available) {
            siteMusicQuote(draft.model, draft.duration, controller.signal)
                .then(setQuote)
                .catch((error: unknown) => {
                    if (!controller.signal.aborted) setQuoteError(error instanceof Error ? error.message : String(error));
                });
        }
        return () => controller.abort();
    }, [config, draft.model, draft.duration, selectedModelCap?.available]);

    const isCustomMode = draft.mode === "custom";
    const estimatedCost = quote ? quote.amountMicrocredits / 1_000_000 : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);
        if (!draft.prompt.trim() || submitting || !quote || quoteError) return;

        try {
            const res = await submitGeneration(userId);
            if (res && res.taskId && onSubmitted) {
                onSubmitted(res.taskId);
            }
        } catch (err: any) {
            setSubmitError(err.message || "提交音乐生成任务失败");
        }
    };

    if (!selectedModelCap) return <p role="status">{t(loadingCaps ? "common.loading" : "music.no_models", undefined, loadingCaps ? "加载中…" : "暂无可用音乐模型，请在后台配置音乐渠道。")}</p>;

    return (
        <form onSubmit={handleSubmit} className="plugin-music-form flex flex-col gap-6">
            {(submitError || quoteError) && (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{submitError || quoteError}</span>
                </div>
            )}

            {/* Model Selection Cards */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                    <span>{t("music.select_model", undefined, "选择生成模型")}</span>
                    {loadingCaps && <span className="text-xs text-muted-foreground">正在同步模型状态...</span>}
                </label>
                <ModelPicker config={config} value={draft.model} capability="audio" onChange={(model) => setModel(model, userId)} modelFilter={(model) => capabilities.some((item) => item.id === model)} fullWidth showSelectedPrice showOptionPrices />
            </div>

            {/* Mode Switcher (Simple vs Custom) */}
            <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-1 self-start">
                <button
                    type="button"
                    disabled={!selectedModelCap.modes.includes("simple")}
                    onClick={() => setDraftField("mode", "simple", userId)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${draft.mode === "simple" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground disabled:opacity-40"}`}
                >
                    {t("music.mode_simple", undefined, "简单模式")}
                </button>
                <button
                    type="button"
                    disabled={!selectedModelCap.modes.includes("custom")}
                    onClick={() => setDraftField("mode", "custom", userId)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${draft.mode === "custom" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground disabled:opacity-40"}`}
                >
                    {t("music.mode_custom", undefined, "专业自定义")}
                </button>
            </div>

            {/* Prompt Description */}
            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                    <span>{t("music.prompt_label", undefined, "音乐风格与描述提示词")}</span>
                    <span className="text-xs text-muted-foreground">
                        {draft.prompt.length} / {selectedModelCap.maxPromptChars}
                    </span>
                </label>
                <textarea
                    rows={3}
                    value={draft.prompt}
                    onChange={(e) => setDraftField("prompt", e.target.value, userId)}
                    placeholder="描述你想要的曲风、氛围、节奏或场景，例如：带有梦幻合成器质感的 80 年代复古流行乐，欢快的节奏和明亮的女声..."
                    className="w-full rounded-xl border border-border/60 bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-hidden"
                />
            </div>

            {/* Custom Mode Exclusive Controls */}
            {isCustomMode && (
                <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-foreground">{t("music.song_title", undefined, "歌曲标题")}</label>
                            <input
                                type="text"
                                value={draft.title}
                                onChange={(e) => setDraftField("title", e.target.value, userId)}
                                placeholder="输入歌曲标题..."
                                className="w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-hidden"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-foreground">{t("music.tags_label", undefined, "风格标签")}</label>
                            <input
                                type="text"
                                value={draft.tags}
                                onChange={(e) => setDraftField("tags", e.target.value, userId)}
                                placeholder="Pop, Synthwave, Energetic, Female Vocals"
                                className="w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-hidden"
                            />
                        </div>
                    </div>

                    {/* Lyrics Editor (Hidden when instrumental) */}
                    {(!selectedModelCap.instrumentalSupported || !draft.instrumental) && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-foreground">{t("music.lyrics_editor", undefined, "专业歌词编辑器")}</label>
                            <LyricsEditor value={draft.lyrics} onChange={(val) => setDraftField("lyrics", val, userId)} maxChars={selectedModelCap.maxLyricsChars} />
                        </div>
                    )}
                </div>
            )}
            {selectedModelCap.instrumentalSupported && (
                <div className="flex items-center justify-between border-t border-border/40 pt-3">
                    <span className="text-sm font-medium text-foreground">{t("music.instrumental_only")}</span>
                    <input type="checkbox" aria-label={t("music.instrumental_only")} checked={draft.instrumental} onChange={(e) => setDraftField("instrumental", e.target.checked, userId)} className="size-5 rounded-sm accent-primary cursor-pointer" />
                </div>
            )}
            {/* Target Duration & Output Format */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center justify-between">
                        <span>{t("music.duration_seconds", undefined, "目标音频时长 (秒)")}</span>
                        <span>{draft.duration} 秒</span>
                    </label>
                    <input
                        type="range"
                        min={selectedModelCap.minDuration}
                        max={selectedModelCap.maxDuration}
                        step={1}
                        aria-label={t("music.duration_seconds", undefined, "目标音频时长 (秒)")}
                        value={draft.duration}
                        onChange={(e) => setDraftField("duration", parseInt(e.target.value, 10), userId)}
                        className="cursor-pointer accent-primary"
                    />
                    <p className="text-xs text-muted-foreground">{t("music.target_duration_hint", { seconds: draft.duration })}</p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">{t("music.output_format", undefined, "输出音频格式")}</label>
                    <div className="flex items-center gap-2">
                        {selectedModelCap.formats.map((fmt) => (
                            <button
                                key={fmt}
                                type="button"
                                onClick={() => setDraftField("format", fmt, userId)}
                                className={`rounded-md border px-3 py-1.5 text-xs font-medium uppercase transition-all ${
                                    draft.format === fmt ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-card text-muted-foreground hover:bg-muted"
                                }`}
                            >
                                {fmt}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Estimated Cost and Submit */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Coins className="size-4 text-amber-500" />
                    <span>{t("music.estimated_credits", undefined, "预估消耗积分:")}</span>
                    <span className="font-semibold text-foreground">{estimatedCost === null ? "—" : estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                    <span className="text-xs text-muted-foreground/70">{t("music.site_billing_tip", undefined, "以平台实时报价及最终账单为准")}</span>
                </div>

                <button
                    type="submit"
                    disabled={submitting || !draft.prompt.trim() || !selectedModelCap.available || !quote || Boolean(quoteError)}
                    className="flex min-w-32 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
                >
                    {submitting ? (
                        <>
                            <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                            <span>{t("music.submitting", undefined, "提交中...")}</span>
                        </>
                    ) : (
                        <>
                            <Sparkles className="size-4" />
                            <span>{t("music.generate_btn", undefined, "立即生成音乐")}</span>
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
