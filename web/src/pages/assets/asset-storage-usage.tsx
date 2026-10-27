import { HardDrive } from "lucide-react";

import { useAccountFileStorageUsage } from "@/hooks/use-account-file-storage-usage";
import { accountFileStorageUsageQueryKey, accountStorageMeter, accountStorageStateMessage, formatStorageBytes } from "@/lib/account-storage-usage";
import { openStoragePurchase } from "@/lib/workspace-storage";
import { progressFillStyle } from "@/lib/progress-fill";
import { useI18n } from "@/supdance/plugins/i18n";

export const assetStorageUsageQueryKey = accountFileStorageUsageQueryKey;

export function AssetStorageUsage() {
    const { t, locale } = useI18n();
    const query = useAccountFileStorageUsage();
    const usage = query.data;
    const meter = accountStorageMeter(usage, locale);
    const stateMessage = accountStorageStateMessage(meter, t);
    const showUpsell = meter.state !== "ok" || meter.tone !== "ok";

    return (
        <section
            className={`assets-storage-usage${meter.full || meter.state !== "ok" ? " is-full" : ""}${usage?.usedBytes ? " has-usage" : ""}`}
            aria-label={t("nav.storage_aria_prefix", undefined, "账号容量")}
            aria-busy={query.isPending}
            title={`${t("nav.storage_tooltip_desc", undefined, "包含素材文件和 Agent 会话附件")}${stateMessage ? `。${stateMessage}` : ""}`}
        >
            <span className="assets-storage-usage-icon" aria-hidden="true">
                <HardDrive />
            </span>
            <span className="assets-storage-usage-title">
                {meter.state === "read_only"
                    ? t("nav.storage_read_only", undefined, "账号只读")
                    : meter.state === "grace"
                        ? t("nav.storage_over_limit", undefined, "容量已超额")
                        : t("nav.storage_aria_prefix", undefined, "账号容量")}
            </span>
            {usage ? (
                <>
                    <span className="assets-storage-usage-value">
                        {formatStorageBytes(usage.usedBytes)} / {formatStorageBytes(usage.totalBytes)}
                    </span>
                    <span
                        className="assets-storage-usage-track"
                        role="progressbar"
                        aria-label={t("nav.storage_meter_aria", undefined, "账号文件容量使用进度")}
                        aria-valuemin={0}
                        aria-valuemax={usage.totalBytes}
                        aria-valuenow={Math.min(usage.usedBytes, usage.totalBytes)}
                        aria-valuetext={`${t("nav.storage_used", { used: formatStorageBytes(usage.usedBytes) }, `已使用 ${formatStorageBytes(usage.usedBytes)}`)}，${t("nav.storage_total", { total: formatStorageBytes(usage.totalBytes) }, `总容量 ${formatStorageBytes(usage.totalBytes)}`)}`}
                    >
                        <span style={progressFillStyle(meter.percent)} />
                    </span>
                    <span className="assets-storage-usage-percent">{meter.percentLabel}</span>
                    <button type="button" className="assets-storage-usage-action" onClick={() => openStoragePurchase()}>
                        {showUpsell ? t("settings.wallet_storage_expand", undefined, "扩容") : t("nav.storage_limit_buy", undefined, "购买空间")}
                    </button>
                </>
            ) : query.isError ? (
                <span className="assets-storage-usage-status">
                    {t("nav.storage_unavailable", undefined, "容量统计暂时不可用。")}
                    <button type="button" onClick={() => void query.refetch()}>
                        {t("common.retry", undefined, "重试")}
                    </button>
                </span>
            ) : (
                <span className="assets-storage-usage-status">{t("nav.storage_calculating", undefined, "正在统计已用容量…")}</span>
            )}
        </section>
    );
}
