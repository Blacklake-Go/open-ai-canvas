import { useEffect, useState } from "react";
import { App, Button, Skeleton } from "antd";
import { AlertCircle, ArrowRightLeft, CheckCircle2, Link2, ShieldAlert, ShieldCheck, Unlink } from "lucide-react";
import { buildSocialAuthBindUrl, getPublicSocialAuthProviders, getUserSocialIdentities, unbindSocialIdentity } from "../api";
import { SocialProviderIcon } from "./social-provider-icons";
import type { SocialAuthProviderPublic, UserIdentitiesView, UserIdentityItem } from "../types";
import { useI18n } from "@/supdance/plugins/i18n";

export function SocialAccountBindings({ onNavigateSecurity }: { onNavigateSecurity?: () => void }) {
    const { message, modal } = App.useApp();
    const { t } = useI18n();
    const [loading, setLoading] = useState(true);
    const [identitiesView, setIdentitiesView] = useState<UserIdentitiesView>({
        hasPassword: true,
        identities: [],
        count: 0,
    });
    const [providers, setProviders] = useState<SocialAuthProviderPublic[]>([]);
    const [unbindingId, setUnbindingId] = useState<string | null>(null);

    const loadData = async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            const [identRes, provRes] = await Promise.all([getUserSocialIdentities(signal), getPublicSocialAuthProviders(undefined, signal)]);
            setIdentitiesView(identRes);
            setProviders(provRes.providers || []);
        } catch (err) {
            console.error("加载第三方绑定信息失败", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        void loadData(controller.signal);
        return () => controller.abort();
    }, []);

    // Helper map of bound identities by provider
    const boundMap = new Map<string, UserIdentityItem>();
    if (identitiesView?.identities) {
        for (const item of identitiesView.identities) {
            if (item.bound) {
                boundMap.set(item.provider.toLowerCase(), item);
            }
        }
    }

    const handleBind = (providerId: string) => {
        const returnTarget = `${window.location.pathname}?open_settings=social&bind_provider=${encodeURIComponent(providerId)}`;
        const bindUrl = buildSocialAuthBindUrl(providerId, returnTarget);
        window.location.href = bindUrl;
    };

    // Handle redirect returns from OAuth callback
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const bindSuccess = params.get("bind_success");
        const bindError = params.get("bind_error") || params.get("oauth_error");
        if (bindSuccess) {
            const providerMeta = providers.find((p) => p.id.toLowerCase() === bindSuccess.toLowerCase());
            const providerName = providerMeta?.name || bindSuccess.toUpperCase();
            message.success(t("settings.social.bind_success", { name: providerName }, `成功绑定 ${providerName} 账号！`));
            const url = new URL(window.location.href);
            url.searchParams.delete("bind_success");
            url.searchParams.delete("bind_provider");
            url.searchParams.delete("open_settings");
            const nextQuery = url.searchParams.toString();
            window.history.replaceState({}, "", url.pathname + (nextQuery ? `?${nextQuery}` : "") + url.hash);
            void loadData();
        } else if (bindError) {
            message.error(bindError);
            const url = new URL(window.location.href);
            url.searchParams.delete("bind_error");
            url.searchParams.delete("oauth_error");
            url.searchParams.delete("bind_provider");
            url.searchParams.delete("open_settings");
            const nextQuery = url.searchParams.toString();
            window.history.replaceState({}, "", url.pathname + (nextQuery ? `?${nextQuery}` : "") + url.hash);
        }
    }, [providers, t, message]);

    const handleUnbind = (provider: SocialAuthProviderPublic, identity: UserIdentityItem) => {
        // Anti-orphan guard: check if user has password or multiple identities
        if (!identitiesView.hasPassword && boundMap.size <= 1) {
            modal.confirm({
                title: t("settings.social.unbind_forbidden_title", {}, "无法解除绑定"),
                icon: <ShieldAlert className="size-5 text-amber-400" />,
                content: (
                    <div className="py-2 text-xs leading-relaxed text-foreground/80">
                        <p className="mb-2">
                            {t("settings.social.unbind_forbidden_content", { name: provider.name }, `您当前尚未设置独立登录密码，且仅绑定了 ${provider.name} 这一种登录方式。若现在解除绑定，您将失去进入此账号的唯一凭证，导致账号无法再次登录。`)}
                        </p>
                    </div>
                ),
                okText: t("settings.social.go_to_security", {}, "前往设置登录密码"),
                cancelText: t("common.cancel", {}, "取消"),
                centered: true,
                onOk: () => {
                    if (onNavigateSecurity) {
                        onNavigateSecurity();
                    }
                },
            });
            return;
        }

        modal.confirm({
            title: t("settings.social.unbind_confirm_title", { name: provider.name }, `解除 ${provider.name} 绑定`),
            icon: <Unlink className="size-5 text-rose-400" />,
            content: (
                <div className="py-2 text-xs leading-relaxed text-foreground/80">
                    <p>
                        确定要解除与当前账号绑定的 <strong>{identity.providerUsername || provider.name}</strong> 吗？
                    </p>
                    <p className="mt-1 text-foreground/50">解绑后，您将无法再使用该 {provider.name} 账号直接一键登录。</p>
                </div>
            ),
            okText: t("settings.social.unbind_action", {}, "解绑"),
            okType: "danger",
            cancelText: t("common.cancel", {}, "取消"),
            centered: true,
            onOk: async () => {
                try {
                    setUnbindingId(provider.id);
                    const updated = await unbindSocialIdentity(provider.id);
                    if (updated && Array.isArray(updated.identities)) {
                        setIdentitiesView(updated);
                    } else {
                        await loadData();
                    }
                    message.success(t("settings.social.unbind_success", { name: provider.name }, `已成功解除与 ${provider.name} 的绑定`));
                } catch (err) {
                    message.error(err instanceof Error ? err.message : t("settings.social.unbind_failed", {}, "解绑失败，请稍后重试"));
                } finally {
                    setUnbindingId(null);
                }
            },
        });
    };

    if (loading) {
        return (
            <div className="space-y-3 py-2">
                <Skeleton active paragraph={{ rows: 4 }} />
            </div>
        );
    }

    const renderAccountIdentifier = (providerId: string, boundItem: UserIdentityItem) => {
        const rawVal = boundItem.providerUsername || boundItem.subject || "";
        if (providerId.toLowerCase() === "qq") {
            const isHex = /^[0-9a-fA-F]{16,64}$/.test(rawVal);
            const displayVal = isHex ? `QQ 创作者 (${rawVal.slice(-4)})` : rawVal;
            return (
                <span title={t("settings.social.qq_privacy_note", {}, "根据 QQ 互联官方规范，为保护隐私不提供明文 QQ 号与邮箱，以授权昵称与主标识作为账号凭据。")}>
                    {t("settings.social.qq_account_label", {}, "QQ 账号标识")}: <strong className="text-foreground/90 font-medium">{displayVal}</strong>
                </span>
            );
        }
        return (
            <span>
                {t("settings.social.account_label", {}, "账号")}: <strong className="text-foreground/90 font-medium">{rawVal}</strong>
            </span>
        );
    };

    return (
        <div className="space-y-4">
            {/* Header explanation banner */}
            <div className="rounded-xl border border-border bg-surface-subtle p-4 text-xs">
                <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-4 text-primary shrink-0" />
                    <div className="space-y-1">
                        <div className="font-medium text-foreground">{t("settings.social.banner_title", {}, "多渠道统一入站与安全凭证")}</div>
                        <p className="text-foreground/60 leading-relaxed">{t("settings.social.banner_desc", {}, "绑定第三方平台后，即可使用对应账号一键免密登录 SupDance。若第三方授权包含邮箱，系统已自动同步为绑定邮箱。")}</p>
                        {!identitiesView.hasPassword && (
                            <p className="flex items-center gap-1 text-amber-400">
                                <AlertCircle className="size-3.5" />
                                {t("settings.social.no_password_tip", {}, "提示：您尚未设置独立密码，建议前往【密码与安全】设置密码以保障多渠道访问。")}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Provider List */}
            <div className="grid gap-2.5">
                {providers.map((provider) => {
                    const bound = boundMap.get(provider.id.toLowerCase());
                    const isUnbinding = unbindingId === provider.id;

                    return (
                        <div key={provider.id} className={`flex items-center justify-between gap-4 rounded-xl border p-3.5 transition-colors ${bound ? "border-primary/30 bg-primary/[0.03]" : "border-border bg-surface-subtle/50 hover:border-border"}`}>
                            {/* Provider info & status */}
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
                                    <SocialProviderIcon provider={provider.id} className="size-6" />
                                </div>

                                <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-foreground">{provider.name}</span>
                                        {bound ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                                <span className="size-1.5 rounded-full bg-primary" />
                                                {t("settings.social.bound", {}, "已绑定")}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-xs text-foreground/50">
                                                <span className="size-1.5 rounded-full bg-foreground/30" />
                                                {t("settings.social.unbound", {}, "未绑定")}
                                            </span>
                                        )}
                                    </div>

                                    <div className="truncate text-xs text-foreground/50">
                                        {bound ? (
                                            <span>
                                                {renderAccountIdentifier(provider.id, bound)}
                                                {bound.boundAt && <span className="ml-2 text-xs text-foreground/40">({new Date(bound.boundAt).toLocaleDateString()})</span>}
                                            </span>
                                        ) : (
                                            <span>{t("settings.social.bind_to_login", {}, "绑定后可直接一键登录")}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                                {bound ? (
                                    <>
                                        <Button
                                            size="small"
                                            icon={<ArrowRightLeft className="size-3.5" />}
                                            onClick={() => handleBind(provider.id)}
                                            className="h-8 rounded-lg border-border bg-surface-raised text-xs text-foreground/80 hover:!border-border hover:!text-foreground active:scale-[0.98]"
                                        >
                                            {t("settings.social.rebind_action", {}, "换绑")}
                                        </Button>
                                        <Button size="small" danger loading={isUnbinding} icon={<Unlink className="size-3.5" />} onClick={() => handleUnbind(provider, bound)} className="h-8 rounded-lg text-xs active:scale-[0.98]">
                                            {t("settings.social.unbind_action", {}, "解绑")}
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        size="small"
                                        type="primary"
                                        icon={<Link2 className="size-3.5" />}
                                        onClick={() => handleBind(provider.id)}
                                        className="h-8 rounded-lg !bg-primary font-medium !text-primary-foreground hover:opacity-90 active:scale-[0.98] border-none shadow-sm"
                                    >
                                        {t("settings.social.bind_action", {}, "立即绑定")}
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
