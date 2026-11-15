import { useEffect, useRef, useState } from "react";
import { ChevronDown, ListMusic, Trash2, WandSparkles } from "lucide-react";
import { Button } from "antd";
import { Select } from "@/components/ui/base/select";
import { useI18n } from "@/supdance/plugins/i18n";
import { insertLyricSection, lyricSections, songOutline } from "./composer-patterns";
import { insertLyricSkeleton, lyricAIActions, lyricTopics, songSkeletons, validateLyricStructure, buildTopicStarter, type LyricAIActionId, type LyricTopicId } from "./lyrics-tools";

/** AI 动作请求：由工作台 / 创作岛注入 service，组件本身不碰网络。 */
export type LyricAIRequest = {
    action: LyricAIActionId;
    topic?: string;
    lyrics: string;
    selection: string;
    language?: string;
    signal?: AbortSignal;
};

export type LyricsIslandProps = {
    value: string;
    onChange: (lyrics: string) => void;
    maxChars: number;
    disabled?: boolean;
    /** 是否显示图 2 的居中大标题与副标题（工作台内嵌时也可显示）。 */
    showHeading?: boolean;
    /** 纯伴奏开启时提示歌词不会用于生成。 */
    instrumental?: boolean;
    /** 演唱语言，透传给 AI service。 */
    language?: string;
    /** 传入即启用 AI 动作条；返回生成的文本，由组件决定插入/替换位置。 */
    onAIAction?: (request: LyricAIRequest) => Promise<string>;
    /** 图 2 Continue 的语义回调：不传时按钮不渲染（工作台由底部 Create 负责提交）。 */
    onContinue?: () => void;
    className?: string;
};

/**
 * 图 2 歌词输入岛：居中衬线标题 + 半透明玻璃卡片 + 话题 pill + 段落标签 +
 * 整曲骨架 + AI 动作条 + 结构校验 + 橙粉渐变 Continue。
 * 工作台 lyrics 模式与 /create 创作岛弹窗共用同一个实现，避免两套歌词交互。
 */
export function LyricsIsland({ value, onChange, maxChars, disabled, showHeading = true, instrumental, language, onAIAction, onContinue, className = "" }: LyricsIslandProps) {
    const { t } = useI18n();
    const textarea = useRef<HTMLTextAreaElement>(null);
    const [confirmingClear, setConfirmingClear] = useState(false);
    const [limitHit, setLimitHit] = useState(false);
    const [aiRunning, setAiRunning] = useState<LyricAIActionId | null>(null);
    const [aiError, setAiError] = useState("");
    const [aiTopic, setAiTopic] = useState("");
    const [pendingAI, setPendingAI] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const structure = validateLyricStructure(value, maxChars);

    useEffect(() => {
        if (!confirmingClear) return;
        const timer = setTimeout(() => setConfirmingClear(false), 3000);
        return () => clearTimeout(timer);
    }, [confirmingClear]);

    useEffect(() => () => abortRef.current?.abort(), []);

    function applyInsert(next: { lyrics: string; caret: number } | null) {
        setLimitHit(!next);
        if (!next) return;
        onChange(next.lyrics);
        const field = textarea.current;
        requestAnimationFrame(() => {
            if (field?.isConnected) {
                field.focus();
                field.setSelectionRange(next.caret, next.caret);
            }
        });
    }

    function insert(text: string) {
        const field = textarea.current;
        if (!field || disabled) return;
        applyInsert(insertLyricSection(value, field.selectionStart, field.selectionEnd, text, maxChars));
    }

    function insertOutline(outline: string) {
        const field = textarea.current;
        if (!field || disabled) return;
        applyInsert(insertLyricSkeleton(value, field.selectionStart, field.selectionEnd, outline, maxChars));
    }

    async function runAI(action: LyricAIActionId, topic = "") {
        if (!onAIAction || disabled || aiRunning) return;
        const field = textarea.current;
        const selection = field ? value.slice(field.selectionStart, field.selectionEnd) : "";
        const meta = lyricAIActions.find((item) => item.id === action);
        if (meta?.needsSelection && !selection.trim()) {
            setAiError(t("music.lyric_ai_need_selection"));
            return;
        }
        setAiError("");
        setPendingAI(null);
        setAiRunning(action);
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const text = (await onAIAction({ action, topic, lyrics: value, selection, language, signal: controller.signal })).trim();
            if (!text) throw new Error(t("music.lyric_ai_failed"));
            // 选中行的动作替换选中范围；生成/无选中则作为独立段落插到光标处。
            if (selection.trim() && meta?.needsSelection && field) {
                const updated = value.slice(0, field.selectionStart) + text + value.slice(field.selectionEnd);
                if (Array.from(updated).length > maxChars) setLimitHit(true);
                else {
                    onChange(updated);
                    setPendingAI(t("music.lyric_ai_replaced"));
                }
            } else {
                insert(text);
                setPendingAI(t("music.lyric_ai_inserted"));
            }
        } catch (cause) {
            if (controller.signal.aborted) return;
            setAiError(cause instanceof Error ? cause.message : t("music.lyric_ai_failed"));
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
            setAiRunning(null);
        }
    }

    const issueText = instrumental ? t("music.lyric_check_instrumental") : structure.issues.includes("unknown_section") ? t("music.lyric_check_unknown_section") : structure.issues.includes("missing_chorus") ? t("music.lyric_check_missing_chorus") : "";

    return (
        <section className={`music-lyrics-island ${className}`} aria-label={t("music.lyric_island_label")}>
            {showHeading && (
                <header className="music-lyrics-island-intro">
                    <h2>{t("music.lyric_island_title")}</h2>
                    <p>{t("music.lyric_island_hint")}</p>
                </header>
            )}
            <div className="music-lyrics-card">
                <div className="music-lyrics-card-head">
                    <span className="music-lyrics-card-label">
                        <ChevronDown size={14} aria-hidden />
                        {t("music.lyric_island_label")}
                    </span>
                    {onAIAction && (
                        <button type="button" className="music-lyrics-magic" aria-label={t("music.lyric_ai")} title={t("music.lyric_ai")} disabled={disabled || !!aiRunning} onClick={() => void runAI("generate", aiTopic || lyricTopics[0].seed)}>
                            <WandSparkles size={16} />
                        </button>
                    )}
                </div>
                <textarea
                    id="music-lyrics"
                    ref={textarea}
                    rows={6}
                    value={value}
                    disabled={disabled}
                    aria-invalid={structure.charCount > maxChars}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setConfirmingClear(false);
                        setLimitHit(false);
                        setAiError("");
                        setPendingAI(null);
                    }}
                    placeholder={t("music.lyric_island_placeholder")}
                />
                <div className="music-lyrics-topics" role="group" aria-label={t("music.lyric_ai")}>
                    {lyricTopics.map((topic) => (
                        <button
                            key={topic.id}
                            type="button"
                            disabled={disabled || !!aiRunning}
                            title={onAIAction ? undefined : t("music.lyric_island_hint")}
                            onClick={() => {
                                // 无 AI 时话题退化为本地起手稿（越过空白页）；有 AI 时直接生成。
                                if (onAIAction) void runAI("generate", topic.seed);
                                else {
                                    insert(buildTopicStarter(topic.id));
                                    setPendingAI(t("music.lyric_ai_inserted"));
                                }
                            }}
                        >
                            {t(topic.labelKey)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="music-lyrics-tools" role="group" aria-label={t("music.lyric_sections")}>
                <Select
                    ariaLabel={t("music.lyric_structure")}
                    placeholder={t("music.lyric_structure")}
                    value={null}
                    disabled={disabled}
                    onChange={(key) => insert("[" + key + "]\n")}
                    options={lyricSections.map((key) => ({ value: key, label: "[" + key + "]" }))}
                />
                <Select
                    ariaLabel={t("music.lyric_outline")}
                    placeholder={t("music.lyric_skeletons")}
                    value={null}
                    disabled={disabled}
                    onChange={(key) => insertOutline(songSkeletons.find((item) => item.id === key)?.outline || songOutline)}
                    options={songSkeletons.map((item) => ({ value: item.id, label: t(item.labelKey) }))}
                />
                <Button htmlType="button" disabled={disabled} icon={<ListMusic size={15} />} onClick={() => insertOutline(songOutline)}>
                    {t("music.lyric_outline")}
                </Button>
                <Button
                    htmlType="button"
                    type="text"
                    disabled={disabled || !value}
                    danger={confirmingClear}
                    aria-label={t(confirmingClear ? "music.confirm_clear" : "music.lyric_clear")}
                    title={t(confirmingClear ? "music.confirm_clear" : "music.lyric_clear")}
                    icon={<Trash2 size={15} />}
                    onClick={() => {
                        if (confirmingClear) {
                            onChange("");
                            setConfirmingClear(false);
                        } else setConfirmingClear(true);
                    }}
                >
                    {confirmingClear && t("music.confirm_clear")}
                </Button>
            </div>

            {onAIAction && (
                <div className="music-lyrics-ai">
                    <div className="music-lyrics-ai-row">
                        <input
                            type="text"
                            value={aiTopic}
                            disabled={disabled || !!aiRunning}
                            aria-label={t("music.lyric_ai_generate")}
                            placeholder={t("music.lyric_ai_topic_placeholder")}
                            onChange={(event) => setAiTopic(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    void runAI("generate", aiTopic.trim());
                                }
                            }}
                        />
                        <Button htmlType="button" loading={aiRunning === "generate"} disabled={disabled || !!aiRunning} icon={<WandSparkles size={15} />} onClick={() => void runAI("generate", aiTopic.trim())}>
                            {t("music.lyric_ai_generate")}
                        </Button>
                    </div>
                    <div className="music-lyrics-ai-actions" role="group" aria-label={t("music.lyric_ai")}>
                        {lyricAIActions
                            .filter((action) => action.needsSelection)
                            .map((action) => (
                                <Button key={action.id} htmlType="button" loading={aiRunning === action.id} disabled={disabled || !!aiRunning} onClick={() => void runAI(action.id)}>
                                    {t(action.labelKey)}
                                </Button>
                            ))}
                        {aiRunning && (
                            <Button htmlType="button" type="text" onClick={() => abortRef.current?.abort()}>
                                {t("common.cancel")}
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {pendingAI && !aiRunning && (
                <p role="status" className="music-lyrics-ai-result">
                    {pendingAI}
                </p>
            )}
            {aiError && (
                <p role="alert" className="text-xs text-destructive">
                    {aiError}
                </p>
            )}
            {(limitHit || structure.issues.includes("too_long")) && (
                <p role="alert" className="text-xs text-destructive">
                    {t("music.limit_hint")}
                </p>
            )}
            {issueText && (
                <p role="status" className="music-lyrics-check">
                    {issueText}
                </p>
            )}
            <p className="music-lyrics-count">
                {structure.charCount} / {maxChars}
            </p>
            {onContinue && (
                <button type="button" className="music-lyrics-continue" disabled={disabled || !value.trim()} onClick={onContinue}>
                    {t("music.lyric_island_continue")}
                </button>
            )}
        </section>
    );
}

/** 兼容旧调用面：music-form.tsx 仍 import { LyricsEditor }。 */
export function LyricsEditor({
    value,
    onChange,
    maxChars,
    disabled,
    instrumental,
    language,
    onAIAction,
}: {
    value: string;
    onChange: (lyrics: string) => void;
    maxChars: number;
    disabled?: boolean;
    instrumental?: boolean;
    language?: string;
    onAIAction?: (request: LyricAIRequest) => Promise<string>;
}) {
    return <LyricsIsland value={value} onChange={onChange} maxChars={maxChars} disabled={disabled} instrumental={instrumental} language={language} onAIAction={onAIAction} />;
}
