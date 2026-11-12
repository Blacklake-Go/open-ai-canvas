import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { App, Button, Popconfirm } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History } from "lucide-react";

import { dramaKeys } from "@/lib/drama/drama-query-keys";
import { formatRelativeTime } from "@/lib/relative-time";
import { ApiError } from "@/services/api/request";
import { DRAMA_ERROR_REASON, listDramaTakes, restoreDramaSegmentTake, type DramaTake, type DramaTakeKind, type DramaTakeSource } from "@/services/api/drama";

import { MediaThumb } from "../drama-shared";

import { secondsLabel } from "./segment-parts";

const SOURCE_LABEL: Record<DramaTakeSource, string> = { pipeline: "生成", upload: "上传", canvas: "来自画布" };

type Props = {
    projectId: string;
    ownerId: string;
    kind: DramaTakeKind;
    limit?: number;
    /** 当前正在右侧预览的版本；仅展示，不写库。 */
    previewTakeId?: string;
    onPreview?: (take: DramaTake) => void;
    /** 段视频可把历史版本设为当前；需要集与段序号。 */
    switchCurrent?: { episodeId: string; segmentIndex: number; expectedRevision?: number };
};

/** 设定参考图、剧情段视频或成片的版本记录，新版本在前；标出来源（流水线生成、上传、从精修画布采用）与当前版本。 */
export function DramaTakeList({ projectId, ownerId, kind, limit = 6, previewTakeId, onPreview, switchCurrent }: Props) {
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    _useCreationLocale();
    const query = useQuery({
        queryKey: dramaKeys.takes(projectId, kind, ownerId),
        queryFn: ({ signal }) => listDramaTakes(projectId, ownerId, kind, signal),
        enabled: Boolean(projectId && ownerId),
        staleTime: 10_000,
    });
    const restore = useMutation({
        mutationFn: (take: DramaTake) => {
            if (!switchCurrent) throw new Error("该类型暂不支持切换当前版本");
            return restoreDramaSegmentTake(projectId, switchCurrent.episodeId, switchCurrent.segmentIndex, {
                takeId: take.id,
                expectedRevision: switchCurrent.expectedRevision,
            });
        },
        onSuccess: async (result, take) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["drama", projectId, "takes"] }),
                queryClient.invalidateQueries({ queryKey: dramaKeys.episode(projectId, switchCurrent?.episodeId || "") }),
                queryClient.invalidateQueries({ queryKey: dramaKeys.summary(projectId), exact: true }),
                queryClient.invalidateQueries({ queryKey: dramaKeys.jobs(projectId) }),
            ]);
            if (result.unchanged) message.info(_creationText("creation.b8be3dd79e3beaad", { value1: take.version }));
            else {
                message.success(_creationText("creation.beef7b33f79c0a87", { value1: take.version }));
                if (result.videoError) message.warning(result.videoError);
            }
            onPreview?.(take);
        },
        onError: (error) => {
            if (error instanceof ApiError && error.reason === DRAMA_ERROR_REASON.segmentChanged) {
                message.warning(_creationText("creation.db76ba462bed454c"));
                void queryClient.invalidateQueries({ queryKey: dramaKeys.episode(projectId, switchCurrent?.episodeId || "") });
                return;
            }
            message.error(error instanceof Error && error.message ? error.message : _creationText("creation.93f467b02c5633e2"));
        },
    });
    const takes = query.data?.takes || [];
    if (query.isError) return <p className="drama-sg-note is-warn">{_creationText("creation.fb6195750faefa42")}</p>;
    if (!takes.length) return null;
    const previewable = Boolean(onPreview);
    const switchable = kind === "video" && Boolean(switchCurrent);
    return (
        <section className="drama-takes" aria-label={_creationText("creation.77426c9420083d5d")}>
            <div className="drama-takes-head">
                <History className="size-3.5" aria-hidden />
                <span>{_creationText("creation.77426c9420083d5d")}</span>
                <small>{takes.length}</small>
            </div>
            <ol className="drama-takes-list">
                {takes.slice(0, limit).map((take) => {
                    const previewing = previewTakeId === take.id && !take.current;
                    const className = [take.current ? "is-current" : "", previewing ? "is-preview" : ""].filter(Boolean).join(" ") || undefined;
                    const meta = takeMeta(take);
                    const body = (
                        <>
                            {kind === "cast" ? (
                                <span className="drama-take-thumb">
                                    <MediaThumb resourceId={take.resourceId} alt={`V${take.version}`} />
                                </span>
                            ) : null}
                            <b>V{take.version}</b>
                            <span className={`drama-take-source is-${take.source}`}>{SOURCE_LABEL[take.source]}</span>
                            {meta ? <span className="drama-take-meta">{meta}</span> : null}
                            <time dateTime={take.createdAt}>{formatRelativeTime(take.createdAt)}</time>
                        </>
                    );
                    return (
                        <li key={take.id} className={className}>
                            {previewable ? (
                                <button
                                    type="button"
                                    className="drama-take-preview"
                                    onClick={() => onPreview?.(take)}
                                    aria-pressed={previewTakeId === take.id}
                                    aria-label={take.current ? _creationText("creation.71577cd4db8d9051", { value1: take.version }) : _creationText("creation.1befcad1a6e6ba5a", { value1: take.version })}
                                >
                                    {body}
                                </button>
                            ) : (
                                body
                            )}
                            {take.current ? <em>{_creationText("creation.cb62ebd689ee8f20")}</em> : previewing ? <em>{_creationText("creation.c0f435c7a0088208")}</em> : null}
                            {switchable && !take.current ? (
                                <Popconfirm
                                    title={_creationText("creation.d2bc626a2616ef9a", { value1: take.version })}
                                    description={_creationText("creation.26199fe9c06249db")}
                                    okText={_creationText("creation.21c86745003a85eb")}
                                    cancelText={_creationText("common.cancel")}
                                    onConfirm={() => restore.mutate(take)}
                                >
                                    <Button size="small" type="link" className="drama-take-switch" loading={restore.isPending && restore.variables?.id === take.id} disabled={restore.isPending} onClick={(event) => event.stopPropagation()}>
                                        {_creationText("creation.21c86745003a85eb")}
                                    </Button>
                                </Popconfirm>
                            ) : null}
                        </li>
                    );
                })}
            </ol>
            {takes.length > limit ? <p className="drama-takes-more">{_creationText("creation.198b5c055d503ec5", { value1: takes.length - limit })}</p> : null}
        </section>
    );
}

function takeMeta(take: DramaTake) {
    const parts: string[] = [];
    if (take.durationMs) parts.push(secondsLabel(take.durationMs).replace(/s$/, " 秒"));
    if (take.model) parts.push(shortModelName(take.model));
    return parts.join(" · ");
}

/** 版本行里的模型名去掉渠道前缀，避免右侧窄栏被撑出横向滚动。 */
export function shortModelName(model: string) {
    return model.replace(/^(wb-|wb_|ohmybb-)/i, "").replace(/^minimax-/i, "");
}
