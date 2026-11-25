import { useState, useMemo } from "react";
import { App } from "antd";
import { Image as ImageIcon, Sparkles, X } from "lucide-react";

import { useAssetStore, type ImageAsset } from "@/stores/use-asset-store";
import { resolveResourceUrl } from "@/services/api/resources";
import { useI18n } from "@/supdance/plugins/i18n";

export function ImageWorkspaceAssetDrawer({ open, onClose, onSelectReference }: { open: boolean; onClose: () => void; onSelectReference: (url: string) => void }) {
    const { message: toast } = App.useApp();
    const { t } = useI18n();
    const assets = useAssetStore((state) => state.assets);
    const [tab, setTab] = useState<"all" | "generation" | "upload">("all");

    const imageAssets = useMemo(() => {
        return assets.filter((asset): asset is ImageAsset => {
            if (asset.kind !== "image") return false;
            const rawUrl = asset.data?.dataUrl || asset.coverUrl;
            if (!rawUrl && !asset.data?.storageKey) return false;
            if (tab === "generation") return asset.source === "creation" || asset.source === "generation";
            if (tab === "upload") return asset.source === "upload" || !asset.source;
            return true;
        });
    }, [assets, tab]);

    if (!open) return null;

    return (
        <aside className="image-workspace-asset-drawer" aria-label={t("create.page.workspaceAssets.ariaLabel")}>
            <div className="image-workspace-asset-header">
                <h3>{t("library.assets.page.title")}</h3>
                <button type="button" className="image-workspace-asset-close" onClick={onClose} aria-label={t("create.page.workspaceAssets.closeAria")}>
                    <X className="size-4" />
                </button>
            </div>

            {/* 分类切换 */}
            <div className="px-3 pt-2 pb-1 flex items-center gap-1 border-b border-white/5 text-xs">
                <button type="button" className={`px-2.5 py-1 rounded-md transition-colors ${tab === "all" ? "bg-white/10 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setTab("all")}>
                    {t("create.page.workspaceAssets.tabAll")}
                </button>
                <button type="button" className={`px-2.5 py-1 rounded-md transition-colors ${tab === "generation" ? "bg-white/10 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setTab("generation")}>
                    {t("create.page.workspaceAssets.tabGeneration")}
                </button>
                <button type="button" className={`px-2.5 py-1 rounded-md transition-colors ${tab === "upload" ? "bg-white/10 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setTab("upload")}>
                    {t("create.page.workspaceAssets.tabUpload")}
                </button>
            </div>

            <div className="image-workspace-asset-body">
                {imageAssets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                        <ImageIcon className="size-8 opacity-40 mb-2" />
                        <span className="text-xs">{t("create.page.workspaceAssets.empty")}</span>
                    </div>
                ) : (
                    <div className="image-workspace-asset-grid">
                        {imageAssets.map((asset) => {
                            const rawUrl = asset.data?.dataUrl || asset.coverUrl || "";
                            const url = resolveResourceUrl(asset.data?.storageKey, rawUrl);
                            if (!url) return null;
                            return (
                                <div
                                    key={asset.id}
                                    className="image-workspace-asset-card"
                                    title={asset.title}
                                    onClick={() => {
                                        onSelectReference(url);
                                        toast.success(t("create.page.workspaceAssets.added"));
                                    }}
                                >
                                    <img src={url} alt={asset.title} loading="lazy" decoding="async" />
                                    <div className="image-workspace-asset-card-overlay">
                                        <button
                                            type="button"
                                            className="image-workspace-asset-use-btn flex items-center gap-1"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectReference(url);
                                                toast.success(t("create.page.workspaceAssets.added"));
                                            }}
                                        >
                                            <Sparkles className="size-3" />
                                            <span>{t("create.page.workspaceAssets.useAsReference")}</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </aside>
    );
}
