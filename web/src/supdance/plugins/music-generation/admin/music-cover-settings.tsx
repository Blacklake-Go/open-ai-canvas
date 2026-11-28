import { useEffect, useState } from "react";
import { Button, Input, InputNumber, Skeleton } from "antd";
import { Image as ImageIcon } from "lucide-react";
import { SettingsSectionCard } from "@/pages/admin/components/admin-ui";
import { AdminCheckbox, AdminSwitch } from "@/pages/admin/ui/controls";
import { Select } from "@/components/ui/base/select";
import { useI18n } from "@/supdance/plugins/i18n";
import { fetchMusicAdminConfig, updateMusicAdminConfig, type AdminMusicConfig } from "../services/music-api";

const MiB = 1024 * 1024;

export function MusicCoverSettings({ writable }: { writable: boolean }) {
    const { t, locale } = useI18n();
    const [settings, setSettings] = useState<AdminMusicConfig>();
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setError("");
        void fetchMusicAdminConfig(controller.signal)
            .then(setSettings)
            .catch((cause: unknown) => {
                if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
            });
        return () => controller.abort();
    }, [attempt]);

    const config = settings?.cover;
    const update = (patch: Partial<NonNullable<AdminMusicConfig["cover"]>>) => {
        setSaved(false);
        setError("");
        setSettings((value) => value && { ...value, cover: { ...value.cover, ...patch } });
    };
    const available = settings?.coverModels || [];
    const allowed = config?.allowedModels || [];
    const unavailable = allowed.filter((id) => !available.some((model) => model.id === id)).map((id) => ({ id, name: id, channel: undefined, estimated: false, quoteMicrocredits: undefined }));
    const modelOptions = available.filter((model) => allowed.includes(model.id)).map((model) => ({ value: model.id, label: [model.name, model.channel].filter(Boolean).join(" · ") }));
    const locked = saving || !writable;
    const price = (microcredits: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(microcredits / 1_000_000);

    return (
        <SettingsSectionCard icon={<ImageIcon size={16} />} title={t("music.cover_settings")} description={t("music.cover_settings_description")} contentClassName="music-admin-section">
            {error ? (
                <p role="alert" className="text-destructive">
                    {error}
                </p>
            ) : null}
            {!config ? (
                error ? (
                    <Button onClick={() => setAttempt((value) => value + 1)}>{t("common.reload")}</Button>
                ) : (
                    <Skeleton active paragraph={{ rows: 3 }} />
                )
            ) : (
                <form
                    className="music-admin-cover-form"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        if (locked) return;
                        setSaving(true);
                        setError("");
                        setSaved(false);
                        try {
                            setSettings(await updateMusicAdminConfig({ cover: config }));
                            setSaved(true);
                        } catch (cause) {
                            setError(cause instanceof Error ? cause.message : String(cause));
                        } finally {
                            setSaving(false);
                        }
                    }}
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>{t("music.cover_enable_generation")}</span>
                        <AdminSwitch aria-label={t("music.cover_enable_generation")} checked={config.enabled} disabled={locked} onChange={(enabled) => update({ enabled })} />
                    </div>
                    <fieldset className="min-w-0">
                        <legend>{t("music.cover_allowed_models")}</legend>
                        {!available.length && <p className="text-muted-foreground">{t("music.cover_no_models")}</p>}
                        <div className="music-admin-cover-models">
                            {[...available, ...unavailable].map((model) => (
                                <AdminCheckbox
                                    key={model.id}
                                    disabled={locked}
                                    checked={allowed.includes(model.id)}
                                    onChange={(event) => {
                                        const allowedModels = event.target.checked ? [...allowed, model.id] : allowed.filter((item) => item !== model.id);
                                        const defaultModel = allowedModels.includes(config.defaultModel) ? config.defaultModel : allowedModels[0] || "";
                                        update({ allowedModels, defaultModel });
                                    }}
                                >
                                    <span translate="no">
                                        {model.name}
                                        {model.channel ? " · " + model.channel : ""}
                                    </span>{" "}
                                    <span className="ms-2 text-muted-foreground">
                                        {model.quoteMicrocredits !== undefined ? t(model.estimated ? "music.cover_estimated_price" : "music.cover_price", { credits: price(model.quoteMicrocredits) }) : t("music.cover_model_unavailable")}
                                    </span>
                                </AdminCheckbox>
                            ))}
                        </div>
                    </fieldset>
                    <div className="grid gap-2">
                        <span>{t("music.cover_default_model")}</span>
                        <Select<string> ariaLabel={t("music.cover_default_model")} value={config.defaultModel || undefined} options={modelOptions} disabled={locked || !modelOptions.length} onChange={(defaultModel) => update({ defaultModel })} />
                    </div>
                    <label className="grid gap-2">
                        {t("music.cover_prompt_template")}
                        <Input.TextArea value={config.promptTemplate} disabled={locked} autoSize={{ minRows: 2, maxRows: 5 }} maxLength={1000} onChange={(event) => update({ promptTemplate: event.target.value })} />
                    </label>
                    <p className="text-caption text-muted-foreground">{t("music.cover_template_tokens", { title: "{title}", prompt: "{prompt}", lyrics: "{lyrics}" })}</p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>{t("music.cover_allow_upload")}</span>
                        <AdminSwitch aria-label={t("music.cover_allow_upload")} checked={config.allowUpload} disabled={locked} onChange={(allowUpload) => update({ allowUpload })} />
                    </div>
                    {config.allowUpload && (
                        <div className="flex flex-wrap items-start gap-4">
                            <label className="grid gap-2">
                                {t("music.cover_upload_size")}
                                <InputNumber min={1} max={20} precision={0} value={config.maxUploadBytes / MiB} disabled={locked} onChange={(value) => value !== null && update({ maxUploadBytes: value * MiB })} />
                            </label>
                            <label className="grid gap-2">
                                {t("music.cover_upload_dimensions")}
                                <InputNumber min={512} max={4096} precision={0} value={config.maxDimension} disabled={locked} onChange={(value) => value !== null && update({ maxDimension: value })} />
                            </label>
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                        <Button htmlType="submit" type="primary" loading={saving} disabled={locked || (config.enabled && !modelOptions.some((model) => model.value === config.defaultModel))}>
                            {t("common.save")}
                        </Button>
                        {saved && <span role="status">{t("music.cover_saved")}</span>}
                    </div>
                </form>
            )}
        </SettingsSectionCard>
    );
}
