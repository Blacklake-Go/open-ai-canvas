import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, App, Button } from "antd";
import { ListFilter } from "lucide-react";
import { appQueryClient } from "@/lib/query-client";
import { AdminPageFrame } from "@/pages/admin/components/admin-shell";
import { SettingsSectionCard } from "@/pages/admin/components/admin-ui";
import { AdminSwitch } from "@/pages/admin/ui/controls";
import { notifyPluginStateChanged } from "@/supdance/adapters/plugin-state-sync";
import { compactAdminKey, compactPublicKey, readAdminSettings, saveAdminSettings, type CompactPickerSettings } from "./settings";
import { GalleryAdmin } from "./gallery-admin";

const fields = [
    ["enabled", "enabledHint"],
    ["showDescription", "descriptionHint"],
    ["showPrice", "priceHint"],
] as const;

export default function CompactPickerAdmin() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [edits, setEdits] = useState<Partial<CompactPickerSettings>>({});
    const query = useQuery({ queryKey: compactAdminKey, queryFn: ({ signal }) => readAdminSettings(signal), staleTime: 0 });
    const save = useMutation({
        mutationFn: saveAdminSettings,
        onSuccess: (settings) => {
            appQueryClient.setQueryData(compactAdminKey, settings);
            appQueryClient.setQueryData(compactPublicKey, settings);
            setEdits({});
            notifyPluginStateChanged();
            void message.success(t("compactPicker.saved"));
        },
    });
    const draft = query.data && { ...query.data, ...edits };
    const dirty = draft && (fields.some(([key]) => draft[key] !== query.data?.[key]) || (["showInspirations", "homepageShowcaseEnabled", "complianceLock"] as const).some((key) => draft[key] !== query.data?.[key]));
    return (
        <AdminPageFrame scroll title={t("compactPicker.title")} description={t("compactPicker.summary")}>
            {query.isError ? (
                <Alert type="error" showIcon title={t("compactPicker.readError")} description={query.error.message} action={<Button onClick={() => void query.refetch()}>{t("compactPicker.retry")}</Button>} />
            ) : !draft ? (
                <p role="status">{t("compactPicker.loading")}</p>
            ) : (
                <>
                    <SettingsSectionCard
                        icon={<ListFilter />}
                        title={t("compactPicker.appearance")}
                        footer={
                            <Button type="primary" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate(draft)}>
                                {t("compactPicker.save")}
                            </Button>
                        }
                    >
                        {fields.map(([key, hint]) => (
                            <div key={key} className="flex items-center justify-between gap-4 border-b border-[var(--admin-border)] px-4 py-3 last:border-b-0">
                                <div>
                                    <strong>{t(`compactPicker.${key}`)}</strong>
                                    <p className="text-sm text-[var(--admin-text-muted)]">{t(`compactPicker.${hint}`)}</p>
                                </div>
                                <AdminSwitch
                                    checked={Boolean(draft[key])}
                                    disabled={save.isPending || (key !== "enabled" && !draft.enabled)}
                                    aria-label={t(`compactPicker.${key}`)}
                                    onChange={(checked) => setEdits((current) => ({ ...current, [key]: checked }))}
                                />
                            </div>
                        ))}
                        {save.isError && <Alert role="alert" type="error" showIcon title={save.error.message} />}
                    </SettingsSectionCard>
                    <GalleryAdmin draft={draft} pending={save.isPending} edit={(value) => setEdits((current) => ({ ...current, ...value }))} />
                </>
            )}
        </AdminPageFrame>
    );
}
