import { Alert, App, Button, Input, Select } from "antd";
import { useEffect, useState } from "react";
import { useI18n } from "@/supdance/plugins/i18n";
import type { EmailCampaign, EmailTemplate } from "../types";
import { controlEmailCampaign, createEmailCampaign, listEmailCampaigns } from "../api";

export function EmailCampaignPanel({ templates, paused }: { templates: EmailTemplate[]; paused: boolean }) {
    const { t } = useI18n();
    const label = (key: string) => t(`email.center.${key}`);
    const { message } = App.useApp();
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [name, setName] = useState("");
    const [templateKey, setTemplateKey] = useState("welcome");
    const [sourceFilter, setSourceFilter] = useState("");
    const [variables, setVariables] = useState('{"name":""}');
    const [scheduleAt, setScheduleAt] = useState("");
    const load = async () => {
        try {
            setCampaigns(await listEmailCampaigns());
            setError("");
        } catch (err) {
            setError(err instanceof Error ? err.message : label("failed"));
        }
    };
    useEffect(() => {
        void load();
    }, []);
    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await action();
            await load();
            message.success(label("saved"));
        } catch (err) {
            message.error(err instanceof Error ? err.message : label("failed"));
        } finally {
            setBusy(false);
        }
    };
    const create = async () => {
        let parsed: unknown;
        try {
            parsed = JSON.parse(variables);
        } catch {
            throw new Error(label("variablesError"));
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.values(parsed).some((value) => typeof value !== "string")) throw new Error(label("variablesError"));
        return createEmailCampaign({ name, templateKey, sourceFilter, variables: parsed as Record<string, string> });
    };
    return (
        <section className="email-center-panel">
            <h2>{label("campaigns")}</h2>
            {paused && <Alert type="warning" title={label("paused")} description={label("pausedhelp")} />}
            {error && <Alert type="error" title={error} />}
            <div className="email-center-summary">
                <div>
                    <label>
                        {label("campaignName")}
                        <Input value={name} maxLength={160} onChange={(e) => setName(e.target.value)} />
                    </label>
                    <label>
                        {label("marketing")}
                        <Select
                            value={templateKey}
                            onChange={(value) => {
                                setTemplateKey(value);
                                const item = templates.find((entry) => entry.key === value);
                                setVariables(JSON.stringify(Object.fromEntries(item?.variables.filter((entry) => !entry.protected).map((entry) => [entry.key, ""]) || []), null, 2));
                            }}
                            options={templates.filter((item) => item.category === "marketing").map((item) => ({ value: item.key, label: label(`event.${item.key}`) }))}
                        />
                    </label>
                    <label>
                        {label("segment")}
                        <Input value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} />
                    </label>
                </div>
                <label>
                    {label("variables")}
                    <Input.TextArea autoSize={{ minRows: 5, maxRows: 12 }} value={variables} onChange={(e) => setVariables(e.target.value)} />
                </label>
            </div>
            <Button loading={busy} disabled={!name} onClick={() => run(create)}>
                {label("create")}
            </Button>
            <label>
                {label("scheduleAt")}
                <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
            </label>
            {campaigns.map((campaign) => (
                <div className="email-center-module" key={campaign.id}>
                    <strong>{campaign.name}</strong>
                    <p>
                        {campaign.templateKey} · {campaign.status} · {campaign.revisionId.slice(0, 8)}
                    </p>
                    <p>
                        {label("counts")}:{" "}
                        {Object.entries(campaign.stats)
                            .map(([state, count]) => `${state}: ${count}`)
                            .join(" · ") || "—"}
                    </p>
                    <div className="email-center-actions">
                        <Button disabled={busy || !scheduleAt || !["draft", "paused"].includes(campaign.status)} onClick={() => run(() => controlEmailCampaign(campaign.id, "schedule", new Date(scheduleAt).toISOString()))}>
                            {label("schedule")}
                        </Button>
                        <Button disabled={busy || campaign.status !== "scheduled"} onClick={() => run(() => controlEmailCampaign(campaign.id, "pause"))}>
                            {label("pause")}
                        </Button>
                        <Button danger disabled={busy || !["draft", "paused", "scheduled"].includes(campaign.status)} onClick={() => run(() => controlEmailCampaign(campaign.id, "cancel"))}>
                            {label("cancel")}
                        </Button>
                    </div>
                </div>
            ))}
        </section>
    );
}
