import { HardDrive } from "lucide-react";
import { Link } from "react-router";

import { useAccountFileStorageUsage } from "@/hooks/use-account-file-storage-usage";
import { accountStorageMeter, accountStorageStateMessage } from "@/lib/account-storage-usage";
import { cn } from "@/lib/utils";
import { preloadWorkspaceRoute } from "@/lib/workspace-route-modules";
import { progressFillStyle } from "@/lib/progress-fill";
import { useI18n } from "@/supdance/plugins/i18n";

function StorageGlyph() {
    return (
        <span className="app-workspace-sidebar-storage-icon" aria-hidden="true">
            <HardDrive strokeWidth={1.75} />
        </span>
    );
}

export function WorkspaceSidebarStorageMeter({ collapsed }: { collapsed: boolean }) {
    const { t, locale } = useI18n();
    const query = useAccountFileStorageUsage();
    const meter = accountStorageMeter(query.data, locale);
    const usedText = query.data ? t("nav.storage_used", { used: meter.usedLabel }, `已用 ${meter.usedLabel}`) : query.isError ? t("nav.storage_unavailable", undefined, "容量暂不可用") : t("nav.storage_calculating", undefined, "正在统计容量");
    const remainingText = query.data ? (meter.state === "read_only" ? t("nav.storage_read_only", undefined, "账号只读") : meter.state === "grace" ? t("nav.storage_over_limit", undefined, "已超额") : meter.full ? t("nav.storage_full", undefined, "容量已满") : t("nav.storage_remaining", { remaining: meter.remainingLabel }, `剩余 ${meter.remainingLabel}`)) : "";
    const totalText = query.data ? t("nav.storage_total", { total: meter.totalLabel }, `共 ${meter.totalLabel}`) : "";
    const summary = query.data ? `${usedText}，${remainingText}，${totalText}` : usedText;
    const stateMessage = accountStorageStateMessage(meter, t);

    const track = (
        <span
            className="app-workspace-sidebar-storage-track"
            role="progressbar"
            aria-label={t("nav.storage_meter_aria", undefined, "账号文件容量使用进度")}
            aria-valuemin={0}
            aria-valuemax={query.data?.totalBytes ?? 0}
            aria-valuenow={query.data ? Math.min(query.data.usedBytes, query.data.totalBytes) : 0}
            aria-valuetext={summary}
        >
            <span style={progressFillStyle(meter.percent)} />
        </span>
    );

    if (query.isError && !query.data) {
        return (
            <div className={cn("app-workspace-sidebar-storage is-error", collapsed && "is-collapsed")}>
                {collapsed ? (
                    <button type="button" title={t("nav.storage_retry_title", undefined, "容量统计暂时不可用，点击重试")} aria-label={t("nav.storage_retry_aria", undefined, "重试加载账号容量")} onClick={() => void query.refetch()}>
                        <StorageGlyph />
                    </button>
                ) : (
                    <>
                        <StorageGlyph />
                        <span>{t("nav.storage_unavailable", undefined, "容量暂不可用")}</span>
                        <button type="button" onClick={() => void query.refetch()}>
                            {t("common.retry", undefined, "重试")}
                        </button>
                    </>
                )}
            </div>
        );
    }

    return (
        <Link
            to="/assets"
            className={cn(
                "app-workspace-sidebar-storage",
                collapsed && "is-collapsed",
                meter.tone === "warn" && "is-warn",
                (meter.tone === "critical" || meter.state !== "ok") && "is-critical",
                query.data?.usedBytes ? "has-usage" : null,
                query.isPending && !query.data && "is-pending",
            )}
            title={`${summary}。${t("nav.storage_tooltip_desc", undefined, "包含素材文件和 Agent 会话附件")}${stateMessage ? `。${stateMessage}` : ""}`}
            aria-label={`${t("nav.storage_aria_prefix", undefined, "账号容量")}，${summary}`}
            aria-busy={query.isPending && !query.data}
            onFocus={() => preloadWorkspaceRoute("/assets")}
            onPointerEnter={() => preloadWorkspaceRoute("/assets")}
        >
            <StorageGlyph />
            {collapsed ? (
                track
            ) : (
                <span className="app-workspace-sidebar-storage-body">
                    <span className="app-workspace-sidebar-storage-copy">
                        <span className="app-workspace-sidebar-storage-meta">
                            <span className="app-workspace-sidebar-storage-used">{usedText}</span>
                            {totalText ? <span className="app-workspace-sidebar-storage-total">{totalText}</span> : null}
                        </span>
                    </span>
                    <span className="app-workspace-sidebar-storage-foot">
                        {track}
                        {remainingText ? <span className="app-workspace-sidebar-storage-remain">{remainingText}</span> : null}
                    </span>
                </span>
            )}
        </Link>
    );
}
