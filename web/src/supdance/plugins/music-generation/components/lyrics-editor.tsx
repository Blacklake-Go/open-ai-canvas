import { useEffect, useRef, useState } from "react";
import { ListMusic, Trash2 } from "lucide-react";
import { Button } from "antd";
import { Select } from "@/components/ui/base/select";
import { useI18n } from "@/supdance/plugins/i18n";
import { insertLyricSection, lyricSections, songOutline } from "./composer-patterns";

interface LyricsEditorProps {
    value: string;
    onChange: (lyrics: string) => void;
    maxChars: number;
    disabled?: boolean;
}

export function LyricsEditor({ value, onChange, maxChars, disabled }: LyricsEditorProps) {
    const { t } = useI18n();
    const textarea = useRef<HTMLTextAreaElement>(null);
    const [confirmingClear, setConfirmingClear] = useState(false);
    const [limitHit, setLimitHit] = useState(false);
    const charCount = Array.from(value).length;

    useEffect(() => {
        if (!confirmingClear) return;
        const timer = setTimeout(() => setConfirmingClear(false), 3000);
        return () => clearTimeout(timer);
    }, [confirmingClear]);

    function insert(section: string) {
        const field = textarea.current;
        if (!field || disabled) return;
        const next = insertLyricSection(value, field.selectionStart, field.selectionEnd, section, maxChars);
        setLimitHit(!next);
        if (!next) return;
        onChange(next.lyrics);
        requestAnimationFrame(() => {
            if (field.isConnected) {
                field.focus();
                field.setSelectionRange(next.caret, next.caret);
            }
        });
    }

    return (
        <section className="music-composer-panel">
            <div className="music-composer-heading">
                <label htmlFor="music-lyrics">{t("music.lyrics_editor")}</label>
                <span>
                    {charCount} / {maxChars}
                </span>
            </div>
            <textarea
                id="music-lyrics"
                ref={textarea}
                rows={6}
                value={value}
                disabled={disabled}
                aria-invalid={charCount > maxChars}
                onChange={(e) => {
                    onChange(e.target.value);
                    setConfirmingClear(false);
                    setLimitHit(false);
                }}
                placeholder={t("music.lyrics_hint")}
            />
            <div className="music-composer-tools">
                <Select
                    ariaLabel={t("music.lyric_structure")}
                    placeholder={t("music.lyric_structure")}
                    value={null}
                    disabled={disabled}
                    onChange={(key) => insert("[" + key + "]\n")}
                    options={lyricSections.map((key) => ({ value: key, label: "[" + key + "]" }))}
                />
                <Button htmlType="button" disabled={disabled} icon={<ListMusic size={15} />} onClick={() => insert(songOutline)}>
                    {t("music.lyric_outline")}
                </Button>
                <Button
                    htmlType="button"
                    type="text"
                    disabled={disabled || !value}
                    danger={confirmingClear}
                    aria-label={t(confirmingClear ? "music.confirm_clear" : "music.lyrics_clear")}
                    title={t(confirmingClear ? "music.confirm_clear" : "music.lyrics_clear")}
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
            {(limitHit || charCount > maxChars) && (
                <p role="alert" className="text-xs text-destructive">
                    {t("music.limit_hint")}
                </p>
            )}
        </section>
    );
}
