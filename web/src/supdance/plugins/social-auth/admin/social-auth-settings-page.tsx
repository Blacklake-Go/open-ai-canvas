import { useEffect, useMemo, useState } from "react";
import { App, Button, Skeleton, Tooltip } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, ExternalLink, KeyRound, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/base/select";
import { AdminPageFrame } from "@/pages/admin/components/admin-shell";
import { AdminStatusBadge } from "@/pages/admin/components/admin-ui";
import { IconButton, SegmentedControl, Switch } from "@/pages/admin/ui/controls";
import { useI18n } from "@/supdance/plugins/i18n";
import { getAdminSocialAuthSettings, testSocialAuthProvider, updateAdminSocialAuthSettings } from "../api";
import { SocialProviderIcon } from "../components/social-provider-icons";
import type { AdminSettingsView, ProviderTestResult, SocialAuthProviderAdmin, SocialAuthRegion } from "../types";
import { credentialKeyLabels, draftFromProvider, maskedClientIdOf, probeBadgeOf, statusBadgeOf, type ProviderDraftState } from "./credential-helpers";
import { ProviderCredentialModal } from "./provider-credential-modal";
import { SocialAuthNavTabs } from "./social-auth-nav-tabs";

const REGION_TABS: Array<{ value: SocialAuthRegion; label: string; hint: string }> = [
    { value: "cn", label: "中国大陆渠道", hint: "面向中国大陆来访 IP 展示国内登录入口。" },
    { value: "intl", label: "海外渠道", hint: "面向海外及港澳台来访 IP 展示国际登录入口。" },
];

const FALLBACK_OPTIONS = [
    { value: "cn", label: "回退到中国大陆渠道" },
    { value: "intl", label: "回退到海外渠道" },
];

export default function SocialAuthSettingsPage() {
    const { t } = useI18n();
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<AdminSettingsView | null>(null);
    const [loadError, setLoadError] = useState("");

    const [activeRegion, setActiveRegion] = useState<SocialAuthRegion>("cn");
    const [credentialProviderId, setCredentialProviderId] = useState<string | null>(null);
    const [modalDraft, setModalDraft] = useState<ProviderDraftState | null>(null);
    const [togglingProviderId, setTogglingProviderId] = useState<string | null>(null);

    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});
    const [copiedProviderId, setCopiedProviderId] = useState<string | null>(null);

    const allProviders = useMemo(() => (data ? [...(data.mainlandProviders || []), ...(data.intlProviders || [])] : []), [data]);

    const loadSettings = async (isInitial = false) => {
        if (isInitial) setLoading(true);
        else setRefreshing(true);
        setLoadError("");
        try {
            const res = await getAdminSocialAuthSettings();
            setData(res);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "读取社交登录配置失败";
            setLoadError(msg);
            message.error(msg);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        void loadSettings(true);
    }, []);

    const invalidatePublicProviders = () => {
        void queryClient.invalidateQueries({ queryKey: ["public-social-auth-providers"] });
        void queryClient.invalidateQueries({ queryKey: ["social-auth"] });
    };

    const handleCopy = (text: string, label = "内容", feedbackKey?: string) => {
        navigator.clipboard.writeText(text);
        message.success(t("admin.social_auth.copy_success", { label }, `已复制${label}到剪贴板`));
        if (!feedbackKey) return;
        setCopiedProviderId(feedbackKey);
        window.setTimeout(() => setCopiedProviderId((current) => (current === feedbackKey ? null : current)), 2000);
    };

    const handlePing = async (provider: SocialAuthProviderAdmin) => {
        setTestingProvider(provider.id);
        try {
            const res = await testSocialAuthProvider(provider.id);
            setTestResults((prev) => ({ ...prev, [provider.id]: res }));
            const isSuccess = res.status === "reachable";
            const latency = res.pingLatencyMs ?? res.latencyMs ?? 0;
            if (isSuccess) {
                message.success(`${provider.name} 端点可达 (${latency}ms)，真实登录待验证`);
            } else if (res.status === "degraded") {
                message.warning(`${provider.name}: ${res.message}`);
            } else {
                message.error(`${provider.name}: ${res.message}`);
            }
        } catch (err) {
            message.error(err instanceof Error ? err.message : "测试失败");
        } finally {
            setTestingProvider(null);
        }
    };

    // Instant toggle Switch handler
    const handleToggleEnable = async (provider: SocialAuthProviderAdmin, checked: boolean) => {
        if (!provider.hasCredentials && checked) {
            message.warning("请先配置密钥后再启用该渠道");
            return;
        }

        setTogglingProviderId(provider.id);
        try {
            const res = await updateAdminSocialAuthSettings({
                providers: {
                    [provider.id]: {
                        enabled: checked,
                        customRedirectUrl: provider.customRedirectUrl,
                    },
                },
            });
            setData(res);
            invalidatePublicProviders();
            message.success(checked ? `${provider.name} 登录已即时开启` : `${provider.name} 登录已关闭`);
        } catch (err) {
            message.error(err instanceof Error ? err.message : "更新渠道状态失败");
        } finally {
            setTogglingProviderId(null);
        }
    };

    const handleFallbackRegionChange = async (value: SocialAuthRegion) => {
        try {
            const res = await updateAdminSocialAuthSettings({
                defaultFallbackRegion: value,
                providers: {},
            });
            setData(res);
            invalidatePublicProviders();
            message.success("默认回退分区已更新");
        } catch (err) {
            message.error(err instanceof Error ? err.message : "更新回退分区失败");
        }
    };

    const handleCredentialSaved = ({ view, providerId, credentialsWritten }: { view: AdminSettingsView; providerId: string; credentialsWritten: boolean }) => {
        setData(view);
        setCredentialProviderId(null);
        setModalDraft(null);
        invalidatePublicProviders();
        const saved = [...(view.mainlandProviders || []), ...(view.intlProviders || [])].find((p) => p.id === providerId) || view.providers?.[providerId];
        if (credentialsWritten && saved) void handlePing(saved);
    };

    const handleOpenCredentialModal = (provider: SocialAuthProviderAdmin) => {
        setCredentialProviderId(provider.id);
        setModalDraft(draftFromProvider(provider));
    };

    if (loading && !data) {
        return (
            <AdminPageFrame title="第三方登录配置" description="第三方登录凭据、IP 分区与即时启停；渠道可用性以真实授权验收为准" scroll>
                <div data-plugin-scope="social-auth" className="flex flex-col gap-4 py-2" role="status">
                    <SocialAuthNavTabs />
                    <Skeleton active paragraph={{ rows: 6 }} />
                </div>
            </AdminPageFrame>
        );
    }

    if (!data) {
        return (
            <AdminPageFrame title="第三方登录配置" description="第三方登录凭据、IP 分区与即时启停；渠道可用性以真实授权验收为准" scroll>
                <div data-plugin-scope="social-auth" className="flex flex-col gap-4 py-2">
                    <SocialAuthNavTabs />
                    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center" role="alert">
                        <AlertTriangle className="size-6 text-amber-500" aria-hidden="true" />
                        <h2 className="text-sm font-semibold text-[var(--admin-text)]">无法读取社交登录配置</h2>
                        <p className="text-xs text-[var(--admin-text-secondary)]">{loadError || "请检查网络或后端服务状态"}</p>
                        <Button icon={<RefreshCw className="size-3.5" />} onClick={() => void loadSettings(true)}>
                            重新读取
                        </Button>
                    </div>
                </div>
            </AdminPageFrame>
        );
    }

    const cnProviders = data.mainlandProviders || [];
    const intlProviders = data.intlProviders || [];
    const activeProviders = activeRegion === "cn" ? cnProviders : intlProviders;
    const credentialProvider = credentialProviderId ? allProviders.find((p) => p.id === credentialProviderId) || null : null;

    return (
        <AdminPageFrame title="第三方登录配置" description="第三方登录凭据、IP 分区与即时启停；渠道可用性以真实授权验收为准" scroll>
            <div data-plugin-scope="social-auth" className="flex flex-col gap-4 py-2">
                {/* WeChat-style underline nav tabs */}
                <SocialAuthNavTabs />

                {/* Sub-header controls: Region toggle, detect indicator & fallback */}
                <div className="flex flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <SegmentedControl
                            ariaLabel="社交登录分区"
                            value={activeRegion}
                            onChange={(value) => setActiveRegion(value as SocialAuthRegion)}
                            options={REGION_TABS.map((tab) => ({
                                value: tab.value,
                                label: `${tab.label} (${tab.value === "cn" ? cnProviders.length : intlProviders.length})`,
                            }))}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="flex items-center gap-1.5 text-[var(--admin-text-secondary)]" title={`来访 IP 来源请求头：${data.ipSourceHeader || "未知"}`}>
                            <code>{data.clientIp || "未知 IP"}</code>
                            <AdminStatusBadge
                                label={data.detectedRegion === "cn" ? "来访：中国大陆" : "来访：海外/港澳台"}
                                tone={data.detectedRegion === "cn" ? "info" : "neutral"}
                            />
                        </span>
                        <div className="flex items-center gap-1.5 border-l border-[var(--admin-border)] pl-3">
                            <span className="text-[var(--admin-text-muted)]">未知 IP 回退:</span>
                            <Select
                                size="sm"
                                ariaLabel="未知或异常 IP 的默认回退分区"
                                value={data.defaultFallbackRegion || "cn"}
                                onChange={(value) => void handleFallbackRegionChange(value as SocialAuthRegion)}
                                options={FALLBACK_OPTIONS}
                            />
                        </div>
                        <IconButton
                            icon={RefreshCw}
                            loading={refreshing}
                            title="刷新配置状态"
                            aria-label="刷新配置状态"
                            onClick={() => void loadSettings(false)}
                        />
                    </div>
                </div>

                {/* 4-column Setting Table conforming to ADMIN_UI_DESIGN_SYSTEM.md */}
                <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                    {/* Table Header */}
                    <div className="flex items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-4 py-2 text-xs font-medium text-[var(--admin-text-secondary)]">
                        <div className="w-[180px] shrink-0">渠道平台</div>
                        <div className="w-[220px] shrink-0">凭证状态与标识</div>
                        <div className="flex-1 min-w-[200px] px-2">授权回调地址 (Redirect URI)</div>
                        <div className="w-[160px] shrink-0 text-right">操作与启用</div>
                    </div>

                    {/* Table Rows */}
                    <div className="divide-y divide-[var(--admin-border)]">
                        {activeProviders.length === 0 ? (
                            <div className="py-8 text-center text-xs text-[var(--admin-text-muted)]">
                                当前分区无可用第三方登录渠道
                            </div>
                        ) : (
                            activeProviders.map((provider) => {
                                const labels = credentialKeyLabels(provider.id);
                                const maskedId = maskedClientIdOf(provider);
                                const status = statusBadgeOf(provider);
                                const probe = probeBadgeOf(testResults[provider.id]);
                                const isCopied = copiedProviderId === provider.id;
                                const isToggling = togglingProviderId === provider.id;
                                const canToggle = provider.hasCredentials && (provider.status === "ready" || provider.status === "online");

                                return (
                                    <div
                                        key={provider.id}
                                        className={cn(
                                            "flex flex-col sm:flex-row sm:items-center px-4 py-3 text-xs transition-colors hover:bg-[var(--admin-row-hover)]",
                                            !provider.enabled && "opacity-85"
                                        )}
                                    >
                                        {/* Col 1: Provider icon + name + ID badge (180px) */}
                                        <div className="flex w-[180px] shrink-0 items-center gap-2.5">
                                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--admin-surface-2)]">
                                                <SocialProviderIcon provider={provider.id} className="size-4" />
                                            </span>
                                            <div className="min-w-0 flex flex-col">
                                                <div className="flex items-center gap-1.5">
                                                    <strong className="truncate font-semibold text-[var(--admin-text)]">
                                                        {provider.name}
                                                    </strong>
                                                </div>
                                                <span className="text-[11px] text-[var(--admin-text-muted)] truncate">
                                                    {provider.platform || provider.id}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Col 2: Masked ID + Status badge (Online / Ready / Unconfigured) (220px) */}
                                        <div className="flex w-[220px] shrink-0 items-center gap-2">
                                            <AdminStatusBadge label={status.label} tone={status.tone} title={provider.statusMessage} />
                                            <span className="min-w-0 truncate font-mono text-[11px] text-[var(--admin-text-secondary)]" title={`${labels.id}: ${maskedId || "未录入"}`}>
                                                {maskedId || "未录入凭证"}
                                            </span>
                                        </div>

                                        {/* Col 3: Callback URI + Copy button + Doc link (flex-1) */}
                                        <div className="flex min-w-[200px] flex-1 items-center gap-2 px-2 my-1 sm:my-0">
                                            <code className="truncate max-w-[340px] rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-text-secondary)] select-all" title={provider.callbackUrl}>
                                                {provider.callbackUrl}
                                            </code>
                                            <IconButton
                                                icon={isCopied ? Check : Copy}
                                                title={isCopied ? "已复制回调地址" : "复制回调地址"}
                                                aria-label={`复制 ${provider.name} 回调地址`}
                                                onClick={() => handleCopy(provider.callbackUrl, `${provider.name} 回调地址`, provider.id)}
                                            />
                                            {provider.docUrl ? (
                                                <a
                                                    className="inline-flex size-6 items-center justify-center rounded text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:bg-[var(--admin-surface-2)]"
                                                    href={provider.docUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="打开三方开放平台文档"
                                                    aria-label={`打开 ${provider.name} 开发者后台`}
                                                >
                                                    <ExternalLink className="size-3" aria-hidden="true" />
                                                </a>
                                            ) : null}
                                            {probe ? (
                                                <AdminStatusBadge label={probe.label} tone={probe.tone} title={probe.detail} />
                                            ) : null}
                                        </div>

                                        {/* Col 4: [配置密钥] + [🔄 probe] + inline instant Switch (160px, right-aligned) */}
                                        <div className="flex w-[160px] shrink-0 items-center justify-end gap-2">
                                            <Button
                                                size="small"
                                                icon={<KeyRound className="size-3" />}
                                                className="text-xs"
                                                onClick={() => handleOpenCredentialModal(provider)}
                                            >
                                                配置密钥
                                            </Button>
                                            <IconButton
                                                icon={RefreshCw}
                                                loading={testingProvider === provider.id}
                                                title="测试连通性"
                                                aria-label={`测试 ${provider.name} 连通性`}
                                                onClick={() => void handlePing(provider)}
                                            />
                                            <Tooltip title={!canToggle ? "请先配置密钥后再开启" : provider.enabled ? "点击即时停用" : "点击即时启用"}>
                                                <div className="inline-flex items-center">
                                                    <Switch
                                                        size="sm"
                                                        checked={provider.enabled}
                                                        loading={isToggling}
                                                        disabled={!canToggle || isToggling}
                                                        onChange={(checked) => void handleToggleEnable(provider, checked)}
                                                        aria-label={`${provider.name} 登录即时开关`}
                                                    />
                                                </div>
                                            </Tooltip>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Credential Modal */}
                {credentialProvider && modalDraft ? (
                    <ProviderCredentialModal
                        provider={credentialProvider}
                        draft={modalDraft}
                        onDraftChange={(patch) => setModalDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
                        onClose={() => {
                            setCredentialProviderId(null);
                            setModalDraft(null);
                        }}
                        onSaved={handleCredentialSaved}
                        onCopy={handleCopy}
                    />
                ) : null}
            </div>
        </AdminPageFrame>
    );
}
