import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bot, ChevronRight, Disc3 } from "lucide-react";
import { Button } from "antd";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { WorkspaceErrorState, WorkspaceLoadingState, WorkspaceState } from "@/components/layout/workspace-state";
import { IconButton } from "@/components/ui/base/buttons";
import { translate } from "@/i18n";
import { ApiError } from "@/services/api/request";
import { useGlobalAgentStore } from "@/stores/use-global-agent-store";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/supdance/plugins/i18n";
import { MusicTrackPlayer } from "../components/music-track-player";
import { querySiteMusicTask } from "../services/music-site-api";
import { musicOutputLabel } from "../services/music-tools";
import { musicLibraryPath, musicTrackHref, parseMusicOutputIndex } from "../services/music-track-route";
import "../styles/music-track-page.css";

export default function MusicTrackPage() {
    const { taskId, outputIndex: rawIndex } = useParams();
    const outputIndex = parseMusicOutputIndex(rawIndex);
    const userId = useUserStore((s) => s.user?.id);
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useI18n();
    const from = location.state?.from;
    const fromCreate = typeof from === "string" && /^(\/create|\/)(\?[^#]*)?$/.test(from);
    const back = fromCreate ? from : musicLibraryPath;

    return (
        <WorkspacePage fluid scroll={false} className="creation-home plugin-scope-supdance-music-generation plugin-music-track-page">
            <div className="plugin-music-track-scroll app-workspace-scroll">
                <div className="plugin-music-track-shell" data-plugin-scope="supdance-music-generation" data-i18n-ignore="true">
                    <div className="plugin-music-track-toolbar plugin-music-track-navigation">
                        <Button htmlType="button" icon={<ArrowLeft size={16} aria-hidden />} className="min-h-11" onClick={() => void navigate(back)}>
                            {t(fromCreate ? "music.track_back_to_create" : "music.track_back_to_studio")}
                        </Button>
                        <IconButton icon={Bot} className="size-11" aria-label={translate("shell.palette.agent")} title={translate("shell.palette.agent")} onClick={() => useGlobalAgentStore.getState().openAgent()} />
                    </div>
                    {userId && taskId && outputIndex !== undefined ? (
                        <MusicTrackContent key={JSON.stringify([userId, taskId])} userId={userId} taskId={taskId} outputIndex={outputIndex} />
                    ) : (
                        <WorkspaceState kind="no-results" title={t("music.track_unavailable")} />
                    )}
                </div>
            </div>
        </WorkspacePage>
    );
}

function MusicTrackContent({ userId, taskId, outputIndex }: { userId: string; taskId: string; outputIndex: number }) {
    const { t } = useI18n();
    const { state } = useLocation();
    const refreshAudio = useRef(false);
    const query = useQuery({
        queryKey: ["music-track", userId, taskId],
        queryFn: ({ signal }) => {
            const forceRefreshAudio = refreshAudio.current;
            refreshAudio.current = false;
            return querySiteMusicTask(taskId, false, { signal, forceRefreshAudio });
        },
        gcTime: 0,
        retry: false,
        refetchOnWindowFocus: false,
    });
    const task = query.data;

    if (query.isPending) return <WorkspaceLoadingState label={t("music.player_title")} rows={2} />;
    const denied = query.error instanceof ApiError && [403, 404].includes(query.error.status || 0);
    const unavailable = denied || (task && (task.userId !== userId || task.taskId !== taskId || task.status !== "completed"));
    if (unavailable) return <WorkspaceState kind="no-results" title={t("music.track_unavailable")} />;
    if (!task) return <WorkspaceErrorState title={t("music.track_load_failed")} onRetry={() => void query.refetch()} />;
    const output = task.outputs?.find((candidate) => candidate.outputIndex === outputIndex);
    if (!output) return <WorkspaceState kind="no-results" title={t("music.track_unavailable")} />;
    const otherOutputs = task.outputs || [];

    return (
        <>
            {query.isRefetchError && (
                <p className="creation-music-track-error" role="alert">
                    {t("music.track_load_failed")}
                </p>
            )}
            <MusicTrackPlayer
                key={output.id}
                task={task}
                output={output}
                refreshing={query.isFetching}
                onRefresh={() => {
                    refreshAudio.current = true;
                    void query.refetch();
                }}
            />
            {otherOutputs.length > 1 && (
                <section className="creation-music-card plugin-music-track-versions" aria-labelledby="music-track-versions-heading">
                    <h2 id="music-track-versions-heading" className="creation-music-card-title">
                        {t("music.track_versions")}
                    </h2>
                    <ul>
                        {otherOutputs.map((track) => (
                            <li key={track.id}>
                                <Link
                                    className={`product-collection-card creation-music-song-card${track.id === output.id ? " is-selected" : ""}`}
                                    to={musicTrackHref({ taskId, outputIndex: track.outputIndex })}
                                    replace
                                    state={state}
                                    aria-current={track.id === output.id ? "page" : undefined}
                                >
                                    <Disc3 size={18} aria-hidden />
                                    <span>{musicOutputLabel(track, t)}</span>
                                    <ChevronRight className="creation-music-song-chevron" aria-hidden />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
}
