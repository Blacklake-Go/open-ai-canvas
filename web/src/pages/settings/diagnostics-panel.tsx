import { App, Button, Input } from "antd";
import { Select } from "@/components/ui/base/select";
import { Activity, CheckCircle2, Clock3, Download, FileText, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { exportDiagnosticBundle, downloadDiagnosticBundle, previewDiagnosticBundle, type DiagnosticExportInput, type DiagnosticPreview } from "@/services/diagnostics/diagnostics-api";
import { getClientDiagnosticEvents, getDiagnosticRuntime } from "@/services/diagnostics/client-diagnostics";
import { useI18n } from "@/supdance/plugins/i18n";

type DiagnosticsPanelProps = {
    taskId?: string;
    projectId?: string;
};

type DiagnosticRange = "15m" | "30m" | "1h" | "24h";

function getRangeOptions(t: (keyOrText: string, params?: Record<string, string | number>, fallbackText?: string) => string): { value: DiagnosticRange; label: string }[] {
    return [
        { value: "15m", label: t("settings.diag_win_15m", undefined, "最近 15 分钟") },
        { value: "30m", label: t("settings.diag_win_30m", undefined, "最近 30 分钟") },
        { value: "1h", label: t("settings.diag_win_1h", undefined, "最近 1 小时") },
        { value: "24h", label: t("settings.diag_win_24h", undefined, "最近 24 小时") },
    ];
}

export default function DiagnosticsPanel({ taskId, projectId }: DiagnosticsPanelProps) {
    const { t } = useI18n();
    const { message } = App.useApp();
    const [range, setRange] = useState<DiagnosticRange>("30m");
    const [description, setDescription] = useState("");
    const [preview, setPreview] = useState<DiagnosticPreview | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [bundleId, setBundleId] = useState("");

    const rangeOptions = useMemo(() => getRangeOptions(t), [t]);

    useEffect(() => {
        let cancelled = false;
        setLoadingPreview(true);
        void previewDiagnosticBundle(buildInput(range, undefined, taskId, projectId))
            .then((result) => {
                if (!cancelled) setPreview(result);
            })
            .catch(() => {
                if (!cancelled) setPreview(null);
            })
            .finally(() => {
                if (!cancelled) setLoadingPreview(false);
            });
        return () => {
            cancelled = true;
        };
    }, [projectId, range, taskId]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const download = await exportDiagnosticBundle(buildInput(range, description, taskId, projectId));
            downloadDiagnosticBundle(download);
            setBundleId(download.bundleId);
            message.success(t("settings.diag_download_success", undefined, "诊断包已下载，请连同诊断编号提交给支持人员"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("settings.diag_export_failed", undefined, "导出诊断包失败"));
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="settings-pane diagnostics-page">
            <div className="settings-section max-w-4xl pb-8">
                <header className="border-b border-border/60 pb-6 pt-1">
                    <div className="mb-3 flex items-center gap-2 text-[var(--fs-tiny)] font-semibold tracking-[0.12em] text-foreground/42">
                        <span className="h-px w-6 bg-[var(--workspace-accent)]" aria-hidden="true" />
                        <span>{t("settings.diag_tool_badge", undefined, "排障工具")}</span>
                    </div>
                    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.72fr)] md:items-end md:gap-10">
                        <div className="min-w-0">
                            <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">{t("settings.diag_heading", undefined, "问题诊断")}</h2>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-foreground/55">{t("settings.diag_heading_desc", undefined, "遇到报错、任务失败或生成卡住时，导出一份给开发人员排查。")}</p>
                        </div>
                        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[.06] px-4 py-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/[.12] text-emerald-600 dark:text-emerald-400">
                                <ShieldCheck className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-foreground/85">{t("settings.diag_sanitized_title", undefined, "默认已脱敏")}</div>
                                <p className="mt-1 text-xs leading-5 text-foreground/55">{t("settings.diag_sanitized_desc", undefined, "不包含 API Key、Cookie、完整提示词或原始媒体。")}</p>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="mt-6 space-y-4">
                    <section className="rounded-xl border border-border/70 bg-background/55 p-4 sm:p-5" aria-labelledby="diagnostic-window-heading">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/55 pb-4">
                            <div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground/85">
                                    <Clock3 className="size-4 text-foreground/55" strokeWidth={1.8} aria-hidden="true" />
                                    <h3 id="diagnostic-window-heading">{t("settings.diag_scope_heading", undefined, "收集范围")}</h3>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-foreground/48">{t("settings.diag_scope_desc", undefined, "选择问题发生前后的日志时间窗口。")}</p>
                            </div>
                            <span className="rounded-full bg-foreground/[.045] px-2 py-1 text-[var(--fs-tiny)] font-medium text-foreground/48">{t("settings.diag_scope_tag", undefined, "最长 24 小时")}</span>
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,230px)_minmax(0,1fr)] md:items-end">
                            <label className="block">
                                <span className="mb-2 block text-xs font-semibold text-foreground/65">{t("settings.diag_time_range_label", undefined, "时间范围")}</span>
                                <Select
                                    ariaLabel={t("settings.diag_time_range_label", undefined, "时间范围")}
                                    className="w-full"
                                    value={range}
                                    options={rangeOptions}
                                    onChange={(value) => {
                                        const next = rangeOptions.find((option) => option.value === value)?.value;
                                        if (next) setRange(next);
                                    }}
                                />
                            </label>
                            <div className="rounded-lg border border-border/55 bg-foreground/[.025] px-4 py-3" aria-live="polite">
                                <div className="flex items-center gap-2 text-sm font-medium text-foreground/78">
                                    <Activity className="size-4 text-emerald-500" strokeWidth={1.8} aria-hidden="true" />
                                    <span>{t("settings.diag_available_records", undefined, "当前账号的可用记录")}</span>
                                </div>
                                <div className="mt-3 grid grid-cols-3 divide-x divide-border/55">
                                    <DiagnosticMetric label={t("settings.diag_metric_fe_events", undefined, "前端事件")} value={loadingPreview ? t("settings.diag_loading_status", undefined, "读取中") : t("settings.diag_metric_fe_events_val", undefined, "最多 500")} />
                                    <DiagnosticMetric label={t("settings.diag_metric_tasks", undefined, "任务")} value={loadingPreview ? t("settings.diag_loading_status", undefined, "读取中") : preview ? String(preview.taskCount) : t("settings.diag_metric_pending", undefined, "待统计")} />
                                    <DiagnosticMetric label={t("settings.diag_metric_upstream", undefined, "上游调用")} value={loadingPreview ? t("settings.diag_loading_status", undefined, "读取中") : preview ? String(preview.apiCallCount) : t("settings.diag_metric_pending", undefined, "待统计")} />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-border/70 bg-background/55 p-4 sm:p-5" aria-labelledby="diagnostic-description-heading">
                        <div className="flex items-start gap-2">
                            <FileText className="mt-0.5 size-4 text-foreground/55" strokeWidth={1.8} aria-hidden="true" />
                            <div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground/85">
                                    <h3 id="diagnostic-description-heading">{t("settings.diag_desc_heading", undefined, "问题描述")}</h3>
                                    <span className="rounded-full bg-foreground/[.045] px-2 py-0.5 text-[var(--fs-tiny)] font-medium text-foreground/42">{t("settings.diag_optional_tag", undefined, "可选")}</span>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-foreground/48">{t("settings.diag_desc_sub", undefined, "用一句话说明现象，帮助开发人员更快定位。")}</p>
                            </div>
                        </div>
                        <label className="mt-4 block" htmlFor="diagnostic-description">
                            <span className="sr-only">{t("settings.diag_desc_sr_only", undefined, "遇到了什么问题？")}</span>
                            <Input.TextArea id="diagnostic-description" rows={4} maxLength={1000} showCount value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("settings.diag_desc_placeholder", undefined, "例如：点击“生成”后一直转圈没有报错，或某条任务失败但提示信息不完整。")} />
                        </label>
                    </section>
                </div>

                <footer className="mt-5 flex flex-col-reverse gap-4 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-md text-xs leading-5 text-foreground/48">{t("settings.diag_footer_hint", undefined, "下载后请把 ZIP 文件和诊断编号一起提交。诊断包不会自动上传到服务器。")}</p>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {bundleId ? (
                            <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[.06] px-2 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300" role="status">
                                <CheckCircle2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                {t("settings.diag_bundle_id", { bundleId }, `诊断编号：${bundleId}`)}
                            </span>
                        ) : null}
                        <Button size="large" type="primary" icon={<Download className="size-4" strokeWidth={2} />} loading={exporting} onClick={() => void handleExport()}>
                            {t("settings.diag_export_btn", undefined, "导出诊断包")}
                        </Button>
                    </div>
                </footer>
            </div>
        </div>
    );
}

function DiagnosticMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 px-3 first:pl-0 last:pr-0">
            <div className="truncate text-[var(--fs-tiny)] text-foreground/45">{label}</div>
            <div className="mt-1 truncate text-sm font-semibold tabular-nums text-foreground/78">{value}</div>
        </div>
    );
}

function buildInput(range: DiagnosticRange, description: string | undefined, taskId?: string, projectId?: string): DiagnosticExportInput {
    const to = new Date();
    const from = new Date(to.getTime() - rangeMilliseconds(range));
    return {
        from: from.toISOString(),
        to: to.toISOString(),
        taskId: taskId || undefined,
        projectId: projectId || undefined,
        description: description || undefined,
        runtime: getDiagnosticRuntime(),
        clientEvents: getClientDiagnosticEvents({ from, to }),
    };
}

function rangeMilliseconds(range: DiagnosticRange) {
    switch (range) {
        case "15m":
            return 15 * 60 * 1000;
        case "1h":
            return 60 * 60 * 1000;
        case "24h":
            return 24 * 60 * 60 * 1000;
        default:
            return 30 * 60 * 1000;
    }
}
