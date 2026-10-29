import React, { useState } from "react";
import { Sparkles, Coins, AlertCircle } from "lucide-react";
import { useI18n } from "@/supdance/plugins/i18n";
import { STATIC_MODEL_CAPABILITIES, useMusicStore } from "../stores/use-music-store";
import { LyricsEditor } from "./lyrics-editor";

interface MusicFormProps {
    userId: string;
    onSubmitted?: (taskId: string) => void;
}

export function MusicForm({ userId, onSubmitted }: MusicFormProps) {
    const { t } = useI18n();
    const [submitError, setSubmitError] = useState<string | null>(null);

    const {
        draft,
        capabilities,
        loadingCaps,
        submitting,
        setDraftField,
        setModel,
        submitGeneration,
    } = useMusicStore();

    const selectedModelCap =
        capabilities.find((c) => c.id === draft.model) ||
        STATIC_MODEL_CAPABILITIES.find((c) => c.id === draft.model) ||
        STATIC_MODEL_CAPABILITIES[1];

    const isCustomMode = draft.mode === "custom";
    const estimatedCost = draft.duration * (selectedModelCap.costPerSecondMicrocredits || 60);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);
        if (!draft.prompt.trim() || submitting) return;

        try {
            const res = await submitGeneration(userId);
            if (res && res.taskId && onSubmitted) {
                onSubmitted(res.taskId);
            }
        } catch (err: any) {
            setSubmitError(err.message || "提交音乐生成任务失败");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="plugin-music-form flex flex-col gap-6">
            {submitError && (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{submitError}</span>
                </div>
            )}

            {/* Model Selection Cards */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                    <span>{t("music.select_model", undefined, "选择生成模型")}</span>
                    {loadingCaps && <span className="text-xs text-muted-foreground">正在同步模型状态...</span>}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {capabilities.map((model) => {
                        const isSelected = draft.model === model.id;
                        return (
                            <button
                                key={model.id}
                                type="button"
                                disabled={!model.available}
                                onClick={() => setModel(model.id, userId)}
                                className={`relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                                    isSelected
                                        ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                                        : "border-border/60 bg-card hover:border-border hover:bg-muted/30"
                                } ${!model.available ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="font-semibold text-sm text-foreground">{model.name}</span>
                                        {!model.available && (
                                            <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                                                维护中
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                        {model.id === "mureka-9.5" && "高表现力旋律与男女声乐控制，支持无损 FLAC"}
                                        {model.id === "suno-v6" && "强大的流行曲风与歌曲续写，丰富的结构标签"}
                                        {model.id === "lyria-3.5" && "精准的 BPM 节奏与调性控制，SynthID 水印保护"}
                                        {model.id === "music_v2_5" && "专业级人声高保真创作，支持人声/伴奏多音轨分离"}
                                    </p>
                                </div>
                                <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground">
                                    <span>{model.costPerSecondMicrocredits} 积分/秒</span>
                                    <span>最高 {model.maxDuration}s</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Mode Switcher (Simple vs Custom) */}
            <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-1 self-start">
                <button
                    type="button"
                    disabled={!selectedModelCap.modes.includes("simple")}
                    onClick={() => setDraftField("mode", "simple", userId)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                        draft.mode === "simple"
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground disabled:opacity-40"
                    }`}
                >
                    {t("music.mode_simple", undefined, "简单模式")}
                </button>
                <button
                    type="button"
                    disabled={!selectedModelCap.modes.includes("custom")}
                    onClick={() => setDraftField("mode", "custom", userId)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                        draft.mode === "custom"
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground disabled:opacity-40"
                    }`}
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
                            <label className="text-xs font-medium text-foreground">
                                {t("music.song_title", undefined, "歌曲标题")}
                            </label>
                            <input
                                type="text"
                                value={draft.title}
                                onChange={(e) => setDraftField("title", e.target.value, userId)}
                                placeholder="输入歌曲标题..."
                                className="w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-hidden"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-foreground">
                                {t("music.tags_label", undefined, "风格标签")}
                            </label>
                            <input
                                type="text"
                                value={draft.tags}
                                onChange={(e) => setDraftField("tags", e.target.value, userId)}
                                placeholder="Pop, Synthwave, Energetic, Female Vocals"
                                className="w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-hidden"
                            />
                        </div>
                    </div>

                    {/* Instrumental Toggle */}
                    <div className="flex items-center justify-between border-t border-border/40 pt-3">
                        <div>
                            <span className="text-sm font-medium text-foreground">
                                {t("music.instrumental_only", undefined, "纯纯伴奏 (无歌词人声)")}
                            </span>
                            <p className="text-xs text-muted-foreground">仅生成背景器乐伴奏，忽略歌词</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={draft.instrumental}
                            onChange={(e) => setDraftField("instrumental", e.target.checked, userId)}
                            className="size-5 rounded-sm accent-primary cursor-pointer"
                        />
                    </div>

                    {/* Lyrics Editor (Hidden when instrumental) */}
                    {!draft.instrumental && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-foreground">
                                {t("music.lyrics_editor", undefined, "专业歌词编辑器")}
                            </label>
                            <LyricsEditor
                                value={draft.lyrics}
                                onChange={(val) => setDraftField("lyrics", val, userId)}
                                maxChars={selectedModelCap.maxLyricsChars}
                            />
                        </div>
                    )}

                    {/* Model-Specific Controls */}
                    {draft.model === "lyria-3.5" && selectedModelCap.tempoBpmRange && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/40 pt-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-foreground">
                                    节奏速度: {draft.tempoBpm} BPM
                                </label>
                                <input
                                    type="range"
                                    min={selectedModelCap.tempoBpmRange[0]}
                                    max={selectedModelCap.tempoBpmRange[1]}
                                    value={draft.tempoBpm}
                                    onChange={(e) => setDraftField("tempoBpm", parseInt(e.target.value, 10), userId)}
                                    className="cursor-pointer accent-primary"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-foreground">调性选择</label>
                                <select
                                    value={draft.keySignature}
                                    onChange={(e) => setDraftField("keySignature", e.target.value, userId)}
                                    className="rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-foreground"
                                >
                                    {(selectedModelCap.keySignatures || ["C"]).map((key) => (
                                        <option key={key} value={key}>{key}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {draft.model === "mureka-9.5" && selectedModelCap.vocalGenders && (
                        <div className="flex flex-col gap-1.5 border-t border-border/40 pt-3">
                            <label className="text-xs font-medium text-foreground">人声音色倾向</label>
                            <div className="flex items-center gap-3">
                                {selectedModelCap.vocalGenders.map((gender) => (
                                    <label key={gender} className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                                        <input
                                            type="radio"
                                            name="vocalGender"
                                            value={gender}
                                            checked={draft.vocalGender === gender}
                                            onChange={() => setDraftField("vocalGender", gender, userId)}
                                            className="accent-primary"
                                        />
                                        <span>{gender === "male" ? "男声" : gender === "female" ? "女声" : "自动识别"}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {draft.model === "music_v2_5" && selectedModelCap.stemSeparation && (
                        <div className="flex flex-col gap-1.5 border-t border-border/40 pt-3">
                            <label className="text-xs font-medium text-foreground">多音轨分轨导出 (Stems)</label>
                            <div className="flex flex-wrap items-center gap-4">
                                {(selectedModelCap.supportedStems || ["vocals", "drums", "bass", "other"]).map((stem) => {
                                    const checked = draft.stems.includes(stem);
                                    return (
                                        <label key={stem} className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => {
                                                    const next = e.target.checked
                                                        ? [...draft.stems, stem]
                                                        : draft.stems.filter((s) => s !== stem);
                                                    setDraftField("stems", next, userId);
                                                }}
                                                className="accent-primary"
                                            />
                                            <span className="capitalize">{stem}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
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
                        step={5}
                        value={draft.duration}
                        onChange={(e) => setDraftField("duration", parseInt(e.target.value, 10), userId)}
                        className="cursor-pointer accent-primary"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">
                        {t("music.output_format", undefined, "输出音频格式")}
                    </label>
                    <div className="flex items-center gap-2">
                        {selectedModelCap.formats.map((fmt) => (
                            <button
                                key={fmt}
                                type="button"
                                onClick={() => setDraftField("format", fmt, userId)}
                                className={`rounded-md border px-3 py-1.5 text-xs font-medium uppercase transition-all ${
                                    draft.format === fmt
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border/60 bg-card text-muted-foreground hover:bg-muted"
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
                    <span className="font-semibold text-foreground">{estimatedCost}</span>
                    <span className="text-xs text-muted-foreground/70">
                        {t("music.settle_tip", undefined, "(实际结算以最终音频秒数精确计费)")}
                    </span>
                </div>

                <button
                    type="submit"
                    disabled={submitting || !draft.prompt.trim() || !selectedModelCap.available}
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
