import { useCallback, useEffect, useState } from "react";
import { App, Button, Checkbox, Input } from "antd";
import { AdminDrawer } from "@/pages/admin/ui/overlays";
import { getTranslationWorkflow, updateTranslationWorkflow, type TranslationDraft, type TranslationWorkflow } from "../api";
import { SUPPORTED_LOCALE_CODES } from "../locales";
import { useI18n, useSupDanceI18nStore } from "../store";
import { getPublicSupDanceI18nBundle } from "../api";
import { SUPDANCE_I18N_VERSION } from "../types";

export function TranslationWorkflowPanel({ onChanged }: { onChanged: () => void }) {
    const { t } = useI18n();
    const { message, modal } = App.useApp();
    const [state, setState] = useState<TranslationWorkflow | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [json, setJson] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [editing, setEditing] = useState<TranslationDraft | null>(null);
    const [lockKey, setLockKey] = useState("");
    const text = (key: string) => t(`admin.i18n_workflow.${key}`);

    const reload = useCallback(async () => {
        setBusy(true);
        try {
            setState(await getTranslationWorkflow());
            setSelected([]);
            setError("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "i18n_workflow_load_failed");
        } finally {
            setBusy(false);
        }
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    const act = async (action: Parameters<typeof updateTranslationWorkflow>[0]["action"], options: { keys?: string[]; drafts?: TranslationDraft[]; releaseId?: string } = {}) => {
        if (!state) return;
        setBusy(true);
        setError("");
        try {
            setState(await updateTranslationWorkflow({ action, expectedRevision: state.revision, ...options }));
            setSelected([]);
            if (action === "stage") setEditing(null);
            if (action === "publish" || action === "rollback") {
                const bundle = await getPublicSupDanceI18nBundle();
                useSupDanceI18nStore.getState().applyBundle(bundle);
                onChanged();
            }
            message.success(text("done"));
        } catch (err) {
            setError(err instanceof Error ? err.message : text("failed"));
        } finally {
            setBusy(false);
        }
    };
    const importDrafts = () => {
        try {
            const payload = JSON.parse(json);
            if (payload.pluginId !== "supdance-i18n" || payload.schemaVersion !== 1 || !Array.isArray(payload.drafts) || payload.drafts.length === 0 || payload.drafts.length > 500) throw new Error(text("invalid"));
            void act("stage", { drafts: payload.drafts });
        } catch (err) {
            setError(err instanceof Error ? err.message : text("invalid"));
        }
    };
    const confirm = (action: "publish" | "discard" | "rollback", releaseId?: string) => modal.confirm({ title: text("confirm"), content: text(action), onOk: () => act(action, releaseId ? { releaseId } : { keys: selected }) });

    return (
        <div data-plugin-scope="supdance-i18n" className="space-y-6">
            <p className="text-sm text-[var(--admin-text-secondary)]">{text("description")}</p>
            <p className="text-xs text-[var(--admin-text-secondary)]">{t("admin.i18n_workflow.version", { version: SUPDANCE_I18N_VERSION, revision: state?.revision ?? 0 })}</p>
            {error ? (
                <div role="alert" className="text-sm text-[var(--admin-text-primary)]">
                    {text("failed")}: {error}
                </div>
            ) : null}
            {state?.staleOverrides?.length ? (
                <div role="status" className="text-sm">
                    {text("stale")}: <span data-i18n-ignore>{state.staleOverrides.join(", ")}</span>
                </div>
            ) : null}
            <Button loading={busy} onClick={() => void reload()}>
                {text("reload")}
            </Button>
            <label className="block space-y-2">
                <span className="text-sm font-medium">{text("import")}</span>
                <Input.TextArea aria-label={text("json")} value={json} onChange={(e) => setJson(e.target.value)} autoSize={{ minRows: 3, maxRows: 8 }} placeholder={text("json")} disabled={busy || !state} />
            </label>
            <Button onClick={importDrafts} disabled={busy || !state || !json.trim()}>
                {text("import")}
            </Button>
            <div className="flex flex-wrap gap-2">
                <Button onClick={() => void act("review", { keys: selected })} disabled={busy || !selected.length}>
                    {text("review")}
                </Button>
                <Button type="primary" onClick={() => confirm("publish")} disabled={busy || !selected.length || selected.some((key) => state?.drafts.find((d) => d.entry.key === key)?.status !== "reviewed")}>
                    {text("publish")}
                </Button>
                <Button danger onClick={() => confirm("discard")} disabled={busy || !selected.length}>
                    {text("discard")}
                </Button>
            </div>
            {state && !state.drafts.length ? <p role="status">{text("empty")}</p> : null}
            <div className="space-y-3">
                {state?.drafts.map((draft) => (
                    <article key={draft.entry.key} className="space-y-2 rounded-lg border border-[var(--admin-border)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Checkbox
                                aria-label={t("admin.i18n_workflow.select", { key: draft.entry.key })}
                                checked={selected.includes(draft.entry.key)}
                                disabled={busy}
                                onChange={(e) => setSelected((keys) => (e.target.checked ? [...keys, draft.entry.key] : keys.filter((key) => key !== draft.entry.key)))}
                            >
                                {draft.entry.key}
                            </Checkbox>
                            <span className="text-xs">{text(draft.status === "reviewed" ? "reviewed" : "draft")}</span>
                            <Button disabled={busy} onClick={() => setEditing(structuredClone(draft))}>
                                {text("edit")}
                            </Button>
                        </div>
                        <p className="break-words text-sm" data-i18n-ignore>
                            {draft.entry.sourceText}
                        </p>
                        {draft.references?.map((ref) => (
                            <p key={`${ref.file}:${ref.line}`} className="break-all text-xs text-[var(--admin-text-secondary)]" data-i18n-ignore>
                                {ref.file}:{ref.line}
                            </p>
                        ))}
                    </article>
                ))}
            </div>
            <section className="space-y-3">
                <h3 className="text-base font-medium">{text("locked")}</h3>
                <label className="block space-y-2">
                    <span>{text("key")}</span>
                    <Input value={lockKey} onChange={(e) => setLockKey(e.target.value)} disabled={busy || !state} />
                </label>
                <Button disabled={busy || !state || !lockKey.trim()} onClick={() => void act("lock", { keys: [lockKey.trim()] })}>
                    {text("lock")}
                </Button>
                {Object.keys(state?.lockedKeys ?? {})
                    .filter((key) => state?.lockedKeys[key])
                    .map((key) => (
                        <div key={key} className="flex flex-wrap items-center gap-2">
                            <span className="break-all" data-i18n-ignore>
                                {key}
                            </span>
                            <Button disabled={busy} onClick={() => void act("unlock", { keys: [key] })}>
                                {text("unlock")}
                            </Button>
                        </div>
                    ))}
            </section>
            <section className="space-y-3">
                <h3 className="text-base font-medium">{text("history")}</h3>
                {state?.releases.map((release) => (
                    <div key={release.id} className="flex flex-wrap items-center gap-2">
                        <time dateTime={release.createdAt}>{release.createdAt}</time>
                        <span>{release.count}</span>
                        <Button disabled={busy} onClick={() => confirm("rollback", release.id)}>
                            {text("rollback")}
                        </Button>
                    </div>
                ))}
            </section>
            <AdminDrawer
                title={text("edit")}
                open={!!editing}
                onClose={() => setEditing(null)}
                width="min(100vw, 48rem)"
                extra={
                    <Button
                        type="primary"
                        loading={busy}
                        onClick={async () => {
                            if (editing) {
                                await act("stage", { drafts: [editing] });
                            }
                        }}
                    >
                        {text("stage")}
                    </Button>
                }
            >
                {editing ? (
                    <div className="space-y-4">
                        <p data-i18n-ignore>{editing.entry.key}</p>
                        <p data-i18n-ignore>{editing.entry.sourceText}</p>
                        {SUPPORTED_LOCALE_CODES.map((code) => (
                            <label key={code} className="block space-y-2">
                                <span>{code}</span>
                                <Input.TextArea
                                    aria-label={code}
                                    disabled={busy || code === "zh-CN"}
                                    value={editing.entry.translations[code] ?? ""}
                                    autoSize={{ minRows: 2, maxRows: 6 }}
                                    onChange={(e) => setEditing({ ...editing, entry: { ...editing.entry, translations: { ...editing.entry.translations, [code]: e.target.value } } })}
                                />
                            </label>
                        ))}
                    </div>
                ) : null}
            </AdminDrawer>
        </div>
    );
}
