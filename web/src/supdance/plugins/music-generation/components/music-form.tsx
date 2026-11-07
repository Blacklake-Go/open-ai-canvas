import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "antd";
import { useI18n } from "@/supdance/plugins/i18n";
import { getWallet } from "@/services/api/wallet";
import { ApiError } from "@/services/api/request";
import { useUserStore } from "@/stores/use-user-store";
import type { LogicalModelQuote } from "@/services/api/logical-models";
import { useMusicStore } from "../stores/use-music-store";
import { siteMusicQuote } from "../services/music-site-api";
import { LyricsEditor } from "./lyrics-editor";

export function musicCreationAllowed(quote: LogicalModelQuote | null, available: number | undefined) {
    return Boolean(quote && available !== undefined && available >= quote.amountMicrocredits);
}

export function MusicForm({ userId, onSubmitted }: { userId: string; onSubmitted?: (taskId: string) => void }) {
    const { t } = useI18n();
    const draft = useMusicStore((s) => s.draft);
    const capabilities = useMusicStore((s) => s.capabilities);
    const loading = useMusicStore((s) => s.loadingCaps);
    const submitting = useMusicStore((s) => s.submitting);
    const setField = useMusicStore((s) => s.setDraftField);
    const setModel = useMusicStore((s) => s.setModel);
    const submit = useMusicStore((s) => s.submitGeneration);
    const selected = capabilities.find((cap) => cap.id === draft.model);
    const [quote, setQuote] = useState<LogicalModelQuote | null>(null);
    const [error, setError] = useState("");
    const [quoteRevision, setQuoteRevision] = useState(0);
    const creditsEnabled = useUserStore((s) => s.features.creditsEnabled);
    const wallet = useQuery({ queryKey: ["music-wallet", userId], queryFn: () => getWallet(1, 1), enabled: Boolean(userId), refetchOnWindowFocus: true });

    useEffect(() => {
        const controller = new AbortController();
        setQuote(null);
        setError("");
        if (selected?.available) {
            void siteMusicQuote(selected.id, 0, controller.signal)
                .then((value) => {
                    if (!controller.signal.aborted) setQuote(value);
                })
                .catch((cause: unknown) => {
                    if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
                });
        }
        return () => controller.abort();
    }, [selected?.id, selected?.available, userId, quoteRevision]);

    const enough = creditsEnabled ? musicCreationAllowed(quote, wallet.data?.account.availableMicrocredits) : Boolean(quote);
    const valid = selected?.available && selected.modes.includes(draft.mode) && (draft.mode === "custom" ? draft.lyrics.trim() : draft.prompt.trim());
    const fieldClass = "min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary";
    const labelClass = "flex flex-col gap-2 text-sm font-medium text-foreground";

    return (
        <form
            className="plugin-music-form flex flex-col gap-5"
            onSubmit={async (event) => {
                event.preventDefault();
                if (!valid || !enough || !quote || submitting) return;
                setError("");
                try {
                    const result = await submit(userId, quote.amountMicrocredits);
                    if (result) onSubmitted?.(result.taskId);
                    await wallet.refetch();
                } catch (cause) {
                    setError(cause instanceof ApiError && cause.reason === "music_quote_changed" ? t("music.quote_changed") : cause instanceof Error ? cause.message : String(cause));
                    if (cause instanceof ApiError && cause.reason === "music_quote_changed") setQuoteRevision((value) => value + 1);
                    await wallet.refetch();
                }
            }}
        >
            <div className="flex gap-2" role="group" aria-label={t("music.creation_mode", undefined, "Creation mode")}>
                {(["simple", "custom"] as const).map((mode) => (
                    <button
                        key={mode}
                        type="button"
                        aria-pressed={draft.mode === mode}
                        disabled={!selected?.modes.includes(mode)}
                        onClick={() => setField("mode", mode, userId)}
                        className={`min-h-11 flex-1 rounded-lg border px-3 text-sm disabled:opacity-40 ${draft.mode === mode ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"}`}
                    >
                        {t(`music.mode_${mode}`)}
                    </button>
                ))}
            </div>
            {draft.mode === "simple" && (
                <label className={labelClass}>
                    {t("music.prompt_label")}
                    <textarea
                        className={fieldClass}
                        rows={5}
                        value={draft.prompt}
                        maxLength={selected?.maxPromptChars}
                        onChange={(event) => setField("prompt", event.target.value, userId)}
                        placeholder={t("music.description_hint", undefined, "Describe the purpose, mood, genre, instruments and rhythm.")}
                    />
                </label>
            )}
            {draft.mode === "simple" && (
                <div className="flex flex-wrap gap-2">
                    {["calm_piano", "film", "focus"].map((scene) => (
                        <button key={scene} type="button" className="min-h-11 rounded-lg border border-border px-3 text-xs" onClick={() => setField("prompt", [draft.prompt, t("music.scene_" + scene)].filter(Boolean).join(", "), userId)}>
                            {t("music.scene_" + scene)}
                        </button>
                    ))}
                </div>
            )}
            {selected?.titleSupported && (
                <label className={labelClass}>
                    {t("music.song_title")}
                    <input className={fieldClass} value={draft.title} maxLength={200} onChange={(event) => setField("title", event.target.value, userId)} />
                </label>
            )}
            {draft.mode === "custom" && selected?.lyricsSupported && (
                <div className={labelClass}>
                    <span>{t("music.lyrics_editor")}</span>
                    <LyricsEditor value={draft.lyrics} onChange={(value) => setField("lyrics", value, userId)} maxChars={selected.maxLyricsChars} />
                </div>
            )}
            {selected?.styleSupported && (
                <label className={labelClass}>
                    {t("music.style_language", undefined, "Music style and song language")}
                    <textarea className={fieldClass} rows={3} value={draft.tags} onChange={(event) => setField("tags", event.target.value, userId)} placeholder={t("music.style_hint", undefined, "Warm piano pop, gentle vocals, English lyrics")} />
                </label>
            )}
            {selected?.styleSupported && (
                <label className={labelClass}>
                    {t("music.song_language")}
                    <input className={fieldClass} maxLength={80} value={draft.songLanguage} onChange={(event) => setField("songLanguage", event.target.value, userId)} />
                    <span className="text-xs font-normal text-muted-foreground">{t("music.language_preference_hint")}</span>
                </label>
            )}
            {selected?.instrumentalSupported && (
                <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-foreground">
                    <span>{t("music.instrumental_label", undefined, "Instrumental · no vocals")}</span>
                    <input type="checkbox" checked={draft.instrumental} onChange={(event) => setField("instrumental", event.target.checked, userId)} className="size-5 accent-primary" />
                </label>
            )}
            <label className={labelClass}>
                {t("music.select_model")}
                <select className={fieldClass} value={draft.model} disabled={loading} onChange={(event) => setModel(event.target.value, userId)}>
                    {!selected && <option value="">{t(loading ? "common.loading" : "music.no_models")}</option>}
                    {capabilities.map((cap) => (
                        <option value={cap.id} key={cap.id} disabled={!cap.available}>
                            {cap.name === cap.modelKey ? cap.name : `${cap.name} · ${cap.modelKey}`}
                        </option>
                    ))}
                </select>
            </label>
            <p className="text-xs text-muted-foreground">{t("music.native_output_hint", undefined, "MP3 output. Duration is determined by the model. Each task may return a different number of tracks.")}</p>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            {!quote && selected?.available && (
                <button type="button" className="min-h-11 rounded-lg border border-border px-3" onClick={() => setQuoteRevision((value) => value + 1)}>
                    {t("music.refresh_quote")}
                </button>
            )}
            {!loading && !capabilities.length && (
                <p role="status" className="text-sm text-muted-foreground">
                    {t("music.no_models")}
                </p>
            )}
            <div className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                    <span>{t("music.estimated_credits")}</span>
                    <strong>{quote ? (quote.amountMicrocredits / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—"}</strong>
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-muted-foreground">
                    <span>{t("music.available_balance", undefined, "Available credits")}</span>
                    <span>{wallet.data ? (wallet.data.account.availableMicrocredits / 1_000_000).toLocaleString() : "—"}</span>
                </div>
                {quote && wallet.data && !enough && (
                    <p role="alert" className="text-destructive">
                        {t("music.insufficient_balance", undefined, "Not enough credits for this quote.")}
                    </p>
                )}
                {wallet.isError && (
                    <p role="alert" className="text-destructive">
                        {t("music.wallet_unavailable", undefined, "Balance unavailable. Refresh before creating music.")}
                    </p>
                )}
                <p className="text-xs text-muted-foreground">
                    {t("music.site_billing_tip")}
                    {quote ? ` · ${t("music.billing_" + quote.billingMode)} × ${quote.quantity}` : ""}
                </p>
            </div>
            <Button type="primary" htmlType="submit" disabled={!valid || !enough || submitting} className="min-h-11">
                {t(submitting ? "music.submitting" : "music.create_music", undefined, submitting ? "Submitting…" : "Create music")}
            </Button>
        </form>
    );
}
