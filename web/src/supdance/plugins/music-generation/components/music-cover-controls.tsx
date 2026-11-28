import { useEffect, useRef, useState } from "react";
import { Button } from "antd";
import { Image, ImageOff, ImagePlus, RotateCw, Upload } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CachedResourceImage } from "@/components/cached-resource-image";
import { IconButton } from "@/components/ui/base/buttons";
import { Select } from "@/components/ui/base/select";
import { AppModal } from "@/components/ui/product/app-modal";
import { uploadResourceFile } from "@/services/api/resources";
import { ApiError } from "@/services/api/request";
import { useI18n } from "@/supdance/plugins/i18n";
import { attachMusicCover, generateMusicCover, getMusicCover, getMusicCoverOptions } from "../services/music-cover-api";
import type { MusicCoverView } from "../services/music-api";

const coverMimeTypes = ["image/jpeg", "image/png", "image/webp"];

export function useMusicCover(userId: string, taskId: string, enabled: boolean, snapshot?: MusicCoverView) {
    const client = useQueryClient();
    const listedStatus = snapshot?.status;
    const listedKey = snapshot?.storageKey;
    const query = useQuery({
        queryKey: ["music-cover", userId, taskId],
        queryFn: ({ signal }) => getMusicCover(taskId, signal),
        refetchInterval: ({ state }) => ((state.data?.status === "none" ? listedStatus : (state.data?.status ?? listedStatus)) === "pending" ? 2500 : false),
        enabled,
        placeholderData: snapshot,
        retry: false,
    });
    const refetch = query.refetch;

    useEffect(() => {
        if (!listedKey) return;
        const key = ["music-cover", userId, taskId];
        const cached = client.getQueryData<MusicCoverView>(key);
        if (cached && cached.storageKey !== listedKey) void refetch({ cancelRefetch: false });
    }, [client, listedKey, refetch, taskId, userId]);

    const cachedCover = query.data;
    const data = !cachedCover || cachedCover.status === "none" ? (snapshot ?? cachedCover) : { ...cachedCover, storageKey: cachedCover.storageKey ?? listedKey };
    return { ...query, data };
}

export function useMusicCoverOptions(userId: string, enabled = true) {
    return useQuery({
        queryKey: ["music-cover-options", userId],
        queryFn: ({ signal }) => getMusicCoverOptions(signal),
        enabled: enabled && Boolean(userId),
        staleTime: 30_000,
        retry: false,
    });
}

export function MusicCoverControls({ userId, taskId, cover, onChange }: { userId: string; taskId: string; cover: MusicCoverView; onChange: (cover: MusicCoverView) => void }) {
    const { t, locale } = useI18n();
    const optionsQuery = useMusicCoverOptions(userId);
    const options = optionsQuery.data;
    const [open, setOpen] = useState(false);
    const [modelId, setModelId] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState<"generate" | "upload">();
    const [preview, setPreview] = useState<{ file: File; url: string }>();
    const [dimensionsValid, setDimensionsValid] = useState(false);
    const previewUpload = useRef<{ file: File; resourceId: string }>(null);
    useEffect(
        () => () => {
            if (preview) URL.revokeObjectURL(preview.url);
        },
        [preview],
    );
    const request = useRef<{ model: string; price: number; nonce: string } | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const pending = cover.status === "pending";
    const model = options?.models.find((item) => item.id === modelId) || options?.models.find((item) => item.id === options.defaultModel);

    const run = async (kind: NonNullable<typeof busy>, execute: () => Promise<MusicCoverView>) => {
        setError("");
        setBusy(kind);
        try {
            onChange(await execute());
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
            if (failure instanceof ApiError && failure.status === 409) void optionsQuery.refetch();
        } finally {
            setBusy(undefined);
        }
    };

    const generate = () => {
        if (!model) return;
        const saved = request.current;
        const next = saved?.model === model.id && saved.price === model.quoteMicrocredits ? saved : { model: model.id, price: model.quoteMicrocredits, nonce: crypto.randomUUID() };
        request.current = next;
        void run("generate", async () => {
            const view = await generateMusicCover(userId, taskId, model, next.nonce);
            request.current = null;
            return view;
        });
    };

    const selectUpload = (file: File) => {
        if (!options || !coverMimeTypes.includes(file.type) || file.size > options.maxUploadBytes) {
            setError(t("music.cover_upload_invalid"));
            return;
        }
        setError("");
        setDimensionsValid(false);
        previewUpload.current = null;
        setPreview({ file, url: URL.createObjectURL(file) });
    };

    const upload = (file: File) => {
        void run("upload", async () => {
            let resourceId = previewUpload.current?.file === file ? previewUpload.current.resourceId : undefined;
            if (!resourceId) {
                const resource = await uploadResourceFile(file, "image", { expectedUserId: userId, fileName: file.name });
                resourceId = resource.id;
                previewUpload.current = { file, resourceId };
            }
            const view = await attachMusicCover(userId, taskId, resourceId);
            previewUpload.current = null;
            setPreview(undefined);
            return view;
        });
    };

    const charge = model ? t(model.estimated ? "music.cover_estimated_price" : "music.cover_price", { credits: new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(model.quoteMicrocredits / 1_000_000) }) : "";
    const accessDenied = optionsQuery.error instanceof ApiError && [401, 403].includes(optionsQuery.error.status || 0);

    if (!cover.storageKey && !pending && cover.status !== "failed" && (accessDenied || (!options?.enabled && !options?.allowUpload))) return null;

    const close = () => {
        setOpen(false);
        setPreview(undefined);
        setError("");
    };

    return (
        <>
            <IconButton
                className="size-11"
                icon={cover.status === "failed" ? ImageOff : cover.storageKey ? Image : ImagePlus}
                aria-label={t("music.cover_settings")}
                title={t(cover.status === "failed" ? "music.cover_failed" : pending ? "music.cover_pending" : "music.cover_settings")}
                onClick={() => setOpen(true)}
            />
            {open && (
                <AppModal open centered title={t("music.cover_settings")} onCancel={close} closable={!busy} keyboard={!busy} maskClosable={false} footer={null}>
                    <div className="music-cover-dialog">
                        {preview ? (
                            <img
                                className="music-cover-dialog-art"
                                src={preview.url}
                                alt={t("music.cover_preview")}
                                onLoad={({ currentTarget }) => {
                                    const longestEdge = Math.max(currentTarget.naturalWidth, currentTarget.naturalHeight);
                                    const valid = longestEdge > 0 && longestEdge <= (options?.maxDimension ?? 0);
                                    setDimensionsValid(valid);
                                    if (!valid) setError(t("music.cover_upload_invalid"));
                                }}
                                onError={() => setError(t("music.cover_upload_invalid"))}
                            />
                        ) : cover.storageKey ? (
                            <CachedResourceImage storageKey={cover.storageKey} alt={t("music.cover_preview")} className="music-cover-dialog-art" eager />
                        ) : null}
                        <div className="plugin-music-track-toolbar">
                            {!preview && options?.enabled && model && (
                                <>
                                    {options.models.length > 1 && (
                                        <Select<string>
                                            ariaLabel={t("music.cover_allowed_models")}
                                            options={options.models.map((item) => ({ value: item.id, label: item.name }))}
                                            value={model.id}
                                            onChange={setModelId}
                                            disabled={pending || Boolean(busy)}
                                        />
                                    )}
                                    <Button className="min-h-11" icon={cover.status === "none" ? <ImagePlus size={16} /> : <RotateCw size={16} />} loading={busy === "generate"} disabled={pending || Boolean(busy)} onClick={generate}>
                                        {cover.status === "none" ? t("music.cover_payment_confirm", { price: charge }) : `${t("music.cover_regenerate")} · ${charge}`}
                                    </Button>
                                </>
                            )}
                            {options?.allowUpload && !preview && (
                                <Button className="min-h-11" icon={<Upload size={16} />} loading={busy === "upload"} disabled={pending || Boolean(busy)} onClick={() => input.current?.click()}>
                                    {t("music.cover_upload")}
                                </Button>
                            )}
                            {preview && (
                                <Button type="primary" className="min-h-11" icon={<Upload size={16} />} disabled={pending || !dimensionsValid} loading={busy === "upload"} onClick={() => upload(preview.file)}>
                                    {t("music.cover_upload")}
                                </Button>
                            )}
                            {preview && (
                                <Button
                                    className="min-h-11"
                                    disabled={Boolean(busy)}
                                    onClick={() => {
                                        setPreview(undefined);
                                        setError("");
                                    }}
                                >
                                    {t("common.cancel")}
                                </Button>
                            )}
                            {options?.allowUpload && (
                                <input
                                    ref={input}
                                    type="file"
                                    accept={coverMimeTypes.join(",")}
                                    hidden
                                    onChange={(event) => {
                                        const file = event.currentTarget.files?.[0];
                                        event.currentTarget.value = "";
                                        if (file) selectUpload(file);
                                    }}
                                />
                            )}
                        </div>
                        {pending && (
                            <p role="status" className="creation-music-card-meta">
                                {t("music.cover_pending")}
                            </p>
                        )}
                        {(error || cover.status === "failed") && (
                            <p role="alert" className="creation-music-track-error">
                                {error || t("music.cover_failed")}
                            </p>
                        )}
                    </div>
                </AppModal>
            )}
        </>
    );
}
