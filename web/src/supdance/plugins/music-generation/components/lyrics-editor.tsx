import React, { useRef, useState } from "react";
import { Tag, Trash2 } from "lucide-react";
import { useI18n } from "@/supdance/plugins/i18n";

interface LyricsEditorProps {
    value: string;
    onChange: (lyrics: string) => void;
    maxChars: number;
    disabled?: boolean;
}

const SECTION_TAGS = [
    { label: "[Verse 1]", tag: "[Verse 1]\n" },
    { label: "[Chorus]", tag: "[Chorus]\n" },
    { label: "[Verse 2]", tag: "[Verse 2]\n" },
    { label: "[Bridge]", tag: "[Bridge]\n" },
    { label: "[Outro]", tag: "[Outro]\n" },
    { label: "[Instrumental]", tag: "[Instrumental]\n" },
];

export function LyricsEditor({ value, onChange, maxChars, disabled }: LyricsEditorProps) {
    const { t } = useI18n();
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [confirmingClear, setConfirmingClear] = useState(false);

    const handleInsertTag = (tag: string) => {
        if (!textareaRef.current || disabled) return;
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const current = value;

        const nextValue = current.substring(0, start) + tag + current.substring(end);
        onChange(nextValue);

        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + tag.length;
        }, 10);
    };

    const handleClear = () => {
        if (disabled || !value) return;
        if (!confirmingClear) {
            setConfirmingClear(true);
            setTimeout(() => setConfirmingClear(false), 3000);
            return;
        }
        onChange("");
        setConfirmingClear(false);
    };

    const charCount = value.length;
    const isExceeded = charCount > maxChars;

    return (
        <div className="plugin-lyrics-editor flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground mr-1">
                        <Tag className="size-3.5" />
                        <span>{t("music.structure_tags", undefined, "结构标签:")}</span>
                    </span>
                    {SECTION_TAGS.map(({ label, tag }) => (
                        <button
                            key={label}
                            type="button"
                            disabled={disabled}
                            onClick={() => handleInsertTag(tag)}
                            className="rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-xs text-foreground/80 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    disabled={disabled || !value}
                    onClick={handleClear}
                    className={`flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs transition-colors disabled:opacity-40 ${
                        confirmingClear
                            ? "bg-destructive/15 text-destructive font-medium"
                            : "text-muted-foreground hover:text-destructive"
                    }`}
                    title={confirmingClear ? "再次点击确认清空" : t("music.lyrics_clear", undefined, "清空歌词")}
                >
                    <Trash2 className="size-3.5" />
                    <span>{confirmingClear ? "确认清空?" : t("music.lyrics_clear", undefined, "清空")}</span>
                </button>
            </div>

            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder="在此输入自定义歌词或使用上方结构标签进行段落规划...&#10;例如：&#10;[Verse 1]&#10;夜幕降临，霓虹初上&#10;[Chorus]&#10;让我们随音乐起舞"
                rows={7}
                className="w-full resize-y rounded-lg bg-transparent p-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden"
            />

            <div className="flex items-center justify-end border-t border-border/40 pt-2 text-xs">
                <span className={isExceeded ? "font-bold text-destructive" : "text-muted-foreground"}>
                    {charCount} / {maxChars} 字
                </span>
            </div>
        </div>
    );
}
