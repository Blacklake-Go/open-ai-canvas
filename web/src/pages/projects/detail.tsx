import { creationOptions as _creationOptions } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { App, Button, Dropdown } from "antd";
import { ArrowLeft, Brush, CheckCheck, Clapperboard, FileDown, FileUp, Film, Inbox, Package, Pause, Pencil, Play, ScrollText, Settings2, UsersRound } from "lucide-react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";

import { WorkspacePage } from "@/components/layout/workspace-page";
import { SegmentedControl } from "@/components/ui/base/segmented-control";
import { WorkspaceErrorState, WorkspaceLoadingState } from "@/components/layout/workspace-state";
import {
    approveDramaEpisode,
    composeDramaEpisode,
    deleteDramaShot,
    generateDramaSegments,
    insertDramaShot,
    pauseDrama,
    reprocessDramaSegmentVideo,
    regenerateDramaCast,
    releaseDramaMedia,
    renameDramaEpisode,
    rescriptDramaEpisode,
    retryFailedDrama,
    startDrama,
    updateDramaSegment,
    updateDramaSegmentReferences,
    writeDramaSegmentPrompts,
    updateDramaShot,
    type DramaEpisodeRow,
    formatDramaInboxCount,
    type DramaInboxItem,
    type DramaJob,
    type DramaModelChoice,
    type DramaSegment,
    type DramaShot,
    type DramaShotPatch,
} from "@/services/api/drama";

import { formatCount, formatDuration, sourceFormatOf, StagePips, STAGE_LABEL, STATUS_LABEL } from "./drama-shared";
import { CastPanel, InboxPanel, SettingsPanel } from "./studio/panels";
import { EpisodeDeleteModal } from "./studio/episode-delete-modal";
import { EpisodeRail } from "./studio/episode-rail";
import { AddEpisodeModal, type EpisodePlacement } from "./studio/episode-source";
import { AssetImportModal, AssetPackageModal } from "./studio/asset-transfer";
import { ChapterPickerModal } from "./studio/chapter-picker";
import { FinalView } from "./studio/final-view";
import { StudioGenesis } from "./studio/genesis";
import { SegmentDialog } from "./studio/segment-dialog";
import { QueueBar } from "./studio/queue-bar";
import { ScriptView } from "./studio/script-view";
import { Storyboard, type EpisodeEmpty } from "./studio/storyboard";
import { isTypingTarget, useDramaCast, useDramaEpisode, useDramaInvalidate, useDramaSummary, useOpenDramaCanvas } from "./studio/use-studio";
import { progressFillStyle } from "@/lib/progress-fill";
import "./drama.css";

type Tab = "board" | "script" | "final";
type StudioView = "production" | "cast" | "inbox" | "settings";

// 提示条在单行里会截断说明，正文同时放进悬停提示。
const AWAITING_MEDIA_BANNER = {
    title: "剧本与视频提示词已就绪，还没有生成视频",
    text: "先看看剧情、镜头拆分、设定和各段视频提示词是否合适；可以改台词、动作、外观或直接改提示词，确认后再生成本集的参考图与段视频。",
};

export default function DramaStudioPage() {
    _useCreationLocale();
    const { projectId = "", episodeId: routeEpisodeId = "" } = useParams();
    const navigate = useNavigate();
    const { message, modal } = App.useApp();
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = (["board", "script", "final"].includes(searchParams.get("tab") || "") ? searchParams.get("tab") : "board") as Tab;
    const shotParam = searchParams.get("shot") || "";
    const view = (["cast", "inbox", "settings"].includes(searchParams.get("view") || "") ? searchParams.get("view") : "production") as StudioView;
    const castFocus = searchParams.get("cast") || "";
    const [renaming, setRenaming] = useState(false);
    const [adding, setAdding] = useState(false);
    // 有值时“添加一集”弹窗插到这一集前后，否则追加到末尾。
    const [placement, setPlacement] = useState<EpisodePlacement>();
    const [deleting, setDeleting] = useState<DramaEpisodeRow | null>(null);
    const [pickingChapters, setPickingChapters] = useState(false);
    const [assetDialog, setAssetDialog] = useState<"export" | "import" | null>(null);
    // 窄屏只显示一栏：集列表与制作区用分段切换（宽屏两栏并排，不受影响）。
    const [mobilePane, setMobilePane] = useState<"episodes" | "production">("production");
    const invalidate = useDramaInvalidate(projectId);

    const summaryQuery = useDramaSummary(projectId);
    const summary = summaryQuery.data;
    const canvas = useOpenDramaCanvas(summary);
    const episodes = summary?.episodes || [];
    const episodeId = episodes.some((episode) => episode.id === routeEpisodeId) ? routeEpisodeId : (episodes.find((episode) => episode.stage === "review") || episodes.find((episode) => episode.stage !== "done") || episodes[0])?.id || "";
    const episodeRow = episodes.find((episode) => episode.id === episodeId);
    const awaitingCount = episodes.filter((episode) => episode.awaitingMedia).length;
    const running = summary?.production.status === "running";
    const episodeQuery = useDramaEpisode(projectId, episodeId, Boolean(running || (summary?.jobCounts.running || 0) > 0));
    const detail = episodeQuery.data?.episode.id === episodeId ? episodeQuery.data : undefined;
    const { cast, byId: castById } = useDramaCast(projectId, Boolean(running));
    const shots = useMemo(() => detail?.shots || [], [detail]);
    const currentShot = shots.find((shot) => shot.id === shotParam);

    const setParams = useCallback(
        (patch: Record<string, string | null>) => {
            const next = new URLSearchParams(searchParams);
            for (const [key, value] of Object.entries(patch)) {
                if (value) next.set(key, value);
                else next.delete(key);
            }
            setSearchParams(next, { replace: true });
        },
        [searchParams, setSearchParams],
    );
    const selectEpisode = useCallback(
        (id: string) => {
            navigate({ pathname: `/projects/${projectId}/e/${id}`, search: tab === "board" ? "" : `?tab=${tab}` });
        },
        [navigate, projectId, tab],
    );
    const segmentParam = searchParams.get("segment");
    const openSegmentIndex = segmentParam !== null && /^\d+$/.test(segmentParam) ? Number(segmentParam) : undefined;
    // 剧情段弹窗的打开状态放在地址里，刷新或从待处理跳转都能直接回到同一段、同一镜头。
    const openSegment = useCallback((index: number | null, shotId?: string) => setParams({ segment: index === null ? null : String(index), shot: index === null ? null : shotId || null }), [setParams]);
    const openView = useCallback((next: StudioView, extra: Record<string, string | null> = {}) => setParams({ view: next === "production" ? null : next, cast: null, ...extra }), [setParams]);

    // [ / ] 切换上一集 / 下一集。
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.key !== "[" && event.key !== "]") return;
            const index = episodes.findIndex((episode) => episode.id === episodeId);
            const next = episodes[index + (event.key === "]" ? 1 : -1)];
            if (next) selectEpisode(next.id);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [episodeId, episodes, selectEpisode]);

    const errorMessage = (error: unknown, fallback: string) => message.error(error instanceof Error ? error.message : fallback);
    const toggleRun = useMutation({
        mutationFn: () => (running ? pauseDrama(projectId) : startDrama(projectId)),
        onSuccess: () => {
            invalidate(episodeId);
            message.success(running ? _creationText("creation.c18dbd76a4c43c5c") : _creationText("creation.000c29ef3ac7223d"));
        },
        onError: (error) => errorMessage(error, "操作失败"),
    });
    const patchShot = useMutation({
        mutationFn: ({ shot, patch }: { shot: DramaShot; patch: DramaShotPatch }) => updateDramaShot(projectId, shot.id, patch),
        onSuccess: () => {
            invalidate(episodeId);
            message.success(_creationText("creation.591c3be011a664c3"));
        },
        onError: (error) => errorMessage(error, "保存失败"),
    });
    const insertShot = useMutation({
        mutationFn: ({ shot, position }: { shot: DramaShot; position: "before" | "after" }) => insertDramaShot(projectId, shot.id, position),
        onSuccess: ({ shot }) => {
            invalidate(episodeId);
            setParams({ shot: shot.id });
            message.success(_creationText("creation.4c8edd9326f14dcf"));
        },
        onError: (error) => errorMessage(error, "插入失败"),
    });
    const removeShot = useMutation({
        mutationFn: (shot: DramaShot) => deleteDramaShot(projectId, shot.id),
        onSuccess: () => {
            invalidate(episodeId);
            setParams({ shot: null });
            message.success(_creationText("creation.00acc11119b2a87b"));
        },
        onError: (error) => errorMessage(error, "删除失败"),
    });
    const saveSegment = useMutation({
        mutationFn: ({ segment, override }: { segment: DramaSegment; override: string }) => updateDramaSegment(projectId, episodeId, segment.index, override),
        onSuccess: (_, { override }) => {
            invalidate(episodeId);
            message.success(override ? _creationText("creation.a3c99723b6084e26") : _creationText("creation.5878e42bbd841215"));
        },
        onError: (error) => errorMessage(error, "保存失败"),
    });
    const saveReferences = useMutation({
        mutationFn: ({ segment, patch }: { segment: DramaSegment; patch: Parameters<typeof updateDramaSegmentReferences>[3] }) => updateDramaSegmentReferences(projectId, episodeId, segment.index, patch),
        onSuccess: async () => {
            // 二级菜单支持连续添加；等服务端选择刷新后再允许下一次修改。
            await invalidate(episodeId);
            message.success(_creationText("creation.94931582a8baac9c"));
        },
        onError: (error) => errorMessage(error, "保存失败"),
    });
    const writeSegment = useMutation({
        mutationFn: (indexes: number[]) => writeDramaSegmentPrompts(projectId, episodeId, indexes),
        onSuccess: (result) => {
            invalidate(episodeId);
            message.success(_creationText("creation.c18f8550115561b0", { value1: result.queued }));
        },
        onError: (error) => errorMessage(error, "操作失败"),
    });
    const approve = useMutation({
        mutationFn: () => approveDramaEpisode(projectId, episodeId),
        onSuccess: () => {
            invalidate(episodeId);
            message.success(episodeRow?.number === 1 && summary?.production.settings.reviewMode === "sample" ? _creationText("creation.9b89fd709429bf11") : _creationText("creation.2b16aad724e5d068"));
        },
        onError: (error) => errorMessage(error, "操作失败"),
    });
    const generateSegments = useMutation({
        mutationFn: ({ segments, videoModel }: { segments: number[]; videoModel?: DramaModelChoice }) => generateDramaSegments(projectId, episodeId, segments, videoModel),
        onSuccess: (result, { segments }) => {
            invalidate(episodeId);
            const label = segments.length > 1 ? `${segments.length} 段` : `第 ${segments[0] + 1} 段`;
            message.success(_creationText("creation.f2e56799fc4eac04", { value1: label, value2: result.queued }));
        },
        onError: (error) => errorMessage(error, "生成失败"),
    });
    const reprocessSegment = useMutation({
        mutationFn: (segmentIndex: number) => reprocessDramaSegmentVideo(projectId, episodeId, segmentIndex),
        onSuccess: (_, segmentIndex) => {
            invalidate(episodeId);
            message.success(_creationText("creation.7be58ed25251db60", { value1: segmentIndex + 1 }));
        },
        onError: (error) => {
            invalidate(episodeId);
            errorMessage(error, "重新处理失败");
        },
    });
    const rescript = useMutation({
        mutationFn: () => rescriptDramaEpisode(projectId, episodeId),
        onSuccess: () => {
            invalidate(episodeId);
            setParams({ shot: null, segment: null });
            message.success(running ? _creationText("creation.a60222297eb24d7a") : _creationText("creation.78c397c6bd7f25df"));
        },
        // 剧本已重置但恢复制作被拒（如预算或模型不可用）时，也要刷新到真实状态。
        onError: (error) => {
            invalidate(episodeId);
            errorMessage(error, "操作失败");
        },
    });
    const composeFinal = useMutation({
        mutationFn: () => composeDramaEpisode(projectId, episodeId),
        onSuccess: () => {
            invalidate(episodeId);
            message.success(running ? _creationText("creation.2614e9da77193af5") : _creationText("creation.f8dcc90b4a5e86a8"));
        },
        onError: (error) => {
            invalidate(episodeId);
            errorMessage(error, "合成失败");
        },
    });
    const retry = useMutation({
        mutationFn: () => retryFailedDrama(projectId),
        onSuccess: (result) => {
            invalidate(episodeId);
            message.success(_creationText("creation.72d2a20cfa330fda", { value1: result.segments + result.casts }));
        },
        onError: (error) => errorMessage(error, "重试失败"),
    });
    // 收件箱按组重试：设定重做参考图（不连带剧情段），剧情段失败统一重新排队。
    const [retryingGroup, setRetryingGroup] = useState("");
    const retryGroup = useMutation({
        mutationFn: async ({ items }: { key: string; items: DramaInboxItem[] }) => {
            const castIds = items.filter((item) => item.kind === "cast_failed" && item.castId).map((item) => item.castId!);
            await Promise.all(castIds.map((id) => regenerateDramaCast(projectId, id, false)));
            if (items.some((item) => item.kind === "segment_failed")) await retryFailedDrama(projectId);
            return items.length;
        },
        onMutate: ({ key }) => setRetryingGroup(key),
        onSettled: () => setRetryingGroup(""),
        onSuccess: (count) => {
            invalidate(episodeId);
            message.success(_creationText("creation.72d2a20cfa330fda", { value1: count }));
        },
        onError: (error) => errorMessage(error, "重试失败"),
    });
    // 手动模式：先看剧本、设定与段提示词，确认后再逐集或全部开始生成参考图与段视频。
    const release = useMutation({
        mutationFn: ({ target, episodeIds }: { target: "assets" | "episodes" | "all"; episodeIds?: string[] }) => releaseDramaMedia(projectId, target, episodeIds),
        onSuccess: (_, { target }) => {
            invalidate(episodeId);
            message.success(target === "assets" ? _creationText("creation.0b024666cc11fa15") : target === "all" ? _creationText("creation.fc61679f4d368ca0") : _creationText("creation.912754eea9e14536"));
        },
        onError: (error) => errorMessage(error, "操作失败"),
    });
    const confirmReleaseAll = () =>
        modal.confirm({
            title: `为 ${awaitingCount} 集开始生成视频？`,
            content: "会生成角色、道具与场景参考图，并按剧情段为这些集生成带对白与音效的视频，按实际用量计费。建议先挑一集生成，确认画风与角色形象后再全部开始。",
            okText: "全部开始",
            cancelText: "再看看",
            centered: true,
            onOk: () => release.mutateAsync({ target: "all" }),
        });
    const rename = useMutation({
        mutationFn: (title: string) => renameDramaEpisode(projectId, episodeId, title),
        onSuccess: () => {
            invalidate(episodeId);
            setRenaming(false);
        },
        onError: (error) => errorMessage(error, "重命名失败"),
    });
    const busy = approve.isPending || rescript.isPending || generateSegments.isPending || release.isPending || insertShot.isPending || removeShot.isPending || saveReferences.isPending;

    const openInbox = (item: DramaInboxItem) => {
        if (item.castId) {
            openView("cast", { cast: item.castId });
            return;
        }
        if (item.kind === "paused") {
            openView("settings");
            return;
        }
        if (item.episodeId) navigate({ pathname: `/projects/${projectId}/e/${item.episodeId}`, search: item.kind === "segment_failed" ? `?segment=${item.segmentIndex}` : "" });
    };
    const jumpToJob = (job: DramaJob) => {
        if (job.episodeId) navigate({ pathname: `/projects/${projectId}/e/${job.episodeId}`, search: "" });
    };

    // 直接打开草稿的制作台地址时回到创建页，草稿参数都在那里编辑。
    if (summary?.production.hasDraftForm) return <Navigate to={`/projects/new?draft=${encodeURIComponent(summary.project.id)}`} replace />;
    if (summaryQuery.isLoading)
        return (
            <WorkspacePage>
                <WorkspaceLoadingState label={_creationText("creation.ceafc9be1eef0b9c")} />
            </WorkspacePage>
        );
    if (summaryQuery.isError || !summary)
        return (
            <WorkspacePage>
                <WorkspaceErrorState title={_creationText("creation.a3fb9d6ca86ded68")} description={_creationText("creation.d497819dbe69f948")} actionLabel="返回作品列表" onRetry={() => navigate("/projects")} />
            </WorkspacePage>
        );

    const { production } = summary;
    const runLabel = running ? "暂停" : production.status === "draft" ? "开始制作" : "继续制作";
    const doneEpisodes = episodes.filter((episode) => episode.stage === "done" && !episode.finalStale).length;
    const progress = episodes.length ? doneEpisodes / episodes.length : 0;
    const aspectRatio = production.settings.aspectRatio;
    const sampleReview = production.settings.reviewMode === "sample" && !production.sampleApproved && detail?.episode.number === 1 && detail.episode.stage === "done" && !detail.episode.finalStale;
    const reviewing = sampleReview || (production.settings.reviewMode === "every" && detail?.episode.stage === "review");
    const reviewBanner = sampleReview
        ? { title: "第 1 集样片已完成，确认画风与角色形象", text: "在成片页看样片；满意后确认，其余各集会全自动跑完。" }
        : { title: "本集视频提示词已就绪，等待你的确认", text: "核对各段提示词与参考图，可改镜头脚本或直接改提示词；确认后按剧情段顺序生成视频。" };
    // 手动模式下流水线可能在“运行”却无事可做：明确告诉用户在等他放行。
    const waitingForMedia = awaitingCount > 0 && !(summary.jobCounts.running || summary.jobCounts.queued) && production.status === "running";
    // 本集还没有镜头时按真实状态说明：失败、暂停、未开始、排队都不能显示成“正在编写”。
    const episodeEmpty: EpisodeEmpty = detail?.episode.error
        ? {
              title: "本集剧本编写失败",
              text: "失败原因见上方提示。可以直接重新改编本集，或在底部队列全部重试。",
              active: false,
              action: (
                  <Button type="primary" loading={rescript.isPending} onClick={() => rescript.mutate()}>
                      {_creationText("creation.bc2922519bc01dc4")}
                  </Button>
              ),
          }
        : production.status === "paused"
          ? {
                title: "制作已暂停，本集剧本还没开始写",
                text: "继续制作后会立即为本集编写剧本与分镜。",
                active: false,
                action: (
                    <Button type="primary" icon={<Play className="size-4" />} loading={toggleRun.isPending} onClick={() => toggleRun.mutate()}>
                        {_creationText("creation.435090558c77f044")}
                    </Button>
                ),
            }
          : production.status === "draft"
            ? { title: "制作还没开始", text: "点击右上角“开始制作”后按集编写剧本与分镜。", active: false }
            : detail?.episode.stage === "queued"
              ? { title: "排队等待改编", text: "同时只改编少量集，前面的集写完剧本后会自动开始本集。", active: false }
              : { title: "正在编写剧本与分镜", text: "剧本按剧情段切分，每段生成一个带对白和镜头切换的视频。", active: true };
    const sampleWaiting = production.settings.reviewMode === "sample" && !production.sampleApproved && episodeRow && episodeRow.number !== 1 && ["prompts", "review", "video"].includes(episodeRow.stage);

    return (
        <WorkspacePage className="!overflow-hidden" fluid scroll={false}>
            <div className="drama-root drama-studio">
                <header className="drama-topbar">
                    <Link to="/projects">
                        <Button type="text" shape="circle" icon={<ArrowLeft className="size-4" />} aria-label={_creationText("projects.return_to_list")} />
                    </Link>
                    <div className="drama-topbar-title">
                        <h1 title={summary.project.name}>{summary.project.name}</h1>
                        {waitingForMedia ? (
                            <span className="drama-chip is-ready">
                                <span className="drama-dot" />
                                {_creationText("creation.fcdd0f7f9d99463f")}
                            </span>
                        ) : (
                            <span className={`drama-chip is-${production.status}`}>
                                <span className="drama-dot" />
                                {STATUS_LABEL[production.status]}
                            </span>
                        )}
                    </div>
                    {episodes.length ? (
                        <div className="drama-topbar-progress">
                            <span className="drama-meter" aria-label={_creationText("creation.a1053edb1e18bbbf", { value1: Math.round(progress * 100) })}>
                                <span style={progressFillStyle(Math.max(progress * 100, 2))} />
                            </span>
                            <span>
                                {doneEpisodes}/{episodes.length}
                                {_creationText("creation.d314a62017e00fb1")}
                                {production.planDone ? "" : _creationText("creation.9889863744900cf9")}
                            </span>
                            <span>{_creationText("creation.f249f74d7a9fd339", { value1: formatCount(production.chapterCount) })}</span>
                        </div>
                    ) : null}
                    <nav className="drama-nav" aria-label={_creationText("creation.ea27380990aecfe2")}>
                        <button type="button" className="drama-nav-item" aria-current={view === "production" ? "page" : undefined} onClick={() => openView("production")}>
                            <Clapperboard className="size-4" />
                            {_creationText("creation.da2dadcd3ff9c5bc")}
                        </button>
                        <button type="button" className="drama-nav-item" aria-current={view === "cast" ? "page" : undefined} onClick={() => openView("cast")}>
                            <UsersRound className="size-4" />
                            {_creationText("creation.f6a7a5a5030ea436")}
                            {summary.castCount ? <span className="drama-nav-count">{summary.castCount}</span> : null}
                        </button>
                        <button type="button" className="drama-nav-item" aria-current={view === "inbox" ? "page" : undefined} onClick={() => openView("inbox")}>
                            <Inbox className="size-4" />
                            {_creationText("settings.feedback_status_pending")}
                            {(summary.inboxCount ?? summary.inbox.length) ? <span className="drama-nav-count is-alert">{formatDramaInboxCount(summary.inboxCount ?? summary.inbox.length)}</span> : null}
                        </button>
                        <button type="button" className="drama-nav-item" aria-current={view === "settings" ? "page" : undefined} onClick={() => openView("settings")}>
                            <Settings2 className="size-4" />
                            {_creationText("nav.settings")}
                        </button>
                    </nav>
                    {/* 窄屏只保留图标（全部生成保留集数），文字由 aria-label 与 title 提供。 */}
                    <div className="drama-topbar-actions">
                        <Dropdown
                            trigger={["click"]}
                            placement="bottomRight"
                            menu={{
                                items: [
                                    { key: "export", icon: <FileDown className="size-3.5" />, label: _creationText("projects.export_assets"), onClick: () => setAssetDialog("export") },
                                    { key: "import", icon: <FileUp className="size-3.5" />, label: _creationText("projects.import_assets"), onClick: () => setAssetDialog("import") },
                                ],
                            }}
                        >
                            <Button icon={<Package className="size-4" />} aria-label={_creationText("projects.asset_package")} title={_creationText("projects.asset_package_hint")}>
                                <span className="drama-topbar-action-label">{_creationText("projects.asset_package")}</span>
                            </Button>
                        </Dropdown>
                        <Button icon={<Brush className="size-4" />} loading={canvas.opening === "canvas"} onClick={() => void canvas.open()} aria-label={_creationText("projects.drama_refine_canvas")} title={_creationText("creation.a16487c1271d0f6d")}>
                            <span className="drama-topbar-action-label">{_creationText("projects.drama_refine_canvas")}</span>
                        </Button>
                        {awaitingCount ? (
                            <Button
                                icon={<Play className="size-4" />}
                                loading={release.isPending && release.variables?.target === "all"}
                                onClick={confirmReleaseAll}
                                aria-label={_creationText("creation.bd02e1ca5ef0ec9e", { value1: awaitingCount })}
                                title={_creationText("creation.bd02e1ca5ef0ec9e", { value1: awaitingCount })}
                            >
                                <span className="drama-topbar-action-label">{_creationText("creation.61920c9e610b90bb")}</span>
                                {awaitingCount}
                                {_creationText("creation.5bbadd8f8c4f781d")}
                            </Button>
                        ) : null}
                        {production.status !== "completed" ? (
                            <Button type={running ? "default" : "primary"} icon={running ? <Pause className="size-4" /> : <Play className="size-4" />} loading={toggleRun.isPending} onClick={() => toggleRun.mutate()} aria-label={runLabel} title={runLabel}>
                                <span className="drama-topbar-action-label">{runLabel}</span>
                            </Button>
                        ) : null}
                    </div>
                </header>

                {view === "cast" ? (
                    <CastPanel
                        projectId={projectId}
                        cast={cast}
                        ratios={{ character: production.settings.assets.characterRatio }}
                        focusId={castFocus}
                        retrying={retry.isPending}
                        assetsPending={production.settings.mediaMode === "manual" && !production.assetsReleased}
                        releasing={release.isPending && release.variables?.target === "assets"}
                        onReleaseAssets={() => release.mutate({ target: "assets" })}
                        onFocus={(id) => setParams({ cast: id })}
                        onRetry={() => retry.mutate()}
                        onChanged={() => invalidate(episodeId)}
                        onOpenCanvas={(castId) => void canvas.open({ kind: "cast", castId })}
                        canvasOpening={canvas.opening?.startsWith("cast:") ? canvas.opening.slice("cast:".length) : undefined}
                    />
                ) : view === "inbox" ? (
                    <InboxPanel
                        items={summary.inbox}
                        failureCount={summary.inboxFailureCount ?? summary.inbox.filter((item) => item.severity === "error").length}
                        castById={castById}
                        retrying={retry.isPending}
                        retryingGroup={retryingGroup}
                        releasing={release.isPending}
                        onRetryAll={() => retry.mutate()}
                        onRetryGroup={(key, items) => retryGroup.mutate({ key, items })}
                        onOpen={openInbox}
                        onOpenSettings={() => openView("settings")}
                        onReleaseAll={confirmReleaseAll}
                    />
                ) : view === "settings" ? (
                    <SettingsPanel projectId={projectId} summary={summary} cast={cast} onChanged={() => invalidate(episodeId)} />
                ) : !episodes.length ? (
                    <StudioGenesis summary={summary} />
                ) : (
                    <div className={`drama-body is-inspector-hidden ${openSegmentIndex !== undefined ? "is-covered" : ""}`} data-mobile-pane={mobilePane}>
                        <div className="drama-mobile-tabs">
                            <SegmentedControl<"episodes" | "production">
                                block
                                size="sm"
                                ariaLabel="切换集列表与制作区"
                                value={mobilePane}
                                onChange={setMobilePane}
                                options={_creationOptions([
                                    { label: `剧集 · ${episodes.length}`, value: "episodes" },
                                    { label: "制作", value: "production" },
                                ])}
                            />
                        </div>
                        <EpisodeRail
                            episodes={episodes}
                            currentId={episodeId}
                            planning={!production.planDone}
                            reservedChapters={production.reservedChapterCount}
                            onSelect={(id) => {
                                selectEpisode(id);
                                setMobilePane("production");
                            }}
                            onAdd={() => {
                                setPlacement(undefined);
                                setAdding(true);
                            }}
                            onInsert={(episode, position) => {
                                setPlacement({ anchorId: episode.id, anchorNumber: episode.number, position });
                                setAdding(true);
                            }}
                            onDelete={setDeleting}
                            onPickChapters={() => setPickingChapters(true)}
                        />
                        <main className="drama-main">
                            {episodeRow ? (
                                <div className="drama-ep-header">
                                    <div className="drama-ep-heading">
                                        <div className="drama-eyebrow">{_creationText("creation.34ac7cbd8058f89f", { value1: episodeRow.number, value2: STAGE_LABEL[episodeRow.stage] })}</div>
                                        {renaming ? (
                                            <div className="drama-title-editor">
                                                <input
                                                    className="drama-title-input"
                                                    autoFocus
                                                    defaultValue={episodeRow.title}
                                                    maxLength={60}
                                                    aria-label={_creationText("creation.1dec31ee573df5ab")}
                                                    disabled={rename.isPending}
                                                    onFocus={(event) => event.currentTarget.select()}
                                                    onBlur={(event) => {
                                                        const title = event.target.value.trim();
                                                        if (title && title !== episodeRow.title) rename.mutate(title);
                                                        else setRenaming(false);
                                                    }}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter") event.currentTarget.blur();
                                                        if (event.key === "Escape") setRenaming(false);
                                                    }}
                                                />
                                                <span className="drama-title-hint">{_creationText("creation.e934df4caf67d2d8")}</span>
                                            </div>
                                        ) : (
                                            <h2 title={episodeRow.title}>
                                                {episodeRow.title}
                                                <button type="button" className="drama-title-edit" aria-label={_creationText("creation.bd0163f3f0040c96")} onClick={() => setRenaming(true)}>
                                                    <Pencil className="size-3.5" />
                                                </button>
                                            </h2>
                                        )}
                                        <p>
                                            <span>{_creationText("creation.9f657219677fbf0b", { value1: episodeRow.shotCount })}</span>
                                            {episodeRow.durationMs ? <span>{formatDuration(episodeRow.durationMs)}</span> : null}
                                            <StagePips episode={episodeRow} size="md" />
                                        </p>
                                    </div>
                                    <div className="drama-tabs" role="tablist" aria-label={_creationText("creation.1c5c067138704dda")}>
                                        <button type="button" role="tab" className="drama-tab" aria-selected={tab === "script"} onClick={() => setParams({ tab: "script" })}>
                                            <ScrollText className="size-3.5" />
                                            {_creationText("creation.0f83503407ff90db")}
                                        </button>
                                        <button type="button" role="tab" className="drama-tab" aria-selected={tab === "board"} onClick={() => setParams({ tab: null })}>
                                            <Clapperboard className="size-3.5" />
                                            {_creationText("creation.c6b1d5264c01a261")}
                                        </button>
                                        <button type="button" role="tab" className="drama-tab" aria-selected={tab === "final"} onClick={() => setParams({ tab: "final" })}>
                                            <Film className="size-3.5" />
                                            {_creationText("projects.final_cut")}
                                        </button>
                                    </div>
                                    <Button
                                        size="small"
                                        icon={<Brush className="size-3.5" />}
                                        disabled={!episodeRow.stats.segments}
                                        loading={canvas.opening === `episode:${episodeRow.id}`}
                                        onClick={() => void canvas.open({ kind: "episode", episodeId: episodeRow.id })}
                                        title={episodeRow.stats.segments ? _creationText("creation.4cf6c0db4a24adc4") : _creationText("creation.64d184dca9f4c0af")}
                                    >
                                        {_creationText("creation.6a68e5fc9eada311")}
                                    </Button>
                                </div>
                            ) : null}
                            <div className="drama-banners">
                                {production.status === "paused" ? (
                                    <div className="drama-banner">
                                        <div className="drama-banner-text">
                                            <strong>{_creationText("creation.2719c5ce5ad43e3e")}</strong>
                                            <span title={production.pauseReason || undefined}>{production.pauseReason || _creationText("creation.787aa15152948963")}</span>
                                        </div>
                                        <Button size="small" type="primary" icon={<Play className="size-3.5" />} loading={toggleRun.isPending} onClick={() => toggleRun.mutate()}>
                                            {_creationText("creation.435090558c77f044")}
                                        </Button>
                                    </div>
                                ) : null}
                                {episodeRow?.awaitingMedia ? (
                                    <div className="drama-banner is-ready">
                                        <Clapperboard className="size-5 shrink-0 text-[var(--workspace-accent)]" />
                                        <div className="drama-banner-text" title={`${_creationText("creation.5590cf532f00cb81")}\n${_creationText("creation.8cf04a4fb9d01439")}`}>
                                            <strong>{_creationText("creation.5590cf532f00cb81")}</strong>
                                            <span>{_creationText("creation.8cf04a4fb9d01439")}</span>
                                        </div>
                                        <div className="flex shrink-0 gap-2">
                                            {tab !== "script" ? <Button onClick={() => setParams({ tab: "script" })}>{_creationText("creation.83bfe8f721354a3c")}</Button> : null}
                                            <Button
                                                type="primary"
                                                icon={<Play className="size-4" />}
                                                loading={release.isPending && release.variables?.target === "episodes"}
                                                onClick={() => release.mutate({ target: "episodes", episodeIds: [episodeRow.id] })}
                                            >
                                                {_creationText("creation.dd6f07b1153e2da6")}
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                                {reviewing ? (
                                    <div className="drama-banner is-info">
                                        <CheckCheck className="size-5 shrink-0 text-[var(--workspace-accent)]" />
                                        <div
                                            className="drama-banner-text"
                                            title={`${sampleReview ? _creationText("creation.ef65437fc29b3b61") : _creationText("creation.368d22095311244d")}\n${sampleReview ? _creationText("creation.1f352a4392d7c2b5") : _creationText("creation.b2c16661ed820cc4")}`}
                                        >
                                            <strong>{sampleReview ? _creationText("creation.ef65437fc29b3b61") : _creationText("creation.368d22095311244d")}</strong>
                                            <span>{sampleReview ? _creationText("creation.1f352a4392d7c2b5") : _creationText("creation.b2c16661ed820cc4")}</span>
                                        </div>
                                        <Button type="primary" loading={approve.isPending} onClick={() => approve.mutate()}>
                                            {sampleReview ? _creationText("creation.9f4de94e8cffd9a9") : _creationText("creation.4d41f608fa6c8a36")}
                                        </Button>
                                    </div>
                                ) : null}
                                {sampleWaiting ? (
                                    <div className="drama-banner is-info">
                                        <div className="drama-banner-text">
                                            <strong>{_creationText("creation.0f50203c0c05fa63")}</strong>
                                            <span>{_creationText("creation.268788604b4155a5")}</span>
                                        </div>
                                        <Button size="small" onClick={() => selectEpisode(episodes[0].id)}>
                                            {_creationText("creation.4151f893a74e38c2")}
                                        </Button>
                                    </div>
                                ) : null}
                                {detail?.episode.error ? (
                                    <div className="drama-banner is-error">
                                        <div className="drama-banner-text">
                                            <strong>{_creationText("creation.f85556bd5b3cb471")}</strong>
                                            <span>{detail.episode.error}</span>
                                        </div>
                                        <span className="text-[var(--fs-tiny)] text-foreground/50">{_creationText("creation.fde964c276bee204")}</span>
                                    </div>
                                ) : null}
                            </div>
                            <div className="drama-scroll thin-scrollbar">
                                {!detail ? (
                                    <WorkspaceLoadingState label={_creationText("creation.6b56261341c13187")} rows={2} />
                                ) : tab === "board" ? (
                                    <Storyboard
                                        shots={shots}
                                        segments={detail.segments}
                                        aspectRatio={aspectRatio}
                                        castById={castById}
                                        defaultVideoModel={production.settings.models.video}
                                        videoResolution={production.settings.videoResolution}
                                        busy={busy}
                                        keyboardEnabled={openSegmentIndex === undefined && view === "production"}
                                        onOpen={openSegment}
                                        onGenerate={(segments, videoModel) => generateSegments.mutate({ segments, videoModel })}
                                        onReprocess={(index) => reprocessSegment.mutate(index)}
                                        reprocessing={reprocessSegment.isPending ? reprocessSegment.variables : undefined}
                                        onWritePrompts={(indexes) => writeSegment.mutate(indexes)}
                                        empty={episodeEmpty}
                                    />
                                ) : tab === "script" ? (
                                    <ScriptView
                                        projectId={projectId}
                                        detail={detail}
                                        storyboard={production.settings.storyboard}
                                        currentId={currentShot?.id || ""}
                                        busy={busy}
                                        onCurrent={(id) => setParams({ shot: id })}
                                        onRescript={() => rescript.mutate()}
                                        onPatchShot={(shot, patch) => patchShot.mutate({ shot, patch })}
                                        onInsertShot={(shot, position) => insertShot.mutate({ shot, position })}
                                        onDeleteShot={(shot) => removeShot.mutate(shot)}
                                        onSourceSaved={(again) => {
                                            invalidate(episodeId);
                                            if (again) rescript.mutate();
                                        }}
                                        empty={episodeEmpty}
                                    />
                                ) : (
                                    <FinalView
                                        projectId={projectId}
                                        title={summary.project.name}
                                        detail={detail}
                                        aspectRatio={aspectRatio}
                                        onOpenSegment={(index) => setParams({ tab: null, segment: String(index), shot: null })}
                                        onOpenCut={() => void canvas.open({ kind: "cut", episodeId: detail.episode.id })}
                                        cutOpening={canvas.opening === `cut:${detail.episode.id}`}
                                        onCompose={() => composeFinal.mutate()}
                                        composing={composeFinal.isPending}
                                    />
                                )}
                            </div>
                        </main>
                        <SegmentDialog
                            detail={tab === "board" ? detail : undefined}
                            segmentIndex={openSegmentIndex}
                            shotId={currentShot?.id}
                            castById={castById}
                            aspectRatio={aspectRatio}
                            busy={busy}
                            writing={writeSegment.isPending}
                            onClose={() => openSegment(null)}
                            onNavigate={openSegment}
                            onPatchShot={(shot, patch) => patchShot.mutate({ shot, patch })}
                            onInsertShot={(shot, position) => insertShot.mutate({ shot, position })}
                            onDeleteShot={(shot) => removeShot.mutate(shot)}
                            onSavePrompt={(segment, override) => saveSegment.mutate({ segment, override })}
                            onSaveReferences={(segment, patch) => saveReferences.mutateAsync({ segment, patch })}
                            onWritePrompt={(segment) => writeSegment.mutate([segment.index])}
                            onGenerate={(segment, videoModel) => generateSegments.mutate({ segments: [segment.index], videoModel })}
                            reprocessing={reprocessSegment.isPending}
                            onReprocess={(segment) => reprocessSegment.mutate(segment.index)}
                            defaultVideoModel={production.settings.models.video}
                            videoResolution={production.settings.videoResolution}
                            onOpenCast={(id) => openView("cast", { cast: id, segment: null, shot: null })}
                            onOpenCanvas={(segment) => void canvas.open({ kind: "segment", episodeId, segmentIndex: segment.index })}
                            canvasOpening={Boolean(canvas.opening?.startsWith("segment:"))}
                        />
                    </div>
                )}

                <QueueBar projectId={projectId} summary={summary} retrying={retry.isPending} onRetry={() => retry.mutate()} onJump={jumpToJob} />
                <AddEpisodeModal
                    open={adding}
                    projectId={projectId}
                    nextNumber={placement ? placement.anchorNumber + (placement.position === "after" ? 1 : 0) : (episodes[episodes.length - 1]?.number || 0) + 1}
                    placement={placement}
                    defaultFormat={sourceFormatOf((placement ? episodes.find((episode) => episode.id === placement.anchorId) : episodes[episodes.length - 1])?.sourceFormat)}
                    blockedReason={production.planDone ? undefined : `前面的章节还在分集规划，完成后才能${placement ? "插入" : "追加"}新的一集。`}
                    onClose={() => setAdding(false)}
                    onAdded={(id) => {
                        setAdding(false);
                        invalidate(id, { renumbered: Boolean(placement) });
                        selectEpisode(id);
                    }}
                />
                <EpisodeDeleteModal
                    projectId={projectId}
                    episode={deleting}
                    blockedReason={!production.planDone ? "前面的章节还在分集规划，完成后才能删除。" : episodes.length <= 1 ? "作品至少保留一集；不再需要这部作品时，可以在作品列表里删除整部作品。" : undefined}
                    onClose={() => setDeleting(null)}
                    onDeleted={(id) => {
                        setDeleting(null);
                        // 删掉当前集时停在原位置的下一集，没有下一集时回到上一集。
                        const index = episodes.findIndex((episode) => episode.id === id);
                        const neighbor = episodes[index + 1] || episodes[index - 1];
                        if (id === episodeId && neighbor) selectEpisode(neighbor.id);
                        invalidate(undefined, { renumbered: true, removedEpisodeId: id });
                    }}
                />
                {pickingChapters ? (
                    <ChapterPickerModal
                        open={pickingChapters}
                        projectId={projectId}
                        defaultPerEpisode={production.settings.chaptersPerEpisode || 1}
                        blockedReason={production.planDone ? undefined : "前面的章节还在分集规划，完成后才能加入新的章节。"}
                        onClose={() => setPickingChapters(false)}
                        onProduced={(ids) => {
                            setPickingChapters(false);
                            invalidate(ids[0]);
                            if (ids[0]) selectEpisode(ids[0]);
                        }}
                    />
                ) : null}
                {assetDialog === "export" ? <AssetPackageModal open projectId={projectId} episodes={episodes} onClose={() => setAssetDialog(null)} /> : null}
                {assetDialog === "import" ? <AssetImportModal open projectId={projectId} onClose={() => setAssetDialog(null)} /> : null}
            </div>
        </WorkspacePage>
    );
}
