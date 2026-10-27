import { App, Button } from "antd";
import { Check, History, ListChecks, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/ui/base/badges";
import { AppModal } from "@/components/ui/product/app-modal";
import { Callout } from "@/components/ui/product/callout";
import { decideAgentMemoryProposal, listAgentMemoryProposals, listAgentMemoryRevisions, restoreAgentMemoryRevision, type AgentMemory, type AgentMemoryProposal, type AgentMemoryRevision } from "@/services/api/agent-memories";
import { useI18n } from "@/supdance/plugins/i18n";

function getProposalLabels(t: (keyOrText: string, params?: Record<string, string | number>, fallbackText?: string) => string): Record<AgentMemoryProposal["status"], string> {
    return {
        generating: t("settings.memory_proposal_generating", undefined, "生成中"),
        pending: t("settings.memory_proposal_pending", undefined, "待批准"),
        approved: t("settings.memory_proposal_approved", undefined, "已应用"),
        rejected: t("settings.memory_proposal_rejected", undefined, "已拒绝"),
        no_changes: t("settings.memory_proposal_no_changes", undefined, "无需修改"),
        failed: t("settings.memory_proposal_failed", undefined, "生成失败"),
    };
}

function MemorySnapshot({ memory }: { memory: AgentMemory }) {
    const { t } = useI18n();
    return (
        <article className="rounded-xl bg-surface-secondary p-3 text-caption leading-5">
            <h4 className="font-medium text-foreground">{memory.topic}</h4>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{memory.situation}</p>
            {memory.lesson ? <p className="mt-1 whitespace-pre-wrap text-foreground">{memory.lesson}</p> : null}
            {memory.steps?.length ? (
                <ol className="mt-1 ml-4 list-decimal text-muted-foreground">
                    {memory.steps.map((step, index) => (
                        <li key={`${memory.id}-${index}`}>
                            {step.action}
                            {step.note ? `（${step.note}）` : ""}
                        </li>
                    ))}
                </ol>
            ) : null}
            {memory.source ? <p className="mt-2 text-muted-foreground">{t("settings.memory_source_label", { source: memory.source }, `来源：${memory.source}`)}</p> : null}
        </article>
    );
}

export function AgentMemoryProposalChanges({ proposal }: { proposal: AgentMemoryProposal }) {
    const { t } = useI18n();
    const proposalLabels = getProposalLabels(t);
    return (
        <div className="space-y-4">
            <Callout tone="info" title={proposal.status === "pending" ? t("settings.memory_proposal_pending_callout", undefined, "批准前不会改变记忆") : proposalLabels[proposal.status]}>
                {t("settings.memory_proposal_pending_desc", undefined, "原始来源和验证时间保持不变。批准时会重新检查记忆版本，已有新编辑则整批拒绝。")}
            </Callout>
            {proposal.changes.map((change, index) => (
                <section key={`${change.after.id}-${index}`} className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">
                        {change.kind === "merge"
                            ? t("settings.memory_proposal_merge_title", { count: change.before.length }, `合并 ${change.before.length} 条记忆`)
                            : t("settings.memory_proposal_rewrite_title", undefined, "改写记忆")}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <p className="text-caption text-muted-foreground">{t("settings.memory_proposal_before", undefined, "修改前")}</p>
                            {change.before.map((memory) => (
                                <MemorySnapshot key={memory.id} memory={memory} />
                            ))}
                        </div>
                        <div className="space-y-2">
                            <p className="text-caption text-muted-foreground">{t("settings.memory_proposal_after", undefined, "修改后")}</p>
                            <MemorySnapshot memory={change.after} />
                        </div>
                    </div>
                </section>
            ))}
            {proposal.changes.length === 0 ? <p className="text-caption text-muted-foreground">{t("settings.memory_proposal_no_changes_desc", undefined, "此提案没有可应用的记忆变更。")}</p> : null}
        </div>
    );
}

export function AgentMemoryRevisionChanges({ revision }: { revision: AgentMemoryRevision }) {
    const { t } = useI18n();
    return (
        <div className="space-y-4">
            <Callout tone="info" title={revision.restoredAt ? t("settings.memory_revision_restored_title", undefined, "此版本已恢复") : t("settings.memory_revision_restore_title", undefined, "恢复压缩前的记忆")}>
                {t("settings.memory_revision_restore_desc", undefined, "恢复会同时还原该批次的改写与合并。若记忆已被后续编辑、删除或重新创建，操作会被拒绝，保留新修改。")}
            </Callout>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                    <p className="text-caption text-muted-foreground">{t("settings.memory_revision_compacted", undefined, "压缩后的版本")}</p>
                    {revision.after.map((memory) => (
                        <MemorySnapshot key={memory.id} memory={memory} />
                    ))}
                </div>
                <div className="space-y-2">
                    <p className="text-caption text-muted-foreground">{t("settings.memory_revision_will_restore", undefined, "将恢复为")}</p>
                    {revision.before.map((memory) => (
                        <MemorySnapshot key={memory.id} memory={memory} />
                    ))}
                </div>
            </div>
        </div>
    );
}

export function AgentMemoryProposalPanel({ refreshKey, onApplied }: { refreshKey: string; onApplied: () => Promise<void> }) {
    const { t } = useI18n();
    const { message } = App.useApp();
    const proposalLabels = getProposalLabels(t);
    const [proposals, setProposals] = useState<AgentMemoryProposal[]>([]);
    const [revisions, setRevisions] = useState<AgentMemoryRevision[]>([]);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<{ kind: "proposal" | "revision"; id: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const sequence = useRef(0);

    const load = useCallback(async (signal?: AbortSignal) => {
        const seq = ++sequence.current;
        setLoading(true);
        try {
            const [proposalData, revisionData] = await Promise.all([listAgentMemoryProposals(signal), listAgentMemoryRevisions(signal)]);
            if (seq !== sequence.current || signal?.aborted) return;
            setProposals(proposalData.proposals);
            setRevisions(revisionData.revisions);
            setError("");
        } catch (cause) {
            if (seq === sequence.current && !signal?.aborted) setError(cause instanceof Error ? cause.message : t("common.save_failed", undefined, "读取压缩提案失败"));
        } finally {
            if (seq === sequence.current && !signal?.aborted) setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load, refreshKey]);

    const proposal = selected?.kind === "proposal" ? proposals.find((item) => item.id === selected.id) : undefined;
    const revision = selected?.kind === "revision" ? revisions.find((item) => item.id === selected.id) : undefined;
    const pending = proposals.filter((item) => item.status === "pending").length;

    const decide = async (decision: "approve" | "reject") => {
        if (!proposal || busy) return;
        setBusy(true);
        setError("");
        try {
            await decideAgentMemoryProposal(proposal.id, decision, proposal.version);
            message.success(decision === "approve" ? t("settings.memory_proposal_apply_success", undefined, "提案已应用，已保存恢复版本") : t("settings.memory_proposal_reject_success", undefined, "已拒绝提案，原记忆未改变"));
            await Promise.all([load(), onApplied()]);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("common.save_failed", undefined, "处理提案失败"));
        } finally {
            setBusy(false);
        }
    };

    const restore = async () => {
        if (!revision || busy) return;
        setBusy(true);
        setError("");
        try {
            await restoreAgentMemoryRevision(revision.id, revision.version);
            message.success(t("settings.memory_revision_restore_success", undefined, "已恢复该批次压缩前的记忆"));
            await Promise.all([load(), onApplied()]);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("common.save_failed", undefined, "恢复失败"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-2">
            <Button
                size="small"
                icon={<ListChecks className="size-3.5" />}
                onClick={() => {
                    setOpen(true);
                    setSelected(null);
                    void load();
                }}
                loading={loading}
            >
                {pending ? t("settings.memory_view_proposals_btn", { count: pending }, `查看 ${pending} 个待审提案`) : t("settings.memory_proposals_and_history", undefined, "压缩提案与历史")}
            </Button>
            {error && !open ? (
                <p role="alert" className="text-caption text-status-error">
                    {error}
                </p>
            ) : null}
            <AppModal
                open={open}
                title={proposal ? t("settings.memory_view_proposal_title", undefined, "查看压缩提案") : revision ? t("settings.memory_restore_version_title", undefined, "恢复记忆版本") : t("settings.memory_proposals_and_history", undefined, "压缩提案与历史")}
                width={800}
                footer={null}
                onCancel={() => {
                    if (!busy) setOpen(false);
                }}
            >
                <div className="space-y-4 pt-2">
                    {error ? (
                        <div role="alert">
                            <Callout tone="warning" title={t("settings.memory_last_unfinished_title", undefined, "操作未完成")}>
                                {error}
                            </Callout>
                        </div>
                    ) : null}
                    {selected ? (
                        <Button size="small" disabled={busy} onClick={() => setSelected(null)}>
                            {t("settings.memory_back_to_list", undefined, "返回列表")}
                        </Button>
                    ) : null}
                    {proposal ? <AgentMemoryProposalChanges proposal={proposal} /> : null}
                    {proposal?.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                            <Button icon={<X className="size-3.5" />} disabled={busy} onClick={() => void decide("reject")}>
                                {t("settings.memory_reject_proposal_btn", undefined, "拒绝提案")}
                            </Button>
                            <Button type="primary" icon={<Check className="size-3.5" />} loading={busy} onClick={() => void decide("approve")}>
                                {t("settings.memory_approve_and_apply_btn", undefined, "批准并应用")}
                            </Button>
                        </div>
                    ) : null}
                    {revision ? <AgentMemoryRevisionChanges revision={revision} /> : null}
                    {revision && !revision.restoredAt ? (
                        <div className="flex justify-end">
                            <Button type="primary" icon={<RotateCcw className="size-3.5" />} loading={busy} onClick={() => void restore()}>
                                {t("settings.memory_restore_compacted_btn", undefined, "恢复压缩前版本")}
                            </Button>
                        </div>
                    ) : null}
                    {!selected ? (
                        <>
                            <section className="space-y-2">
                                <h3 className="text-sm font-medium text-foreground">{t("settings.memory_proposals_heading", undefined, "压缩提案")}</h3>
                                {proposals.length === 0 ? <p className="text-caption text-muted-foreground">{t("settings.memory_proposals_empty", undefined, "生成压缩提案后，可在这里检查并批准。")}</p> : null}
                                {proposals.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className="flex w-full items-center justify-between gap-3 rounded-xl bg-surface-secondary p-3 text-left hover:bg-surface-hover focus-visible:outline focus-visible:outline-2"
                                        onClick={() => setSelected({ kind: "proposal", id: item.id })}
                                    >
                                        <span className="text-caption text-foreground">
                                            {new Date(item.createdAt).toLocaleString()} · {t("settings.memory_proposal_changes_count", { count: item.changes.length }, `${item.changes.length} 项变更`)}
                                        </span>
                                        <StatusBadge size="sm" tone={item.status === "pending" ? "warning" : item.status === "approved" ? "success" : "neutral"} label={proposalLabels[item.status]} />
                                    </button>
                                ))}
                            </section>
                            <section className="space-y-2">
                                <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <History className="size-4" />
                                    {t("settings.memory_revisions_heading", undefined, "可恢复版本")}
                                </h3>
                                {revisions.length === 0 ? <p className="text-caption text-muted-foreground">{t("settings.memory_revisions_empty", undefined, "批准应用压缩后，会自动保留修改前的版本。")}</p> : null}
                                {revisions.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className="flex w-full items-center justify-between gap-3 rounded-xl bg-surface-secondary p-3 text-left hover:bg-surface-hover focus-visible:outline focus-visible:outline-2"
                                        onClick={() => setSelected({ kind: "revision", id: item.id })}
                                    >
                                        <span className="text-caption text-foreground">
                                            {new Date(item.createdAt).toLocaleString()} · {t("settings.memory_proposal_raw_count", { count: item.before.length }, `${item.before.length} 条原始记忆`)}
                                        </span>
                                        <span className="text-caption text-muted-foreground">{item.restoredAt ? t("settings.memory_revisions_restored", undefined, "已恢复") : t("settings.memory_revisions_view_and_restore", undefined, "查看与恢复")}</span>
                                    </button>
                                ))}
                            </section>
                        </>
                    ) : null}
                </div>
            </AppModal>
        </div>
    );
}
