import { useEffect, useMemo, useRef, useState } from "react";
import { MusicAdvancedDialog } from "../components/music-advanced-dialog";
import { musicOutputLabel, trackSource, type MusicSource } from "../services/music-tools";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowDownUp, AudioLines, Check, Disc3, FolderOpen, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { TrackList } from "../components/track-list";
import { MusicTrimDialog } from "../components/music-trim-dialog";
import { getMusicAssetHref, saveMusicClip } from "../services/music-assets";
import { groupMusicHistory } from "../services/workspace-list";
import type { MusicTask, MusicOutput } from "../services/music-api";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { AppDrawer } from "@/components/ui/product/app-drawer";
import { IconButton } from "@/components/ui/base/buttons";
import { useUserStore } from "@/stores/use-user-store";
import { selectPluginEffectivelyEnabled, usePluginStore } from "@/stores/use-plugin-store";
import { useI18n } from "@/supdance/plugins/i18n";
import { selectPlayerWork, useMusicStore } from "../stores/use-music-store";
import { SUPDANCE_MUSIC_PLUGIN_ID } from "../types";
import { MusicForm } from "../components/music-form";
import { MusicTrackPlayer } from "../components/music-track-player";
import { MusicExpandedPlayer } from "../components/music-expanded-player";
import { MusicTaskDetails } from "../components/music-task-details";
import { WaveformPlayer } from "../components/waveform-player";
import "../styles/music-workbench.css";
import "../styles/music-track-page.css";

const musicEnabled = selectPluginEffectivelyEnabled(SUPDANCE_MUSIC_PLUGIN_ID);
export default function MusicWorkbenchPage() {
    const userId = useUserStore((s) => s.user?.id);
    return <MusicStudio key={userId || "guest"} userId={userId} />;
}

function MusicStudio({ userId }: { userId?: string }) {
    const { t, locale } = useI18n();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const favoriteKey = "supdance:music:favorites:" + userId;
    const [favorites, setFavorites] = useState<Set<string>>(() => {
        try {
            const stored: unknown = JSON.parse(localStorage.getItem(favoriteKey) || "[]");
            return new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : []);
        } catch {
            return new Set();
        }
    });
    const favorite = (output: MusicOutput) => {
        const next = new Set(favorites);
        if (next.has(output.id)) next.delete(output.id);
        else next.add(output.id);
        setFavorites(next);
        try {
            localStorage.setItem(favoriteKey, JSON.stringify([...next]));
        } catch {
            /* Keep session favorites in private browsing. */
        }
    };
    const [oldestFirst, setOldestFirst] = useState(false);
    const studio = useRef<HTMLDivElement>(null);
    const [detailOutput, setDetailOutput] = useState<string>();
    const [advanced, setAdvanced] = useState<{ source?: MusicSource; lyrics?: string } | null>(null);
    function showSubmitted() {
        setSearch("");
        setFilter("all");
        setOldestFirst(false);
        setMobile("library");
    }
    const [trim, setTrim] = useState<{ task: MusicTask; output: MusicOutput } | null>(null);
    const [savedHref, setSavedHref] = useState("");
    const openTrim = (task: MusicTask, output: MusicOutput) => {
        useMusicStore.getState().pauseAudio();
        setDetailId(null);
        setSavedHref("");
        setTrim({ task, output });
    };
    const enabled = usePluginStore(musicEnabled);
    const tasks = useMusicStore((s) => s.tasks);
    const historyPage = useMusicStore((s) => s.historyPage);
    const historyTotal = useMusicStore((s) => s.historyTotal);
    const loading = useMusicStore((s) => s.loadingTasks);
    const loadError = useMusicStore((s) => s.loadError);
    const loadTasks = useMusicStore((s) => s.loadTasks);
    const selected = useMusicStore(selectPlayerWork);
    const playingId = useMusicStore((s) => s.playingTaskId);
    const [selectedOutputId, setSelectedOutputId] = useState<string>();
    const [lyricsExpanded, setLyricsExpanded] = useState(false);
    const [mobile, setMobile] = useState<"create" | "player" | "library">(() => (searchParams.get("tab") === "library" ? "library" : "create"));
    const [filter, setFilter] = useState("all");
    const [showFilters, setShowFilters] = useState(false);
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
    const days = useMemo(() => groupMusicHistory(tasks, search, filter, oldestFirst, favorites, locale), [tasks, search, filter, oldestFirst, favorites, locale]);
    const works = useMemo(() => tasks.filter((task) => task.status === "completed").flatMap((task) => (task.outputs || []).map((output) => ({ task, output }))), [tasks]);
    const playingOutput = selected?.outputs?.find((item) => item.id === playingId);
    const track = works.find(({ output }) => output.id === selectedOutputId) ?? (selected && playingOutput ? { task: selected, output: playingOutput } : undefined) ?? works.find(({ output }) => output.audioUrl) ?? works[0];
    const playable = useMemo(() => works.filter(({ output }) => output.audioUrl), [works]);
    const trackIndex = playable.findIndex(({ output }) => output.id === track?.output.id);
    const chooseTrack = (output: MusicOutput) => {
        setSelectedOutputId(output.id);
        setMobile("player");
        const playback = useMusicStore.getState();
        if (playback.playingTaskId !== output.id) playback.pauseAudio();
    };
    const playTrack = (output: MusicOutput) => {
        setSelectedOutputId(output.id);
        if (output.audioUrl) useMusicStore.getState().playAudio(output.id, output.audioUrl);
    };
    const trackNavigation = {
        previous: trackIndex > 0 ? () => playTrack(playable[trackIndex - 1].output) : undefined,
        next: trackIndex >= 0 && trackIndex + 1 < playable.length ? () => playTrack(playable[trackIndex + 1].output) : undefined,
    };
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
        <WorkspacePage fluid scroll={false} className="creation-home plugin-music-generation music-workbench-page">
            <div ref={studio} className="music-studio-shell" translate="no" data-i18n-ignore="true" data-plugin-scope="supdance-music-generation">
                <div className="music-mobile-tabs" role="group" aria-label={t("music.studio_title")}>
                    {(["create", "player", "library"] as const).map((tab) => (
                        <button type="button" key={tab} aria-pressed={mobile === tab} onClick={() => setMobile(tab)}>
                            {t(tab === "create" ? "music.create_music" : tab === "player" ? "music.track_playing_panel" : "music.my_works")}
                        </button>
                    ))}
                </div>
                <div className="music-studio-columns">
                    <section className={`music-composer ${mobile === "create" ? "is-mobile-active" : ""}`}>
                        <div className="music-composer-heading">
                            <h1>{t("music.compose_heading")}</h1>
                            {enabled && userId && <IconButton icon={SlidersHorizontal} className="size-11" aria-label={t("music.adv_tools")} title={t("music.adv_tools")} onClick={() => setAdvanced({})} />}
                        </div>
                        {enabled && userId ? <MusicForm userId={userId} onSubmitted={showSubmitted} /> : <p role="status">{t("music.generation_disabled", undefined, "New music generation is disabled. Your tasks and saved works remain available.")}</p>}
                    </section>
                    <section className={`music-stage ${mobile === "player" ? "is-mobile-active" : ""}`} aria-label={t("music.track_playing_panel")}>
                        {track ? (
                            <MusicTrackPlayer key={track.output.id} studio task={track.task} output={track.output} refreshing={loading} onRefresh={() => void loadTasks()} onExpand={() => setLyricsExpanded(true)} />
                        ) : (
                            <div className="music-stage-empty" role="status">
                                <AudioLines size={32} aria-hidden />
                                <h2>{t("music.track_playing_panel")}</h2>
                                <p>{t(loading ? "common.loading" : "music.track_playing_empty")}</p>
                            </div>
                        )}
                    </section>
                    <section className={`music-library ${mobile === "library" ? "is-mobile-active" : ""}`} aria-label={t("music.my_works")}>
                        <div className="music-library-header">
                            <div className="music-library-heading">
                                <h2>{t("music.my_works")}</h2>
                            </div>
                            <div className="music-header-actions">
                                <IconButton icon={FolderOpen} className="size-11" aria-label={t("music.assets_heading")} title={t("music.assets_heading")} onClick={() => void navigate("/assets")} />
                                <IconButton icon={RefreshCw} className="size-11" title={t("music.refresh_works")} aria-label={t("music.refresh_works")} onClick={() => void loadTasks()} disabled={loading} />
                            </div>
                        </div>
                        <div className="music-tools">
                            <label className="music-search">
                                <Search size={16} aria-hidden />
                                <input type="search" aria-label={t("music.search_works")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("music.search_works")} />
                            </label>
                            <IconButton
                                icon={SlidersHorizontal}
                                className="size-11"
                                aria-pressed={showFilters || filter !== "all"}
                                title={t("music.workspace_filters")}
                                aria-label={t("music.workspace_filters")}
                                onClick={() => setShowFilters(!showFilters)}
                            />
                            <IconButton
                                icon={ArrowDownUp}
                                className="size-11"
                                aria-pressed={oldestFirst}
                                title={t(oldestFirst ? "music.order_old" : "music.order_new")}
                                aria-label={t(oldestFirst ? "music.order_old" : "music.order_new")}
                                onClick={() => setOldestFirst(!oldestFirst)}
                            />
                        </div>
                        {showFilters && (
                            <div className="music-filters" role="group" aria-label={t("music.filter_works")}>
                                {["all", "favorites", "instrumental", "generating", "completed", "failed"].map((status) => (
                                    <button type="button" key={status} aria-pressed={filter === status} onClick={() => setFilter(status)}>
                                        {t("music.filter_" + status)}
                                    </button>
                                ))}
                            </div>
                        )}
                        {savedHref && (
                            <div className="music-saved-clip" role="status">
                                <Check size={16} />
                                {t("music.clip_saved")}
                                <IconButton icon={FolderOpen} className="size-11" aria-label={t("music.manage_in_assets")} title={t("music.manage_in_assets")} onClick={() => void navigate(savedHref)} />
                            </div>
                        )}
                        {loadError && (
                            <p role="alert" className="text-destructive">
                                {loadError}
                            </p>
                        )}
                        <div className="music-work-list">
                            {loading && !tasks.length ? (
                                <p role="status">{t("common.loading")}</p>
                            ) : days.size ? (
                                [...days].map(([day, list]) => (
                                    <section key={day} className="music-day">
                                        <h3>{day}</h3>
                                        {list.map((task) => (
                                            <TrackList
                                                key={task.taskId}
                                                task={task}
                                                favorites={favorites}
                                                onlyFavorites={filter === "favorites"}
                                                selectedOutputId={track?.output.id}
                                                onSelect={chooseTrack}
                                                onFavorite={favorite}
                                                onDetails={(output) => {
                                                    setDetailId(task.taskId);
                                                    setDetailOutput(output?.id);
                                                }}
                                                onAdvanced={enabled && userId ? (output) => setAdvanced({ source: trackSource(task, output, musicOutputLabel(output, t)), lyrics: task.lyrics }) : undefined}
                                                onTrim={(output) => openTrim(task, output)}
                                                onAsset={async (output) => {
                                                    void navigate(await getMusicAssetHref(task, output));
                                                }}
                                            />
                                        ))}
                                    </section>
                                ))
                            ) : (
                                <p className="music-empty">
                                    <Disc3 size={36} aria-hidden />
                                    {t(
                                        search || filter !== "all" ? "music.no_matching_works" : "music.empty_works",
                                        undefined,
                                        search || filter !== "all" ? "No works match this search." : "Your music will appear here. Start with a description or your own lyrics.",
                                    )}
                                </p>
                            )}
                        </div>
                        {tasks.length < historyTotal && (
                            <button type="button" className="music-load-more min-h-11 rounded-lg border border-border px-4" disabled={loading} onClick={() => void loadTasks(historyPage + 1)}>
                                {t("music.load_more_works")}
                            </button>
                        )}
                    </section>
                </div>
                {track && (
                    <WaveformPlayer
                        key={track.output.id}
                        taskId={track.output.id}
                        audioUrl={track.output.audioUrl}
                        title={track.task.title}
                        durationSeconds={(track.output.durationMs || 0) / 1000}
                        output={track.output}
                        navigation={trackNavigation}
                        onToggleLyrics={() => setLyricsExpanded(true)}
                    />
                )}
                {track && <MusicExpandedPlayer task={track.task} output={track.output} open={lyricsExpanded} onClose={() => setLyricsExpanded(false)} navigation={trackNavigation} />}
                <AppDrawer rootClassName="plugin-music-generation" open={Boolean(detail)} onClose={() => setDetailId(null)} title={detail?.title || t("music.default_track_title")}>
                    {detail && (
                        <MusicTaskDetails
                            task={detail}
                            selectedOutputId={detailOutput}
                            onReuse={reuse}
                            onTrim={(output) => openTrim(detail, output)}
                            onAsset={async (output) => {
                                void navigate(await getMusicAssetHref(detail, output));
                            }}
                        />
                    )}
                </AppDrawer>
                {advanced && enabled && userId && (
                    <MusicAdvancedDialog
                        userId={userId}
                        initialSource={advanced.source}
                        initialOp={advanced.source ? "remix" : "reference"}
                        initialLyrics={advanced.lyrics}
                        onClose={() => setAdvanced(null)}
                        onSubmitted={() => {
                            setAdvanced(null);
                            showSubmitted();
                        }}
                    />
                )}
                {trim && (
                    <MusicTrimDialog
                        returnFocusTo={studio.current?.querySelector<HTMLButtonElement>('[data-output-id="' + CSS.escape(trim.output.id) + '"] .music-track-actions-trigger')}
                        url={trim.output.audioUrl || ""}
                        storageKey={trim.output.storageKey}
                        title={[trim.task.title || t("music.default_track_title"), musicOutputLabel(trim.output, t)].join(" · ")}
                        onClose={() => setTrim(null)}
                        onPreviewStart={() => useMusicStore.getState().pauseAudio()}
                        onSave={async ({ blob, start, end }) => {
                            const asset = await saveMusicClip(trim.task, trim.output, blob, { start, end });
                            setSavedHref(asset.href);
                        }}
                    />
                )}
            </div>
        </WorkspacePage>
    );
}
