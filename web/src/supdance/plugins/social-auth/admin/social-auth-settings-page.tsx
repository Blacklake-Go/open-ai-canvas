import { useEffect, useMemo, useState } from "react";
import { App, Button, Skeleton } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, ExternalLink, KeyRound, RefreshCw, RotateCcw, Save } from "lucide-react";

import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/base/select";
import { AdminPageFrame } from "@/pages/admin/components/admin-shell";
import { AdminStatusBadge } from "@/pages/admin/components/admin-ui";
import { IconButton, SegmentedControl, Switch } from "@/pages/admin/ui/controls";
import { useI18n } from "@/supdance/plugins/i18n";
import { getAdminSocialAuthSettings, testSocialAuthProvider, updateAdminSocialAuthSettings } from "../api";
import { SocialProviderIcon } from "../components/social-provider-icons";
import type { AdminSettingsView, ProviderTestResult, ProviderUpdateInput, SocialAuthProviderAdmin, SocialAuthRegion } from "../types";
import { credentialKeyLabels, draftFromProvider, isMaskedPreview, probeBadgeOf, statusBadgeOf, type ProviderDraftState } from "./credential-helpers";
import { ProviderCredentialModal } from "./provider-credential-modal";

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
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState<AdminSettingsView | null>(null);
    const [loadError, setLoadError] = useState("");

    const [activeRegion, setActiveRegion] = useState<SocialAuthRegion>("cn");
    const [draftFallbackRegion, setDraftFallbackRegion] = useState<SocialAuthRegion>("cn");
    const [providerDrafts, setProviderDrafts] = useState<Record<string, ProviderDraftState>>({});
    const [credentialProviderId, setCredentialProviderId] = useState<string | null>(null);

    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});
    const [copiedProviderId, setCopiedProviderId] = useState<string | null>(null);

    const allProviders = useMemo(() => (data ? [...(data.mainlandProviders || []), ...(data.intlProviders || [])] : []), [data]);

    const initDraftsFromData = (settings: AdminSettingsView) => {
        setDraftFallbackRegion(settings.defaultFallbackRegion || "cn");
        const drafts: Record<string, ProviderDraftState> = {};
        const all = [...(settings.mainlandProviders || []), ...(settings.intlProviders || []), ...(settings.providers ? Object.values(settings.providers) : [])];
        for (const p of all) drafts[p.id] = draftFromProvider(p);
        setProviderDrafts(drafts);
    };

    const loadSettings = async (isInitial = false) => {
        if (isInitial) setLoading(true);
        else setRefreshing(true);
        setLoadError("");
        try {
            const res = await getAdminSocialAuthSettings();
            setData(res);
            initDraftsFromData(res);
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

    // 凭证与沙盒开关在弹窗内即时落库，页面草稿只剩"前台展示 + 回退分区"。
    const isDirty = useMemo(() => {
        if (!data) return false;
        if (draftFallbackRegion !== (data.defaultFallbackRegion || "cn")) return true;
        for (const p of allProviders) {
            const draft = providerDrafts[p.id];
            if (draft && draft.enabled !== p.enabled) return true;
        }
        return false;
    }, [allProviders, data, draftFallbackRegion, providerDrafts]);

    const patchDraft = (providerId: string, patch: Partial<ProviderDraftState>) => {
        setProviderDrafts((prev) => ({ ...prev, [providerId]: { ...prev[providerId], ...patch } }));
    };

    const invalidatePublicProviders = () => {
        void queryClient.invalidateQueries({ queryKey: ["public-social-auth-providers"] });
        void queryClient.invalidateQueries({ queryKey: ["social-auth"] });
    };

    const handleResetDraft = () => {
        if (!data) return;
        initDraftsFromData(data);
        message.info(t("admin.social_auth.reset_reverted", undefined, "已撤销当前未保存的调整"));
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
            const isSuccess = res.status === "ok" || res.status === "online";
            const latency = res.pingLatencyMs ?? res.latencyMs ?? 0;
            if (isSuccess) {
                message.success(`${provider.name} 连通性测试通过 (${latency}ms)`);
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

    const handleSubmitSave = async () => {
        if (!data) return;
        setSaving(true);
        try {
            const providersPayload: Record<string, ProviderUpdateInput> = {};
            for (const p of allProviders) {
                const draft = providerDrafts[p.id];
                if (!draft) continue;
                const clientId = draft.clientId.trim();
                const clientSecret = draft.clientSecret.trim();
                const update: ProviderUpdateInput = {
                    enabled: draft.enabled,
                    sandboxMockEnabled: draft.sandboxMockEnabled,
                    customRedirectUrl: draft.customRedirectUrl.trim(),
                };
                if (clientId && !isMaskedPreview(clientId)) update.clientId = clientId;
                if (clientSecret && !isMaskedPreview(clientSecret)) update.clientSecret = clientSecret;
                providersPayload[p.id] = update;
            }

            const res = await updateAdminSocialAuthSettings({
                defaultFallbackRegion: draftFallbackRegion,
                providers: providersPayload,
            });

            setData(res);
            initDraftsFromData(res);
            invalidatePublicProviders();
            message.success(t("admin.social_auth.save_success", undefined, "社交登录配置已保存并即时生效"));
        } catch (err) {
            message.error(err instanceof Error ? err.message : "保存配置失败");
        } finally {
            setSaving(false);
        }
    };

    // 弹窗只提交单个渠道，回包也只同步这一个渠道，避免覆盖其他未保存的草稿。
    const handleCredentialSaved = ({ view, providerId, credentialsWritten }: { view: AdminSettingsView; providerId: string; credentialsWritten: boolean }) => {
        setData(view);
        const saved = [...(view.mainlandProviders || []), ...(view.intlProviders || [])].find((p) => p.id === providerId) || view.providers?.[providerId];
        if (saved) setProviderDrafts((prev) => ({ ...prev, [providerId]: draftFromProvider(saved) }));
        setCredentialProviderId(null);
        invalidatePublicProviders();
        if (credentialsWritten && saved) void handlePing(saved);
    };

    const renderProviderCard = (provider: SocialAuthProviderAdmin) => {
        const draft = providerDrafts[provider.id] || draftFromProvider(provider);
        const labels = credentialKeyLabels(provider.id);
        const maskedId = provider.clientIdMasked || provider.maskedClientId || "";
        const maskedSecret = provider.clientSecretMasked || provider.maskedSecret || "";
        const status = statusBadgeOf(provider);
        const probe = probeBadgeOf(testResults[provider.id]);
        const isCopied = copiedProviderId === provider.id;

        return (
            <section key={provider.id} className={cn("admin-social-provider-card", !draft.enabled && "is-hidden")}>
                <header className="admin-social-provider-card-head">
                    <span className="admin-social-provider-icon">
                        <SocialProviderIcon provider={provider.id} className="size-5" />
                    </span>
                    <div className="admin-social-provider-card-names">
                        <strong title={provider.name}>{provider.name}</strong>
                        <span title={provider.platform}>{provider.platform || provider.id}</span>
                    </div>
                    <AdminStatusBadge label={status.label} tone={status.tone} title={provider.statusMessage} />
                </header>

                <div className="admin-social-provider-uri">
                    <code title={provider.callbackUrl}>{provider.callbackUrl}</code>
                    <IconButton icon={isCopied ? Check : Copy} title={isCopied ? "已复制回调地址" : "复制回调地址"} aria-label={`复制 ${provider.name} 回调地址`} onClick={() => handleCopy(provider.callbackUrl, `${provider.name} 回调地址`, provider.id)} />
                    {provider.docUrl ? (
                        <a className="admin-social-provider-uri-link" href={provider.docUrl} target="_blank" rel="noreferrer" title="打开凭证申请平台" aria-label={`打开 ${provider.name} 凭证申请平台`}>
                            <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                    ) : null}
                </div>

                <div className="admin-social-provider-keys">
                    <span className="admin-social-provider-key">
                        <em>{labels.id}</em>
                        <code className={maskedId ? "is-set" : "is-missing"}>{maskedId || "未配置"}</code>
                    </span>
                    <span className="admin-social-provider-key">
                        <em>{labels.secret}</em>
                        <code className={maskedSecret ? "is-set" : "is-missing"}>{maskedSecret || "未配置"}</code>
                    </span>
                </div>

                <footer className="admin-social-provider-card-foot">
                    <div className="admin-social-provider-display">
                        <Switch size="sm" checked={draft.enabled} onChange={(checked) => patchDraft(provider.id, { enabled: checked })} aria-label={`前台展示 ${provider.name}`} />
                        <span>前台展示</span>
                        {draft.sandboxMockEnabled ? <AdminStatusBadge label="沙盒 Mock" tone="info" title="该渠道正在使用模拟授权，未接入真实三方登录" /> : null}
                    </div>
                    <div className="admin-social-provider-card-actions">
                        {probe ? <AdminStatusBadge label={probe.label} tone={probe.tone} title={probe.detail} /> : null}
                        <IconButton icon={RefreshCw} loading={testingProvider === provider.id} title="连通性测试" aria-label={`测试 ${provider.name} 连通性`} onClick={() => void handlePing(provider)} />
                        <Button size="small" icon={<KeyRound className="size-3.5" />} onClick={() => setCredentialProviderId(provider.id)}>
                            配置密钥 / 轮换
                        </Button>
                    </div>
                </footer>
            </section>
        );
    };

    if (loading && !data) {
        return (
            <AdminPageFrame title="第三方登录配置" description="全站统一 8 大主流平台登录、IP 智能分区策略与沙盒联调测试" scroll>
                <div data-plugin-scope="social-auth" className="admin-settings-stack admin-social-auth-settings" role="status">
                    <div className="admin-social-auth-overview">
                        <Skeleton active title={{ width: 240 }} paragraph={false} />
                    </div>
                    <div className="admin-social-provider-grid">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="admin-social-provider-card">
                                <Skeleton active avatar paragraph={{ rows: 3 }} />
                            </div>
                        ))}
                    </div>
                </div>
            </AdminPageFrame>
        );
    }

    if (!data) {
        return (
            <AdminPageFrame title="第三方登录配置" description="全站统一 8 大主流平台登录、IP 智能分区策略与沙盒联调测试" scroll>
                <div data-plugin-scope="social-auth" className="admin-settings-stack admin-social-auth-settings">
                    <div className="admin-access-load-error" role="alert">
                        <span className="admin-access-load-error-icon">
                            <AlertTriangle className="size-5" aria-hidden="true" />
                        </span>
                        <div>
                            <h2>无法读取社交登录配置</h2>
                            <p>{loadError || "当前没有可显示的配置，请稍后重试。"}</p>
                        </div>
                        <Button icon={<RefreshCw className="size-4" />} onClick={() => void loadSettings(true)}>
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
    const enabledCount = allProviders.filter((p) => providerDrafts[p.id]?.enabled ?? p.enabled).length;
    const activeTabHint = REGION_TABS.find((tab) => tab.value === activeRegion)?.hint || "";

    const credentialProvider = credentialProviderId ? allProviders.find((p) => p.id === credentialProviderId) || null : null;
    const credentialDraft = credentialProvider ? providerDrafts[credentialProvider.id] : undefined;

    return (
        <AdminPageFrame title="第三方登录配置" description="全站统一 8 大主流平台登录、IP 智能分区策略与沙盒联调测试" scroll>
            <div data-plugin-scope="social-auth" className="admin-settings-stack admin-social-auth-settings">
                <div className="admin-social-auth-overview">
                    <div className="admin-social-auth-overview-head">
                        <SegmentedControl
                            ariaLabel="社交登录分区"
                            value={activeRegion}
                            onChange={(value) => setActiveRegion(value as SocialAuthRegion)}
                            options={REGION_TABS.map((tab) => ({
                                value: tab.value,
                                label: `${tab.label} · ${tab.value === "cn" ? cnProviders.length : intlProviders.length}`,
                            }))}
                        />
                        <div className="admin-social-auth-overview-side">
                            <span className="admin-social-auth-detect" title={`来访 IP 来源请求头：${data.ipSourceHeader || "未知"}`}>
                                <code>{data.clientIp || "未知 IP"}</code>
                                <AdminStatusBadge label={data.detectedRegion === "cn" ? "本次访问：中国大陆" : "本次访问：海外及港澳台"} tone={data.detectedRegion === "cn" ? "info" : "neutral"} />
                            </span>
                            <div className="admin-social-auth-fallback">
                                <span>未知 IP 回退</span>
                                <Select size="sm" ariaLabel="未知或异常 IP 的默认回退分区" value={draftFallbackRegion} onChange={(value) => setDraftFallbackRegion(value as SocialAuthRegion)} options={FALLBACK_OPTIONS} />
                            </div>
                            <IconButton icon={RefreshCw} loading={refreshing} title="刷新渠道状态" aria-label="刷新渠道状态" onClick={() => void loadSettings(false)} />
                        </div>
                    </div>
                    <p className="admin-social-auth-hint">
                        分区只认访客的网络 IP，语言、时区与账号资料都不会改变它。<span>{activeTabHint}</span>
                    </p>
                </div>

                <div className="admin-social-provider-grid">{activeProviders.length ? activeProviders.map(renderProviderCard) : <div className="admin-social-provider-empty">该分区当前没有可配置的渠道，请检查插件渠道注册表。</div>}</div>

                <div className={cn("admin-social-auth-save-bar", isDirty && "is-dirty")}>
                    <div className="admin-social-auth-save-copy" aria-live="polite">
                        <strong>{isDirty ? "存在未保存的前台展示变更" : "前台展示与线上一致"}</strong>
                        <span>
                            已启用 {enabledCount} / {allProviders.length} 个渠道 · 凭证与沙盒开关在弹窗内即时保存
                        </span>
                    </div>
                    <div className="admin-social-auth-save-actions">
                        {isDirty ? (
                            <Button icon={<RotateCcw className="size-4" />} disabled={saving} onClick={handleResetDraft}>
                                撤销改动
                            </Button>
                        ) : null}
                        <Button type="primary" icon={<Save className="size-4" />} loading={saving} disabled={!isDirty} onClick={() => void handleSubmitSave()}>
                            保存分区设置
                        </Button>
                    </div>
                </div>

                {credentialProvider && credentialDraft ? (
                    <ProviderCredentialModal
                        provider={credentialProvider}
                        draft={credentialDraft}
                        onDraftChange={(patch) => patchDraft(credentialProvider.id, patch)}
                        onClose={() => setCredentialProviderId(null)}
                        onSaved={handleCredentialSaved}
                        onCopy={handleCopy}
                    />
                ) : null}
            </div>
        </AdminPageFrame>
    );
}
