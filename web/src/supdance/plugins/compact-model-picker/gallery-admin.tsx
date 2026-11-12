import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, App, Button, Input, Select } from "antd";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsSectionCard } from "@/pages/admin/components/admin-ui";
import { AdminSwitch } from "@/pages/admin/ui/controls";
import { InspirationFeedRow } from "@/pages/admin/components/inspiration-feed-row";
import "@/pages/admin/components/feature-availability-panel.css";
import { http } from "@/services/api/request";
import type { CompactPickerSettings } from "./settings";

type Review = { status: string; evidence: string; reviewedBy?: string; reviewedAt?: string; replacementImage?: string };
type Candidate = { entry: { id: string; title: string; prompt: string; image: string }; review: Review; hash: string };
const path = "/admin/supdance/compact-model-picker/inspirations";
const statuses = ["pending_review", "restricted", "archived", "approved"];

export function GalleryAdmin({ draft, pending, edit }: { draft: CompactPickerSettings; pending: boolean; edit: (value: Partial<CompactPickerSettings>) => void }) {
    const { t } = useTranslation();
    const { modal } = App.useApp();
    const [query, setQuery] = useState("");
    const [search, setSearch] = useState<string | null>(null);
    const [selected, setSelected] = useState<Candidate | null>(null);
    const [status, setStatus] = useState("pending_review");
    const [evidence, setEvidence] = useState("");
    const [replacementImage, setReplacementImage] = useState("");
    const [feedOpen, setFeedOpen] = useState(false);
    const candidates = useQuery({ queryKey: [path, search], queryFn: ({ signal }) => http.get<Candidate[]>(path, { params: { q: search }, signal }), enabled: search !== null });
    const review = useMutation({
        mutationFn: () => http.put(path, { id: selected!.entry.id, hash: selected!.hash, status, evidence, replacementImage }),
        onSuccess: () => {
            setSelected(null);
            void candidates.refetch();
        },
    });
    const confirm = (action: () => void) => modal.confirm({ title: t("compactPicker.galleryConfirm"), content: t("compactPicker.galleryConfirmHint"), onOk: action });
    const fields = ["showInspirations", "homepageShowcaseEnabled", "complianceLock"] as const;
    return (
        <SettingsSectionCard icon={<ShieldCheck />} title={t("compactPicker.galleryTitle")}>
            <Alert showIcon type={draft.complianceLock || !draft.showInspirations ? "warning" : "info"} title={t("compactPicker.galleryTitle")} description={t("compactPicker.galleryIsolationHint")} />
            {fields.map((key) => (
                <div key={key} className="flex items-center justify-between gap-4 border-b border-[var(--admin-border)] px-4 py-3">
                    <strong>{t(`compactPicker.${key}`)}</strong>
                    <AdminSwitch
                        aria-label={t(`compactPicker.${key}`)}
                        checked={Boolean(draft[key])}
                        disabled={pending || (key === "showInspirations" && draft.complianceLock !== false) || (key === "homepageShowcaseEnabled" && (!draft.showInspirations || draft.complianceLock !== false))}
                        onChange={(checked) => {
                            const apply = () =>
                                edit({
                                    [key]: checked,
                                    ...(key === "showInspirations" && !checked ? { homepageShowcaseEnabled: false } : {}),
                                    ...(key === "complianceLock" ? (checked ? { showInspirations: false, homepageShowcaseEnabled: false, unlockConfirmed: false } : { unlockConfirmed: true }) : {}),
                                });
                            if ((key === "complianceLock" && !checked) || (key !== "complianceLock" && checked)) confirm(apply);
                            else apply();
                        }}
                    />
                </div>
            ))}
            <p role="status" className="px-4 py-3 text-sm text-[var(--admin-text-muted)]">
                {t("compactPicker.galleryUpdated")}: {draft.updatedAt ? new Date(draft.updatedAt).toLocaleString() : "—"}
            </p>
            <details className="px-4 py-3" onToggle={(event) => setFeedOpen(event.currentTarget.open)}>
                <summary>{t("compactPicker.galleryFeed")}</summary>
                {feedOpen && <InspirationFeedRow />}
            </details>
            <details className="px-4 py-3">
                <summary>{t("compactPicker.galleryReviews")}</summary>
                <div className="flex flex-col gap-3 py-3">
                    <Input.Search
                        aria-label={t("compactPicker.gallerySearch")}
                        placeholder={t("compactPicker.gallerySearch")}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onSearch={() => setSearch(query)}
                        enterButton
                        loading={candidates.isFetching}
                    />
                    {candidates.isError && <Alert type="error" title={candidates.error.message} />}
                    {candidates.data && <p role="status">{t("compactPicker.galleryResultCount", { count: candidates.data.length })}</p>}
                    <Select
                        aria-label={t("compactPicker.galleryReviews")}
                        value={selected?.entry.id}
                        placeholder={t("compactPicker.galleryReviews")}
                        options={candidates.data?.map((row) => ({ value: row.entry.id, label: `${row.entry.title} · ${row.review.status}` }))}
                        onChange={(id) => {
                            const row = candidates.data?.find((row) => row.entry.id === id) ?? null;
                            setSelected(row);
                            setStatus(row?.review.status ?? "pending_review");
                            setEvidence(row?.review.evidence ?? "");
                            setReplacementImage(row?.review.replacementImage ?? "");
                            review.reset();
                        }}
                    />
                    {selected && (
                        <>
                            <strong>{selected.entry.id}</strong>
                            <p className="whitespace-pre-wrap break-words">{selected.entry.prompt}</p>
                            <p className="break-all">{selected.entry.image}</p>
                            <Input aria-label={t("compactPicker.galleryReplacement")} placeholder={t("compactPicker.galleryReplacement")} value={replacementImage} maxLength={1000} onChange={(event) => setReplacementImage(event.target.value)} />
                            <Select aria-label={t("compactPicker.galleryReviewStatus")} value={status} onChange={setStatus} options={statuses.map((value) => ({ value, label: t(`compactPicker.galleryStatus_${value}`) }))} />
                            <Input.TextArea aria-label={t("compactPicker.galleryEvidence")} placeholder={t("compactPicker.galleryEvidence")} value={evidence} maxLength={4000} onChange={(event) => setEvidence(event.target.value)} />
                            <p className="text-sm text-[var(--admin-text-muted)]">
                                {selected.review.reviewedBy && selected.review.reviewedAt ? `${selected.review.reviewedBy} · ${new Date(selected.review.reviewedAt).toLocaleString()}` : t("compactPicker.galleryStatus_pending_review")}
                            </p>
                            <Button
                                disabled={status === "approved" && evidence.trim().length < 10}
                                loading={review.isPending}
                                onClick={() =>
                                    status === "approved"
                                        ? confirm(() => {
                                              review.mutate();
                                          })
                                        : review.mutate()
                                }
                            >
                                {t("compactPicker.gallerySaveReview")}
                            </Button>
                        </>
                    )}
                    {review.isError && <Alert role="alert" type="error" title={review.error.message} />}
                    {review.isSuccess && <Alert role="status" type="success" title={t("compactPicker.saved")} />}
                </div>
            </details>
        </SettingsSectionCard>
    );
}
