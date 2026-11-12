import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useRef, useState } from "react";
import { App, Button } from "antd";
import { Clapperboard, Download, Film, Scissors } from "lucide-react";

import type { DramaEpisodeDetail } from "@/services/api/drama";

import { aspectRatioValue, downloadResource, formatDuration, MediaThumb, STAGE_LABEL, useResourceMediaUrl } from "../drama-shared";
import { JianyingDraftModal } from "./asset-transfer";
import { secondsLabel } from "./segment-parts";

/** 成片：各剧情段视频按顺序拼接，保留视频模型生成的对白与音效。片段条可跳到对应段并打开该段详情。 */
export function FinalView({
    projectId,
    title,
    detail,
    aspectRatio,
    onOpenSegment,
    onOpenCut,
    cutOpening,
    onCompose,
    composing,
}: {
    projectId: string;
    title: string;
    detail: DramaEpisodeDetail;
    aspectRatio: string;
    onOpenSegment: (index: number) => void;
    /** 把各段视频按成片顺序载入精修画布的时间线，在画布里精剪。 */
    onOpenCut: () => void;
    cutOpening: boolean;
    /** 手动重新合成成品（按实测时长拼接）。 */
    onCompose: () => void;
    composing: boolean;
}) {
    _useCreationLocale();
    const { episode } = detail;
    const segments = [...detail.segments].sort((left, right) => left.index - right.index);
    const { message } = App.useApp();
    const [exportingDraft, setExportingDraft] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const url = useResourceMediaUrl(episode.finalResourceId, "playback");
    const readySegments = segments.filter((segment) => segment.videoResourceId && (segment.videoStatus === "ready" || segment.videoStatus === "stale")).length;
    // 合成要求各段为 ready（过期段需先重新生成）；与后端 timeline 校验一致。
    const composeReady = segments.length > 0 && segments.every((segment) => segment.videoStatus === "ready" && segment.videoResourceId);
    const rendering = episode.stage === "render";
    const composeBusy = composing || rendering;
    const starts: number[] = [];
    segments.reduce((cursor, segment) => {
        starts.push(cursor);
        return cursor + (segment.videoSeconds || segment.request.seconds || segment.durationMs / 1000);
    }, 0);
    const download = () => {
        if (!episode.finalResourceId) return;
        void downloadResource(episode.finalResourceId, `${title}-第${episode.number}集.mp4`).catch((error) => message.error(error instanceof Error ? error.message : _creationText("creation.8a03e35ad323e387")));
    };
    return (
        <div className="drama-finalv">
            <div className="drama-finalv-stage">
                <div className="drama-finalv-player" style={{ aspectRatio: aspectRatioValue(aspectRatio) }}>
                    {url ? (
                        <video ref={videoRef} key={url} src={url} controls playsInline />
                    ) : (
                        <div className="drama-finalv-empty">
                            <Film className="size-6" aria-hidden />
                            <span>
                                {STAGE_LABEL[episode.stage]} · {rendering ? _creationText("creation.62e4b64415643c15") : _creationText("creation.b4c1014cd2247c3e")}
                            </span>
                        </div>
                    )}
                </div>
                <div className="drama-filmstrip thin-scrollbar">
                    {segments.map((segment, position) => (
                        <button
                            key={segment.id || segment.index}
                            type="button"
                            className="drama-filmstrip-item"
                            title={segment.title}
                            onClick={() => {
                                if (videoRef.current) videoRef.current.currentTime = starts[position];
                                onOpenSegment(segment.index);
                            }}
                        >
                            <MediaThumb resourceId={segment.tailFrameResourceId} alt={segment.title} fallback={<span className="drama-filmstrip-empty" />} />
                            <span>
                                {_creationText("creation.af50a0fe2a50a3d1")}
                                {segment.index + 1}
                                {_creationText("creation.5061056bb842bfbd")}
                                {secondsLabel(segment.durationMs)}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
            <aside className="drama-finalv-side">
                <h2>{_creationText("creation.34ac7cbd8058f89f", { value1: episode.number, value2: episode.title })}</h2>
                <p>
                    {formatDuration(episode.durationMs)} · {segments.length}
                    {_creationText("creation.563dcc5b90795320")}
                </p>
                {episode.finalStale ? (
                    <p className="drama-finalv-stale" role="status">
                        {rendering ? _creationText("creation.30a67692906f9a80") : _creationText("creation.c6a3004a1e11fb05")}
                    </p>
                ) : null}
                <Button
                    type="primary"
                    icon={<Film className="size-4" />}
                    disabled={!composeReady}
                    loading={composeBusy}
                    onClick={onCompose}
                    title={composeReady ? (rendering ? _creationText("creation.fb6f39e788652934") : _creationText("creation.53f33fd280413736")) : _creationText("creation.acbb867a87d8ccd7")}
                >
                    {_creationText("creation.a2b6fde16acf346b")}
                </Button>
                <Button icon={<Download className="size-4" />} disabled={!episode.finalResourceId} onClick={download}>
                    {_creationText("creation.a926ee400ac9108e")}
                </Button>
                <Button icon={<Scissors className="size-4" />} disabled={!readySegments} loading={cutOpening} onClick={onOpenCut}>
                    {_creationText("creation.cdb1d5eb1abd3cb0")}
                </Button>
                <Button icon={<Clapperboard className="size-4" />} disabled={!segments.length} onClick={() => setExportingDraft(true)} title={_creationText("creation.jianying.subtitle")}>
                    {_creationText("projects.export_draft")}
                </Button>
                {readySegments ? <p className="drama-editor-note">{_creationText("projects.editor_export_note", { count: readySegments })}</p> : null}
            </aside>
            {exportingDraft ? <JianyingDraftModal open projectId={projectId} episodeId={episode.id} episodeLabel={_creationText("creation.4d7de35611db4bda", { value1: episode.number })} onClose={() => setExportingDraft(false)} /> : null}
        </div>
    );
}
