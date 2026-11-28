import { useRef, useState } from "react";
import { Button } from "antd";
import { ImagePlus, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui/base/select";
import { uploadResourceFile } from "@/services/api/resources";
import { ApiError } from "@/services/api/request";
import { useI18n } from "@/supdance/plugins/i18n";
import { attachMusicCover, generateMusicCover, getMusicCover, getMusicCoverOptions, type MusicCoverView } from "../services/music-cover-api";

const coverMimeTypes = ["image/jpeg", "image/png", "image/webp"];

export function useMusicCover(userId: string, taskId: string, supported: boolean) {
    return useQuery({
        queryKey: ["music-cover", userId, taskId],
        queryFn: ({ signal }) => getMusicCover(taskId, signal),
        refetchInterval: (query) => (query.state.data?.status === "pending" ? 2500 : false),
        enabled: supported,
        retry: false,
    });
}

export function MusicCoverControls({ userId, taskId, cover, onChange }: { userId: string; taskId: string; cover: MusicCoverView; onChange: (cover: MusicCoverView) => void }) {
    const { t, locale } = useI18n();
    const optionsQuery = useQuery({
        queryKey: ["music-cover-options", userId],
        queryFn: ({ signal }) => getMusicCoverOptions(signal),
        retry: false,
    });
    const options = optionsQuery.data;
    const [modelId, setModelId] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState<"generate" | "upload">();
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

    const upload = (file: File) => {
        if (!options || !coverMimeTypes.includes(file.type) || file.size > options.maxUploadBytes) {
            setError(t("music.cover_upload_invalid"));
            return;
        }
        void run("upload", async () => {
            const resource = await uploadResourceFile(file, "image", { expectedUserId: userId, fileName: file.name });
            return attachMusicCover(userId, taskId, resource.id);
        });
    };

    const charge = model ? t(model.estimated ? "music.cover_estimated_price" : "music.cover_price", { credits: new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(model.quoteMicrocredits / 1_000_000) }) : "";
    const accessDenied = optionsQuery.error instanceof ApiError && [401, 403].includes(optionsQuery.error.status || 0);

    if (!pending && cover.status !== "failed" && (accessDenied || (!options?.enabled && !options?.allowUpload))) return null;

    return (
        <div className="flex flex-col gap-2">
            <div className="plugin-music-track-toolbar">
                {options?.enabled && model && (
                    <>
                        {options.models.length > 1 && (
                            <Select<string> ariaLabel={t("music.cover_allowed_models")} options={options.models.map((item) => ({ value: item.id, label: item.name }))} value={model.id} onChange={setModelId} disabled={pending || Boolean(busy)} />
                        )}
                        <Button icon={<ImagePlus size={16} />} loading={busy === "generate"} disabled={pending || Boolean(busy)} onClick={generate}>
                            {t("music.cover_payment_confirm", { price: charge })}
                        </Button>
                    </>
                )}
                {options?.allowUpload && (
                    <Button icon={<Upload size={16} />} loading={busy === "upload"} disabled={pending || Boolean(busy)} onClick={() => input.current?.click()}>
                        {t("music.cover_upload")}
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
                            if (file) upload(file);
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
    );
}
