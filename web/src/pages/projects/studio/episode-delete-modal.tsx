import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { App, Input } from "antd";
import { AlertTriangle } from "lucide-react";

import { AppModal } from "@/components/ui/product/app-modal";
import { deleteDramaEpisode, DRAMA_ERROR_REASON, type DramaEpisodeRow } from "@/services/api/drama";
import { ApiError } from "@/services/api/request";

// 删除一集：生成过分镜视频的集要输入“第 N 集”才能删除，没有视频的集确认一次即可。
// 是否生成过以服务端为准：集列表统计不到重新改编前的旧视频，服务端要求确认时再切到输入确认。

const compact = (value: string) => value.replace(/\s+/g, "");

export function EpisodeDeleteModal({
    projectId,
    episode,
    blockedReason,
    onClose,
    onDeleted,
}: {
    projectId: string;
    /** 为 null 时不显示。 */
    episode: DramaEpisodeRow | null;
    blockedReason?: string;
    onClose: () => void;
    onDeleted: (episodeId: string) => void;
}) {
    _useCreationLocale();
    return episode ? <DeleteEpisodeDialog key={episode.id} projectId={projectId} episode={episode} blockedReason={blockedReason} onClose={onClose} onDeleted={onDeleted} /> : null;
}

function DeleteEpisodeDialog({ projectId, episode, blockedReason, onClose, onDeleted }: { projectId: string; episode: DramaEpisodeRow; blockedReason?: string; onClose: () => void; onDeleted: (episodeId: string) => void }) {
    _useCreationLocale();
    const { message } = App.useApp();
    const videos = episode.stats.videoGenerated;
    const [confirmText, setConfirmText] = useState<string | null>(videos > 0 || episode.finalResourceId ? `第 ${episode.number} 集` : null);
    const [typed, setTyped] = useState("");
    const matches = confirmText !== null && compact(typed) === compact(confirmText);
    const remove = useMutation({
        mutationFn: () => deleteDramaEpisode(projectId, episode.id, confirmText !== null ? typed.trim() : undefined),
        onSuccess: () => {
            message.success(_creationText("creation.beab90f3c6e88443", { value1: episode.number }));
            onDeleted(episode.id);
        },
        onError: (error) => {
            if (error instanceof ApiError && error.reason === DRAMA_ERROR_REASON.episodeConfirmRequired) {
                const text = error.details?.confirmText;
                setConfirmText(typeof text === "string" && text ? text : `第 ${episode.number} 集`);
                setTyped("");
                message.warning(error.message);
                return;
            }
            message.error(error instanceof Error ? error.message : _creationText("creation.c228558cf257fc49"));
        },
    });
    const canSubmit = !blockedReason && (confirmText === null || matches);
    const submit = () => {
        if (canSubmit && !remove.isPending) remove.mutate();
    };
    return (
        <AppModal
            open
            centered
            width={480}
            rootClassName="drama-root"
            title={_creationText("creation.a9b23e176fbeb2d7", { value1: episode.number })}
            okText={_creationText("creation.8bbbf2450b0d06c9")}
            cancelText={_creationText("common.cancel")}
            okButtonProps={{ danger: true, disabled: !canSubmit }}
            confirmLoading={remove.isPending}
            onOk={submit}
            onCancel={onClose}
        >
            <div className="drama-episode-delete">
                <p>{_creationText("creation.1adaea005ab0a093", { value1: episode.title })}</p>
                {confirmText !== null ? (
                    <>
                        <div className="drama-episode-delete-warn" role="alert">
                            <AlertTriangle className="size-4 shrink-0" />
                            <span>
                                {_creationText("creation.4e4551579a29d421")}
                                {videos > 0 ? _creationText("creation.ebe9e2d6af9acda4", { value1: videos }) : ""}
                                {episode.finalResourceId ? _creationText("creation.5f507b0d68f56167") : ""}
                                {_creationText("creation.fb02202e2d5bebd4")}
                            </span>
                        </div>
                        <label className="drama-episode-delete-field">
                            <span>
                                {_creationText("creation.60120ff05f5c62b9")}
                                <b>{confirmText}</b>
                                {_creationText("common.confirm_delete")}
                            </span>
                            <Input
                                autoFocus
                                value={typed}
                                placeholder={confirmText}
                                aria-label={_creationText("creation.66fcdaf9c594fffd", { value1: confirmText })}
                                disabled={Boolean(blockedReason)}
                                onChange={(event) => setTyped(event.target.value)}
                                onPressEnter={submit}
                            />
                        </label>
                    </>
                ) : null}
                {blockedReason ? (
                    <div className="drama-composer-notice">
                        <AlertTriangle className="size-4 shrink-0" />
                        {blockedReason}
                    </div>
                ) : null}
            </div>
        </AppModal>
    );
}
