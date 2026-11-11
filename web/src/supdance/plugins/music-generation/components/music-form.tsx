import { useEffect, useRef, useState } from "react";
import { Button } from "antd";
import { BookMarked, ChevronDown, LibraryBig, Music2, SlidersHorizontal, WandSparkles } from "lucide-react";
import { SegmentedControl } from "@/components/ui/base/segmented-control";
import { Select } from "@/components/ui/base/select";
import { ModelPicker } from "@/components/model-picker";
import { useConfigStore } from "@/stores/use-config-store";
import { Switch } from "@/components/ui/base/switch";
import { useI18n } from "@/supdance/plugins/i18n";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { currentLocale } from "@/i18n";
import { ApiError } from "@/services/api/request";
import { useUserStore } from "@/stores/use-user-store";
import type { LogicalModelQuote } from "@/services/api/logical-models";
import { useMusicStore } from "../stores/use-music-store";
import { siteMusicQuote } from "../services/music-site-api";
import { LyricsEditor } from "./lyrics-editor";
import { PromptBuilder, SavedPrompts, StyleTemplates } from "./style-templates";
import { appendStyle } from "./composer-patterns";
import "../styles/music-composer.css";

export function musicCreationAllowed(quote: LogicalModelQuote | null, available: number | null | undefined) {
    return Boolean(quote && available != null && available >= quote.amountMicrocredits);
}

export function MusicForm({ userId, onSubmitted }: { userId: string; onSubmitted?: (taskId: string) => void }) {
    const { t } = useI18n();
    const config = useConfigStore((s) => s.config);
    const draft = useMusicStore((s) => s.draft);
    const capabilities = useMusicStore((s) => s.capabilities).filter((cap) => !cap.operations?.length);
    const loading = useMusicStore((s) => s.loadingCaps);
    const submitting = useMusicStore((s) => s.submitting);
    const setField = useMusicStore((s) => s.setDraftField);
    const setModel = useMusicStore((s) => s.setModel);
    const submit = useMusicStore((s) => s.submitGeneration);
    const selected = capabilities.find((cap) => cap.id === draft.model);
    const [pricing, setPricing] = useState<{ model: string; user: string; quote: LogicalModelQuote } | null>(null);
    const quote = pricing?.model === selected?.id && pricing?.user === userId ? pricing.quote : null;
    const [panel, setPanel] = useState<"templates" | "saved" | "builder" | null>(null);
    const opener = useRef<HTMLButtonElement | null>(null);
    const [notice, setNotice] = useState("");
    const [quoteError, setQuoteError] = useState("");
    const [error, setError] = useState("");
    const [quoteRevision, setQuoteRevision] = useState(0);
    const creditsEnabled = useUserStore((s) => s.features.creditsEnabled);
    const wallet = useWalletBalance(userId, creditsEnabled);

    useEffect(() => {
        const controller = new AbortController();
        setPricing(null);
        setQuoteError("");
        if (selected?.available) {
            void siteMusicQuote(selected.id, 0, controller.signal)
                .then((value) => {
                    if (!controller.signal.aborted) setPricing({ model: selected.id, user: userId, quote: value });
                })
                .catch((cause: unknown) => {
                    if (!controller.signal.aborted) setQuoteError(cause instanceof Error ? cause.message : String(cause));
                });
        }
        return () => controller.abort();
    }, [selected?.id, selected?.available, userId, quoteRevision]);

    const enough = creditsEnabled ? musicCreationAllowed(quote, wallet.availableMicrocredits) : Boolean(quote);
    const mainField = draft.mode === "simple" ? "prompt" : "tags";
    const input = draft.mode === "simple" ? draft.prompt : draft.lyrics;
    const limit = draft.mode === "simple" ? selected?.maxPromptChars : selected?.maxLyricsChars;
    const valid = selected?.available && selected.modes.includes(draft.mode) && input.trim() && Array.from(input).length <= (limit ?? 0) && (!selected.styleSupported || Array.from(draft.tags).length <= selected.maxPromptChars);
    const canUseStyles = Boolean(selected?.available && (draft.mode === "simple" || selected.styleSupported));
    function addStyle(style: string) {
        if (!selected || !canUseStyles) return false;
        const updated = appendStyle(draft[mainField], style, selected.maxPromptChars);
        if (updated === null) return false;
        setField(mainField, updated, userId);
        setNotice(t("music.pattern_applied"));
        return true;
    }
    function changeMode(mode: "simple" | "custom") {
        const model = selected?.available && selected.modes.includes(mode) ? selected : capabilities.find((c) => c.available && c.modes.includes(mode));
        if (!model) return;
        setNotice("");
        setError("");
        if (selected?.id !== model.id) setModel(model.id, userId);
        setField("mode", mode, userId);
    }
    function closePanel() {
        setPanel(null);
        requestAnimationFrame(() => {
            if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
        });
    }
    const styleActions = (
        <div className="music-composer-tools">
            <Button
                htmlType="button"
                icon={<WandSparkles size={15} />}
                disabled={!canUseStyles}
                onClick={(e) => {
                    opener.current = e.currentTarget as HTMLButtonElement;
                    setPanel("builder");
                }}
            >
                {t("music.prompt_builder")}
            </Button>
            <Button
                htmlType="button"
                icon={<LibraryBig size={15} />}
                disabled={!canUseStyles}
                onClick={(e) => {
                    opener.current = e.currentTarget as HTMLButtonElement;
                    setPanel("templates");
                }}
            >
                {t("music.pattern_library")}
            </Button>
            <Button
                htmlType="button"
                icon={<BookMarked size={15} />}
                disabled={!canUseStyles}
                onClick={(e) => {
                    opener.current = e.currentTarget as HTMLButtonElement;
                    setPanel("saved");
                }}
            >
                {t("music.saved_styles")}
            </Button>
        </div>
    );

    return (
        <form
            className="plugin-music-form"
            onSubmit={async (event) => {
                event.preventDefault();
                if (!valid || !enough || !quote || submitting) return;
                setError("");
                try {
                    const result = await submit(userId, quote.amountMicrocredits);
                    if (result) onSubmitted?.(result.taskId);
                    if (creditsEnabled) await wallet.refresh();
                } catch (cause) {
                    setError(cause instanceof ApiError && cause.reason === "music_quote_changed" ? t("music.quote_changed") : cause instanceof Error ? cause.message : String(cause));
                    if (cause instanceof ApiError && cause.reason === "music_quote_changed") setQuoteRevision((value) => value + 1);
                    if (creditsEnabled) await wallet.refresh();
                }
            }}
        >
            <div className="music-composer-toolbar">
                <SegmentedControl
                    value={draft.mode}
                    ariaLabel={t("music.creation_mode")}
                    disabled={submitting}
                    options={(["simple", "custom"] as const).map((mode) => ({ value: mode, label: t(mode === "simple" ? "music.mode_description" : "music.mode_lyrics"), disabled: !capabilities.some((c) => c.available && c.modes.includes(mode)) }))}
                    onChange={changeMode}
                />
                <div className="music-model-picker-field">
                    <ModelPicker
                        fullWidth
                        config={config}
                        value={selected?.id}
                        placeholder={t(loading ? "common.loading" : capabilities.length ? "music.select_model" : "music.no_models")}
                        disabled={loading || submitting || !capabilities.length}
                        capability="audio"
                        className="music-model-picker"
                        showSelectedPrice={false}
                        showOptionPrices
                        showConfiguredModelName
                        modelFilter={(model) => capabilities.some((cap) => cap.id === model)}
                        modelDisabledReason={(model) => {
                            const cap = capabilities.find((item) => item.id === model);
                            return cap?.available ? "" : cap?.unavailableReason || t("music.no_models");
                        }}
                        onChange={(v) => {
                            if (loading || submitting || !capabilities.some((cap) => cap.id === v && cap.available)) return;
                            setNotice("");
                            setError("");
                            setModel(v, userId);
                        }}
                    />
                </div>
            </div>
            {draft.mode === "simple" && (
                <section className="music-composer-panel">
                    <div className="music-composer-heading">
                        <label htmlFor="music-song-description">{t("music.prompt_label")}</label>
                        {selected && (
                            <span>
                                {Array.from(draft.prompt).length} / {selected.maxPromptChars}
                            </span>
                        )}
                    </div>
                    <textarea
                        id="music-song-description"
                        rows={5}
                        value={draft.prompt}
                        aria-invalid={!!selected && Array.from(draft.prompt).length > selected.maxPromptChars}
                        onChange={(e) => {
                            setField("prompt", e.target.value, userId);
                            setNotice("");
                        }}
                        placeholder={t("music.description_hint")}
                    />
                    {selected && Array.from(draft.prompt).length > selected.maxPromptChars && (
                        <p role="alert" className="text-xs text-destructive">
                            {t("music.limit_hint")}
                        </p>
                    )}
                    {styleActions}
                </section>
            )}
            {draft.mode === "custom" && selected?.lyricsSupported && <LyricsEditor value={draft.lyrics} onChange={(value) => setField("lyrics", value, userId)} maxChars={selected.maxLyricsChars} />}
            {selected?.styleSupported && (
                <section className="music-composer-panel">
                    <div className="music-composer-heading">
                        <label htmlFor="music-style-field">{t("music.style_field")}</label>
                        <span>
                            {Array.from(draft.tags).length} / {selected.maxPromptChars}
                        </span>
                    </div>
                    <textarea
                        id="music-style-field"
                        rows={3}
                        value={draft.tags}
                        aria-invalid={Array.from(draft.tags).length > selected.maxPromptChars}
                        onChange={(e) => {
                            setField("tags", e.target.value, userId);
                            setNotice("");
                        }}
                        placeholder={t("music.style_hint")}
                    />
                    {Array.from(draft.tags).length > selected.maxPromptChars && (
                        <p role="alert" className="text-xs text-destructive">
                            {t("music.limit_hint")}
                        </p>
                    )}
                    {draft.mode === "custom" && styleActions}
                </section>
            )}
            {notice && (
                <p role="status" className="text-xs text-muted-foreground">
                    {notice}
                </p>
            )}
            {selected?.instrumentalSupported && (
                <div className="music-composer-setting">
                    <label htmlFor="music-instrumental">{t("music.instrumental_label")}</label>
                    <Switch id="music-instrumental" checked={draft.instrumental} onChange={(v) => setField("instrumental", v, userId)} />
                </div>
            )}
            <details className="music-composer-options">
                <summary>
                    <SlidersHorizontal size={16} />
                    {t("music.composer_options")}
                    <ChevronDown size={15} />
                </summary>
                <div>
                    {selected?.titleSupported && (
                        <label>
                            {t("music.song_title")}
                            <input value={draft.title} maxLength={200} onChange={(e) => setField("title", e.target.value, userId)} />
                        </label>
                    )}
                    {selected?.styleSupported && (
                        <label>
                            {t("music.song_language")}
                            <input maxLength={80} value={draft.songLanguage} onChange={(e) => setField("songLanguage", e.target.value, userId)} />
                            <small>{t("music.language_preference_hint")}</small>
                        </label>
                    )}
                    <p className="text-xs text-muted-foreground">{t("music.native_output_hint")}</p>
                </div>
            </details>
            {panel === "templates" && <StyleTemplates onClose={closePanel} onApply={addStyle} />}
            {panel === "builder" && <PromptBuilder onClose={closePanel} onApply={addStyle} />}
            {panel === "saved" && <SavedPrompts key={userId} userId={userId} current={draft[mainField]} onClose={closePanel} onApply={addStyle} />}
            {quoteError && (
                <p role="alert" className="text-sm text-destructive">
                    {quoteError}
                </p>
            )}
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            {(quoteError || wallet.isError) && selected?.available && (
                <button
                    type="button"
                    className="min-h-11 rounded-lg border border-border px-3"
                    onClick={() => {
                        setQuoteRevision((value) => value + 1);
                        if (creditsEnabled) void wallet.refresh();
                    }}
                >
                    {t("music.refresh_quote")}
                </button>
            )}
            {!loading && !capabilities.length && (
                <p role="status" className="text-sm text-muted-foreground">
                    {t("music.no_models")}
                </p>
            )}
            <div className="music-create-footer">
                <div className="music-quote-line">
                    <span>
                        {t("music.estimated_credits")} <strong>{quote ? (quote.amountMicrocredits / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—"}</strong>
                    </span>
                    {creditsEnabled && (
                        <span>
                            {t("music.available_balance")} {wallet.availableMicrocredits === null ? "—" : (wallet.availableMicrocredits / 1_000_000).toLocaleString(currentLocale(), { maximumFractionDigits: 2 })}
                        </span>
                    )}
                </div>
                {quote && wallet.availableMicrocredits !== null && !enough && (
                    <p role="alert" className="text-sm text-destructive">
                        {t("music.insufficient_balance")}
                    </p>
                )}
                {wallet.isError && creditsEnabled && (
                    <p role="alert" className="text-sm text-destructive">
                        {t("music.wallet_unavailable")}
                    </p>
                )}
                <Button type="primary" htmlType="submit" loading={submitting} icon={<Music2 size={18} />} disabled={!valid || !enough || submitting} className="music-create-button">
                    {t(submitting ? "music.submitting" : "music.create_music")}
                </Button>
                <p className="text-xs text-muted-foreground">
                    {t("music.site_billing_tip")}
                    {quote ? ` · ${t("music.billing_" + quote.billingMode)} × ${quote.quantity}` : ""}
                </p>
            </div>
        </form>
    );
}
