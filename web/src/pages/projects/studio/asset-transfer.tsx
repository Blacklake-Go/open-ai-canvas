import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { App, Button, Checkbox, Input, Progress } from "antd";
import { AlertTriangle, FileArchive, X } from "lucide-react";

import { AppModal } from "@/components/ui/product/app-modal";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { dramaKeys } from "@/lib/drama/drama-query-keys";
import type { DramaEpisodeRow } from "@/services/api/drama";
import { previewDramaJianyingDraft, type JianyingDraftPreview } from "@/services/api/drama-export";
import { formatBytes } from "@/lib/image-utils";
import { applyDramaAssetImport, openDramaAssetPackage, planDramaAssetImport, type DramaAssetImportOptions, type DramaAssetImportPlan, type DramaAssetImportResult, type DramaAssetPackage } from "@/services/drama-asset-import";
import { defaultJianyingDraftRoot, exportDramaAssetPackage, exportDramaJianyingDraft, jianyingDraftRootProblem, savedJianyingDraftRoot, saveJianyingDraftRoot } from "@/services/drama-export";

/** 一键打包资产：全剧设定总会打包；剧集只能选已拆出分镜的。导出不消耗积分。 */
export function AssetPackageModal({ open, projectId, episodes, onClose }: { open: boolean; projectId: string; episodes: DramaEpisodeRow[]; onClose: () => void }) {
    _useCreationLocale();
    const { message } = App.useApp();
    const selectable = useMemo(() => episodes.filter((episode) => episode.shotCount > 0), [episodes]);
    const [picked, setPicked] = useState<Set<string> | null>(null);
    const selected = picked ?? new Set(selectable.map((episode) => episode.id));
    const [media, setMedia] = useState(true);
    const [prompts, setPrompts] = useState(true);
    const chosen = selectable.filter((episode) => selected.has(episode.id));
    const segments = chosen.reduce((sum, episode) => sum + (episode.stats.segments || 0), 0);
    const toggle = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setPicked(next);
    };
    const submit = () => {
        exportDramaAssetPackage(projectId, { episodeIds: chosen.map((episode) => episode.id), media, prompts }, (text) => message.error(text));
        message.info(media ? _creationText("creation.9ffaa8354a7f2444") : _creationText("creation.6d3ce1b92f8595ff"));
        onClose();
    };
    return (
        <AppModal open={open} onCancel={onClose} footer={null} title={null} closable={false} flush centered width="min(640px, calc(100vw - 32px))" rootClassName="drama-root" aria-label={_creationText("projects.export_assets")}>
            <div className="drama-composer drama-transfer">
                <header className="drama-composer-head">
                    <div className="min-w-0">
                        <strong>{_creationText("projects.export_assets")}</strong>
                        <span>{_creationText("creation.1dfbd5eaddfde7d5")}</span>
                    </div>
                    <Button type="text" icon={<X className="size-4" />} aria-label={_creationText("common.close")} onClick={onClose} />
                </header>
                <div className="drama-transfer-body thin-scrollbar">
                    <div className="drama-transfer-row">
                        <span className="drama-composer-label">{_creationText("creation.cb9a20776230420e")}</span>
                        <Button size="small" disabled={!selectable.length} onClick={() => setPicked(chosen.length === selectable.length ? new Set() : new Set(selectable.map((episode) => episode.id)))}>
                            {chosen.length === selectable.length && selectable.length ? _creationText("creation.f4d4bae588c4c0ff") : _creationText("creation.3a5040b68abf75f9")}
                        </Button>
                    </div>
                    {episodes.length ? (
                        <div className="drama-transfer-episodes" role="group" aria-label={_creationText("creation.8a23988fee7f643b")}>
                            {episodes.map((episode) => {
                                const disabled = episode.shotCount <= 0;
                                return (
                                    <button
                                        key={episode.id}
                                        type="button"
                                        className="drama-transfer-episode"
                                        aria-pressed={selected.has(episode.id) && !disabled}
                                        disabled={disabled}
                                        title={disabled ? _creationText("creation.ea5ce3e6962393e2") : episode.title}
                                        onClick={() => toggle(episode.id)}
                                    >
                                        {_creationText("creation.472fdd4479a1dde5", { value1: String(episode.number).padStart(2, "0") })}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="drama-transfer-note">{_creationText("creation.1f78f5a5c52f220e")}</p>
                    )}
                    <div className="drama-transfer-options">
                        <Checkbox checked={media} onChange={(event) => setMedia(event.target.checked)}>
                            {_creationText("creation.ebecbae11f9a8272")}
                        </Checkbox>
                        <Checkbox checked={prompts} onChange={(event) => setPrompts(event.target.checked)}>
                            {_creationText("creation.f6426f9ee15f9d5a")}
                        </Checkbox>
                    </div>
                    <p className="drama-transfer-note">{_creationText("creation.d0f71e12bd7aae00")}</p>
                </div>
                <footer className="drama-composer-foot">
                    <span className="drama-composer-count">
                        {_creationText("creation.7ecf1cde648680d2")}
                        {chosen.length}
                        {_creationText("creation.5bbadd8f8c4f781d")}
                        {media && segments ? _creationText("creation.f53df91118552c52", { value1: segments }) : ""}
                    </span>
                    <span className="flex-1" />
                    <Button onClick={onClose}>{_creationText("common.cancel")}</Button>
                    <Button type="primary" disabled={!media && !prompts} onClick={submit}>
                        {_creationText("creation.ba53ab74b75a6f00")}
                    </Button>
                </footer>
            </div>
        </AppModal>
    );
}

const IMPORT_DEFAULTS: DramaAssetImportOptions = { castImages: true, castText: false, segmentPrompts: true, shotPrompts: false };

/** 导入资产包：按设定类型与名称、集号与段号匹配当前作品，先预览再写入。 */
export function AssetImportModal({ open, projectId, onClose }: { open: boolean; projectId: string; onClose: () => void }) {
    _useCreationLocale();
    const brand = useAppearanceStore((state) => state.appearance.brandName);
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const inputRef = useRef<HTMLInputElement>(null);
    const [pkg, setPkg] = useState<DramaAssetPackage>();
    const [fileName, setFileName] = useState("");
    const [opening, setOpening] = useState(false);
    const [options, setOptions] = useState(IMPORT_DEFAULTS);
    const [plan, setPlan] = useState<{ source: DramaAssetPackage; options: DramaAssetImportOptions; value?: DramaAssetImportPlan; error?: string }>();
    const [progress, setProgress] = useState<{ done: number; total: number }>();
    const [result, setResult] = useState<DramaAssetImportResult>();
    const importing = Boolean(progress) && !result;
    const prompts = pkg?.manifest.includes?.prompts === true;

    useEffect(() => {
        if (!pkg || result) return;
        let active = true;
        planDramaAssetImport(projectId, pkg, options)
            .then((value) => active && setPlan({ source: pkg, options, value }))
            .catch((error) => active && setPlan({ source: pkg, options, error: error instanceof Error ? error.message : "读取当前作品失败" }));
        return () => {
            active = false;
        };
    }, [options, pkg, projectId, result]);
    const currentPlan = plan?.source === pkg && plan?.options === options ? plan : undefined;

    const reset = () => {
        setPkg(undefined);
        setFileName("");
        setPlan(undefined);
        setProgress(undefined);
        setResult(undefined);
        setOptions(IMPORT_DEFAULTS);
    };
    const close = () => {
        if (importing) return;
        reset();
        onClose();
    };
    const choose = async (file: File | undefined) => {
        if (!file) return;
        setOpening(true);
        try {
            const opened = await openDramaAssetPackage(file);
            setPkg(opened);
            setFileName(file.name);
            setPlan(undefined);
            setResult(undefined);
            setProgress(undefined);
            const hasPrompts = opened.manifest.includes?.prompts === true;
            setOptions({ ...IMPORT_DEFAULTS, segmentPrompts: hasPrompts, shotPrompts: false });
        } catch (error) {
            message.error(error instanceof Error ? error.message : _creationText("creation.1e4f32e04997e3ff"));
        } finally {
            setOpening(false);
        }
    };
    const run = async () => {
        if (!pkg || !currentPlan?.value?.operations.length) return;
        setProgress({ done: 0, total: currentPlan.value.operations.length });
        const outcome = await applyDramaAssetImport(projectId, pkg, currentPlan.value, (done, total) => setProgress({ done, total }));
        setResult(outcome);
        await Promise.all([queryClient.invalidateQueries({ queryKey: dramaKeys.summary(projectId) }), queryClient.invalidateQueries({ queryKey: dramaKeys.cast(projectId) }), queryClient.invalidateQueries({ queryKey: dramaKeys.episodes(projectId) })]);
        if (outcome.failed.length) message.warning(_creationText("creation.19d47ba55f07bb8b", { value1: outcome.succeeded, value2: outcome.failed.length }));
        else message.success(_creationText("creation.d67dcc88043f95bc", { value1: outcome.succeeded }));
    };
    const counts = useMemo(() => {
        const operations = currentPlan?.value?.operations || [];
        return {
            images: operations.filter((item) => item.kind === "cast-image").length,
            texts: operations.filter((item) => item.kind === "cast-text").length,
            segments: operations.filter((item) => item.kind === "segment-prompt").length,
            shots: operations.filter((item) => item.kind === "shot-prompt").length,
        };
    }, [currentPlan]);
    const option = (key: keyof DramaAssetImportOptions) => ({ checked: options[key], disabled: importing || Boolean(result), onChange: (event: { target: { checked: boolean } }) => setOptions({ ...options, [key]: event.target.checked }) });

    return (
        <AppModal open={open} onCancel={close} footer={null} title={null} closable={false} flush centered width="min(680px, calc(100vw - 32px))" rootClassName="drama-root" aria-label={_creationText("projects.import_assets")}>
            <div className="drama-composer drama-transfer">
                <header className="drama-composer-head">
                    <div className="min-w-0">
                        <strong>{_creationText("projects.import_assets")}</strong>
                        <span>{_creationText("creation.860e0263da320531", { brand })}</span>
                    </div>
                    <Button type="text" icon={<X className="size-4" />} aria-label={_creationText("common.close")} disabled={importing} onClick={close} />
                </header>
                <div className="drama-transfer-body thin-scrollbar">
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".zip,application/zip"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            void choose(file);
                        }}
                    />
                    <div className="drama-transfer-file">
                        <FileArchive className="size-5 shrink-0" aria-hidden />
                        <div className="min-w-0 flex-1">
                            {pkg ? (
                                <>
                                    <strong title={fileName}>{fileName}</strong>
                                    <span>
                                        {_creationText("creation.13b186b0ffa7a310")}
                                        {pkg.manifest.drama.name}」 · {pkg.manifest.cast.length}
                                        {_creationText("creation.2a54271f6424512b")}
                                        {pkg.manifest.episodes.length}
                                        {_creationText("creation.5bbadd8f8c4f781d")}
                                        {prompts ? _creationText("creation.62ca10bfd30ebcbf") : _creationText("creation.c3b739ada1c4c484")}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <strong>{_creationText("creation.3b45ddea375cbc26")}</strong>
                                    <span>{_creationText("creation.bf5829d17bc12ee9")}</span>
                                </>
                            )}
                        </div>
                        <Button loading={opening} disabled={importing} onClick={() => inputRef.current?.click()}>
                            {pkg ? _creationText("creation.9b904c0e2fafe983") : _creationText("creation.822fb37dba29381a")}
                        </Button>
                    </div>
                    {pkg ? (
                        <>
                            <div className="drama-transfer-options">
                                <Checkbox {...option("castImages")}>{_creationText("creation.b0ab030580a4a69d")}</Checkbox>
                                <Checkbox {...option("castText")}>{_creationText("creation.cbb6ddabd175d8f0")}</Checkbox>
                                <Checkbox {...option("segmentPrompts")} disabled={!prompts || importing || Boolean(result)}>
                                    {_creationText("creation.26ff60a4cb28344c")}
                                </Checkbox>
                                <Checkbox {...option("shotPrompts")} disabled={!prompts || importing || Boolean(result)}>
                                    {_creationText("creation.99359203b6457a9e")}
                                </Checkbox>
                            </div>
                            <p className="drama-transfer-note">{_creationText("creation.acc84feaf8a09df3")}</p>
                            <div className="drama-transfer-plan" role="status">
                                {currentPlan?.error ? (
                                    <span className="drama-transfer-problem">
                                        <AlertTriangle className="size-4 shrink-0" />
                                        {currentPlan.error}
                                    </span>
                                ) : !currentPlan ? (
                                    <span>{_creationText("creation.a4121110978b1c8d")}</span>
                                ) : (
                                    <span>{_creationText("creation.d8fad4bd67187902", { value1: currentPlan.value!.operations.length, value2: counts.images, value3: counts.texts, value4: counts.segments, value5: counts.shots })}</span>
                                )}
                                {progress ? <Progress percent={Math.round((progress.done / Math.max(progress.total, 1)) * 100)} size="small" /> : null}
                                {currentPlan?.value?.skipped.length ? (
                                    <details>
                                        <summary>{_creationText("creation.a3c2e787a5df3a31", { value1: currentPlan.value.skipped.length })}</summary>
                                        <ul>
                                            {currentPlan.value.skipped.map((item) => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ul>
                                    </details>
                                ) : null}
                                {result?.failed.length ? (
                                    <details open>
                                        <summary>{_creationText("creation.8646147736cb1d12", { value1: result.failed.length })}</summary>
                                        <ul>
                                            {result.failed.map((item) => (
                                                <li key={item.label}>
                                                    {item.label}：{item.message}
                                                </li>
                                            ))}
                                        </ul>
                                    </details>
                                ) : null}
                            </div>
                        </>
                    ) : null}
                </div>
                <footer className="drama-composer-foot">
                    <span className="drama-composer-count">
                        {result
                            ? _creationText("creation.79c5810be861c0d2", { value1: result.succeeded, value2: result.failed.length ? _creationText("creation.11af39cf036f7c34", { value1: result.failed.length }) : "" })
                            : progress
                              ? _creationText("creation.917de3c1444a4057", { value1: progress.done, value2: progress.total })
                              : ""}
                    </span>
                    <span className="flex-1" />
                    {result ? (
                        <Button type="primary" onClick={close}>
                            {_creationText("settings.channel_complete_btn")}
                        </Button>
                    ) : (
                        <>
                            <Button disabled={importing} onClick={close}>
                                {_creationText("common.cancel")}
                            </Button>
                            <Button type="primary" loading={importing} disabled={!currentPlan?.value?.operations.length} onClick={() => void run()}>
                                {_creationText("creation.bb8aa0ddaaf3e6d1")}
                            </Button>
                        </>
                    )}
                </footer>
            </div>
        </AppModal>
    );
}

/** 先检查媒体与导入目录，再交给浏览器流式下载；页面无法观察附件下载完成。 */
export function JianyingDraftModal({ open, projectId, episodeId, episodeLabel, onClose }: { open: boolean; projectId: string; episodeId: string; episodeLabel: string; onClose: () => void }) {
    _useCreationLocale();
    const [root, setRoot] = useState(() => savedJianyingDraftRoot() || defaultJianyingDraftRoot());
    const [captions, setCaptions] = useState(true);
    const [preview, setPreview] = useState<JianyingDraftPreview | null>(null);
    const [checking, setChecking] = useState(false);
    const [requested, setRequested] = useState(false);
    const [error, setError] = useState("");
    const [allowIncomplete, setAllowIncomplete] = useState(false);
    const [allowStale, setAllowStale] = useState(false);
    const lock = useRef(false);
    const submitted = useRef(false);
    const request = useRef<AbortController | null>(null);
    const download = useRef<ReturnType<typeof exportDramaJianyingDraft> | null>(null);
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        setPreview(null);
        setRequested(false);
        setChecking(false);
        setError("");
        lock.current = false;
        submitted.current = false;
        return () => {
            alive.current = false;
            request.current?.abort();
            download.current?.stopObserving();
        };
    }, [projectId, episodeId, open]);
    const problem = jianyingDraftRootProblem(root);
    const invalidate = () => {
        submitted.current = false;
        setPreview(null);
        setRequested(false);
        setError("");
        setAllowIncomplete(false);
        setAllowStale(false);
    };
    const inspect = async () => {
        if (problem || lock.current) return;
        lock.current = true;
        setChecking(true);
        invalidate();
        download.current?.stopObserving();
        const controller = new AbortController();
        request.current?.abort();
        request.current = controller;
        try {
            const result = await previewDramaJianyingDraft(projectId, episodeId, { draftRoot: root.trim(), captions }, controller.signal);
            if (controller.signal.aborted || !alive.current) return;
            setRoot(result.draftRoot);
            setPreview(result);
        } catch (cause) {
            if (!controller.signal.aborted && alive.current) setError(cause instanceof Error ? cause.message : _creationText("creation.jianying.checkFailed"));
        } finally {
            if (request.current === controller) {
                lock.current = false;
                if (alive.current) setChecking(false);
            }
        }
    };
    const canDownload = Boolean(preview?.availableSegments && (!preview.missingSegments || allowIncomplete) && (!preview.staleSegments || allowStale));
    const submit = () => {
        if (problem || !preview || !canDownload || submitted.current || lock.current) return;
        lock.current = true;
        submitted.current = true;
        setRequested(true);
        setError("");
        saveJianyingDraftRoot(root);
        const fail = (text: string) => {
            if (!alive.current) return;
            setError(text);
            setRequested(false);
            setPreview(null);
            lock.current = false;
            submitted.current = false;
        };
        try {
            download.current = exportDramaJianyingDraft(projectId, episodeId, { draftRoot: preview.draftRoot, captions, revision: preview.revision, allowIncomplete, allowStale }, fail);
        } catch (cause) {
            fail(cause instanceof Error ? cause.message : _creationText("creation.jianying.submitFailed"));
        } finally {
            lock.current = false;
        }
    };
    return (
        <AppModal open={open} onCancel={onClose} footer={null} title={null} closable={false} flush centered width="min(720px, calc(100vw - 32px))" rootClassName="drama-root" aria-label={_creationText("projects.export_draft")}>
            <div className="drama-composer drama-transfer">
                <header className="drama-composer-head">
                    <div className="min-w-0">
                        <strong>{_creationText("creation.3115e0921d5d71aa", { value1: episodeLabel })}</strong>
                        <span>{_creationText("creation.jianying.subtitle")}</span>
                    </div>
                    <Button type="text" icon={<X className="size-4" />} aria-label={_creationText("common.close")} onClick={onClose} />
                </header>
                <div className="drama-transfer-body thin-scrollbar">
                    <label className="drama-composer-field">
                        <span className="drama-composer-label">{_creationText("creation.0b9effef94991935")}</span>
                        <Input
                            aria-label={_creationText("creation.0b9effef94991935")}
                            value={root}
                            disabled={checking || requested}
                            onChange={(event) => {
                                setRoot(event.target.value);
                                invalidate();
                            }}
                            status={problem ? "warning" : undefined}
                            spellCheck={false}
                        />
                        <span className={problem ? "drama-transfer-problem" : "drama-transfer-note"}>{problem || _creationText("creation.jianying.pathPrivacy")}</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="small"
                            disabled={checking || requested}
                            onClick={() => {
                                setRoot(defaultJianyingDraftRoot("windows"));
                                invalidate();
                            }}
                        >
                            {_creationText("creation.jianying.windowsExample")}
                        </Button>
                        <Button
                            size="small"
                            disabled={checking || requested}
                            onClick={() => {
                                setRoot(defaultJianyingDraftRoot("macos"));
                                invalidate();
                            }}
                        >
                            {_creationText("creation.jianying.macosExample")}
                        </Button>
                    </div>
                    <div className="drama-transfer-options">
                        <Checkbox
                            checked={captions}
                            disabled={checking || requested}
                            onChange={(event) => {
                                setCaptions(event.target.checked);
                                invalidate();
                            }}
                        >
                            {_creationText("creation.1b5aa162b70d4cb6")}
                        </Checkbox>
                    </div>
                    {error ? (
                        <p className="drama-transfer-problem" role="alert">
                            {error}
                        </p>
                    ) : null}
                    {preview ? (
                        <div className="drama-transfer-plan" role="status">
                            <strong>
                                {_creationText("creation.jianying.previewSummary", {
                                    available: preview.availableSegments,
                                    total: preview.totalSegments,
                                    duration: (preview.durationMs / 1000).toFixed(1),
                                    size: formatBytes(preview.mediaBytes),
                                })}
                            </strong>
                            {!preview.availableSegments ? <p className="drama-transfer-problem">{_creationText("creation.jianying.noAvailable")}</p> : null}
                            {preview.warnings.length ? (
                                <ul>
                                    {preview.warnings.map((warning) => (
                                        <li key={warning}>{warning}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p>{_creationText("creation.jianying.checked")}</p>
                            )}
                            <details open={preview.missingSegments > 0 || preview.staleSegments > 0}>
                                <summary>{_creationText("creation.jianying.segmentList")}</summary>
                                <ul>
                                    {preview.segments.map((segment) => (
                                        <li key={segment.index}>
                                            {_creationText("creation.jianying.segment", { index: segment.index + 1, title: segment.title })}
                                            {segment.included
                                                ? _creationText("creation.jianying.segmentIncluded", {
                                                      duration: (segment.durationMs / 1000).toFixed(1),
                                                      stale: segment.stale ? _creationText("creation.jianying.stale") : "",
                                                      estimated: segment.durationEstimated ? _creationText("creation.jianying.estimated") : "",
                                                  })
                                                : segment.reason}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                            <div className="drama-transfer-options">
                                {preview.missingSegments > 0 ? (
                                    <Checkbox checked={allowIncomplete} disabled={requested} onChange={(event) => setAllowIncomplete(event.target.checked)}>
                                        {_creationText("creation.jianying.skipIncomplete", { count: preview.missingSegments })}
                                    </Checkbox>
                                ) : null}
                                {preview.staleSegments > 0 ? (
                                    <Checkbox checked={allowStale} disabled={requested} onChange={(event) => setAllowStale(event.target.checked)}>
                                        {_creationText("creation.jianying.useStale", { count: preview.staleSegments })}
                                    </Checkbox>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                    {requested ? (
                        <p className="drama-transfer-note" role="status">
                            {_creationText("creation.jianying.downloadRequested")}
                        </p>
                    ) : null}
                    <ol className="drama-transfer-steps">
                        <li>{_creationText("creation.jianying.step1")}</li>
                        <li>{_creationText("creation.jianying.step2")}</li>
                        <li>{_creationText("creation.jianying.step3")}</li>
                    </ol>
                </div>
                <footer className="drama-composer-foot">
                    <span className="flex-1" />
                    <Button onClick={onClose}>{requested ? _creationText("common.close") : _creationText("common.cancel")}</Button>
                    {requested ? (
                        <Button onClick={() => void inspect()}>{_creationText("creation.jianying.retryCheck")}</Button>
                    ) : preview ? (
                        <>
                            <Button onClick={() => void inspect()}>{_creationText("creation.jianying.recheck")}</Button>
                            <Button type="primary" disabled={!canDownload} onClick={submit}>
                                {_creationText("creation.jianying.confirmDownload")}
                            </Button>
                        </>
                    ) : (
                        <Button type="primary" loading={checking} disabled={Boolean(problem)} onClick={() => void inspect()}>
                            {_creationText("creation.jianying.inspect")}
                        </Button>
                    )}
                </footer>
            </div>
        </AppModal>
    );
}
