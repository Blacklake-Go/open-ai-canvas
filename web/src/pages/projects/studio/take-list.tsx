import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { dramaKeys } from "@/lib/drama/drama-query-keys";
import { formatRelativeTime } from "@/lib/relative-time";
import { listDramaTakes, type DramaTakeKind, type DramaTakeSource } from "@/services/api/drama";

import { MediaThumb } from "../drama-shared";

const SOURCE_LABEL: Record<DramaTakeSource, string> = { pipeline: "生成", upload: "上传", canvas: "来自画布" };

/** 设定参考图、剧情段视频或成片的版本记录，新版本在前；标出来源（流水线生成、上传、从精修画布采用）与当前版本。 */
export function DramaTakeList({ projectId, ownerId, kind, limit = 6 }: { projectId: string; ownerId: string; kind: DramaTakeKind; limit?: number }) {
    _useCreationLocale();
    const query = useQuery({
        queryKey: dramaKeys.takes(projectId, kind, ownerId),
        queryFn: ({ signal }) => listDramaTakes(projectId, ownerId, kind, signal),
        enabled: Boolean(projectId && ownerId),
        staleTime: 10_000,
    });
    const takes = query.data?.takes || [];
    if (query.isError) return <p className="drama-sg-note is-warn">{_creationText("creation.fb6195750faefa42")}</p>;
    if (!takes.length) return null;
    return (
        <section className="drama-takes" aria-label={_creationText("creation.77426c9420083d5d")}>
            <div className="drama-takes-head">
                <History className="size-3.5" aria-hidden />
                <span>{_creationText("creation.77426c9420083d5d")}</span>
                <small>{takes.length}</small>
            </div>
            <ol className="drama-takes-list">
                {takes.slice(0, limit).map((take) => (
                    <li key={take.id} className={take.current ? "is-current" : undefined}>
                        {kind === "cast" ? (
                            <span className="drama-take-thumb">
                                <MediaThumb resourceId={take.resourceId} alt={`V${take.version}`} />
                            </span>
                        ) : null}
                        <b>V{take.version}</b>
                        <span className={`drama-take-source is-${take.source}`}>{SOURCE_LABEL[take.source]}</span>
                        <time dateTime={take.createdAt}>{formatRelativeTime(take.createdAt)}</time>
                        {take.current ? <em>{_creationText("creation.cb62ebd689ee8f20")}</em> : null}
                    </li>
                ))}
            </ol>
            {takes.length > limit ? <p className="drama-takes-more">{_creationText("creation.198b5c055d503ec5", { value1: takes.length - limit })}</p> : null}
        </section>
    );
}
