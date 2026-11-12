import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button, Input, Skeleton } from "antd";
import { RefreshCw, Music2, Settings2 } from "lucide-react";
import { AdminPageFrame } from "@/pages/admin/components/admin-shell";
import { AdminStatTile, AdminTableEmpty, SettingsSectionCard } from "@/pages/admin/components/admin-ui";
import { AdminSegmented } from "@/pages/admin/ui/controls";
import { AdminDrawer } from "@/pages/admin/ui/overlays";
import { useI18n } from "@/supdance/plugins/i18n";
import { useUserStore } from "@/stores/use-user-store";
import { MusicForm } from "../components/music-form";
import { MusicTaskDetails } from "../components/music-task-details";
import { TaskCard } from "../components/task-card";
import { WaveformPlayer } from "../components/waveform-player";
import { useMusicStore } from "../stores/use-music-store";
import { siteMusicQuote } from "../services/music-site-api";
import {
    fetchMusicCapabilities,
    fetchMusicAdminOverview,
    listAdminMusicTasks,
    queryAdminMusicTask,
    recoverMusicAdminTest,
    setMusicPluginLifecycle,
    testMusicConnection,
    type ModelCapabilities,
    type MusicLifecycleInfo,
    type MusicTask,
} from "../services/music-api";
import type { LogicalModelQuote } from "@/services/api/logical-models";
import "../styles/music-workbench.css";
import "../styles/music-admin.css";

export default function MusicAdminSettingsPage() {
    const { t } = useI18n();
    const [params] = useSearchParams();
    const userId = useUserStore((s) => s.user?.id);
    const sequence = useRef(0);
    const sharedTasks = useMusicStore((s) => s.tasks);
    const playingId = useMusicStore((s) => s.playingTaskId);
    const selectedTrack = useMusicStore((s) => s.activeTrack);
    const queue = sharedTasks.flatMap((task) => (task.outputs || []).map((output) => ({ task, output })));
    const track = queue.find((item) => item.output.id === playingId) || queue.find((item) => item.task.taskId === selectedTrack?.taskId && item.output.audioUrl);
    const [tab, setTab] = useState(params.get("tab") === "test" ? "test" : "overview");
    const [lifecycle, setLifecycle] = useState<MusicLifecycleInfo | null>(null);
    const [models, setModels] = useState<ModelCapabilities[]>([]);
    const [quotes, setQuotes] = useState<Record<string, LogicalModelQuote | string>>({});
    const [tasks, setTasks] = useState<MusicTask[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [probe, setProbe] = useState(false);
    const [tracked, setTracked] = useState<MusicTask | null>(null);
    const [receiptId, setReceiptId] = useState<string | null>(null);
    const [logId, setLogId] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [detailId, setDetailId] = useState<string | null>(null);
    const detail = tasks.find((task) => task.taskId === detailId) || (tracked?.taskId === detailId ? tracked : null);
    const load = async (nextPage = 1) => {
        const current = ++sequence.current;
        setLoading(true);
        setError("");
        try {
            const [state, caps, result] = await Promise.all([fetchMusicAdminOverview(), fetchMusicCapabilities(), listAdminMusicTasks(undefined, nextPage, 50)]);
            if (current !== sequence.current) return;
            setLifecycle(state);
            setModels(caps);
            setPage(nextPage);
            setTotal(result.total);
            const merge = (previous: MusicTask[]) => (nextPage > 1 ? [...new Map([...previous, ...result.items].map((task) => [task.taskId, task])).values()] : result.items);
            setTasks(merge);
            useMusicStore.setState((state) => ({ capabilities: caps, tasks: merge(state.tasks) }));
            const requestedModel = params.get("model") || useMusicStore.getState().draft.model;
            const selected = caps.find((cap) => cap.id === requestedModel) || caps.find((cap) => cap.available);
            if (selected) useMusicStore.getState().setModel(selected.id);
            const amounts = await Promise.all(
                caps.map(async (cap) => {
                    try {
                        return [cap.id, await siteMusicQuote(cap.id)] as const;
                    } catch (cause) {
                        return [cap.id, cause instanceof Error ? cause.message : String(cause)] as const;
                    }
                }),
            );
            if (current === sequence.current) setQuotes(Object.fromEntries(amounts));
        } catch (cause) {
            if (current === sequence.current) setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            if (current === sequence.current) setLoading(false);
        }
    };
    useEffect(() => {
        let active = true;
        useMusicStore.getState().resetUser();
        setTasks([]);
        setTracked(null);
        setReceiptId(null);
        if (userId) {
            void useMusicStore
                .getState()
                .loadUserDraft(userId)
                .then(() => {
                    if (active) void load();
                });
        }
        return () => {
            active = false;
            sequence.current += 1;
            useMusicStore.getState().resetUser();
        };
    }, [userId]);
    useEffect(() => {
        if (!receiptId) return;
        let active = true;
        let querying = false;
        const timer = setInterval(() => {
            if (querying) return;
            querying = true;
            void queryAdminMusicTask(receiptId)
                .then((task) => {
                    if (!active) return;
                    setTracked(task);
                    useMusicStore.setState((state) => ({ tasks: [task, ...state.tasks.filter((item) => item.taskId !== task.taskId)] }));
                    if (["completed", "failed", "cancelled"].includes(task.status)) clearInterval(timer);
                })
                .catch((cause: unknown) => {
                    if (active) setError(cause instanceof Error ? cause.message : String(cause));
                })
                .finally(() => {
                    querying = false;
                });
        }, 4000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [receiptId, userId]);
    const changeLifecycle = async (state: MusicLifecycleInfo["state"]) => {
        setError("");
        setLoading(true);
        try {
            setLifecycle(await setMusicPluginLifecycle(state));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setLoading(false);
        }
    };
    return (
        <AdminPageFrame
            title={t("music.admin_title")}
            scroll
            actions={
                <Button icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading}>
                    {t("music.refresh_works")}
                </Button>
            }
        >
            <div className="plugin-music-generation music-admin flex min-w-0 flex-col gap-4" translate="no" data-i18n-ignore="true" data-plugin-scope="supdance-music-generation">
                <div className="music-admin-navigation">
                    <AdminSegmented value={tab} onChange={setTab} ariaLabel={t("music.admin_title")} options={["overview", "models", "pricing", "tasks", "test", "settings"].map((key) => ({ value: key, label: t("music.admin_tab_" + key) }))} />
                </div>
                {error && (
                    <p role="alert" className="text-destructive">
                        {error}
                    </p>
                )}
                <Link to="/admin/channels" className="music-admin-link">
                    {t("music.manage_site_channels", undefined, "Manage models, credentials and prices in site channels")}
                </Link>
                {tab === "overview" && (
                    <SettingsSectionCard icon={<Music2 size={16} />} title={t("music.admin_tab_overview")} contentClassName="music-admin-section">
                        {loading && !lifecycle ? (
                            <Skeleton active paragraph={{ rows: 2 }} />
                        ) : (
                            <div className="music-admin-stats">
                                <AdminStatTile label={t("music.admin_plugin_state")} value={lifecycle ? t("music.lifecycle_" + lifecycle.state) : "—"} />
                                <AdminStatTile label={t("music.admin_available_models")} value={lifecycle ? models.filter((model) => model.available).length : "—"} />
                            </div>
                        )}
                        <p>{t("music.admin_credentials_hint", undefined, "A configured model does not prove that provider credentials work. A completed real task verifies generation.")}</p>
                        <p>{t("music.admin_saving_hint", undefined, "Accepted, generated, saved and settled are separate task states.")}</p>
                    </SettingsSectionCard>
                )}
                {(tab === "models" || tab === "pricing") && (
                    <div className="flex flex-col gap-3">
                        {loading && !models.length ? <Skeleton active paragraph={{ rows: 4 }} /> : !models.length && <AdminTableEmpty title={t("music.no_models")} />}
                        {models.map((model) => {
                            const quote = quotes[model.id];
                            return (
                                <article key={model.id} className="music-admin-card flex flex-col gap-2">
                                    <strong translate="no">
                                        {model.name} · {model.modelKey}
                                    </strong>
                                    <p>{model.modes.map((mode) => t("music.mode_" + mode)).join(" / ")} · MP3</p>
                                    {typeof quote === "string" ? (
                                        <p className="text-destructive">{quote}</p>
                                    ) : (
                                        quote && (
                                            <p>
                                                {(quote.amountMicrocredits / 1_000_000).toLocaleString()} · {t("music.billing_" + quote.billingMode)} × {quote.quantity}
                                            </p>
                                        )
                                    )}
                                    <p>{t(model.instrumentalSupported ? "music.instrumental_label" : model.lyricsSupported ? "music.lyrics_editor" : "music.prompt_label")}</p>
                                </article>
                            );
                        })}
                    </div>
                )}
                {tab === "tasks" && (
                    <div className="flex flex-col gap-3">
                        {tasks.map((task) => (
                            <TaskCard key={task.taskId} task={task} onDetails={() => setDetailId(task.taskId)} />
                        ))}
                        {loading && !tasks.length ? <Skeleton active paragraph={{ rows: 4 }} /> : !tasks.length && <AdminTableEmpty title={t("music.empty_works")} />}
                        {tasks.length < total && (
                            <Button loading={loading} onClick={() => void load(page + 1)}>
                                {t("music.load_more_works")}
                            </Button>
                        )}
                    </div>
                )}
                {tab === "test" && (
                    <div className="grid gap-5 lg:grid-cols-2">
                        <section className="music-admin-card flex min-w-0 flex-col gap-4">
                            <Button
                                className="music-admin-wrap-button"
                                onClick={async () => {
                                    try {
                                        await testMusicConnection();
                                        setProbe(true);
                                    } catch (cause) {
                                        setError(cause instanceof Error ? cause.message : String(cause));
                                    }
                                }}
                            >
                                {t("music.admin_check_configuration", undefined, "Check configuration · no generation charge")}
                            </Button>
                            {probe && <p role="status">{t("music.admin_credentials_hint")}</p>}
                            <p>{t("music.admin_paid_test", undefined, "Creating a test is a real paid generation. Review the model, inputs, current price and balance before submitting.")}</p>
                            {userId && lifecycle?.state === "enabled" && <MusicForm admin userId={userId} onSubmitted={setReceiptId} />}
                        </section>
                        <section className="flex min-w-0 flex-col gap-4">
                            <form
                                className="music-admin-card flex flex-col gap-3"
                                onSubmit={async (event) => {
                                    event.preventDefault();
                                    if (!logId.trim() || loading) return;
                                    setLoading(true);
                                    setError("");
                                    try {
                                        const task = await recoverMusicAdminTest(logId.trim());
                                        setReceiptId(task.taskId);
                                        setTracked(task);
                                    } catch (cause) {
                                        setError(cause instanceof Error ? cause.message : String(cause));
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                            >
                                <label className="flex flex-col gap-2 text-sm">
                                    {t("music.original_log_id")}
                                    <Input value={logId} maxLength={80} onChange={(event) => setLogId(event.target.value)} />
                                </label>
                                <Button htmlType="submit" loading={loading} disabled={!logId.trim()}>
                                    {t("music.recover_test_receipt")}
                                </Button>
                                <Link to="/admin/logs" className="music-admin-link">
                                    {t("music.original_log_id")}
                                </Link>
                            </form>
                            {receiptId && (
                                <p className="break-all">
                                    {t("music.task_id")}: {receiptId}
                                </p>
                            )}
                            {tracked ? <TaskCard task={tracked} onDetails={() => setDetailId(tracked.taskId)} /> : <p>{t("music.admin_test_history")}</p>}
                        </section>
                    </div>
                )}
                {track?.output.audioUrl && <WaveformPlayer taskId={track.output.id} audioUrl={track.output.audioUrl} title={track.task.title} durationSeconds={(track.output.durationMs || 0) / 1000} output={track.output} />}
                {tab === "settings" && (
                    <SettingsSectionCard icon={<Settings2 size={16} />} title={t("music.admin_tab_settings")} contentClassName="music-admin-section">
                        <p>{t("music.admin_lifecycle_hint", undefined, "Disabling blocks new tasks. Existing tasks continue, and history and ledger entries are retained.")}</p>
                        <div className="flex flex-wrap gap-3">
                            {(["enabled", "draining"] as const).map((state) => (
                                <Button disabled={loading || !lifecycle} aria-pressed={lifecycle?.state === state} key={state} onClick={() => void changeLifecycle(state)}>
                                    {t("music.lifecycle_" + state, undefined, state)}
                                </Button>
                            ))}
                        </div>
                        <p>{t("music.admin_upgrade_hint", undefined, "Configuration switches apply at runtime. Upgrading this implementation and its protocol package requires a host build and restart.")}</p>
                    </SettingsSectionCard>
                )}
                <AdminDrawer rootClassName="plugin-music-generation music-admin" open={Boolean(detail)} onClose={() => setDetailId(null)} title={<span translate="no">{detail?.title || t("music.default_track_title")}</span>}>
                    {detail && <MusicTaskDetails task={detail} />}
                </AdminDrawer>
            </div>
        </AdminPageFrame>
    );
}
