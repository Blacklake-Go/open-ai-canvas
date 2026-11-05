import { useEffect, useState } from "react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { AppDrawer } from "@/components/ui/product/app-drawer";
import { useUserStore } from "@/stores/use-user-store";
import { selectPluginEffectivelyEnabled, usePluginStore } from "@/stores/use-plugin-store";
import { useI18n } from "@/supdance/plugins/i18n";
import { useMusicStore } from "../stores/use-music-store";
import { SUPDANCE_MUSIC_PLUGIN_ID } from "../types";
import { MusicForm } from "../components/music-form";
import { TaskCard } from "../components/task-card";
import { WaveformPlayer } from "../components/waveform-player";
import { MusicTaskDetails } from "../components/music-task-details";
import "../styles/music-workbench.css";

const musicEnabled = selectPluginEffectivelyEnabled(SUPDANCE_MUSIC_PLUGIN_ID);
export default function MusicWorkbenchPage() {
    const { t } = useI18n();
    const userId = useUserStore((s) => s.user?.id);
    const enabled = usePluginStore(musicEnabled);
    const tasks = useMusicStore((s) => s.tasks);
    const historyPage = useMusicStore((s) => s.historyPage);
    const historyTotal = useMusicStore((s) => s.historyTotal);
    const loading = useMusicStore((s) => s.loadingTasks);
    const loadError = useMusicStore((s) => s.loadError);
    const loadTasks = useMusicStore((s) => s.loadTasks);
    const selected = useMusicStore((s) => s.activeTrack);
    const playingId = useMusicStore((s) => s.playingTaskId);
    const [mobile, setMobile] = useState("create");
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [detailId, setDetailId] = useState<string | null>(null);
    useEffect(() => {
        const store = useMusicStore.getState();
        store.resetUser();
        if (userId) {
            void store.loadUserDraft(userId).then(() => useMusicStore.getState().loadCapabilities());
            void store.loadTasks();
        }
        return () => useMusicStore.getState().resetUser();
    }, [userId]);
    const visible = tasks.filter((task) => {
        const status = ["submitted", "queued", "generating", "transcoding"].includes(task.status) ? "generating" : task.status;
        return (filter === "all" || filter === status) && (task.title + " " + task.prompt + " " + task.model).toLowerCase().includes(search.toLowerCase());
    });
    const queue = tasks.flatMap((task) => (task.outputs || []).map((output) => ({ task, output })));
    const track = queue.find((item) => item.output.id === playingId) || queue.find((item) => item.task.taskId === selected?.taskId && item.output.audioUrl);
    const detail = tasks.find((task) => task.taskId === detailId);
    const reuse = () => {
        if (!detail || !userId) return;
        const store = useMusicStore.getState();
        const cap = store.capabilities.find((item) => item.modelKey === detail.model || item.id === detail.model);
        if (cap) store.setModel(cap.id, userId);
        if (cap?.modes.includes(detail.mode)) store.setDraftField("mode", detail.mode, userId);
        store.setDraftField("prompt", detail.prompt, userId);
        store.setDraftField("lyrics", detail.lyrics || "", userId);
        store.setDraftField("title", detail.title || "", userId);
        store.setDraftField("tags", detail.tags || "", userId);
        store.setDraftField("songLanguage", detail.songLanguage || "", userId);
        store.setDraftField("instrumental", detail.instrumental, userId);
        setMobile("create");
        setDetailId(null);
    };
    return (
        <WorkspacePage fluid scroll={false} className="plugin-music-generation music-workbench-page">
            <div className="music-studio-shell" translate="no" data-i18n-ignore="true">
                <div className="music-mobile-tabs" role="group" aria-label={t("music.studio_title")}>
                    {["create", "library"].map((tab) => (
                        <button type="button" key={tab} aria-pressed={mobile === tab} onClick={() => setMobile(tab)}>
                            {t(tab === "create" ? "music.create_music" : "music.my_works")}
                        </button>
                    ))}
                </div>
                <div className="music-studio-columns">
                    <section className={`music-composer ${mobile === "create" ? "is-mobile-active" : ""}`}>
                        <h1>{t("music.studio_title")}</h1>
                        {enabled && userId ? (
                            <MusicForm userId={userId} onSubmitted={() => setMobile("library")} />
                        ) : (
                            <p role="status">{t("music.generation_disabled", undefined, "New music generation is disabled. Your tasks and saved works remain available.")}</p>
                        )}
                    </section>
                    <section className={`music-library ${mobile === "library" ? "is-mobile-active" : ""}`} aria-label={t("music.my_works")}>
                        <div className="music-library-header">
                            <h2>{t("music.my_works")}</h2>
                            <button type="button" onClick={() => void loadTasks()} disabled={loading}>
                                {t("music.refresh_works")}
                            </button>
                        </div>
                        <label className="music-search">
                            <span className="sr-only">{t("music.search_works", undefined, "Search works")}</span>
                            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("music.search_works", undefined, "Search works")} />
                        </label>
                        <div className="music-filters" role="group" aria-label={t("music.filter_works", undefined, "Filter works")}>
                            {["all", "generating", "completed", "failed"].map((status) => (
                                <button type="button" key={status} aria-pressed={filter === status} onClick={() => setFilter(status)}>
                                    {t("music.filter_" + status, undefined, status)}
                                </button>
                            ))}
                        </div>
                        {loadError && (
                            <p role="alert" className="text-destructive">
                                {loadError}
                            </p>
                        )}
                        <div className="music-work-list">
                            {loading && !tasks.length ? (
                                <p role="status">{t("common.loading")}</p>
                            ) : visible.length ? (
                                visible.map((task) => <TaskCard key={task.taskId} task={task} onDetails={() => setDetailId(task.taskId)} />)
                            ) : (
                                <p className="music-empty">
                                    {t(
                                        search || filter !== "all" ? "music.no_matching_works" : "music.empty_works",
                                        undefined,
                                        search || filter !== "all" ? "No works match this search." : "Your music will appear here. Start with a description or your own lyrics.",
                                    )}
                                </p>
                            )}
                        </div>
                        {tasks.length < historyTotal && (
                            <button type="button" className="min-h-11 rounded-lg border border-border px-4" disabled={loading} onClick={() => void loadTasks(historyPage + 1)}>
                                {t("music.load_more_works")}
                            </button>
                        )}
                    </section>
                </div>
                {track?.output.audioUrl && <WaveformPlayer taskId={track.output.id} audioUrl={track.output.audioUrl} title={track.task.title} durationSeconds={(track.output.durationMs || 0) / 1000} output={track.output} />}
                <AppDrawer rootClassName="plugin-music-generation" open={Boolean(detail)} onClose={() => setDetailId(null)} title={detail?.title || t("music.default_track_title")}>
                    {detail && <MusicTaskDetails task={detail} onReuse={reuse} />}
                </AppDrawer>
            </div>
        </WorkspacePage>
    );
}
