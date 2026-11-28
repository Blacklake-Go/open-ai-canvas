import { useEffect, useRef, useState } from "react";
import { Button, Switch as AntSwitch } from "antd";
import { AdminSegmented } from "@/pages/admin/ui/controls";
import { BookMarked, ChevronDown, ImagePlus, LibraryBig, Music2, SlidersHorizontal, WandSparkles } from "lucide-react";
import { SegmentedControl } from "@/components/ui/base/segmented-control";
import { Checkbox } from "@/components/ui/base/checkbox";
import { AppModal } from "@/components/ui/product/app-modal";
import { IconButton } from "@/components/ui/base/buttons";
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
import { LyricsEditor, type LyricAIRequest } from "./lyrics-editor";
import { PromptBuilder, SavedPrompts, StyleTemplates } from "./style-templates";
import { appendStyle } from "./composer-patterns";
import { generateLyrics, isLyricsAIRuntimeConfigured } from "../services/lyrics-ai";
import { useMusicCoverOptions } from "./music-cover-controls";
import "../styles/music-composer.css";

export function musicCreationAllowed(quote: LogicalModelQuote | null, available: number | null | undefined) {
    return Boolean(quote && available != null && available >= quote.amountMicrocredits);
}

export function MusicForm({ userId, onSubmitted, admin = false }: { userId: string; onSubmitted?: (taskId: string) => void; admin?: boolean }) {
    const ModeSelector = admin ? AdminSegmented : SegmentedControl;
    const InstrumentalSwitch = admin ? AntSwitch : Switch;
    const { t, locale } = useI18n();
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
    const coverOptions = useMusicCoverOptions(userId, !admin);
    const [includeCover, setIncludeCover] = useState(false);
    const [coverModelId, setCoverModelId] = useState("");
    const [confirmCover, setConfirmCover] = useState(false);
    const availableCover = coverOptions.data?.enabled ? coverOptions.data : undefined;
    const coverModel = availableCover?.models.find((item) => item.id === coverModelId) ?? availableCover?.models.find((item) => item.id === availableCover.defaultModel);
    const coverSelection = includeCover && coverModel ? { model: coverModel.id, quotedMicrocredits: coverModel.quoteMicrocredits } : undefined;
    const total = quote ? quote.amountMicrocredits + (coverSelection?.quotedMicrocredits ?? 0) : undefined;
    const formatCredits = (microcredits?: number) => (microcredits === undefined ? "—" : new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(microcredits / 1_000_000));
    // AI 歌词助手只在文本模型协议真正配置时启用；否则话题 pill 降级为本地起手稿，不渲染必然报错的按钮。
    const lyricsAIEnabled = isLyricsAIRuntimeConfigured(config);
    const runLyricsAI = async (request: LyricAIRequest) => {
        if (!lyricsAIEnabled) throw new Error(t("music.lyric_ai_failed"));
        return generateLyrics(request, { config });
    };

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

    const enough = (!includeCover || Boolean(coverSelection)) && total !== undefined && (!creditsEnabled || (wallet.availableMicrocredits != null && wallet.availableMicrocredits >= total));
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
    async function submitSong() {
        if (!valid || !enough || !quote || submitting) return;
        setConfirmCover(false);
        setError("");
        try {
            const result = await submit(userId, quote.amountMicrocredits, coverSelection);
            if (result) onSubmitted?.(result.taskId);
        } catch (cause) {
            if (cause instanceof ApiError && ["music_quote_changed", "music_cover_quote_changed"].includes(cause.reason || "")) {
                setError(t("music.quote_changed"));
                setQuoteRevision((value) => value + 1);
                if (includeCover) void coverOptions.refetch();
            } else {
                setError(cause instanceof Error ? cause.message : String(cause));
            }
        } finally {
            if (creditsEnabled) await wallet.refresh();
        }
    }
    const coverBreakdown = coverSelection && (
        <dl className="music-cover-quote">
            <dt>{t("music.cover_audio_credits")}</dt>
            <dd>{formatCredits(quote?.amountMicrocredits)}</dd>
            <dt>{t("music.cover_image_credits")}</dt>
            <dd>{formatCredits(coverSelection.quotedMicrocredits)}</dd>
            <dt>{t("music.cover_total_credits")}</dt>
            <dd>
                <strong>{formatCredits(total)}</strong>
            </dd>
        </dl>
    );
    const styleActions = (
        <div className="music-composer-tools">
            <IconButton
                icon={WandSparkles}
                className="size-11"
                aria-label={t("music.prompt_builder")}
                title={t("music.prompt_builder")}
                disabled={!canUseStyles}
                onClick={(e) => {
                    opener.current = e.currentTarget as HTMLButtonElement;
                    setPanel("builder");
                }}
            />
            <IconButton
                icon={LibraryBig}
                className="size-11"
                aria-label={t("music.pattern_library")}
                title={t("music.pattern_library")}
                disabled={!canUseStyles}
                onClick={(e) => {
                    opener.current = e.currentTarget as HTMLButtonElement;
                    setPanel("templates");
                }}
            />
            <IconButton
                icon={BookMarked}
                className="size-11"
                aria-label={t("music.saved_styles")}
                title={t("music.saved_styles")}
                disabled={!canUseStyles}
                onClick={(e) => {
                    opener.current = e.currentTarget as HTMLButtonElement;
                    setPanel("saved");
                }}
            />
        </div>
    );
    const styleEditor = selected?.styleSupported && (
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
    );

    return (
        <form
            className="plugin-music-form"
            onSubmit={(event) => {
                event.preventDefault();
                if (!valid || !enough || !quote || submitting) return;
                if (coverSelection) setConfirmCover(true);
                else void submitSong();
            }}
        >
            {admin && (
                <div className="music-suno-tabs" role="tablist" aria-label={t("music.songs_tab")}>
                    <button type="button" role="tab" aria-selected="true" className="is-active">
                        {t("music.songs_tab")}
                    </button>
                    <button type="button" role="tab" aria-selected="false" disabled title={t("music.speech_tab")}>
                        {t("music.speech_tab")}
                    </button>
                    <span className="music-suno-version">{selected?.id?.split("::").at(-1) || t("music.no_models")}</span>
                </div>
            )}
            <div className="music-composer-toolbar">
                <ModeSelector
                    value={draft.mode}
                    ariaLabel={t("music.creation_mode")}
                    options={(["simple", "custom"] as const).map((mode) => ({
                        value: mode,
                        label: t(mode === "simple" ? "music.mode_description" : "music.mode_lyrics"),
                        disabled: submitting || !capabilities.some((c) => c.available && c.modes.includes(mode)),
                    }))}
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
                        rows={admin ? 5 : 4}
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
            {draft.mode === "custom" && selected?.lyricsSupported && (
                <LyricsEditor
                    value={draft.lyrics}
                    onChange={(value) => setField("lyrics", value, userId)}
                    maxChars={selected.maxLyricsChars}
                    instrumental={selected.instrumentalSupported && draft.instrumental}
                    language={draft.songLanguage}
                    onAIAction={lyricsAIEnabled ? runLyricsAI : undefined}
                />
            )}
            {(admin || draft.mode === "custom") && styleEditor}
            {notice && (
                <p role="status" className="text-xs text-muted-foreground">
                    {notice}
                </p>
            )}
            {selected?.instrumentalSupported && (
                <div className="music-composer-setting">
                    <label htmlFor="music-instrumental">{t("music.instrumental_label")}</label>
                    <InstrumentalSwitch id="music-instrumental" checked={draft.instrumental} onChange={(v) => setField("instrumental", v, userId)} />
                </div>
            )}
            <details className="music-composer-options">
                <summary>
                    <SlidersHorizontal size={16} />
                    {t("music.composer_options")}
                    <ChevronDown size={15} />
                </summary>
                <div>
                    {!admin && draft.mode === "simple" && styleEditor}
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
            {panel === "templates" && <StyleTemplates admin={admin} onClose={closePanel} onApply={addStyle} />}
            {panel === "builder" && <PromptBuilder admin={admin} onClose={closePanel} onApply={addStyle} />}
            {panel === "saved" && <SavedPrompts admin={admin} key={userId} userId={userId} current={draft[mainField]} onClose={closePanel} onApply={addStyle} />}
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
                    className="music-quote-retry min-h-11 rounded-lg border border-border px-3"
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
                {(availableCover || includeCover) && (
                    <section className="flex flex-col gap-2">
                        <Checkbox className="min-h-11" checked={includeCover} onChange={(event) => setIncludeCover(event.target.checked)} disabled={submitting}>
                            <span className="inline-flex items-center gap-2">
                                <ImagePlus size={16} aria-hidden />
                                {t("music.cover_include")}
                            </span>
                        </Checkbox>
                        {includeCover && availableCover && coverModel && (
                            <Select<string>
                                ariaLabel={t("music.cover_allowed_models")}
                                options={availableCover.models.map((item) => ({ value: item.id, label: item.name }))}
                                value={coverModel.id}
                                onChange={setCoverModelId}
                                className="min-h-11"
                                disabled={submitting}
                            />
                        )}
                        {includeCover && !availableCover && (
                            <p role="alert" className="text-sm text-destructive">
                                {t("music.quote_changed")}
                            </p>
                        )}
                        {coverBreakdown}
                    </section>
                )}
                <div className="music-quote-line">
                    {!includeCover && (
                        <span>
                            {t("music.estimated_credits")} <strong>{quote ? (quote.amountMicrocredits / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—"}</strong>
                        </span>
                    )}
                    {creditsEnabled && (
                        <span>
                            {t("music.available_balance")} {wallet.availableMicrocredits === null ? "—" : (wallet.availableMicrocredits / 1_000_000).toLocaleString(currentLocale(), { maximumFractionDigits: 2 })}
                        </span>
                    )}
                </div>
                {creditsEnabled && total !== undefined && wallet.availableMicrocredits != null && wallet.availableMicrocredits < total && (
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
                <p className="text-xs text-muted-foreground music-save-to">
                    {t("music.site_billing_tip")}
                    {quote ? ` · ${t("music.billing_" + quote.billingMode)} × ${quote.quantity}` : ""}
                </p>
            </div>
            {confirmCover && (
                <AppModal open centered title={t("music.cover_include")} onCancel={() => setConfirmCover(false)} onOk={() => void submitSong()} okText={t("music.create_music")} okButtonProps={{ disabled: !enough }}>
                    <p className="mb-3 text-sm text-muted-foreground">{t("music.cover_after_audio")}</p>
                    {coverBreakdown}
                </AppModal>
            )}
        </form>
    );
}
