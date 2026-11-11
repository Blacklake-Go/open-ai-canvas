import { creationLabel as _creationLabel, creationOptions as _creationOptions } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { App, Button, Input, InputNumber, Select } from "antd";
import { AlertTriangle, ArrowLeft, BookOpenText, ClipboardPaste, FileUp, Cpu, Play } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";

import { WorkspacePage } from "@/components/layout/workspace-page";
import { WorkspaceErrorState, WorkspaceLoadingState } from "@/components/layout/workspace-state";
import { DEFAULT_DRAMA_STYLE_ID, findDramaStyle } from "@/lib/drama/drama-styles";
import { decodeNovelText } from "@/lib/canvas/canvas-document";
import { analyzeNovel, EPISODE_GROUP_CHARS, EPISODE_SOURCE_CHARS, sourceChars, titleFromFileName, type NovelAnalysis } from "@/lib/drama/novel-parse";
import { defaultChapterSelection, groupChapterEpisodes } from "@/lib/drama/chapter-selection";
import { ApiError } from "@/services/api/request";
import { linkCanvasToDrama } from "@/services/drama-canvas";
import { dramaChoiceKey, dramaResolutionAfterModelChange, dramaVideoOptionFits, dramaVideoRatioIssue, dramaVideoResolutionValue } from "@/lib/drama/model-choice";
import { DEFAULT_STORYBOARD } from "@/lib/drama/storyboard";
import {
    createDrama,
    estimateDrama,
    getDramaDraft,
    saveDramaDraft,
    type DramaAssetSettings,
    type DramaCapability,
    type DramaEpisodeMode,
    type DramaMediaMode,
    type DramaModels,
    type DramaReviewMode,
    type DramaSkillRef,
    type DramaSourceFormat,
    type DramaTextThinking,
    type DramaStoryboardSettings,
    type DramaVideoContinuity,
} from "@/services/api/drama";

import { EpisodeGroupField, formatCount, formatCredits, MEDIA_MODE_LABEL, SOURCE_FORMAT_LABEL, SourceFormatPicker, VIDEO_CONTINUITY_LABEL } from "./drama-shared";
import { AssetSchemePicker, defaultAssetSettings, useAssetSchemes } from "./asset-scheme";
import { DramaModelPicker, useDramaModelCatalog } from "./drama-model-picker";
import { DramaAssetImageModels, DramaTextSteps, VideoResolutionField } from "./step-settings";
import { EpisodeDurationInput, StoryboardRules } from "./storyboard-rules";
import { DramaStylePicker } from "./style-picker";
import { ChapterPickList } from "./chapter-pick-list";
import "./drama.css";

const MAX_FILE_BYTES = 40 * 1024 * 1024;

/** 从画布“交给短剧自动制作”带来的预填内容；canvasId 是创建后要关联的原画布（已关联项目的画布不带）。 */
type DramaCreatePrefill = { name?: string; sourceFormat?: DramaSourceFormat; text: string; canvasId?: string };
const RATIOS = [
    { value: "9:16", label: "竖屏 9:16", w: 9, h: 16 },
    { value: "16:9", label: "横屏 16:9", w: 16, h: 9 },
    { value: "1:1", label: "方形 1:1", w: 12, h: 12 },
];
const LANGUAGES = ["中文普通话", "粤语", "英语", "日语"];
const REVIEW_MODES: Array<{ value: DramaReviewMode; title: string; detail: string }> = [
    { value: "sample", title: "先看样片，满意后全剧自动", detail: "先做完第 1 集成片，请你确认一次画风、角色和声线，之后所有集自动跑到成片。" },
    { value: "every", title: "每集确认提示词", detail: "每集生成视频前停下来，等你审阅各剧情段的视频提示词与参考图。" },
    { value: "auto", title: "全自动", detail: "不打断，直接从小说跑到成片，可随时在制作台修改重做。" },
];
const CAPABILITY_LABEL: Record<DramaCapability, string> = { text: "默认文本", image: "默认图片", video: "剧情段视频" };
const EPISODE_MODES: Array<{ value: DramaEpisodeMode; title: string; detail: string }> = [
    { value: "chapter", title: "按章分集", detail: "按章节顺序固定分集，默认每章一集，也可以每 2–12 章合成一集；可以只放第 1 集，之后在制作台追加。单章不超过 1.2 万字。" },
    { value: "auto", title: "整本导入，自动分集", detail: "由模型按剧情把章节规划成集（可合并或拆分章节），适合一次导入整本小说；章节多时耗时更长。" },
];

export default function DramaCreatePage() {
    _useCreationLocale();
    const navigate = useNavigate();
    const { message } = App.useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [pasteMode, setPasteMode] = useState(searchParams.get("paste") === "1");
    const [pasteText, setPasteText] = useState("");
    // ?draft=<作品 ID>：回到创建页继续编辑草稿，保存时整体替换这个草稿而不是新建作品。
    const draftId = searchParams.get("draft") || "";
    const [sourceText, setSourceText] = useState("");
    const [sourceFormat, setSourceFormat] = useState<DramaSourceFormat>("novel");
    // 默认逐集：一次只让流水线处理一集，长篇整本导入容易让改编任务超时。
    const [chapterMode, setChapterMode] = useState<DramaEpisodeMode>("chapter");
    const [groupSize, setGroupSize] = useState(1);
    const episodeMode: DramaEpisodeMode = sourceFormat === "novel" ? chapterMode : "chapter";
    const perEpisode = episodeMode === "chapter";
    // 剧本与分镜每个标题就是一集；小说按章分集时可每 N 章合成一集。
    const chaptersPerEpisode = sourceFormat === "novel" && perEpisode ? groupSize : 1;
    const analysis = useMemo(() => (sourceText ? analyzeNovel(sourceText, { perEpisode }) : null), [perEpisode, sourceText]);
    // 选章跟随这一次的拆章结果：换素材或切换分集方式会重新拆章，选择回到默认（长篇只选前几章）。
    const [picked, setPicked] = useState<{ source: NovelAnalysis; chapters: Set<number> } | null>(null);
    const selection = useMemo(() => (analysis ? (picked?.source === analysis ? picked.chapters : defaultChapterSelection(analysis.chapters.length)) : new Set<number>()), [analysis, picked]);
    const selectedIndexes = useMemo(() => [...selection].filter((index) => analysis && index < analysis.chapters.length).sort((left, right) => left - right), [analysis, selection]);
    const selectedWords = useMemo(() => selectedIndexes.reduce((sum, index) => sum + (analysis?.chapters[index]?.words || 0), 0), [analysis, selectedIndexes]);
    const allSelected = Boolean(analysis) && selectedIndexes.length === analysis?.chapters.length;
    const episodeGroups = useMemo(
        () =>
            analysis && perEpisode
                ? groupChapterEpisodes(
                      selectedIndexes.map((index) => ({ position: index, chars: sourceChars(analysis.chapters[index].text) })),
                      chaptersPerEpisode,
                  )
                : [],
        [analysis, chaptersPerEpisode, perEpisode, selectedIndexes],
    );
    const oversizedGroup = episodeGroups.find((group) => group.chars > EPISODE_GROUP_CHARS);
    // 单章原文上限只约束选中的章节；预留章节加入制作时再检查。
    const longChapters = useMemo(() => (analysis && perEpisode ? analysis.chapters.flatMap((chapter, index) => (sourceChars(chapter.text) > EPISODE_SOURCE_CHARS ? [index] : [])) : []), [analysis, perEpisode]);
    const longSelected = longChapters.filter((index) => selection.has(index)).length;
    const [name, setName] = useState("");
    const [aspectRatio, setAspectRatio] = useState("9:16");
    const [episodeSeconds, setEpisodeSeconds] = useState(90);
    const [styleId, setStyleId] = useState(DEFAULT_DRAMA_STYLE_ID);
    const [language, setLanguage] = useState(LANGUAGES[0]);
    const [reviewMode, setReviewMode] = useState<DramaReviewMode>("sample");
    // 默认先只跑文本：先看剧情、镜头、设定和段提示词对不对，再决定花钱生成参考图与视频。
    const [mediaMode, setMediaMode] = useState<DramaMediaMode>("manual");
    const [videoContinuity, setVideoContinuity] = useState<DramaVideoContinuity>("tail_frame");
    const [storyboard, setStoryboard] = useState<DramaStoryboardSettings>(DEFAULT_STORYBOARD);
    const [promptSkill, setPromptSkill] = useState<DramaSkillRef>();
    const [bibleSkill, setBibleSkill] = useState<DramaSkillRef>();
    const [scriptSkill, setScriptSkill] = useState<DramaSkillRef>();
    const [textThinking, setTextThinking] = useState<DramaTextThinking>({});
    const [videoResolution, setVideoResolution] = useState<string>();
    const [models, setModels] = useState<Partial<DramaModels>>({});
    const [budgetCredits, setBudgetCredits] = useState<number | null>(null);
    const assetCatalog = useAssetSchemes();
    const [assetDraft, setAssetDraft] = useState<DramaAssetSettings>();
    const assets = assetDraft || defaultAssetSettings(assetCatalog.data);
    const [previewIndex, setPreviewIndex] = useState(0);

    const style = findDramaStyle(styleId);
    const catalogQuery = useDramaModelCatalog();
    const resolvedModels = useMemo<DramaModels | undefined>(() => {
        const catalog = catalogQuery.data;
        if (!catalog) return undefined;
        const { defaults } = catalog;
        // 没手动选视频模型时按当前画幅与衔接方式挑：目录默认值给不出就换第一个给得出的，都不行留空并说明原因。
        // 分辨率不参与挑选：先选模型，模型给不出旧分辨率时按模型默认出片。
        const videoOptions = catalog.options.video || [];
        const fitting = videoOptions.filter((option) => dramaVideoOptionFits(option, aspectRatio, videoContinuity));
        const video = models.video || fitting.find((option) => dramaChoiceKey(option.choice) === dramaChoiceKey(defaults.video))?.choice || fitting[0]?.choice || {};
        return { ...models, text: models.text || defaults.text, image: models.image || defaults.image, video };
    }, [aspectRatio, catalogQuery.data, models, videoContinuity]);
    const videoOption = catalogQuery.data?.options.video?.find((option) => dramaChoiceKey(option.choice) === dramaChoiceKey(resolvedModels?.video));
    // 角色参考图用单独指定的模型，没有就用默认图片模型；参考图方案按它检查角色画幅。
    const characterImage = dramaChoiceKey(resolvedModels?.characterImage) ? resolvedModels?.characterImage : resolvedModels?.image;
    const imageOption = catalogQuery.data?.options.image?.find((option) => dramaChoiceKey(option.choice) === dramaChoiceKey(characterImage));
    // 目录已加载时把旧项目里模型给不出的分辨率换成模型默认，报价与提交用同一个有效值。
    const effectiveVideoResolution = videoResolution && catalogQuery.data ? dramaVideoResolutionValue(videoOption, videoResolution) || undefined : videoResolution;
    const missingCapabilities = (Object.keys(CAPABILITY_LABEL) as DramaCapability[]).filter((capability) => catalogQuery.data && !dramaChoiceKey(resolvedModels?.[capability]));
    // 目录里有视频模型、但没有一个能按当前画幅与衔接方式出片：说清原因，不笼统说“没有可用模型”。
    const noFittingVideo = missingCapabilities.includes("video") && Boolean(catalogQuery.data?.options.video?.length);
    const unavailableCapabilities = missingCapabilities.filter((capability) => !(capability === "video" && noFittingVideo));
    const videoRatioProblem = dramaVideoRatioIssue(videoOption, aspectRatio);
    // 服务端只在支持图生视频时下发 tailFrameChain，缺省即不支持。
    const tailFrameProblem = videoContinuity === "tail_frame" && Boolean(videoOption) && !videoOption?.tailFrameChain;
    const settings = {
        aspectRatio,
        episodeSeconds,
        stylePrompt: style?.prompt || "",
        styleName: style?.name || "",
        language,
        reviewMode,
        mediaMode,
        videoContinuity,
        storyboard,
        ...(promptSkill ? { promptSkill } : {}),
        ...(bibleSkill ? { bibleSkill } : {}),
        ...(scriptSkill ? { scriptSkill } : {}),
        ...(Object.keys(textThinking).length ? { textThinking } : {}),
        ...(effectiveVideoResolution ? { videoResolution: effectiveVideoResolution } : {}),
        concurrency: 4,
        models: resolvedModels,
        episodeMode,
        chaptersPerEpisode,
        ...(assets ? { assets } : {}),
    };
    const estimateQuery = useQuery({
        queryKey: [
            "drama-estimate",
            selectedIndexes.length,
            selectedWords,
            episodeMode,
            chaptersPerEpisode,
            episodeSeconds,
            aspectRatio,
            videoContinuity,
            JSON.stringify(storyboard),
            [assets?.resolution, assets?.propResolution, assets?.sceneResolution, assets?.characterRatio].join("|"),
            effectiveVideoResolution || "",
            JSON.stringify(resolvedModels || {}),
        ],
        queryFn: ({ signal }) => estimateDrama({ chapterCount: selectedIndexes.length, wordCount: selectedWords, settings, episodeMode }, signal),
        enabled: Boolean(analysis && resolvedModels && selectedIndexes.length),
        staleTime: 30_000,
    });
    const estimate = estimateQuery.data;
    useEffect(() => {
        if (estimate && budgetCredits === null && estimate.maxMicrocredits > 0) setBudgetCredits(Math.ceil(estimate.maxMicrocredits / 1_000_000));
    }, [estimate, budgetCredits]);

    const loadText = (text: string, fileName?: string) => {
        const result = analyzeNovel(text, { perEpisode });
        if (!result.chapters.length) {
            message.error(_creationText("creation.3e089216c9d6a116"));
            return;
        }
        setSourceText(text);
        setBudgetCredits(null);
        if (fileName && !name) setName(titleFromFileName(fileName));
        if (!fileName && !name) setName(result.chapters[0]?.title.slice(0, 20) || "未命名短剧");
    };
    const loadFile = async (file: File) => {
        if (!/\.(txt|md|markdown)$/i.test(file.name)) {
            message.warning(_creationText("creation.8991ca13459ad40b"));
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            message.warning(_creationText("creation.23784b850888c4e0"));
            return;
        }
        loadText(decodeNovelText(await file.arrayBuffer()), file.name);
    };
    const routeState = location.state as { file?: File; prefill?: DramaCreatePrefill } | null;
    const handedFile = routeState?.file;
    const prefill = routeState?.prefill;
    const handedRef = useRef(false);
    // 画布分镜带过来的原画布：作品创建后关联过去，成为它的精修画布。
    const linkCanvasRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (handedRef.current || (!handedFile && !prefill?.text)) return;
        handedRef.current = true;
        if (handedFile) void loadFile(handedFile);
        else if (prefill) {
            if (prefill.sourceFormat) setSourceFormat(prefill.sourceFormat);
            loadText(prefill.text);
            // loadText 在没有名称时会取首章标题，这里在它之后设置，以画布带来的名称为准。
            if (prefill.name?.trim()) setName(prefill.name.trim().slice(0, 80));
            linkCanvasRef.current = prefill.canvasId;
        }
        // 文件与预填内容只用于首次进入，清掉路由状态避免刷新或返回时重复解析。
        navigate(".", { replace: true, state: null });
    }, [handedFile, prefill]); // eslint-disable-line react-hooks/exhaustive-deps
    const draftQuery = useQuery({ queryKey: ["drama-draft", draftId], queryFn: ({ signal }) => getDramaDraft(draftId, signal), enabled: Boolean(draftId), staleTime: Infinity, gcTime: 0 });
    const hydratedRef = useRef("");
    // 草稿选章要等原文按回填的分集方式拆好章后才能对上，先记下来，拆章结果出来后再套用。
    const pendingSelectionRef = useRef<{ indexes: number[]; count: number } | null>(null);
    useEffect(() => {
        const draft = draftQuery.data;
        if (!draft || hydratedRef.current === draft.projectId) return;
        hydratedRef.current = draft.projectId;
        const saved = draft.settings;
        setName(draft.name);
        setSourceFormat(draft.sourceFormat);
        if (saved.episodeMode) setChapterMode(saved.episodeMode);
        if (saved.chaptersPerEpisode) setGroupSize(saved.chaptersPerEpisode);
        if (saved.aspectRatio) setAspectRatio(saved.aspectRatio);
        if (saved.episodeSeconds) setEpisodeSeconds(saved.episodeSeconds);
        if (draft.form.styleId && findDramaStyle(draft.form.styleId)) setStyleId(draft.form.styleId);
        if (saved.language) setLanguage(saved.language);
        if (saved.reviewMode) setReviewMode(saved.reviewMode);
        if (saved.mediaMode) setMediaMode(saved.mediaMode);
        if (saved.videoContinuity) setVideoContinuity(saved.videoContinuity);
        if (saved.storyboard) setStoryboard(saved.storyboard);
        setPromptSkill(saved.promptSkill);
        setBibleSkill(saved.bibleSkill);
        setScriptSkill(saved.scriptSkill);
        setTextThinking(saved.textThinking || {});
        setVideoResolution(saved.videoResolution || undefined);
        if (saved.models) setModels(saved.models);
        if (saved.assets) setAssetDraft(saved.assets);
        setBudgetCredits(Math.ceil(draft.budgetMicrocredits / 1_000_000));
        pendingSelectionRef.current = { indexes: draft.selectedChapters, count: draft.chapterCount };
        setSourceText(draft.form.sourceText);
    }, [draftQuery.data]);
    useEffect(() => {
        const pending = pendingSelectionRef.current;
        if (!analysis || !pending) return;
        pendingSelectionRef.current = null;
        // 拆章规则变化导致章数对不上时回到默认选择，不按下标硬套到别的章节上。
        if (analysis.chapters.length === pending.count) setPicked({ source: analysis, chapters: new Set(pending.indexes) });
    }, [analysis]);
    const onDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void loadFile(file);
    };

    // start=false 保存为草稿（status=draft），连同原始正文与画风一起保存，之后从作品列表回到这里继续编辑。
    const create = useMutation({
        mutationFn: (start: boolean) => {
            const input = {
                name: name.trim(),
                chapters: analysis!.chapters.map((chapter) => ({ title: chapter.title, text: chapter.text })),
                settings: { ...settings, models: resolvedModels },
                budgetMicrocredits: Math.max(0, Math.round((budgetCredits || 0) * 1_000_000)),
                start,
                sourceFormat,
                episodeMode,
                // 没选中的章节照常上传，保存为预留章节，之后在制作台加入。
                ...(allSelected ? {} : { selectedChapters: selectedIndexes }),
                ...(start ? {} : { draft: { sourceText, styleId } }),
            };
            return draftId ? saveDramaDraft(draftId, input) : createDrama(input);
        },
        onSuccess: async (summary, start) => {
            const canvasId = linkCanvasRef.current;
            if (canvasId) {
                linkCanvasRef.current = undefined;
                const { warning } = await linkCanvasToDrama(canvasId, summary.project.id);
                if (warning) message.warning(warning);
            }
            if (start) {
                navigate(`/projects/${summary.project.id}`, { replace: true });
                return;
            }
            message.success(_creationText("creation.c40234a899e084e6"));
            // 新建的草稿换成草稿地址，再次保存时替换同一个草稿而不是再建一个。
            if (!draftId) {
                hydratedRef.current = summary.project.id;
                navigate(`/projects/new?draft=${encodeURIComponent(summary.project.id)}`, { replace: true });
            }
        },
        onError: (error) => message.error(error instanceof ApiError || error instanceof Error ? error.message : _creationText("creation.7e6a71efbf63fd6f")),
    });
    const tooLong = longSelected > 0 || Boolean(oversizedGroup);
    // 草稿不要求模型齐全（服务端只在开工时检查），但画幅与续接方式仍会被服务端校验；分辨率给不出时按模型默认。
    const canSaveDraft = Boolean(analysis && selectedIndexes.length && name.trim() && resolvedModels && !videoRatioProblem && !tailFrameProblem && !tooLong && !create.isPending);
    const canStart = canSaveDraft && missingCapabilities.length === 0;
    const reservedCount = analysis ? analysis.chapters.length - selectedIndexes.length : 0;
    // 超长章节的提示按选择拆开：选中的必须拆开才能开工，没选中的只提醒加入制作前要拆。
    const issues = useMemo(() => {
        if (!analysis) return [];
        const list: Array<{ key: string; message: string; blocking: boolean }> = analysis.issues.filter((issue) => issue.kind !== "too_long").map((issue) => ({ key: issue.kind, message: issue.message, blocking: false }));
        const limit = `${EPISODE_SOURCE_CHARS / 10_000} 万字`;
        if (longSelected) list.push({ key: "too_long_selected", message: `选中的 ${longSelected} ${perEpisode && chaptersPerEpisode === 1 ? "集" : "章"}原文超过 ${limit}，请用“第 N 集”标题拆开，或先取消选中`, blocking: true });
        const longReserved = longChapters.length - longSelected;
        if (longReserved) list.push({ key: "too_long_reserved", message: `另有 ${longReserved} 章原文超过 ${limit}，暂未选中；加入制作前需要拆开`, blocking: false });
        return list;
    }, [analysis, chaptersPerEpisode, longChapters.length, longSelected, perEpisode]);
    const chapterItems = useMemo(
        () =>
            (analysis?.chapters || []).map((chapter, index) => ({
                key: `${index}-${chapter.title}`,
                title: chapter.title,
                words: chapter.words,
                warn: perEpisode ? sourceChars(chapter.text) > EPISODE_SOURCE_CHARS : chapter.words < 200,
            })),
        [analysis, perEpisode],
    );

    const previewChapter = analysis?.chapters[previewIndex];
    const reset = () => {
        setSourceText("");
        setPasteText("");
        setName("");
        setPreviewIndex(0);
        setPicked(null);
    };

    // 刚保存的新草稿换成草稿地址时表单已在页面上，不再显示读取状态。
    if (draftId && !draftQuery.data && hydratedRef.current !== draftId) {
        return (
            <WorkspacePage fluid scroll={false}>
                {draftQuery.isError ? (
                    <WorkspaceErrorState
                        title={_creationText("creation.068428025087c163")}
                        description={draftQuery.error instanceof Error ? draftQuery.error.message : _creationText("creation.744eadb6b115f019")}
                        actionLabel="返回作品列表"
                        onRetry={() => navigate("/projects")}
                    />
                ) : (
                    <WorkspaceLoadingState label={_creationText("creation.11a048e3089f270f")} />
                )}
            </WorkspacePage>
        );
    }

    if (!analysis) {
        return (
            <WorkspacePage fluid scroll={false}>
                <div className="drama-root drama-compose-empty">
                    <header className="drama-compose-head">
                        <Link to="/projects">
                            <Button type="text" shape="circle" icon={<ArrowLeft className="size-4" />} aria-label={_creationText("projects.return_to_list")} />
                        </Link>
                        <h1>{_creationText("projects.create")}</h1>
                    </header>
                    <div className="drama-compose-formats">
                        <SourceFormatPicker value={sourceFormat} onChange={setSourceFormat} row />
                    </div>
                    <div
                        className={`drama-drop ${dragOver ? "is-over" : ""}`}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop}
                    >
                        {pasteMode ? (
                            <div className="grid w-full max-w-[860px] gap-3">
                                <Input.TextArea
                                    autoFocus
                                    value={pasteText}
                                    onChange={(event) => setPasteText(event.target.value)}
                                    placeholder={_creationText("creation.8950267da3835c28", { value1: SOURCE_FORMAT_LABEL[sourceFormat].placeholder, value2: sourceFormat === "novel" ? "" : _creationText("creation.24a4e6859c59204a") })}
                                    autoSize={{ minRows: 14, maxRows: 24 }}
                                />
                                <div className="flex justify-end gap-2">
                                    <Button onClick={() => setPasteMode(false)}>{_creationText("common.cancel")}</Button>
                                    <Button type="primary" disabled={!pasteText.trim()} onClick={() => loadText(pasteText)}>
                                        {_creationText("creation.90ebc7055d441a6d")}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <span className="drama-drop-icon">
                                    <BookOpenText className="size-7" />
                                </span>
                                <h2>{_creationText("creation.41418eeb93a4f9c2", { value1: SOURCE_FORMAT_LABEL[sourceFormat].title })}</h2>
                                <p>
                                    {_creationText("creation.19eafdf264729e3b")}
                                    {sourceFormat === "novel" ? _creationText("creation.2e8d7cf8e5631278") : _creationText("creation.c7bd76c9be25451d")}
                                </p>
                                <Button type="primary" size="large" icon={<FileUp className="size-4" />} onClick={() => fileInputRef.current?.click()}>
                                    {_creationText("creation.d49c54fa9d2b95ca", { value1: SOURCE_FORMAT_LABEL[sourceFormat].title })}
                                </Button>
                                <button type="button" className="drama-link inline-flex items-center gap-1" onClick={() => setPasteMode(true)}>
                                    <ClipboardPaste className="size-3.5" />
                                    {_creationText("creation.3bb943ca31dabae9")}
                                </button>
                                <div className="drama-drop-steps">
                                    {[sourceFormat === "storyboard" ? "导入分镜" : "解析分集", "建立角色、道具与场景", sourceFormat === "novel" ? "改编剧本与段提示词" : "拆镜与段提示词", "按剧情段生成视频", "合成成片"].map((step, index) => (
                                        <span key={step}>
                                            <b>{index + 1}</b>
                                            {step}
                                        </span>
                                    ))}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".txt,.md,.markdown,text/plain,text/markdown"
                                    className="hidden"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) void loadFile(file);
                                        event.target.value = "";
                                    }}
                                />
                            </>
                        )}
                    </div>
                </div>
            </WorkspacePage>
        );
    }

    return (
        <WorkspacePage fluid scroll={false}>
            <div className="drama-root drama-compose">
                {/* 左：小说目录 */}
                <aside className="drama-compose-novel">
                    <header className="drama-compose-head">
                        <Link to="/projects">
                            <Button type="text" shape="circle" icon={<ArrowLeft className="size-4" />} aria-label={_creationText("projects.return_to_list")} />
                        </Link>
                        <h1>{draftId ? _creationText("creation.9d0eedd99d2bdac6") : _creationText("projects.create")}</h1>
                        <Button size="small" type="text" className="!ml-auto" onClick={reset}>
                            {_creationText("creation.1e2b12fb35a8d18f")}
                        </Button>
                    </header>
                    <div className="drama-stats">
                        <div className="drama-stat">
                            <div className="drama-stat-value">
                                {formatCount(selectedIndexes.length)}
                                {reservedCount ? <small className="drama-stat-total"> / {formatCount(analysis.chapters.length)}</small> : null}
                            </div>
                            <div className="drama-stat-label">{perEpisode ? _creationText("creation.dd959b9771902e05") : _creationText("creation.845e5159e41aa43f")}</div>
                        </div>
                        <div className="drama-stat">
                            <div className="drama-stat-value">{formatCount(selectedWords)}</div>
                            <div className="drama-stat-label">{_creationText("creation.c55038b272b109b8")}</div>
                        </div>
                        <div className="drama-stat">
                            <div className="drama-stat-value">{estimate && selectedIndexes.length ? `≈${estimate.episodes}` : "—"}</div>
                            <div className="drama-stat-label">{_creationText("creation.5bbadd8f8c4f781d")}</div>
                        </div>
                    </div>
                    {issues.length ? (
                        <div className="drama-issues">
                            {issues.map((issue) => (
                                <div key={issue.key} className={`drama-issue ${issue.blocking ? "is-blocking" : ""}`} role={issue.blocking ? "alert" : undefined}>
                                    <AlertTriangle className="size-3.5" />
                                    {_creationLabel(issue.message)}
                                </div>
                            ))}
                        </div>
                    ) : null}
                    <ChapterPickList items={chapterItems} selected={selection} onChange={(next) => setPicked({ source: analysis, chapters: next })} previewIndex={previewIndex} onPreview={setPreviewIndex} />
                    <p className="drama-chapter-pick-note">{reservedCount ? _creationText("creation.2d5133762ed70f79", { value1: formatCount(reservedCount) }) : _creationText("creation.5eadd24a96227430")}</p>
                </aside>

                {/* 中：风格与审阅，下方原文预览 */}
                <main className="drama-compose-main thin-scrollbar">
                    <section>
                        <div className="drama-section-title">
                            <h2>{_creationText("creation.2d566ed0b16d02d9")}</h2>
                            <span>{sourceFormat === "novel" ? _creationText("creation.76696f06b3f7627a") : _creationText("creation.7cac90c6322290c8")}</span>
                        </div>
                        <div className="grid gap-3">
                            <SourceFormatPicker value={sourceFormat} onChange={setSourceFormat} row />
                            {sourceFormat === "novel" ? (
                                <div className="drama-media-modes is-row is-two" role="radiogroup" aria-label={_creationText("projects.drama_episode_split")}>
                                    {_creationOptions(EPISODE_MODES).map((mode) => (
                                        <button key={mode.value} type="button" role="radio" aria-checked={chapterMode === mode.value} className="drama-media-mode" onClick={() => setChapterMode(mode.value)}>
                                            <span className="drama-radio" />
                                            <span>
                                                <strong>
                                                    {mode.title}
                                                    {mode.value === "chapter" ? <em>{_creationText("workbench.recommended")}</em> : null}
                                                </strong>
                                                <span>{mode.detail}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                            {sourceFormat === "novel" && perEpisode ? (
                                <EpisodeGroupField
                                    value={groupSize}
                                    onChange={setGroupSize}
                                    chapterCount={analysis.chapters.length}
                                    error={oversizedGroup ? _creationText("creation.804088c724259ca1", { value1: oversizedGroup.label, value2: formatCount(oversizedGroup.chars), value3: formatCount(EPISODE_GROUP_CHARS) }) : undefined}
                                />
                            ) : null}
                        </div>
                    </section>
                    <DramaStylePicker value={styleId} onChange={setStyleId} disabled={create.isPending} />
                    <section>
                        <div className="drama-section-title">
                            <h2>{_creationText("creation.f074a508d31551f1")}</h2>
                            <span>{_creationText("creation.78b321ef092316f3")}</span>
                        </div>
                        <DramaTextSteps
                            models={resolvedModels}
                            onModelsChange={(patch) => setModels((current) => ({ ...current, ...patch }))}
                            skills={{ bible: bibleSkill, script: scriptSkill, prompt: promptSkill }}
                            onSkillChange={(step, value) => (step === "bible" ? setBibleSkill(value) : step === "script" ? setScriptSkill(value) : setPromptSkill(value))}
                            textThinking={textThinking}
                            onThinkingChange={(step, level) => setTextThinking((current) => ({ ...current, [step]: level === "auto" ? undefined : level }))}
                        />
                    </section>
                    <section>
                        <div className="drama-section-title">
                            <h2>{_creationText("workbench.ref_image_short")}</h2>
                            <span>{_creationText("creation.2083238c8106cad9")}</span>
                        </div>
                        <div className="grid gap-3">
                            <DramaAssetImageModels models={resolvedModels} onModelsChange={(patch) => setModels((current) => ({ ...current, ...patch }))} assets={assets} onAssetsChange={setAssetDraft} />
                            <AssetSchemePicker value={assets} onChange={setAssetDraft} sample={{ style: style?.prompt || "", characterName: "主角", sceneName: "主场景" }} layout="compact" imageModel={imageOption} />
                        </div>
                    </section>
                    <section>
                        <div className="drama-section-title">
                            <h2>{_creationText("creation.cff64d1df754bb51")}</h2>
                            <span>{_creationText("creation.b4160ac31c723907")}</span>
                        </div>
                        <StoryboardRules value={storyboard} onChange={setStoryboard} episodeSeconds={episodeSeconds} maxVideoSeconds={videoOption?.maxVideoSeconds} videoModelLabel={resolvedModels?.video?.label} />
                    </section>
                    <section>
                        <div className="drama-section-title">
                            <h2>{_creationText("projects.review_mode")}</h2>
                            <span>{_creationText("creation.abf9efda2936ce45")}</span>
                        </div>
                        <div className="drama-review-modes" role="radiogroup" aria-label={_creationText("projects.review_mode")}>
                            {REVIEW_MODES.map((mode) => (
                                <button key={mode.value} type="button" role="radio" aria-checked={reviewMode === mode.value} className="drama-review-mode" onClick={() => setReviewMode(mode.value)}>
                                    <span className="drama-radio" />
                                    <span>
                                        <strong>{mode.title}</strong>
                                        <span>{mode.detail}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                    {previewChapter ? (
                        <section className="drama-compose-preview">
                            <div className="drama-section-title">
                                <h2>{previewChapter.title}</h2>
                                <span>{_creationText("creation.8c24646406bceb90", { value1: formatCount(previewChapter.words) })}</span>
                            </div>
                            <div className="drama-compose-text thin-scrollbar">
                                {previewChapter.text.slice(0, 6000)}
                                {previewChapter.text.length > 6000 ? "……" : ""}
                            </div>
                        </section>
                    ) : null}
                </main>

                {/* 右：作品设置与启动 */}
                <aside className="drama-compose-side">
                    <div className="drama-compose-side-scroll thin-scrollbar">
                        <label className="block">
                            <div className="drama-option-label">{_creationText("creation.35c086955049999d")}</div>
                            <Input size="large" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder={_creationText("creation.35c086955049999d")} />
                        </label>
                        <div>
                            <div className="drama-option-label">{_creationText("creation.9b7a0bf8b5258a13")}</div>
                            <div className="drama-ratio-group" role="group" aria-label={_creationText("creation.9b7a0bf8b5258a13")}>
                                {RATIOS.map((ratio) => (
                                    <button key={ratio.value} type="button" className="drama-ratio" aria-pressed={aspectRatio === ratio.value} onClick={() => setAspectRatio(ratio.value)}>
                                        <span className="drama-ratio-shape" style={{ width: ratio.w, height: ratio.h }} />
                                        {_creationLabel(ratio.label)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="block">
                                <div className="drama-option-label">{_creationText("creation.e2880b26fb73cac1")}</div>
                                <EpisodeDurationInput value={episodeSeconds} onChange={setEpisodeSeconds} />
                            </div>
                            <label className="block">
                                <div className="drama-option-label">{_creationText("creation.f195d8a2459126bc")}</div>
                                <Select className="w-full" value={language} onChange={setLanguage} options={_creationOptions(LANGUAGES.map((value) => ({ value, label: value })))} />
                            </label>
                        </div>
                        <div>
                            <div className="drama-option-label">{_creationText("projects.generation_pacing")}</div>
                            <div className="drama-media-modes" role="radiogroup" aria-label={_creationText("projects.generation_pacing")}>
                                {(Object.keys(MEDIA_MODE_LABEL) as DramaMediaMode[]).map((mode) => (
                                    <button key={mode} type="button" role="radio" aria-checked={mediaMode === mode} className="drama-media-mode" onClick={() => setMediaMode(mode)}>
                                        <span className="drama-radio" />
                                        <span>
                                            <strong>
                                                {_creationLabel(MEDIA_MODE_LABEL[mode].title)}
                                                {mode === "manual" ? <em>{_creationText("workbench.recommended")}</em> : null}
                                            </strong>
                                            <span>{_creationLabel(MEDIA_MODE_LABEL[mode].detail)}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div className="drama-option-label">{_creationText("creation.3656248ae83b8212")}</div>
                            <div className="drama-media-modes" role="radiogroup" aria-label={_creationText("creation.3656248ae83b8212")}>
                                {(Object.keys(VIDEO_CONTINUITY_LABEL) as DramaVideoContinuity[]).map((mode) => (
                                    <button key={mode} type="button" role="radio" aria-checked={videoContinuity === mode} className="drama-media-mode" onClick={() => setVideoContinuity(mode)}>
                                        <span className="drama-radio" />
                                        <span>
                                            <strong>{_creationLabel(VIDEO_CONTINUITY_LABEL[mode].title)}</strong>
                                            <span>{_creationLabel(VIDEO_CONTINUITY_LABEL[mode].detail)}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                            {tailFrameProblem ? (
                                <p className="drama-cfg-note" role="alert">
                                    {_creationText("creation.7bfab741960eeaaf")}
                                </p>
                            ) : null}
                        </div>
                        <section className="drama-compose-models" aria-label={_creationText("creation.3909481ae334f9fd")}>
                            <div className="drama-compose-models-head">
                                <Cpu className="size-4 text-[var(--workspace-accent)]" />
                                <strong>{_creationText("creation.3909481ae334f9fd")}</strong>
                                <span>{catalogQuery.isLoading ? _creationText("creation.51d0ae6de08e0b60") : _creationText("creation.17b7f61e136d2545")}</span>
                            </div>
                            {(Object.keys(CAPABILITY_LABEL) as DramaCapability[]).map((capability) => (
                                <div key={capability} className="drama-compose-model-row">
                                    <span>{CAPABILITY_LABEL[capability]}</span>
                                    <DramaModelPicker
                                        capability={capability}
                                        size="sm"
                                        showPrice={false}
                                        aspectRatio={aspectRatio}
                                        value={resolvedModels?.[capability]}
                                        placeholder={_creationText("creation.d6e0385d73f38b9b", { value1: CAPABILITY_LABEL[capability] })}
                                        onChange={(choice) => {
                                            setModels((current) => ({ ...current, [capability]: choice }));
                                            if (capability !== "video" || !catalogQuery.data) return;
                                            const next = catalogQuery.data.options.video?.find((option) => dramaChoiceKey(option.choice) === dramaChoiceKey(choice));
                                            if (!next) return;
                                            // 模型与分辨率一起更新：新模型支持就保留，不支持就回到它的默认档。
                                            setVideoResolution((current) => dramaResolutionAfterModelChange(next, current));
                                        }}
                                    />
                                </div>
                            ))}
                            <div className="drama-compose-model-row">
                                <span>{_creationText("creation.458920ec58f79783")}</span>
                                <VideoResolutionField option={videoOption} value={videoResolution} onChange={setVideoResolution} />
                            </div>
                            {videoRatioProblem ? (
                                <p className="drama-cfg-note" role="alert">
                                    {_creationText("creation.1d89859f04b1c59e", { value1: videoRatioProblem })}
                                </p>
                            ) : null}
                            {videoOption?.generateAudio === false ? <p className="drama-cfg-note">{_creationText("creation.7675c15706918653")}</p> : null}
                        </section>
                        <div className="drama-field">
                            <div className="drama-field-label">
                                <span>{_creationText("projects.budget_cap")}</span>
                                <small>{_creationText("creation.f17309f63f8cde93")}</small>
                            </div>
                            <InputNumber className="!w-full" min={0} precision={0} value={budgetCredits} onChange={(value) => setBudgetCredits(value ?? 0)} suffix="积分" aria-label={_creationText("projects.budget_cap")} />
                        </div>
                        {unavailableCapabilities.length ? (
                            <p className="flex items-start gap-2 text-[var(--fs-tiny)] leading-5 text-[var(--status-error)]">
                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                                {_creationText("creation.83fd382e4103ba40")}
                                {unavailableCapabilities.map((capability) => CAPABILITY_LABEL[capability]).join("、")}
                                {_creationText("creation.bfff2e708ff1f303")}
                            </p>
                        ) : null}
                        {noFittingVideo ? (
                            <p className="flex items-start gap-2 text-[var(--fs-tiny)] leading-5 text-[var(--status-error)]">
                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                                {videoContinuity === "tail_frame" ? _creationText("creation.08e5f69ec88a7687", { value1: aspectRatio }) : _creationText("creation.c5cd501ddef24248", { value1: aspectRatio })}
                            </p>
                        ) : null}
                    </div>
                    <footer className="drama-compose-launch">
                        <div className="drama-compose-estimate">
                            <div>
                                <b>{estimate ? _creationText("creation.3d3f365c4904a20c", { value1: estimate.episodes }) : "—"}</b>
                                <span>
                                    {_creationText("creation.5890c084b9317bb1")}
                                    {estimate?.durationMinutes ?? "—"}
                                    {_creationText("creation.bd957bc497aa1a41")}
                                </span>
                            </div>
                            <div>
                                <b>{estimate ? formatCount(estimate.shots) : "—"}</b>
                                <span>{_creationText("projects.shot")}</span>
                            </div>
                            <div title={estimate?.priced ? _creationText("creation.7f255fa4801167d7", { value1: formatCredits(estimate.minMicrocredits), value2: formatCredits(estimate.maxMicrocredits) }) : undefined}>
                                <b className="is-wrap">{estimate?.priced ? `${formatCredits(estimate.minMicrocredits)}–${formatCredits(estimate.maxMicrocredits)}` : "—"}</b>
                                <span>{_creationText("creation.c3ed5be07e189c1d")}</span>
                            </div>
                        </div>
                        {mediaMode === "manual" ? (
                            <div className="text-[var(--fs-tiny)] text-foreground/50">{_creationText("creation.db9628732d72920f")}</div>
                        ) : reviewMode === "sample" && estimate?.priced ? (
                            <div className="text-[var(--fs-tiny)] text-foreground/50">{_creationText("creation.2adddad7cc4c7866", { value1: formatCredits(estimate.sampleMicrocredits) })}</div>
                        ) : null}
                        {estimate?.note ? <div className="text-[var(--fs-micro)] text-foreground/40">{estimate.note}</div> : null}
                        {!selectedIndexes.length ? <div className="text-[var(--fs-tiny)] text-[var(--status-error)]">{_creationText("creation.5cd8e92b80fd3483")}</div> : null}
                        <Button type="primary" size="large" block icon={<Play className="size-4" />} disabled={!canStart} loading={create.isPending && create.variables === true} onClick={() => create.mutate(true)}>
                            {mediaMode === "manual" ? _creationText("creation.fcf3b51986b9f770") : _creationText("creation.a87a50bae318b157")}
                            {reservedCount && selectedIndexes.length ? _creationText("creation.5ba4c2259e82e520", { value1: formatCount(selectedIndexes.length) }) : ""}
                        </Button>
                        <Button size="large" block disabled={!canSaveDraft} loading={create.isPending && create.variables === false} onClick={() => create.mutate(false)}>
                            {_creationText("creation.99e3d8a58fc31ae5")}
                        </Button>
                    </footer>
                </aside>
            </div>
        </WorkspacePage>
    );
}
