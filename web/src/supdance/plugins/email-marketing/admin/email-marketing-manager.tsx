import { Alert, App, Button, Input, Select, Spin, Tabs } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useBlocker, useSearchParams } from "react-router";
import { useI18n } from "@/supdance/plugins/i18n";
import { AdminPageFrame } from "@/pages/admin/components/admin-shell";
import EmailSettingsPanel from "@/pages/admin/components/email-settings-panel";
import { EmailLogs } from "@/pages/admin/email-logs/email-logs-page";
import { editEmailTemplate, fetchEmailCenter, fetchEmailBrand, initializeEmailCenter, previewEmailTemplate, uploadEmailAsset } from "../api";
import type { EmailBlock, EmailCenterOverview, EmailDocument, EmailPreview } from "../types";
import "./email-center.css";
import { isAppLocale, SUPPORTED_LOCALES } from "@/i18n/locales";
import { useLocaleStore } from "@/stores/use-locale-store";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { EmailCampaignPanel } from "./email-campaign-panel";
import { EmailPreferencePanel } from "./email-preference-panel";
import { EmailActivityPanel } from "./email-activity-panel";
import { EmailQueuePanel } from "./email-queue-panel";

const sections = ["overview", "system", "marketing", "brand", "contacts", "smtp", "logs", "versions"];
const moduleTypes = ["heading", "paragraph", "image", "card", "steps", "notice", "summary", "button", "features", "cover", "html"];

export default function EmailMarketingManager() {
    const { t } = useI18n();
    const label = (key: string) => t(`email.center.${key}`);
    const { message, modal } = App.useApp();
    const [params, setParams] = useSearchParams();
    const uiLocale = useLocaleStore((state) => state.locale);
    const requestedLocale = params.get("emailLocale");
    const emailLocale = isAppLocale(requestedLocale) ? requestedLocale : uiLocale;
    const appearanceRevision = useAppearanceStore((state) => state.appearance.revision);
    const [brandRefresh, setBrandRefresh] = useState(0);
    const [brandError, setBrandError] = useState("");
    const brandVersion = useRef("");
    const loadController = useRef<AbortController | null>(null);
    const section = sections.includes(params.get("section") || "") ? params.get("section")! : "overview";
    const [data, setData] = useState<EmailCenterOverview>();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [key, setKey] = useState("registration");
    const [document, setDocument] = useState<EmailDocument>();
    const [preview, setPreview] = useState<EmailPreview>();
    const [previewError, setPreviewError] = useState("");
    const [previewBusy, setPreviewBusy] = useState(false);
    const [width, setWidth] = useState(600);
    const [mode, setMode] = useState("light");
    const [recipient, setRecipient] = useState("");
    const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
    const [revision, setRevision] = useState("");
    const [newType, setNewType] = useState("paragraph");
    const selected = data?.locale === emailLocale ? data.templates.find((item) => item.key === key) : undefined;
    const dirty = !!document && !!selected && JSON.stringify(document) !== JSON.stringify(selected.draft);
    const dirtyRef = useRef(dirty);
    dirtyRef.current = dirty;
    const blocker = useBlocker(dirty);

    useEffect(() => {
        if (blocker.state !== "blocked") return;
        const confirm = modal.confirm({ title: label("unsaved"), onOk: () => blocker.proceed(), onCancel: () => blocker.reset() });
        return () => confirm.destroy();
    }, [blocker.state]);
    useEffect(() => {
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (dirtyRef.current) event.preventDefault();
        };
        window.addEventListener("beforeunload", beforeUnload);
        return () => window.removeEventListener("beforeunload", beforeUnload);
    }, []);
    const load = useCallback(async () => {
        loadController.current?.abort();
        const controller = new AbortController();
        loadController.current = controller;
        setLoading(true);
        try {
            const result = await fetchEmailCenter(emailLocale, controller.signal);
            if (controller.signal.aborted) return;
            brandVersion.current = result.brand.version;
            setData(result);
            setError("");
        } catch (err) {
            if (!controller.signal.aborted) setError(err instanceof Error ? err.message : label("failed"));
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }, [emailLocale]);
    useEffect(() => {
        void load();
        return () => loadController.current?.abort();
    }, [load]);
    useEffect(() => {
        let controller: AbortController | undefined;
        const refresh = () => {
            if (window.document.visibilityState !== "visible") return;
            controller?.abort();
            const request = new AbortController();
            controller = request;
            void fetchEmailBrand(request.signal)
                .then((brand) => {
                    if (request.signal.aborted) return;
                    setBrandError("");
                    if (brandVersion.current === brand.version) return;
                    brandVersion.current = brand.version;
                    setData((previous) => (previous ? { ...previous, brand } : previous));
                    setBrandRefresh((value) => value + 1);
                })
                .catch(() => {
                    if (!request.signal.aborted) setBrandError(label("failed"));
                });
        };
        refresh();
        const timer = window.setInterval(refresh, 30000);
        window.addEventListener("focus", refresh);
        window.document.addEventListener("visibilitychange", refresh);
        return () => {
            controller?.abort();
            window.clearInterval(timer);
            window.removeEventListener("focus", refresh);
            window.document.removeEventListener("visibilitychange", refresh);
        };
    }, [appearanceRevision]);
    useEffect(() => {
        setDocument(selected ? structuredClone(selected.draft) : undefined);
        setPreviewVariables({});
        setRevision("");
    }, [selected]);
    useEffect(() => {
        if (section === "marketing") setKey("welcome");
        if (section === "system") setKey("registration");
        setDocument(selected ? structuredClone(selected.draft) : undefined);
        setPreviewVariables({});
        setRevision("");
    }, [section]);
    useEffect(() => {
        if (!document) return;
        const controller = new AbortController();
        setPreviewBusy(true);
        const timer = setTimeout(() => {
            previewEmailTemplate(key, { document, previewVariables, locale: emailLocale }, controller.signal)
                .then((result) => {
                    if (!controller.signal.aborted) {
                        setPreview(result);
                        setPreviewError("");
                    }
                })
                .catch((err: unknown) => {
                    if (!controller.signal.aborted) {
                        setPreview(undefined);
                        setPreviewError(err instanceof Error ? err.message : label("failed"));
                    }
                })
                .finally(() => {
                    if (!controller.signal.aborted) setPreviewBusy(false);
                });
        }, 350);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [document, key, previewVariables, emailLocale, brandRefresh]);

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await action();
            message.success(label("saved"));
            await load();
        } catch (err) {
            message.error(err instanceof Error ? err.message : label("failed"));
        } finally {
            setBusy(false);
        }
    };
    const switchTemplate = (next: string) => {
        if (!dirty) {
            setKey(next);
            return;
        }
        modal.confirm({ title: label("unsaved"), onOk: () => setKey(next) });
    };
    const update = (field: keyof EmailDocument, value: string) => setDocument((prev) => prev && { ...prev, [field]: value });
    const updateBlock = (index: number, value: Partial<EmailBlock>) => setDocument((prev) => prev && { ...prev, blocks: prev.blocks.map((block, i) => (i === index ? { ...block, ...value } : block)) });
    const moveBlock = (index: number, offset: number) =>
        setDocument((prev) => {
            if (!prev) return prev;
            const blocks = [...prev.blocks];
            const target = index + offset;
            if (target < 0 || target >= blocks.length) return prev;
            [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
            return { ...prev, blocks };
        });
    const chooseSection = (next: string) => {
        const nextParams = new URLSearchParams(params);
        nextParams.set("section", next);
        setParams(nextParams);
    };
    const previewHTML = preview?.HTML.replace(
        "</head>",
        `${mode === "noimages" ? "<style>img{display:none!important}</style>" : ""}${mode === "dark" ? "<style>html{filter:invert(.9) hue-rotate(180deg)}img{filter:invert(1) hue-rotate(180deg)}</style>" : ""}</head>`,
    );
    const history = selected?.history.find((item) => item.id === revision);

    const editor =
        document && selected ? (
            <div className="email-center-workspace">
                <aside className="email-center-template-list" aria-label={label("modules")}>
                    {data?.templates
                        .filter((item) => (section === "marketing" ? item.category === "marketing" : item.category !== "marketing"))
                        .map((item) => (
                            <button key={item.key} type="button" aria-pressed={key === item.key} onClick={() => switchTemplate(item.key)}>
                                <strong>{item.name}</strong>
                                <small>
                                    {item.key} · {item.locale}
                                </small>
                            </button>
                        ))}
                </aside>
                <div className="email-center-editor">
                    <div className="email-center-actions">
                        <Button loading={busy} disabled={!selected.state.revision || !dirty} onClick={() => run(() => editEmailTemplate(key, "draft", { document, locale: emailLocale, expectedRevision: selected.state.revision }))}>
                            {label("save")}
                        </Button>
                        <Button
                            type="primary"
                            loading={busy}
                            disabled={dirty || !selected.state.draftId || selected.state.draftId === selected.state.publishedId || !!previewError}
                            onClick={() => run(() => editEmailTemplate(key, "publish", { document, locale: emailLocale, expectedRevision: selected.state.revision, revisionId: selected.state.draftId }))}
                        >
                            {label("publish")}
                        </Button>
                        {dirty && <span role="status">{label("unsaved")}</span>}
                    </div>
                    <label>
                        {label("subject")}
                        <Input value={document.subject} onChange={(e) => update("subject", e.target.value)} maxLength={300} />
                    </label>
                    <label>
                        {label("preheader")}
                        <Input value={document.preheader} onChange={(e) => update("preheader", e.target.value)} maxLength={400} />
                    </label>
                    <label>
                        {label("heading")}
                        <Input value={document.heading} onChange={(e) => update("heading", e.target.value)} />
                    </label>
                    <p>
                        {label("required")}: {selected.variables?.map((item) => `{{${item.key}}}`).join(", ") || "—"}
                    </p>
                    {selected.protectedModule && <Alert type="info" title={label("protected")} />}
                    <p>
                        {label("effective")}: {selected.effectiveTemplateId}
                    </p>
                    {selected.variables?.some((variable) => !variable.protected) && (
                        <section className="email-center-module">
                            <strong>{label("previewVariables")}</strong>
                            {selected.variables
                                .filter((variable) => !variable.protected)
                                .map((variable) => (
                                    <label key={variable.key}>
                                        {variable.key}
                                        <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} value={previewVariables[variable.key] || ""} onChange={(e) => setPreviewVariables((previous) => ({ ...previous, [variable.key]: e.target.value }))} />
                                    </label>
                                ))}
                        </section>
                    )}
                    {document.blocks.map((block, index) => {
                        const protectedBlock = block.type === "code" || block.type === "report" || (selected.protectedModule === "notice" && block.type === "notice" && !block.text);
                        return (
                            <section className="email-center-module" key={index}>
                                <div className="email-center-actions">
                                    <strong>{label(`block.${block.type}`)}</strong>
                                    <Button aria-label={label("up")} disabled={index === 0} onClick={() => moveBlock(index, -1)}>
                                        ↑
                                    </Button>
                                    <Button aria-label={label("down")} disabled={index === document.blocks.length - 1} onClick={() => moveBlock(index, 1)}>
                                        ↓
                                    </Button>
                                    {!protectedBlock && (
                                        <Button danger onClick={() => setDocument({ ...document, blocks: document.blocks.filter((_, i) => i !== index) })}>
                                            {label("remove")}
                                        </Button>
                                    )}
                                </div>
                                {!protectedBlock && (
                                    <>
                                        <label>
                                            {label("heading")}
                                            <Input value={block.title || ""} onChange={(e) => updateBlock(index, { title: e.target.value })} />
                                        </label>
                                        <label>
                                            {label("text")}
                                            <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} value={block.text || ""} onChange={(e) => updateBlock(index, { text: e.target.value })} />
                                        </label>
                                        {["button", "card", "cover"].includes(block.type) && (
                                            <label>
                                                {label("link")}
                                                <Input value={block.url || ""} onChange={(e) => updateBlock(index, { url: e.target.value })} />
                                            </label>
                                        )}
                                        {["image", "card", "cover"].includes(block.type) && (
                                            <>
                                                <label>
                                                    {label("upload")}
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/gif"
                                                        disabled={busy}
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            setBusy(true);
                                                            try {
                                                                const result = await uploadEmailAsset(file);
                                                                updateBlock(index, { image: result.url });
                                                            } catch (err) {
                                                                message.error(err instanceof Error ? err.message : label("failed"));
                                                            } finally {
                                                                setBusy(false);
                                                                e.target.value = "";
                                                            }
                                                        }}
                                                    />
                                                </label>
                                                <small>{label("uploadHelp")}</small>
                                                <label>
                                                    {label("image")}
                                                    <Input value={block.image || ""} onChange={(e) => updateBlock(index, { image: e.target.value })} />
                                                </label>
                                                <label>
                                                    {label("alt")}
                                                    <Input value={block.alt || ""} onChange={(e) => updateBlock(index, { alt: e.target.value })} />
                                                </label>
                                            </>
                                        )}
                                        {["steps", "features", "summary"].includes(block.type) && (
                                            <label>
                                                {label("items")}
                                                <Input.TextArea value={(block.items || []).join("\n")} onChange={(e) => updateBlock(index, { items: e.target.value.split("\n") })} />
                                            </label>
                                        )}
                                    </>
                                )}
                            </section>
                        );
                    })}
                    <div className="email-center-actions">
                        <Select aria-label={label("modules")} value={newType} onChange={setNewType} options={moduleTypes.map((value) => ({ value, label: label(`block.${value}`) }))} />
                        <Button onClick={() => setDocument({ ...document, blocks: [...document.blocks, { type: newType }] })}>{label("add")}</Button>
                    </div>
                </div>
                <div className="email-center-preview">
                    <div className="email-center-actions">
                        {[600, 375, 320].map((size) => (
                            <Button key={size} aria-pressed={width === size} onClick={() => setWidth(size)}>
                                {size}px
                            </Button>
                        ))}
                        <Select aria-label={label("preview")} value={mode} onChange={setMode} options={["light", "dark", "noimages", "plain", "source"].map((value) => ({ value, label: label(value) }))} />
                        {previewBusy && <Spin size="small" />}
                    </div>
                    {previewError && <Alert type="error" title={previewError} />}
                    <p>{preview?.Subject}</p>
                    {["plain", "source"].includes(mode) ? (
                        <pre className="email-center-source">{mode === "plain" ? preview?.Text : preview?.HTML}</pre>
                    ) : (
                        <div className="email-center-preview-scroll">
                            <iframe title={label("preview")} sandbox="" referrerPolicy="no-referrer" srcDoc={previewHTML || ""} style={{ width }} />
                        </div>
                    )}
                    <Alert type="info" title={label("testhelp")} />
                    <label>
                        {label("recipient")}
                        <Input type="email" autoComplete="off" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
                    </label>
                    <Button loading={busy} disabled={!recipient || !!previewError || !!brandError || previewBusy} onClick={() => run(() => editEmailTemplate(key, "test", { document, locale: emailLocale, to: recipient, previewVariables }))}>
                        {label("test")}
                    </Button>
                </div>
            </div>
        ) : null;

    return (
        <div data-plugin-scope="supdance-email-marketing" className="email-center">
            <AdminPageFrame
                scroll
                title={label("title")}
                description={label("description")}
                actions={
                    <div className="email-center-actions">
                        <Button loading={loading} onClick={() => (dirty ? modal.confirm({ title: label("unsaved"), onOk: load }) : load())}>
                            {label("refresh")}
                        </Button>
                        <Select
                            aria-label={label("emailLanguage")}
                            value={emailLocale}
                            onChange={(next) => {
                                const target = new URLSearchParams(params);
                                target.set("emailLocale", next);
                                setParams(target);
                            }}
                            options={SUPPORTED_LOCALES.map((item) => ({ value: item.code, label: item.label }))}
                        />
                        {data && (
                            <Button loading={busy} onClick={() => run(initializeEmailCenter)}>
                                {label("initialize")}
                            </Button>
                        )}
                    </div>
                }
            >
                {error && <Alert type="error" title={error} />}
                {brandError && <Alert type="error" title={brandError} />}
                {data?.safeMode && <Alert type="warning" title={label("safeMode")} />}
                {loading && !data ? (
                    <Spin tip={label("loading")} />
                ) : (
                    data && (
                        <>
                            <Tabs activeKey={section} onChange={chooseSection} items={sections.map((value) => ({ key: value, label: label(value) }))} />
                            {section === "overview" && (
                                <div className="email-center-summary">
                                    <section>
                                        <h2>{data.brand.name}</h2>
                                        {data.brand.logoUrl && <img src={data.brand.logoUrl} alt={`${data.brand.name} Logo`} />}
                                        <p>
                                            {data.templates.length} · {label("system")}: {data.templates.filter((item) => item.category !== "marketing").length} · {label("marketing")}: 4
                                        </p>
                                        <p>
                                            {data.smtp.host}:{data.smtp.port} · {data.smtp.encryption}
                                        </p>
                                        <Alert type="info" title={label("accepted")} />
                                    </section>
                                    <section>
                                        <Alert type="warning" title={label("paused")} description={label("pausedhelp")} />
                                        <p>{label("noTracking")}</p>
                                        <p>{label("protected")}</p>
                                    </section>
                                </div>
                            )}
                            {["system", "marketing"].includes(section) && editor}
                            {section === "marketing" && <EmailCampaignPanel templates={data.templates} paused={data.marketingPaused} />}
                            {section === "brand" && (
                                <section className="email-center-panel">
                                    <p>{label("inherited")}</p>
                                    {data.brand.logoUrl && <img className="email-center-brand-image" src={data.brand.logoUrl} alt={`${data.brand.name} Logo`} />}
                                    <dl>
                                        {Object.entries(data.brand).map(([name, value]) => (
                                            <div key={name}>
                                                <dt>{name}</dt>
                                                <dd>{value || "—"}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                    <Link to="/admin/settings/appearance">{label("appearance")}</Link>
                                </section>
                            )}
                            {section === "contacts" && (
                                <section className="email-center-panel">
                                    <Alert type="info" title={label("consent")} />
                                    <EmailPreferencePanel />
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>{label("recipient")}</th>
                                                <th>{label("sourceLabel")}</th>
                                                <th>{label("state")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.contacts.map((contact, index) => (
                                                <tr key={index}>
                                                    <td>{contact.email}</td>
                                                    <td>{contact.source}</td>
                                                    <td>{contact.suppression || label(contact.marketing ? "optedIn" : "optedOut")}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {!data.contacts.length && <p>{label("empty")}</p>}
                                </section>
                            )}
                            {section === "smtp" && (
                                <>
                                    <Alert type="warning" title={label("paused")} description={label("pausedhelp")} />
                                    <EmailSettingsPanel />
                                </>
                            )}
                            {section === "logs" && (
                                <>
                                    <EmailQueuePanel />
                                    <EmailLogs embedded />
                                </>
                            )}
                            {section === "versions" && (
                                <section className="email-center-panel">
                                    <Select aria-label={label("system")} value={key} onChange={switchTemplate} options={data.templates.map((item) => ({ value: item.key, label: label(`event.${item.key}`) }))} />
                                    <h2>{label("history")}</h2>
                                    <Select
                                        aria-label={label("history")}
                                        value={revision || undefined}
                                        onChange={setRevision}
                                        options={selected?.history.map((item) => ({ value: item.id, label: `${new Date(item.createdAt).toLocaleString()} · ${item.kind} · ${item.id.slice(0, 8)}` }))}
                                    />
                                    {history && (
                                        <>
                                            <p>{history.kind === "legacy" ? label("legacy") : label("compare")}</p>
                                            <div className="email-center-comparison">
                                                <pre>{JSON.stringify(selected?.published, null, 2)}</pre>
                                                <pre>{history.contentJson}</pre>
                                            </div>
                                            <Button
                                                disabled={history.kind === "legacy" || history.id === selected?.state.publishedId || dirty}
                                                loading={busy}
                                                onClick={() => selected && document && run(() => editEmailTemplate(key, "publish", { document, locale: emailLocale, revisionId: history.id, expectedRevision: selected.state.revision }))}
                                            >
                                                {label("rollback")}
                                            </Button>
                                        </>
                                    )}
                                    <EmailActivityPanel />
                                </section>
                            )}
                        </>
                    )
                )}
            </AdminPageFrame>
        </div>
    );
}
