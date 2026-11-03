import { useRef, useState } from "react";
import { App, Button } from "antd";
import { Eraser, ImageIcon, MoonStar, Sun, UploadCloud } from "lucide-react";

import { uploadResourceFile } from "@/services/api/resources";
import { useI18n } from "@/supdance/plugins/i18n";
import { AdminModal } from "@/pages/admin/ui/overlays";
import { Callout } from "@/pages/admin/ui/controls";

import { updateAdminSocialAuthSettings } from "../api";
import { SocialProviderBrandIcon } from "../components/social-provider-icons";
import type { AdminSettingsView, SocialAuthProviderAdmin } from "../types";

export interface ProviderIconModalProps {
    provider: SocialAuthProviderAdmin;
    onClose: () => void;
    onSaved: (payload: { view: AdminSettingsView; providerId: string }) => void;
}

const ACCEPTED_ICON_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml";

export function ProviderIconModal({ provider, onClose, onSaved }: ProviderIconModalProps) {
    const { t } = useI18n();
    const { message } = App.useApp();
    const [busy, setBusy] = useState(false);
    const [uploadingSlot, setUploadingSlot] = useState<"light" | "dark" | null>(null);
    const [notice, setNotice] = useState("");
    const [iconLightUrl, setIconLightUrl] = useState(provider.iconLightUrl || "");
    const [iconDarkUrl, setIconDarkUrl] = useState(provider.iconDarkUrl || "");
    const lightInputRef = useRef<HTMLInputElement | null>(null);
    const darkInputRef = useRef<HTMLInputElement | null>(null);

    const dirty = iconLightUrl !== (provider.iconLightUrl || "") || iconDarkUrl !== (provider.iconDarkUrl || "");

    const handleUpload = async (slot: "light" | "dark", file: File) => {
        setUploadingSlot(slot);
        setNotice("");
        try {
            const resource = await uploadResourceFile(file, "image", { fileName: `social-${provider.id}-${slot}-${file.name}` });
            const url = resource.publicUrl || `/api/resources/${resource.id}/raw`;
            if (slot === "light") setIconLightUrl(url);
            else setIconDarkUrl(url);
        } catch (err) {
            setNotice(err instanceof Error ? err.message : t("admin.social_auth.icon_upload_failed", undefined, "图标上传失败"));
        } finally {
            setUploadingSlot(null);
        }
    };

    const handleClear = (slot: "light" | "dark") => {
        if (slot === "light") setIconLightUrl("");
        else setIconDarkUrl("");
    };

    const submit = async () => {
        // 后端对 enabled / customRedirectUrl 是无条件覆盖写入，保存图标时必须带上当前值。
        setBusy(true);
        setNotice("");
        try {
            const view = await updateAdminSocialAuthSettings({
                providers: {
                    [provider.id]: {
                        enabled: provider.enabled,
                        customRedirectUrl: provider.customRedirectUrl || "",
                        iconLightUrl: iconLightUrl.trim(),
                        iconDarkUrl: iconDarkUrl.trim(),
                    },
                },
            });
            message.success(t("admin.social_auth.icon_saved", undefined, "品牌图标已更新"));
            onSaved({ view, providerId: provider.id });
        } catch (err) {
            setNotice(err instanceof Error ? err.message : t("admin.social_auth.icon_save_failed", undefined, "品牌图标保存失败"));
        } finally {
            setBusy(false);
        }
    };

    const renderSlot = (slot: "light" | "dark") => {
        const url = slot === "light" ? iconLightUrl : iconDarkUrl;
        const inputRef = slot === "light" ? lightInputRef : darkInputRef;
        const isUploading = uploadingSlot === slot;
        const IconLabel = slot === "light" ? Sun : MoonStar;
        return (
            <div className="flex flex-col gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--admin-text)]">
                    <IconLabel className="size-3.5 text-[var(--admin-text-secondary)]" aria-hidden="true" />
                    {slot === "light" ? t("admin.social_auth.icon_light", undefined, "亮色图标") : t("admin.social_auth.icon_dark", undefined, "暗色图标")}
                </div>
                <div className={`flex h-20 items-center justify-center rounded-md border border-[var(--admin-border)] ${slot === "light" ? "bg-white" : "bg-[#101014]"}`}>
                    {url ? <SocialProviderBrandIcon provider={provider.id} iconLightUrl={url} iconDarkUrl={url} className="size-10" /> : <ImageIcon className="size-6 text-[var(--admin-text-muted)]" aria-hidden="true" />}
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_ICON_TYPES}
                    className="hidden"
                    aria-label={slot === "light" ? t("admin.social_auth.icon_light", undefined, "亮色图标") : t("admin.social_auth.icon_dark", undefined, "暗色图标")}
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void handleUpload(slot, file);
                    }}
                />
                <div className="flex items-center justify-between gap-2">
                    <Button size="small" icon={<UploadCloud className="size-3.5" />} loading={isUploading} onClick={() => inputRef.current?.click()}>
                        {url ? t("admin.social_auth.icon_replace", undefined, "替换文件") : t("admin.social_auth.icon_upload", undefined, "上传文件")}
                    </Button>
                    {url ? (
                        <Button size="small" type="text" icon={<Eraser className="size-3.5" />} onClick={() => handleClear(slot)}>
                            {t("admin.social_auth.icon_clear", undefined, "清除")}
                        </Button>
                    ) : null}
                </div>
            </div>
        );
    };

    return (
        <AdminModal
            open
            width={480}
            title={
                <span className="flex items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-surface-2)]">
                        <SocialProviderBrandIcon provider={provider.id} iconLightUrl={provider.iconLightUrl} iconDarkUrl={provider.iconDarkUrl} className="size-4" />
                    </span>
                    <span className="flex flex-col">
                        <strong className="text-sm font-semibold text-[var(--admin-text)] leading-tight">{provider.name}</strong>
                        <em className="text-xs not-italic text-[var(--admin-text-muted)]">{t("admin.social_auth.brand_icon_setting", undefined, "品牌图标设置")}</em>
                    </span>
                </span>
            }
            onCancel={onClose}
            onOk={() => void submit()}
            okText={t("admin.social_auth.icon_save", undefined, "保存图标")}
            cancelText={t("common.cancel", undefined, "取消")}
            okButtonProps={{ loading: busy, disabled: !dirty }}
        >
            <div className="flex flex-col gap-4 py-2 text-xs">
                <p className="text-[var(--admin-text-secondary)]">{t("admin.social_auth.icon_hint", undefined, "分别上传亮色与暗色两版品牌图标（建议 128×128 PNG/SVG）；登录页与管理台会按界面明暗自动切换，清除后恢复默认图标。")}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {renderSlot("light")}
                    {renderSlot("dark")}
                </div>
                {notice ? (
                    <Callout tone="warning" title={t("admin.social_auth.icon_notice_title", undefined, "提示")}>
                        {notice}
                    </Callout>
                ) : null}
            </div>
        </AdminModal>
    );
}
