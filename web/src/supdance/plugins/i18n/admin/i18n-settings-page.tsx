import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Alert, Button, Checkbox } from "antd";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminSupDanceI18nOverview, updateAdminSupDanceI18nSettings } from "../api";
import { useI18n, useSupDanceI18nStore } from "../store";
import type { SupDanceI18nSettings } from "../types";
import { LanguageOptionGrid } from "@/components/layout/language-menu";
import { AdminPageFrame } from "@/pages/admin/components/admin-shell";

export function SupDanceI18nSettingsPage() {
    const { t } = useTranslation();
    const { t: text } = useI18n();
    const queryClient = useQueryClient();
    const queryKey = ["admin", "supdance-i18n", "settings"];
    const query = useQuery({ queryKey, queryFn: getAdminSupDanceI18nOverview });
    const [edits, setEdits] = useState<SupDanceI18nSettings | null>(null);
    const draft = edits ?? query.data?.settings;
    const save = useMutation({
        mutationFn: updateAdminSupDanceI18nSettings,
        onSuccess(overview) {
            queryClient.setQueryData(queryKey, overview);
            useSupDanceI18nStore.getState().updateLocalSettings(overview.settings);
            setEdits(null);
        },
    });
    return (
        <div data-plugin-scope="i18n">
            <AdminPageFrame scroll title={t("language.label")} description={t("language.description")}>
                <LanguageOptionGrid />
                <section className="mt-6 space-y-4 rounded-lg border border-border p-4">
                    <h2 className="font-semibold">{text("admin.i18n_settings")}</h2>
                    {query.isError && <Alert type="error" title={query.error.message} action={<Button onClick={() => void query.refetch()}>{text("common.retry")}</Button>} />}
                    {query.isPending && <p role="status">{text("common.loading")}</p>}
                    {draft && (
                        <fieldset disabled={save.isPending} className="space-y-4">
                            <label className="flex flex-wrap items-center gap-2">
                                {text("projects.default_preset")} · {t("language.label")}
                                <select
                                    value={draft.defaultLocale}
                                    onChange={(event) => {
                                        const language = draft.languages.find((item) => item.code === event.target.value);
                                        if (language) setEdits({ ...draft, defaultLocale: language.code });
                                    }}
                                >
                                    {draft.languages
                                        .filter((item) => item.enabled)
                                        .map((item) => (
                                            <option key={item.code} value={item.code}>
                                                {item.nativeName}
                                            </option>
                                        ))}
                                </select>
                            </label>
                            <div className="flex flex-wrap gap-3">
                                {draft.languages.map((item) => (
                                    <Checkbox
                                        key={item.code}
                                        checked={item.enabled}
                                        disabled={save.isPending || item.code === draft.defaultLocale}
                                        onChange={(event) => setEdits({ ...draft, languages: draft.languages.map((lang) => (lang.code === item.code ? { ...lang, enabled: event.target.checked } : lang)) })}
                                    >
                                        {item.nativeName}
                                    </Checkbox>
                                ))}
                            </div>
                            <Button loading={save.isPending} disabled={!edits} onClick={() => save.mutate(draft)}>
                                {text("common.save_changes")}
                            </Button>
                            {save.isError && <Alert type="error" title={save.error.message} />}
                            {save.isSuccess && !edits && <p role="status">{text("common.save_success")}</p>}
                        </fieldset>
                    )}
                    <Link className="underline" to="/admin/i18n/entries">
                        {text("admin.i18n_entries")}
                    </Link>
                </section>
            </AdminPageFrame>
        </div>
    );
}

export default SupDanceI18nSettingsPage;
