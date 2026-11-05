import { creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "antd";
import { AlertCircle, ChevronDown, ChevronRight, ChevronUp, Loader2, RotateCcw } from "lucide-react";

import { listDramaJobs, type DramaJob, type DramaSummary } from "@/services/api/drama";

import { formatCredits } from "../drama-shared";
import { formatJobTime, JOB_KIND_LABEL, JobDetailModal, JobStatusIcon } from "./job-detail";
import { dramaKeys } from "./use-studio";

type JobFilter = "all" | "active" | "failed";

export function QueueBar({ projectId, summary, retrying, onRetry, onJump }: { projectId: string; summary: DramaSummary; retrying: boolean; onRetry: () => void; onJump: (job: DramaJob) => void }) {
    _useCreationLocale();
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState<JobFilter>("all");
    const [detailJob, setDetailJob] = useState<DramaJob>();
    const { jobCounts, production } = summary;
    const failedItems = summary.inbox.filter((item) => item.kind === "segment_failed" || item.kind === "cast_failed" || item.kind === "episode_error").length;
    const jobsQuery = useQuery({ queryKey: dramaKeys.jobs(projectId), queryFn: ({ signal }) => listDramaJobs(projectId, 120, signal), enabled: open, refetchInterval: open ? 3_000 : false });
    const jobs = useMemo(
        () => (jobsQuery.data?.jobs || []).filter((job) => filter === "all" || (filter === "failed" ? job.status === "failed" || Boolean(job.error && job.status === "queued") : job.status === "running" || job.status === "queued")),
        [filter, jobsQuery.data],
    );
    const budget = production.budgetMicrocredits;
    const held = production.heldMicrocredits || 0;
    // 预算进度与后端预算判断同一口径：已扣费加未结算订单的冻结额。
    const committed = production.spentMicrocredits + held;
    const usage = budget ? Math.min(1, committed / budget) : 0;
    return (
        <div className="drama-queue">
            <div className="drama-queue-bar">
                <span className={`drama-queue-stat ${(jobCounts.running || 0) > 0 ? "is-run" : ""}`}>
                    {(jobCounts.running || 0) > 0 ? <Loader2 className="size-3.5 animate-spin" /> : <span className="drama-dot opacity-40" />}
                    {_creationText("tasks.running")}
                    <b>{jobCounts.running || 0}</b>
                </span>
                <span className="drama-queue-stat">
                    {_creationText("creation.117c113c3b45cf89")}
                    <b>{jobCounts.queued || 0}</b>
                </span>
                <span className="drama-queue-stat">
                    {_creationText("workbench.completed_state")}
                    <b>{jobCounts.succeeded || 0}</b>
                </span>
                {failedItems ? (
                    <span className="drama-queue-stat is-err">
                        <AlertCircle className="size-3.5" />
                        {_creationText("creation.91a5c0ac287910a4")}
                        <b>{failedItems}</b>
                    </span>
                ) : null}
                {failedItems ? (
                    <Button size="small" type="text" icon={<RotateCcw className="size-3.5" />} loading={retrying} onClick={onRetry}>
                        {_creationText("creation.57e91697264062af")}
                    </Button>
                ) : null}
                <span className="drama-queue-budget">
                    {budget ? (
                        <span className="drama-queue-meter">
                            <span className={usage >= 0.9 ? "is-warn" : ""} style={{ width: `${Math.max(usage * 100, committed ? 3 : 0)}%` }} />
                        </span>
                    ) : null}
                    {_creationText("settings.wallet_used_storage")}
                    <b>{formatCredits(production.spentMicrocredits)}</b>
                    {held > 0 ? <>{_creationText("creation.820ae0368b94d492", { value1: formatCredits(held) })}</> : null}
                    {budget ? <>{_creationText("creation.e89a54bb0e96586b", { value1: formatCredits(budget) })}</> : _creationText("creation.13da88ca37fad039")}
                </span>
                <button type="button" className="drama-queue-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
                    {open ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
                    {open ? _creationText("creation.a4553c152d2a8568") : _creationText("creation.fc4f6fb2351a4faa")}
                </button>
            </div>
            {open ? (
                <div className="drama-queue-panel">
                    <div className="drama-queue-filters" role="tablist" aria-label={_creationText("creation.a920b74d5009fa49")}>
                        {(
                            [
                                ["all", "全部"],
                                ["active", "进行中"],
                                ["failed", "失败"],
                            ] as const
                        ).map(([key, label]) => (
                            <button key={key} type="button" role="tab" className="drama-filter" aria-pressed={filter === key} aria-selected={filter === key} onClick={() => setFilter(key)}>
                                {_creationLabel(label)}
                            </button>
                        ))}
                        <span className="ml-auto drama-queue-hint">{_creationText("creation.4feabd6c6b45a70a")}</span>
                    </div>
                    <div className="drama-queue-list thin-scrollbar" role="list">
                        {jobs.map((job) => (
                            <button key={job.id} type="button" role="listitem" className={`drama-job is-${job.status}`} onClick={() => setDetailJob(job)}>
                                <JobStatusIcon status={job.status} />
                                <span className="drama-job-kind">{JOB_KIND_LABEL[job.kind]}</span>
                                <span className="drama-job-label" title={job.providerStage ? `${job.label} · ${job.providerStage}` : job.label}>
                                    {_creationLabel(job.label)}
                                    {job.status === "running" && job.providerStage ? <span className="text-foreground/50"> · {job.providerStage}</span> : null}
                                </span>
                                {job.error && (job.status === "failed" || job.status === "queued") ? (
                                    <span className="drama-job-error" title={job.error}>
                                        {job.error}
                                    </span>
                                ) : (
                                    <span className="drama-job-error is-wait" title={job.status === "queued" ? job.wait : undefined}>
                                        {job.status === "queued" ? job.wait || "" : ""}
                                    </span>
                                )}
                                <span className="drama-job-time">{formatJobTime(job.finishedAt || job.startedAt || job.createdAt)}</span>
                                <span className="drama-job-cost">{job.costMicrocredits ? _creationText("creation.d901f70479c8f61f", { value1: formatCredits(job.costMicrocredits) }) : ""}</span>
                                <ChevronRight className="drama-job-chevron size-3.5" />
                            </button>
                        ))}
                        {jobsQuery.isLoading ? (
                            <div className="drama-queue-empty">{_creationText("creation.b7378bbfcf4dc5a3")}</div>
                        ) : !jobs.length ? (
                            <div className="drama-queue-empty">{filter === "failed" ? _creationText("creation.05405073fca6429a") : filter === "active" ? _creationText("creation.188694726e3181d8") : _creationText("creation.7d4c6aadb11ab8ff")}</div>
                        ) : null}
                    </div>
                </div>
            ) : null}
            <JobDetailModal projectId={projectId} job={detailJob} onClose={() => setDetailJob(undefined)} onLocate={onJump} />
        </div>
    );
}
