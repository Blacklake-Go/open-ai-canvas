import { useEffect, useRef, useState } from "react";
import { Button } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Upload } from "lucide-react";
import { AppModal } from "@/components/ui/product/app-modal";
import { Select } from "@/components/ui/base/select";
import { AssetLibraryPickerModal } from "@/components/assets/asset-library-picker-modal";
import { probeMediaDurationMs } from "@/lib/media-metadata";
import { getResource, resourceIdFromStorageKey, resourceStorageKey, uploadResourceFile } from "@/services/api/resources";
import { ApiError } from "@/services/api/request";
import { getWallet } from "@/services/api/wallet";
import { useI18n } from "@/supdance/plugins/i18n";
import { useUserStore } from "@/stores/use-user-store";
import { submitMusicTask, type SubmitMusicTaskPayload } from "../services/music-api";
import { siteMusicQuote } from "../services/music-site-api";
import { advancedSubmission, musicOperations, musicToolInputError, resourceSource, type MusicOperation, type MusicSource, type VoicePersona } from "../services/music-tools";
import { useMusicStore } from "../stores/use-music-store";
import { MusicTrimDialog } from "./music-trim-dialog";
import "../styles/music-advanced.css";

function readPersonas(key: string): VoicePersona[] {
    try {
        const profiles: unknown = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(profiles) ? profiles.filter((p) => typeof p?.name === "string" && typeof p?.source?.id === "string" && typeof p?.style === "string").slice(0, 30) : [];
    } catch {
        return [];
    }
}

export function MusicAdvancedDialog({
    userId,
    initialSource,
    initialOp,
    initialLyrics,
    onClose,
    onSubmitted,
}: {
    userId: string;
    initialSource?: MusicSource;
    initialOp?: MusicOperation;
    initialLyrics?: string;
    onClose: () => void;
    onSubmitted: () => void;
}) {
    const { t } = useI18n();
    const caps = useMusicStore((s) => s.capabilities);
    const [op, setOp] = useState<MusicOperation>(initialOp || "reference");
    const [source, setSource] = useState(initialSource);
    const [modelId, setModelId] = useState("");
    const [lyrics, setLyrics] = useState(initialLyrics || "");
    const [prompt, setPrompt] = useState("");
    const [start, setStart] = useState("0"),
        [end, setEnd] = useState(initialSource?.durationMs ? String(Math.min(10000, initialSource.durationMs) / 1000) : "3");
    const [toolsPanel, setToolsPanel] = useState<"source" | "range" | null>(null);
    const [busy, setBusy] = useState<"" | "upload" | "submit">("");
    const [message, setMessage] = useState("");
    const [rights, setRights] = useState(false);
    const key = "supdance:music:personas:" + userId;
    const [profiles, setProfiles] = useState(() => readPersonas(key));
    const [profileName, setProfileName] = useState("");
    const client = useQueryClient();
    const lock = useRef(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const live = useRef(true);
    const creditsEnabled = useUserStore((s) => s.features.creditsEnabled);
    useEffect(() => {
        live.current = true;
        useMusicStore.getState().pauseAudio();
        return () => {
            live.current = false;
        };
    }, []);
    function current() {
        return live.current && useUserStore.getState().user?.id === userId;
    }
    const candidates = caps.filter((c) => c.available && c.operations?.includes(op));
    const model = candidates.find((c) => c.id === modelId) || candidates[0];
    const quote = useQuery({ queryKey: ["music-tool-quote", userId, model?.id, op], queryFn: ({ signal }) => siteMusicQuote(model!.id, 0, signal, op), enabled: Boolean(model), retry: false, staleTime: 0 });
    const wallet = useQuery({ queryKey: ["music-wallet", userId], queryFn: () => getWallet(1, 1), enabled: creditsEnabled });
    const price = quote.data?.amountMicrocredits;
    const startMs = start.trim() === "" ? NaN : Math.round(Number(start) * 1000),
        endMs = end.trim() === "" ? NaN : Math.round(Number(end) * 1000);
    const inputError = musicToolInputError(op, source, prompt, lyrics, startMs, endMs);
    const enough = price !== undefined && (!creditsEnabled || (wallet.data?.account.availableMicrocredits ?? -1) >= price);
    function chooseSource(next: MusicSource) {
        setSource(next);
        setStart("0");
        setEnd(String(Math.min(next.durationMs ?? 3000, 10000) / 1000));
        setRights(false);
        setMessage("");
    }
    function changeOp(next: MusicOperation) {
        setOp(next);
        setModelId("");
        setMessage("");
        setRights(false);
    }
    function persistProfiles(next: VoicePersona[]) {
        try {
            localStorage.setItem(key, JSON.stringify(next));
            setProfiles(next);
            setMessage(t("music.adv_profile_saved"));
        } catch {
            setMessage(t("music.trim_save_error"));
        }
    }
    async function pickResource(id: string, title: string) {
        const resource = await getResource(id);
        if (current()) chooseSource(resourceSource(resource, title, userId));
    }
    async function upload(file: File) {
        if (lock.current || !current()) return;
        if (!/\.(mp3|m4a)$/i.test(file.name) || file.size <= 0 || file.size > 10_000_000) {
            setMessage(t("music.adv_source_format"));
            return;
        }
        lock.current = true;
        setBusy("upload");
        setMessage("");
        try {
            const durationMs = await probeMediaDurationMs(file);
            if (!current()) return;
            if (!durationMs && op !== "stems") throw new Error(t("music.adv_source_duration"));
            const resource = await uploadResourceFile(file, "audio", { fileName: file.name, durationMs, idempotencyKey: crypto.randomUUID() });
            if (current()) chooseSource(resourceSource(resource, file.name, userId));
        } catch (e) {
            if (current()) setMessage(e instanceof Error ? t(e.message, undefined, e.message) : t("music.adv_source_format"));
        } finally {
            lock.current = false;
            if (current()) setBusy("");
        }
    }
    async function submit() {
        if (lock.current || !current() || !source || !model || quote.isFetching || quote.isError || inputError || !rights || !enough || price === undefined) return;
        lock.current = true;
        setBusy("submit");
        setMessage("");
        const request: Omit<SubmitMusicTaskPayload, "idempotencyNonce"> = {
            model: model.id,
            operation: op,
            mode: "custom",
            title: [...source.title].slice(0, 155).join("") + " · " + t("music.adv_" + op),
            sourceResourceId: source.id,
            quotedMicrocredits: price,
            prompt: op === "persona" || op === "remix" ? prompt.trim() : "",
            ...(op !== "stems" ? { lyrics: lyrics.trim() } : {}),
            ...(op === "region" ? { editStartMs: startMs, editEndMs: endMs } : {}),
        };
        try {
            const receipt = await advancedSubmission(userId, request);
            if (!current()) return;
            const result = await submitMusicTask({ ...request, idempotencyNonce: receipt.nonce });
            if (!result.taskId) throw new Error(t("music.adv_reconcile"));
            receipt.clear();
            if (current()) {
                void useMusicStore.getState().loadTasks();
                void client.invalidateQueries({ queryKey: ["music-wallet", userId] });
                void client.invalidateQueries({ queryKey: ["wallet-balance", userId] });
                onSubmitted();
            }
        } catch (e) {
            if (current()) {
                if (e instanceof ApiError && e.reason === "music_quote_changed") {
                    setMessage(t("music.quote_changed"));
                    void quote.refetch();
                } else setMessage(e instanceof Error ? e.message : t("music.adv_retry_same"));
                if (creditsEnabled) void wallet.refetch();
            }
        } finally {
            lock.current = false;
            if (current()) setBusy("");
        }
    }
    const disabled = Boolean(busy);
    const textInput = op === "persona" || op === "remix";
    return (
        <>
            <AppModal
                open={!toolsPanel}
                centered
                width={640}
                title={t("music.adv_tools")}
                onCancel={() => {
                    if (!lock.current) onClose();
                }}
                keyboard={!disabled}
                closable={!disabled}
                mask={{ closable: false }}
                footer={null}
            >
                <section className="music-advanced" translate="no" data-i18n-ignore="true">
                    <fieldset disabled={disabled}>
                        <Select value={op} ariaLabel={t("music.adv_tools")} options={musicOperations.map((value) => ({ value, label: t("music.adv_" + value) }))} onChange={(v) => changeOp(v as MusicOperation)} disabled={disabled} />
                        <p className="music-tool-help">{t("music.adv_" + op + "_help")}</p>
                        {model ? (
                            <label>
                                {t("music.adv_model")}
                                <Select value={model.id} ariaLabel={t("music.adv_model")} options={candidates.map((c) => ({ value: c.id, label: c.name }))} onChange={setModelId} disabled={disabled} />
                            </label>
                        ) : (
                            <p role="status" className="music-tool-note">
                                {t("music.adv_unavailable")}
                            </p>
                        )}
                        {op === "persona" && profiles.length > 0 && (
                            <label>
                                {t("music.adv_profiles")}
                                <Select
                                    value={profiles.find((p) => p.name === profileName && p.source.id === source?.id)?.name || ""}
                                    ariaLabel={t("music.adv_profiles")}
                                    options={profiles.map((p) => ({ value: p.name, label: p.name }))}
                                    placeholder={t("music.adv_choose")}
                                    onChange={(v) => {
                                        const p = profiles.find((item) => item.name === v);
                                        if (p) {
                                            chooseSource(p.source);
                                            setPrompt(p.style);
                                            setProfileName(p.name);
                                        }
                                    }}
                                />
                            </label>
                        )}
                        <div className="music-tool-source">
                            <strong>{t("music.adv_source")}</strong>
                            <span>{source?.title || t("music.adv_no_source")}</span>
                            <small>{t("music.adv_source_format")}</small>
                            <div className="music-tool-actions">
                                <Button htmlType="button" icon={<FolderOpen size={15} />} disabled={!model || disabled} onClick={() => setToolsPanel("source")}>
                                    {t("music.adv_assets")}
                                </Button>
                                <Button htmlType="button" icon={<Upload size={15} />} disabled={!model || disabled} loading={busy === "upload"} onClick={() => fileInput.current?.click()}>
                                    {t("music.adv_upload")}
                                </Button>
                                <input
                                    type="file"
                                    hidden
                                    ref={fileInput}
                                    accept=".mp3,.m4a,audio/mpeg,audio/mp4"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = "";
                                        if (file) void upload(file);
                                    }}
                                />
                            </div>
                        </div>
                        {textInput && (
                            <label>
                                {t("music.adv_prompt")}
                                <textarea maxLength={1024} value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} />
                            </label>
                        )}
                        {op !== "stems" && (
                            <label>
                                {t("music.adv_lyrics")}
                                <textarea maxLength={op === "region" ? 3000 : 5000} value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={3} />
                            </label>
                        )}
                        {op === "region" && (
                            <div className="music-tool-range">
                                <label>
                                    {t("music.adv_start")}
                                    <input type="number" min="0" step="0.001" value={start} onChange={(e) => setStart(e.target.value)} />
                                </label>
                                <label>
                                    {t("music.adv_end")}
                                    <input type="number" min="3" max={(source?.durationMs || 0) / 1000 || undefined} step="0.001" value={end} onChange={(e) => setEnd(e.target.value)} />
                                </label>
                                <Button disabled={!source || !model} onClick={() => setToolsPanel("range")}>
                                    {t("music.adv_clip_preview")}
                                </Button>
                            </div>
                        )}
                        {op === "persona" && (
                            <div>
                                <label>
                                    {t("music.adv_profile_name")}
                                    <input maxLength={60} value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                                </label>
                                <div className="music-tool-actions">
                                    <Button
                                        disabled={!source || !profileName.trim() || !rights}
                                        onClick={() => {
                                            if (source) {
                                                const name = profileName.trim();
                                                persistProfiles([{ name, source, style: prompt }, ...profiles.filter((p) => p.name !== name)].slice(0, 30));
                                            }
                                        }}
                                    >
                                        {t("music.adv_profile_save")}
                                    </Button>
                                    {profiles.some((p) => p.name === profileName) && (
                                        <Button
                                            onClick={() => {
                                                persistProfiles(profiles.filter((p) => p.name !== profileName));
                                                setProfileName("");
                                            }}
                                        >
                                            {t("music.adv_profile_delete")}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                        <label className="music-tool-rights">
                            <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
                            {t("music.adv_rights")}
                        </label>
                    </fieldset>
                    {source && inputError && !["music.adv_lyrics", "music.adv_prompt"].includes(inputError) && <p role="status">{t(inputError)}</p>}
                    {message && <p role="status">{message}</p>}
                    {quote.isError && (
                        <div role="alert">
                            {quote.error.message} <Button onClick={() => void quote.refetch()}>{t("common.retry")}</Button>
                        </div>
                    )}
                    {model && (
                        <div className="music-tool-footer">
                            <span>
                                {t("music.adv_quote")} <b>{price === undefined || quote.isFetching || quote.isError ? "—" : (price / 1_000_000).toLocaleString()}</b>
                            </span>
                            {price !== undefined && !enough && <small>{t("music.adv_quota")}</small>}
                            <Button type="primary" loading={busy === "submit"} disabled={disabled || !!inputError || !rights || !enough || quote.isFetching || quote.isError} onClick={() => void submit()}>
                                {t("music.adv_submit")}
                            </Button>
                        </div>
                    )}
                </section>
            </AppModal>
            {toolsPanel === "source" && (
                <AssetLibraryPickerModal
                    open
                    remoteLibrary
                    remoteKind="audio"
                    acceptRemoteItems
                    multiple={false}
                    items={[]}
                    categoryLabels={{}}
                    title={t("music.adv_assets")}
                    remoteItemDisabledReason={(asset) => (asset.kind === "audio" && resourceIdFromStorageKey(asset.data.storageKey) ? undefined : t("music.adv_no_source"))}
                    onClose={() => setToolsPanel(null)}
                    onConfirm={async (ids, items) => {
                        try {
                            const asset = items?.find((item) => item.id === ids[0])?.asset;
                            if (asset?.kind !== "audio") throw new Error(t("music.adv_no_source"));
                            await pickResource(resourceIdFromStorageKey(asset.data.storageKey), asset.title);
                        } catch (e) {
                            if (current()) setMessage(e instanceof Error ? t(e.message, undefined, e.message) : t("music.adv_no_source"));
                        } finally {
                            if (current()) setToolsPanel(null);
                        }
                    }}
                />
            )}
            {toolsPanel === "range" && source && (
                <MusicTrimDialog
                    initialRangeMs={[startMs, endMs]}
                    title={source.title}
                    url=""
                    storageKey={resourceStorageKey(source.id)}
                    onClose={() => setToolsPanel(null)}
                    onPreviewStart={() => useMusicStore.getState().pauseAudio()}
                    onSelectRange={(a, b) => {
                        setStart(String(a / 1000));
                        setEnd(String(b / 1000));
                    }}
                />
            )}
        </>
    );
}
