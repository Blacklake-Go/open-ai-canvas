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
}: {
    projectId: string;
    title: string;
    detail: DramaEpisodeDetail;
    aspectRatio: string;
    onOpenSegment: (index: number) => void;
    /** 把各段视频按成片顺序载入精修画布的时间线，在画布里精剪。 */
    onOpenCut: () => void;
    cutOpening: boolean;
}) {
    _useCreationLocale();
    const { episode, segments } = detail;
    const { message } = App.useApp();
    const [exportingDraft, setExportingDraft] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const url = useResourceMediaUrl(episode.finalResourceId, "playback");
    const readySegments = segments.filter((segment) => segment.videoResourceId && (segment.videoStatus === "ready" || segment.videoStatus === "stale")).length;
    const starts: number[] = [];
    segments.reduce((cursor, segment) => {
        starts.push(cursor);
        return cursor + (segment.request.seconds || segment.durationMs / 1000);
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
                            <span>{_creationText("creation.2beb59ff97110693", { value1: STAGE_LABEL[episode.stage] })}</span>
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
                        {_creationText("creation.c1d89610837b527b")}
                    </p>
                ) : null}
                <Button icon={<Download className="size-4" />} disabled={!episode.finalResourceId} onClick={download}>
                    {_creationText("creation.a926ee400ac9108e")}
                </Button>
                <Button icon={<Scissors className="size-4" />} disabled={!readySegments} loading={cutOpening} onClick={onOpenCut}>
                    {_creationText("creation.cdb1d5eb1abd3cb0")}
                </Button>
                <Button icon={<Clapperboard className="size-4" />} disabled={!readySegments} onClick={() => setExportingDraft(true)} title={_creationText(readySegments ? "projects.export_draft_hint" : "projects.no_segment_video")}>
                    {_creationText("projects.export_draft")}
                </Button>
                {readySegments ? <p className="drama-editor-note">{_creationText("projects.editor_export_note", { count: readySegments })}</p> : null}
            </aside>
            {exportingDraft ? <JianyingDraftModal open projectId={projectId} episodeId={episode.id} episodeLabel={`第 ${episode.number} 集`} readySegments={readySegments} onClose={() => setExportingDraft(false)} /> : null}
        </div>
    );
}
