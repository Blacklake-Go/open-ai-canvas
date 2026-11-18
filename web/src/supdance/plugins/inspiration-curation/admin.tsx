import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Input, Spin, Tabs, Tag } from "antd";
import { Link, useBlocker } from "react-router";
import { AdminPageFrame } from "@/pages/admin/components/admin-shell";
import { invalidateInspirationCatalog } from "@/services/inspiration-catalog";
import { useI18n } from "@/supdance/plugins/i18n";
import { MAX_FEATURED, MAX_GALLERY_ORDER, changeCuration, readCuration, readCurationCatalog, type CurationDocument } from "./api";
import { CatalogPanel } from "./catalog-panel";
import { FeaturedLineup } from "./lineup";
import { GalleryOrderPanel } from "./gallery-order-panel";
import "./curation.css";

const stateKey = ["inspiration-curation", "state"];
const catalogKey = ["inspiration-curation", "catalog"];
const noCards: Awaited<ReturnType<typeof readCurationCatalog>> = [];
type Action = "draft" | "publish" | "rollback";
type Edit = { document: CurationDocument; base: number };

export default function InspirationCurationAdmin() {
    const { t, locale } = useI18n();
    const label = (key: string) => t(`inspiration.curation.${key}`);
    const { message, modal } = App.useApp();
    const cache = useQueryClient();
    const state = useQuery({ queryKey: stateKey, queryFn: ({ signal }) => readCuration(signal) });
    const catalog = useQuery({ queryKey: catalogKey, queryFn: ({ signal }) => readCurationCatalog("", signal) });
    const [edits, setEdits] = useState<Edit>();
    const [section, setSection] = useState("catalog");
    const [styleName, setStyleName] = useState("");
    const doc = edits?.document ?? state.data?.draft;
    const dirty = Boolean(edits);
    const blocker = useBlocker(dirty);
    const rows = catalog.data ?? noCards;
    const inventory = useMemo(() => new Map(rows.map((item) => [item.id, item])), [rows]);
    const save = useMutation({
        onMutate: () => cache.cancelQueries({ queryKey: stateKey }),
        mutationFn: ({ action, expectedRevision, version, document }: { action: Action; expectedRevision: number; version?: string; document?: CurationDocument }) => changeCuration(action, { expectedRevision, version, document }),
        onSuccess: (data, { action }) => {
            cache.setQueryData(stateKey, data);
            setEdits(undefined);
            if (action !== "draft") invalidateInspirationCatalog();
            void message.success(label("saved"));
        },
    });

    useEffect(() => {
        if (blocker.state !== "blocked") return;
        const confirm = modal.confirm({ title: label("discard"), onOk: blocker.proceed, onCancel: blocker.reset });
        return () => confirm.destroy();
    }, [blocker.state]);

    useEffect(() => {
        if (!dirty) return;
        const leave = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        window.addEventListener("beforeunload", leave);
        return () => window.removeEventListener("beforeunload", leave);
    }, [dirty]);

    function edit(changes: Partial<CurationDocument>) {
        if (save.isPending || !state.data) return;
        const version = state.data.revision;
        const draft = state.data.draft;
        setEdits((current) => ({ base: current?.base ?? version, document: { ...(current?.document ?? draft), ...changes } }));
    }

    function submit(action: Action, version?: string) {
        if (!state.data || save.isPending || (action !== "draft" && dirty)) return;
        const expectedRevision = edits?.base ?? state.data.revision;
        const run = () => save.mutateAsync({ action, expectedRevision, version, document: action === "draft" ? edits?.document : undefined });
        if (action === "draft") {
            void run().catch(() => undefined);
            return;
        }
        modal.confirm({
            title: label(action),
            content: label(action === "rollback" ? "rollbackConfirm" : doc?.galleryOrder && !doc.galleryOrder.some((id) => inventory.get(id)?.eligible) ? "publishEmptyGallery" : "publishConfirm"),
            onOk: async () => {
                await run().catch(() => undefined);
            },
        });
    }

    function addFeatured(ids: string[]) {
        if (!doc) return;
        const added = ids.filter((id) => !doc.featured.some((item) => item.id === id));
        if (!added.length) return;
        if (added.some((id) => !inventory.get(id)?.eligible || !inventory.get(id)?.image)) {
            void message.warning(label("blocked"));
            return;
        }
        if (doc.featured.length + added.length > MAX_FEATURED) {
            void message.warning(t("inspiration.curation.limit", { count: MAX_FEATURED }));
            return;
        }
        edit({ featured: [...doc.featured, ...added.map((id) => ({ id, pinned: false, focusX: 50, focusY: 50 }))] });
        setSection("lineup");
    }

    function addToGallery(ids: string[]) {
        if (!doc) return;
        const eligible = ids.filter((id) => inventory.get(id)?.eligible);
        if (eligible.length !== ids.length) void message.warning(label("skippedRestricted"));
        if (!eligible.length) return;
        const galleryOrder = [...new Set([...(doc.galleryOrder ?? []), ...eligible])];
        if (galleryOrder.length > MAX_GALLERY_ORDER) {
            void message.warning(t("inspiration.curation.galleryLimit", { count: MAX_GALLERY_ORDER }));
            return;
        }
        edit({ galleryOrder });
        setSection("gallery");
    }

    function reload() {
        const run = () => {
            setEdits(undefined);
            save.reset();
            void state.refetch();
            void catalog.refetch();
        };
        if (dirty) modal.confirm({ title: label("discard"), onOk: run });
        else run();
    }

    return (
        <AdminPageFrame
            scroll
            title={label("title")}
            description={label("summary")}
            actions={
                <div className="curation-actions">
                    {dirty && <Tag role="status">{label("dirty")}</Tag>}
                    <Button disabled={save.isPending} onClick={reload}>
                        {label("reload")}
                    </Button>
                    <Button disabled={!dirty || save.isPending} onClick={() => submit("draft")}>
                        {label("save")}
                    </Button>
                    <Button type="primary" disabled={!doc || dirty || save.isPending} onClick={() => submit("publish")}>
                        {label("publish")}
                    </Button>
                </div>
            }
        >
            <div className="curation-admin curation-stack" data-plugin-scope="supdance-inspiration-curation">
                <Link to="/admin/plugins/page-management?page=models#inspiration-public-controls">{label("controls")}</Link>
                {save.isError && <Alert type="error" showIcon title={save.error.message} />}
                {(state.isError || catalog.isError) && <Alert type="error" showIcon title={(state.error ?? catalog.error)?.message} />}
                {state.isPending || catalog.isPending ? (
                    <Spin />
                ) : (
                    doc &&
                    !catalog.isError && (
                        <Tabs
                            activeKey={section}
                            onChange={setSection}
                            items={[
                                { key: "catalog", label: label("catalog"), children: <CatalogPanel doc={doc} inventory={rows} disabled={save.isPending} onCases={(cases) => edit({ cases })} onFeatured={addFeatured} onGallery={addToGallery} /> },
                                {
                                    key: "gallery",
                                    label: label("galleryList"),
                                    children: <GalleryOrderPanel order={doc.galleryOrder} inventory={inventory} disabled={save.isPending} onChange={(galleryOrder) => edit({ galleryOrder })} onBrowse={() => setSection("catalog")} />,
                                },
                                {
                                    key: "taxonomy",
                                    label: label("taxonomy"),
                                    children: (
                                        <section className="curation-stack">
                                            <div className="curation-actions">
                                                <Input aria-label={label("styleName")} placeholder={label("styleName")} maxLength={36} value={styleName} onChange={(event) => setStyleName(event.target.value)} />
                                                <Button
                                                    disabled={save.isPending || !styleName.trim() || doc.styles.length >= 60 || doc.styles.some((style) => (style.label || label(style.id)).toLowerCase() === styleName.trim().toLowerCase())}
                                                    onClick={() => {
                                                        edit({ styles: [...doc.styles, { id: `style-${crypto.randomUUID()}`, label: styleName.trim() }] });
                                                        setStyleName("");
                                                    }}
                                                >
                                                    {label("add")}
                                                </Button>
                                            </div>
                                            <ul className="curation-order">
                                                {doc.styles.map((style) => (
                                                    <li key={style.id} className="curation-order-item">
                                                        <span>{style.label || label(style.id)}</span>
                                                        <Button disabled={save.isPending || Object.values(doc.cases).some((item) => item.styles.includes(style.id))} onClick={() => edit({ styles: doc.styles.filter((item) => item.id !== style.id) })}>
                                                            {label("remove")}
                                                        </Button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    ),
                                },
                                { key: "lineup", label: label("lineup"), children: <FeaturedLineup doc={doc} inventory={inventory} disabled={save.isPending} onChange={(featured) => edit({ featured })} /> },
                                {
                                    key: "history",
                                    label: label("history"),
                                    children: state.data?.history.length ? (
                                        <ul className="curation-order">
                                            {state.data.history.map((release) => (
                                                <li key={release.id} className="curation-order-item">
                                                    <span>
                                                        <time dateTime={release.createdAt}>{new Date(release.createdAt).toLocaleString(locale)}</time> · {release.id.slice(0, 8)}
                                                    </span>
                                                    {release.id === state.data?.published && <Tag>{label("live")}</Tag>}
                                                    {release.restoredFrom && (
                                                        <Tag>
                                                            {label("restored")} · {release.restoredFrom.slice(0, 8)}
                                                        </Tag>
                                                    )}
                                                    <Button disabled={dirty || save.isPending || release.id === state.data?.published} onClick={() => submit("rollback", release.id)}>
                                                        {label("rollback")}
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p role="status">{label("empty")}</p>
                                    ),
                                },
                            ]}
                        />
                    )
                )}
            </div>
        </AdminPageFrame>
    );
}
