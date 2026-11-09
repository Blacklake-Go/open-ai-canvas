import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router";
import { App, Button, Skeleton } from "antd";
import { AlertCircle, ArrowRightLeft, Link2, ShieldCheck, Unlink } from "lucide-react";
import { buildSocialAuthBindUrl, buildSocialAuthReauthUrl, getPublicSocialAuthProviders, getUserSocialIdentities, unbindSocialIdentity } from "../api";
import { SocialProviderIcon } from "./social-provider-icons";
import type { UserIdentityItem } from "../types";
import { useI18n } from "@/supdance/plugins/i18n";
import { useUserStore } from "@/stores/use-user-store";

export function SocialAccountBindings({ returnToModal = false }: { returnToModal?: boolean }) {
    const { message, modal } = App.useApp();
    const { t } = useI18n();
    const location = useLocation();
    const navigate = useNavigate();
    const userId = useUserStore((state) => state.user?.id);
    const queryClient = useQueryClient();
    const identitiesKey = ["social-identities", userId];
    const identities = useQuery({ queryKey: identitiesKey, queryFn: ({ signal }) => getUserSocialIdentities(signal), retry: false });
    const publicProviders = useQuery({ queryKey: ["social-auth-providers"], queryFn: ({ signal }) => getPublicSocialAuthProviders(undefined, signal), retry: false });
    const [unbindingId, setUnbindingId] = useState<string | null>(null);
    const handledResult = useRef("");

    const boundMap = new Map(identities.data?.identities.filter((item) => item.bound).map((item) => [item.provider, item]));
    const providers = (publicProviders.data?.providers ?? []).map(({ id, name }) => ({ id, name, available: true }));
    for (const [id, identity] of boundMap) {
        if (!providers.some((provider) => provider.id === id)) {
            providers.push({ id, name: identity.providerName, available: identity.available });
        }
    }

    const handleBind = (providerId: string) => {
        const params = new URLSearchParams(location.search);
        if (returnToModal) params.set("open_settings", "social");
        else params.delete("open_settings");
        const query = params.toString();
        const next = location.pathname + (query ? `?${query}` : "") + location.hash;
        window.location.assign(buildSocialAuthBindUrl(providerId, next));
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (returnToModal !== (params.get("open_settings") === "social")) return;
        const bindSuccess = params.get("bind_success");
        const bindError = params.has("bind_error");
        if (!bindSuccess && !bindError) {
            handledResult.current = "";
            return;
        }
        if (handledResult.current === location.search || (!bindError && (!identities.isFetchedAfterMount || !identities.isSuccess || identities.isFetching))) return;
        handledResult.current = location.search;
        const confirmed = identities.data?.identities.find((item) => item.provider === bindSuccess && item.bound);
        if (confirmed && !bindError) {
            message.success(t("settings.social.bind_success", { name: confirmed.providerName }));
        } else {
            message.error(t("settings.social.bind_failed", undefined, "绑定未完成，请确认登录的是发起绑定的账号，并重新授权。"));
        }
        for (const key of ["bind_success", "bind_error", "bind_provider", "open_settings"]) params.delete(key);
        navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash }, { replace: true, state: location.state });
    }, [identities.data, identities.isFetchedAfterMount, identities.isFetching, identities.isSuccess, location, message, navigate, returnToModal, t]);

    const handleUnbind = (provider: { id: string; name: string }, identity: UserIdentityItem) => {
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
                    await unbindSocialIdentity(provider.id);
                    await queryClient.invalidateQueries({ queryKey: identitiesKey });
                    message.success(t("settings.social.unbind_success", { name: provider.name }, `已成功解除与 ${provider.name} 的绑定`));
                } catch (err) {
                    message.error(err instanceof Error ? err.message : t("settings.social.unbind_failed", {}, "解绑失败，请稍后重试"));
                } finally {
                    setUnbindingId(null);
                }
            },
        });
    };

    if (identities.isPending || publicProviders.isPending) {
        return (
            <div className="space-y-3 py-2">
                <Skeleton active paragraph={{ rows: 4 }} />
            </div>
        );
    }
    if (identities.isError || publicProviders.isError) {
        const error = identities.error || publicProviders.error;
        return (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 py-2">
                <p className="text-sm text-foreground/80">{error?.message}</p>
                <Button onClick={() => void Promise.all([identities.refetch(), publicProviders.refetch()])}>{t("common.retry")}</Button>
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
                        {!identities.data?.hasPassword && (
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
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                {bound ? (
                                    <>
                                        {!identities.data?.hasPassword && provider.available && (
                                            <Button className="min-h-11" onClick={() => window.location.assign(buildSocialAuthReauthUrl(provider.id))}>
                                                {t("settings.reverify")}
                                            </Button>
                                        )}
                                        <Button
                                            size="small"
                                            icon={<ArrowRightLeft className="size-3.5" />}
                                            onClick={() => handleBind(provider.id)}
                                            disabled={!provider.available}
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
